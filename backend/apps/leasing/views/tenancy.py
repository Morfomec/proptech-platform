from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsObjectOwner, IsOwner, IsTenant, _matches_user
from apps.core.schemas import (
    ApiErrorResponseSerializer,
    paginated_envelope,
    success_envelope,
)
from apps.leasing.models import Tenancy, TenancyStatus
from apps.leasing.serializers import (
    TenancyActivateSerializer,
    TenancyCreateSerializer,
    TenancyDetailSerializer,
    TenancyEndSerializer,
    TenancyListSerializer,
)
from apps.leasing.services import (
    activate_tenancy,
    cancel_tenancy,
    create_tenancy,
    end_tenancy,
)
from apps.leasing.services.exceptions import (
    TenancyApplicationError,
    TenancyNotFoundError,
    TenancyOverlapError,
    TenancyOwnershipError,
    TenancyStateError,
)
from apps.properties.models import Property


@extend_schema_view(
    retrieve=extend_schema(
        tags=["Tenancies"],
        summary="Retrieve tenancy details",
        responses={
            200: success_envelope("TenancyDetailResponse", TenancyDetailSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
    create=extend_schema(
        tags=["Tenancies"],
        summary="Create a pending tenancy",
        request=TenancyCreateSerializer,
        responses={
            201: success_envelope("TenancyCreateResponse", TenancyDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
)
class TenancyViewSet(viewsets.GenericViewSet):
    """
    Owner tenancy creation and lifecycle management,
    and tenant tenancy viewing.
    """

    queryset = Tenancy.objects.select_related(
        "property",
        "property__owner",
        "tenant",
        "application",
    ).prefetch_related("property__images")

    http_method_names = ["get", "post", "head", "options"]
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_permissions(self):
        if self.action == "create":
            permission_classes = [IsAuthenticated, IsOwner]

        elif self.action == "me":
            permission_classes = [IsAuthenticated, IsTenant]

        elif self.action == "managed":
            permission_classes = [IsAuthenticated, IsOwner]

        elif self.action == "retrieve":
            permission_classes = [IsAuthenticated, IsObjectOwner]

        else:
            permission_classes = [IsAuthenticated, IsOwner]

        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user

        if self.action == "me":
            return self.queryset.filter(tenant=user)

        if self.action in [
            "managed",
            "activate",
            "cancel",
            "end",
        ]:
            return self.queryset.filter(property__owner=user)

        if self.action == "retrieve":
            if getattr(user, "is_platform_admin", False):
                return self.queryset
            return self.queryset.filter(
                Q(tenant=user) | Q(property__owner=user)
            )

        return self.queryset.none()

    def get_serializer_class(self):
        if self.action == "create":
            return TenancyCreateSerializer

        if self.action == "activate":
            return TenancyActivateSerializer

        if self.action == "end":
            return TenancyEndSerializer

        if self.action in ["me", "managed"]:
            return TenancyListSerializer

        return TenancyDetailSerializer

    def _translate_service_exception(self, exc):
        if isinstance(exc, TenancyNotFoundError):
            raise NotFound(str(exc))

        if isinstance(exc, TenancyOwnershipError):
            raise PermissionDenied(str(exc))

        if isinstance(
            exc,
            (
                TenancyStateError,
                TenancyOverlapError,
                TenancyApplicationError,
                DjangoValidationError,
            ),
        ):
            raise ValidationError(
                getattr(exc, "message_dict", None)
                or getattr(exc, "messages", None)
                or str(exc)
            )

        raise exc

    def _list_response(self, queryset):
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "success": True,
            "message": "Tenancies retrieved successfully.",
            "data": serializer.data,
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        User = get_user_model()

        property_instance = Property.objects.filter(pk=data["property_id"]).first()
        if not property_instance:
            raise NotFound("Property not found.")

        # Verify ownership of the property BEFORE resolving tenant or application IDs
        # so non-owners cannot probe whether arbitrary tenant or application UUIDs exist.
        if not _matches_user(property_instance.owner_id, request.user):
            raise PermissionDenied(
                "You do not have permission to manage this property."
            )

        tenant = User.objects.filter(pk=data["tenant_id"]).first()
        if not tenant:
            raise ValidationError({"tenant_id": "Specified tenant user does not exist."})

        try:
            tenancy = create_tenancy(
                owner=request.user,
                property_id=property_instance.pk,
                tenant=tenant,
                application_id=data.get("application_id"),
                start_date=data["start_date"],
                end_date=data.get("end_date"),
                monthly_rent=data["monthly_rent"],
                security_deposit=data.get("security_deposit", Decimal("0.00")),
                rent_due_day=data.get("rent_due_day", 1),
                notes=data.get("notes"),
            )
        except (
            TenancyNotFoundError,
            TenancyOwnershipError,
            TenancyStateError,
            TenancyOverlapError,
            TenancyApplicationError,
            DjangoValidationError,
        ) as exc:
            self._translate_service_exception(exc)

        response_serializer = TenancyDetailSerializer(
            tenancy,
            context=self.get_serializer_context(),
        )

        return Response(
            {
                "success": True,
                "message": "Tenancy created successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["Tenancies"],
        summary="Retrieve tenancies for the authenticated tenant",
        responses={
            200: paginated_envelope("TenancyMeListResponse", TenancyListSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        queryset = self.get_queryset().order_by("-created_at")
        return self._list_response(queryset)

    @extend_schema(
        tags=["Tenancies"],
        summary="Retrieve tenancies managed by the authenticated owner",
        parameters=[
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=TenancyStatus.values,
                description="Filter managed tenancies by status.",
            ),
        ],
        responses={
            200: paginated_envelope("TenancyManagedListResponse", TenancyListSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    @action(detail=False, methods=["get"], url_path="managed")
    def managed(self, request):
        queryset = self.get_queryset()
        status_param = request.query_params.get("status")
        if status_param:
            if status_param not in TenancyStatus.values:
                raise ValidationError({"status": ["Invalid tenancy status filter."]})
            queryset = queryset.filter(status=status_param)
        queryset = queryset.order_by("-created_at")
        return self._list_response(queryset)

    def retrieve(self, request, *args, **kwargs):
        tenancy = self.get_object()
        serializer = TenancyDetailSerializer(
            tenancy,
            context=self.get_serializer_context(),
        )

        return Response({
            "success": True,
            "message": "Tenancy retrieved successfully.",
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Tenancies"],
        summary="Activate a confirmed tenancy (move-in)",
        request=TenancyActivateSerializer,
        responses={
            200: success_envelope("TenancyActivateResponse", TenancyDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, *args, **kwargs):
        tenancy = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            tenancy = activate_tenancy(
                owner=request.user,
                tenancy_id=tenancy.pk,
                move_in_date=serializer.validated_data.get(
                    "move_in_date"
                ),
            )
        except (
            TenancyNotFoundError,
            TenancyOwnershipError,
            TenancyStateError,
            TenancyOverlapError,
            DjangoValidationError,
        ) as exc:
            self._translate_service_exception(exc)

        return Response({
            "success": True,
            "message": "Tenancy activated successfully.",
            "data": TenancyDetailSerializer(
                tenancy,
                context=self.get_serializer_context(),
            ).data,
        })

    @extend_schema(
        tags=["Tenancies"],
        summary="Cancel a pending or confirmed tenancy",
        request=None,
        responses={
            200: success_envelope("TenancyCancelResponse", TenancyDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, *args, **kwargs):
        tenancy = self.get_object()

        try:
            tenancy = cancel_tenancy(
                owner=request.user,
                tenancy_id=tenancy.pk,
            )
        except (
            TenancyNotFoundError,
            TenancyOwnershipError,
            TenancyStateError,
            DjangoValidationError,
        ) as exc:
            self._translate_service_exception(exc)

        return Response({
            "success": True,
            "message": "Tenancy cancelled successfully.",
            "data": TenancyDetailSerializer(
                tenancy,
                context=self.get_serializer_context(),
            ).data,
        })

    @extend_schema(
        tags=["Tenancies"],
        summary="End an active tenancy (move-out)",
        request=TenancyEndSerializer,
        responses={
            200: success_envelope("TenancyEndResponse", TenancyDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["post"], url_path="end")
    def end(self, request, *args, **kwargs):
        tenancy = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            tenancy = end_tenancy(
                owner=request.user,
                tenancy_id=tenancy.pk,
                move_out_date=serializer.validated_data.get(
                    "move_out_date"
                ),
            )
        except (
            TenancyNotFoundError,
            TenancyOwnershipError,
            TenancyStateError,
            DjangoValidationError,
        ) as exc:
            self._translate_service_exception(exc)

        return Response({
            "success": True,
            "message": "Tenancy ended successfully.",
            "data": TenancyDetailSerializer(
                tenancy,
                context=self.get_serializer_context(),
            ).data,
        })
