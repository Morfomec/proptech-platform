from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.core.pagination import StandardResultsSetPagination
from apps.core.schemas import ApiErrorResponseSerializer, success_envelope
from apps.subscriptions.models import (
    Subscription,
    SubscriptionPayment,
    SubscriptionPlan,
)
from apps.subscriptions.serializers import (
    QuotaUtilizationSerializer,
    SubscriptionDetailSerializer,
    SubscriptionPaymentSerializer,
    SubscriptionPlanSerializer,
    UpgradeSubscriptionRequestSerializer,
)
from apps.subscriptions.services import (
    activate_owner_trial,
    cancel_subscription,
    get_owner_subscription,
    get_quota_utilization,
    list_active_plans,
    upgrade_subscription,
)
from apps.subscriptions.services.exceptions import (
    PropertyQuotaExceededError,
    SubscriptionError,
    SubscriptionNotFoundError,
    SubscriptionOwnershipError,
    SubscriptionPlanNotFoundError,
    SubscriptionStateError,
)


@extend_schema_view(
    list=extend_schema(
        tags=["Subscriptions"],
        summary="List active subscription plans",
        description="Publicly retrieve available subscription plan tiers, limits, and pricing.",
        responses={
            200: success_envelope("SubscriptionPlanListResponse", SubscriptionPlanSerializer(many=True)),
        },
    ),
    retrieve=extend_schema(
        tags=["Subscriptions"],
        summary="Retrieve subscription plan details",
        description="Publicly retrieve details, limits, and pricing for a specific subscription plan tier.",
        responses={
            200: success_envelope("SubscriptionPlanDetailResponse", SubscriptionPlanSerializer),
        },
    ),
)
class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """Viewset providing public read access to available subscription plans."""

    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return list_active_plans()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            "success": True,
            "data": serializer.data,
        })


class SubscriptionViewSet(viewsets.GenericViewSet):
    """
    Viewset managing the authenticated owner's subscription,
    quota utilization, plan upgrades, cancellation, and payment logs.
    """

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def _check_owner_access(self, user):
        if not getattr(user, "is_owner", False) and not Subscription.objects.filter(owner=user).exists():
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": "Owner subscription access is restricted to property owners."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def _translate_service_exception(self, exc):
        if isinstance(exc, SubscriptionPlanNotFoundError):
            raise DRFValidationError({"plan": str(exc.message)})
        if isinstance(exc, (SubscriptionStateError, PropertyQuotaExceededError)):
            raise DRFValidationError({"detail": str(exc.message)})
        if isinstance(exc, SubscriptionOwnershipError):
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": str(exc.message)}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if isinstance(exc, SubscriptionNotFoundError):
            return Response(
                {"success": False, "error": {"code": "NOT_FOUND", "message": str(exc.message)}},
                status=status.HTTP_404_NOT_FOUND,
            )
        raise DRFValidationError({"detail": str(exc)})

    @extend_schema(
        tags=["Subscriptions"],
        summary="Activate Starter 90-day trial for owner",
        description="Explicitly activates the 90-day Starter trial and grants owner capability to a verified user.",
        request=None,
        responses={
            200: success_envelope("SubscriptionActivateTrialResponse", SubscriptionDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["post"], url_path="activate-trial")
    def activate_trial(self, request):
        try:
            subscription = activate_owner_trial(user=request.user)
        except DjangoValidationError as exc:
            msg = exc.messages[0] if hasattr(exc, "messages") and exc.messages else str(exc)
            return Response(
                {"success": False, "error": {"code": "VALIDATION_ERROR", "message": msg}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SubscriptionError as exc:
            return self._translate_service_exception(exc)

        serializer = SubscriptionDetailSerializer(subscription, context={"request": request})
        return Response({
            "success": True,
            "message": "Owner trial activated successfully.",
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Subscriptions"],
        summary="Retrieve current owner subscription",
        description="Fetch the authenticated owner's active subscription, trial status, and dates.",
        responses={
            200: success_envelope("OwnerSubscriptionDetailResponse", SubscriptionDetailSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        denied = self._check_owner_access(request.user)
        if denied:
            return denied
        try:
            subscription = get_owner_subscription(owner=request.user)
        except SubscriptionError as exc:
            return self._translate_service_exception(exc)
        serializer = SubscriptionDetailSerializer(subscription, context={"request": request})
        return Response({
            "success": True,
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Subscriptions"],
        summary="Retrieve owner property quota utilization",
        description="Retrieve total owned properties, plan limits, remaining slots, and entitlement status.",
        responses={
            200: success_envelope("QuotaUtilizationResponse", QuotaUtilizationSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["get"], url_path="quota")
    def quota(self, request):
        denied = self._check_owner_access(request.user)
        if denied:
            return denied
        try:
            utilization = get_quota_utilization(owner=request.user)
        except SubscriptionError as exc:
            return self._translate_service_exception(exc)
        serializer = QuotaUtilizationSerializer(utilization)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Subscriptions"],
        summary="Upgrade subscription plan",
        description="Switch the owner subscription to a new active plan tier.",
        request=UpgradeSubscriptionRequestSerializer,
        responses={
            200: success_envelope("SubscriptionUpgradeResponse", SubscriptionDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["post"], url_path="upgrade")
    def upgrade(self, request):
        denied = self._check_owner_access(request.user)
        if denied:
            return denied
        req_serializer = UpgradeSubscriptionRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        plan_code = req_serializer.validated_data["plan_code"]

        try:
            subscription = upgrade_subscription(
                owner=request.user,
                target_plan_code=plan_code,
            )
        except SubscriptionError as exc:
            return self._translate_service_exception(exc)

        serializer = SubscriptionDetailSerializer(subscription, context={"request": request})
        return Response({
            "success": True,
            "message": "Subscription upgraded successfully.",
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Subscriptions"],
        summary="Cancel subscription",
        description="Cancel the authenticated owner's subscription.",
        request=None,
        responses={
            200: success_envelope("SubscriptionCancelResponse", SubscriptionDetailSerializer),
            401: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["post"], url_path="cancel")
    def cancel(self, request):
        denied = self._check_owner_access(request.user)
        if denied:
            return denied
        try:
            subscription = cancel_subscription(owner=request.user)
        except SubscriptionError as exc:
            return self._translate_service_exception(exc)

        serializer = SubscriptionDetailSerializer(subscription, context={"request": request})
        return Response({
            "success": True,
            "message": "Subscription cancelled successfully.",
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Subscriptions"],
        summary="List subscription payment history",
        description="List billing payment records for the authenticated owner's subscription.",
        responses={
            200: success_envelope("SubscriptionPaymentListResponse", SubscriptionPaymentSerializer(many=True)),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["get"], url_path="payments")
    def payments(self, request):
        denied = self._check_owner_access(request.user)
        if denied:
            return denied
        try:
            subscription = get_owner_subscription(owner=request.user)
        except SubscriptionError as exc:
            return self._translate_service_exception(exc)
        queryset = SubscriptionPayment.objects.filter(
            subscription=subscription
        ).select_related("plan").order_by("-created_at")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = SubscriptionPaymentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = SubscriptionPaymentSerializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        })
