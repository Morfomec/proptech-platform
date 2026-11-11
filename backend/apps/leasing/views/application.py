from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q

from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsObjectOwner, IsOwner, IsTenant
from apps.core.schemas import (
    ApiErrorResponseSerializer,
    paginated_envelope,
    success_envelope,
)
from apps.leasing.models import Application, ApplicationStatus
from apps.leasing.serializers import (
    ApplicationCreateSerializer,
    ApplicationDetailSerializer,
    ApplicationListSerializer,
    ApplicationReviewSerializer,
    ApplicationWithdrawSerializer,
)
from apps.leasing.services import (
    get_applicant_applications,
    get_application_by_id,
    get_received_applications,
    review_application,
    submit_application,
    withdraw_application,
)
from apps.leasing.services.exceptions import (
    ApplicationNotFoundError,
    ApplicationOwnershipError,
    ApplicationStateError,
    DuplicateApplicationError,
    ListingUnavailableError,
)


@extend_schema_view(
    retrieve=extend_schema(
        tags=["Applications"],
        summary="Retrieve an application",
        responses={
            200: success_envelope("ApplicationDetailResponse", ApplicationDetailSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
    create=extend_schema(
        tags=["Applications"],
        summary="Submit a rental application",
        request=ApplicationCreateSerializer,
        responses={
            201: success_envelope("ApplicationCreateResponse", ApplicationDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
)
class ApplicationViewSet(viewsets.GenericViewSet):
    """
    Tenant application submission and tracking,
    and owner application review.
    """

    queryset = Application.objects.all()
    lookup_value_regex = r"[0-9a-f-]{36}"
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action in ["create", "me", "withdraw"]:
            return [IsAuthenticated(), IsTenant()]

        if self.action == "received":
            return [IsAuthenticated(), IsOwner()]

        if self.action == "review":
            return [IsAuthenticated(), IsOwner()]

        if self.action == "retrieve":
            return [IsAuthenticated(), IsObjectOwner()]

        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            Application.objects
            .select_related(
                "listing",
                "listing__property",
                "listing__property__owner",
                "applicant",
                "reviewed_by",
                "tenancy",
            )
            .prefetch_related("status_history")
        )

        if self.action in ["me", "withdraw"]:
            return queryset.filter(applicant=user)

        if self.action in ["received", "review"]:
            return queryset.filter(listing__property__owner=user)

        if self.action == "retrieve":
            if getattr(user, "is_platform_admin", False):
                return queryset
            return queryset.filter(
                Q(applicant=user) | Q(listing__property__owner=user)
            )

        return queryset.none()

    def get_serializer_class(self):
        if self.action == "create":
            return ApplicationCreateSerializer

        if self.action == "review":
            return ApplicationReviewSerializer

        if self.action == "withdraw":
            return ApplicationWithdrawSerializer

        if self.action in ["me", "received"]:
            return ApplicationListSerializer

        return ApplicationDetailSerializer

    def _translate_service_exception(self, exc):
        if isinstance(exc, ApplicationNotFoundError):
            raise NotFound(str(exc))

        if isinstance(exc, ApplicationOwnershipError):
            raise PermissionDenied(
                exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            )

        if isinstance(
            exc,
            (
                ApplicationStateError,
                DuplicateApplicationError,
                ListingUnavailableError,
                DjangoValidationError,
            ),
        ):
            detail = (
                exc.message_dict
                if hasattr(exc, "message_dict")
                else str(exc)
            )
            raise ValidationError(detail)

        raise exc

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            application = submit_application(
                applicant=request.user,
                listing_id=serializer.validated_data["listing_id"],
                message=serializer.validated_data.get("message"),
            )
        except (
            ApplicationNotFoundError,
            ApplicationOwnershipError,
            ApplicationStateError,
            DuplicateApplicationError,
            ListingUnavailableError,
            DjangoValidationError,
        ) as exc:
            self._translate_service_exception(exc)

        response_serializer = ApplicationDetailSerializer(
            application,
            context=self.get_serializer_context(),
        )

        return Response(
            {
                "success": True,
                "message": "Application submitted successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["Applications"],
        summary="Retrieve applications submitted by the tenant",
        responses={
            200: paginated_envelope("ApplicationMeListResponse", ApplicationListSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        try:
            queryset = get_applicant_applications(
                applicant=request.user,
            )
        except ApplicationOwnershipError as exc:
            self._translate_service_exception(exc)

        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ApplicationListSerializer(
                page,
                many=True,
                context=self.get_serializer_context(),
            )
            return self.get_paginated_response(serializer.data)

        serializer = ApplicationListSerializer(
            queryset,
            many=True,
            context=self.get_serializer_context(),
        )

        return Response({
            "success": True,
            "message": "Your applications retrieved successfully.",
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Applications"],
        summary="Retrieve applications received by the owner",
        parameters=[
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter received applications by status (single or comma-separated: submitted, under_review, approved, rejected, withdrawn).",
            ),
        ],
        responses={
            200: paginated_envelope("ApplicationReceivedListResponse", ApplicationListSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["get"], url_path="received")
    def received(self, request):
        try:
            queryset = get_received_applications(owner=request.user)
        except ApplicationOwnershipError as exc:
            self._translate_service_exception(exc)

        status_param = request.query_params.get("status")
        if status_param:
            statuses = [s.strip() for s in status_param.split(",") if s.strip()]
            invalid = [s for s in statuses if s not in ApplicationStatus.values]
            if not statuses or invalid:
                raise ValidationError({"status": ["Invalid application status filter."]})
            queryset = queryset.filter(status__in=statuses)

        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = ApplicationListSerializer(
                page,
                many=True,
                context=self.get_serializer_context(),
            )
            return self.get_paginated_response(serializer.data)

        serializer = ApplicationListSerializer(
            queryset,
            many=True,
            context=self.get_serializer_context(),
        )

        return Response({
            "success": True,
            "message": "Received applications retrieved successfully.",
            "data": serializer.data,
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        serializer = ApplicationDetailSerializer(
            instance,
            context=self.get_serializer_context(),
        )

        return Response({
            "success": True,
            "message": "Application details retrieved successfully.",
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Applications"],
        summary="Review, approve or reject an application",
        request=ApplicationReviewSerializer,
        responses={
            200: success_envelope("ApplicationReviewResponse", ApplicationDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        instance = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            application = review_application(
                owner=request.user,
                application_id=instance.id,
                new_status=serializer.validated_data["status"],
                change_reason=serializer.validated_data.get("change_reason"),
            )
        except (
            ApplicationNotFoundError,
            ApplicationOwnershipError,
            ApplicationStateError,
            DjangoValidationError,
        ) as exc:
            self._translate_service_exception(exc)

        response_serializer = ApplicationDetailSerializer(
            application,
            context=self.get_serializer_context(),
        )

        return Response({
            "success": True,
            "message": "Application status updated successfully.",
            "data": response_serializer.data,
        })

    @extend_schema(
        tags=["Applications"],
        summary="Withdraw an application",
        request=ApplicationWithdrawSerializer,
        responses={
            200: success_envelope("ApplicationWithdrawResponse", ApplicationDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        instance = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            application = withdraw_application(
                applicant=request.user,
                application_id=instance.id,
                change_reason=serializer.validated_data.get("change_reason"),
            )
        except (
            ApplicationNotFoundError,
            ApplicationOwnershipError,
            ApplicationStateError,
            DjangoValidationError,
        ) as exc:
            self._translate_service_exception(exc)

        response_serializer = ApplicationDetailSerializer(
            application,
            context=self.get_serializer_context(),
        )

        return Response({
            "success": True,
            "message": "Application withdrawn successfully.",
            "data": response_serializer.data,
        })