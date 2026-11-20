from datetime import date
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.core.pagination import StandardResultsSetPagination
from apps.core.permissions import _matches_user
from apps.core.schemas import ApiErrorResponseSerializer, success_envelope
from apps.rent.models import RentCharge
from apps.rent.serializers import RentChargeSerializer
from apps.rent.services import list_user_rent_charges
from apps.rent.services.exceptions import RentError


class RentChargeViewSet(viewsets.GenericViewSet):
    """
    ViewSet for listing and retrieving rent charges across an authorized portfolio.
    Strictly isolated: owners see charges for their properties, tenants for their tenancies.
    """

    queryset = RentCharge.objects.none()
    serializer_class = RentChargeSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    lookup_value_regex = r"[0-9a-f-]{36}"

    def _translate_exception(self, exc):
        from apps.rent.services.exceptions import PaymentPermissionError
        if isinstance(exc, PaymentPermissionError):
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": str(exc)}},
                status=status.HTTP_403_FORBIDDEN,
            )
        raise DRFValidationError({"detail": str(exc)})

    @extend_schema(
        tags=["Rent Charges"],
        summary="List rent charges",
        description="Retrieve all rent charges for properties owned by or leased to the authenticated user.",
        parameters=[
            OpenApiParameter(
                name="tenancy_id",
                type=str,
                description="Optional tenancy UUID filter.",
                required=False,
            ),
            OpenApiParameter(
                name="property_id",
                type=str,
                description="Optional property UUID filter.",
                required=False,
            ),
            OpenApiParameter(
                name="status",
                type=str,
                description="Filter by charge status (e.g. 'unpaid', 'partially_paid', or comma-separated 'unpaid,partially_paid').",
                required=False,
            ),
            OpenApiParameter(
                name="charge_type",
                type=str,
                description="Filter by charge type (e.g. 'rent', 'security_deposit').",
                required=False,
            ),
            OpenApiParameter(
                name="exclude_deposits",
                type=bool,
                description="If true, excludes all security deposit charges.",
                required=False,
            ),
            OpenApiParameter(
                name="due_date_from",
                type=str,
                description="Filter charges due on or after this date (YYYY-MM-DD).",
                required=False,
            ),
            OpenApiParameter(
                name="due_date_to",
                type=str,
                description="Filter charges due on or before this date (YYYY-MM-DD).",
                required=False,
            ),
        ],
        responses={
            200: success_envelope("RentChargeListResponse", RentChargeSerializer(many=True)),
            401: ApiErrorResponseSerializer,
        },
    )
    def list(self, request):
        role = request.query_params.get("role")
        tenancy_id = request.query_params.get("tenancy_id")
        property_id = request.query_params.get("property_id")
        status_param = request.query_params.get("status")
        charge_type = request.query_params.get("charge_type")
        exclude_deposits = request.query_params.get("exclude_deposits")

        # Due date range filters (supporting common aliases)
        due_date_from = (
            request.query_params.get("due_date_from")
            or request.query_params.get("due_date_after")
            or request.query_params.get("due_date__gte")
        )
        due_date_to = (
            request.query_params.get("due_date_to")
            or request.query_params.get("due_date_before")
            or request.query_params.get("due_date__lte")
        )

        try:
            queryset = list_user_rent_charges(user=request.user, role=role)
        except RentError as exc:
            return self._translate_exception(exc)

        if tenancy_id:
            queryset = queryset.filter(tenancy_id=tenancy_id)
        if property_id:
            queryset = queryset.filter(tenancy__property_id=property_id)
        if status_param:
            statuses = [s.strip() for s in status_param.split(",") if s.strip()]
            if len(statuses) == 1:
                queryset = queryset.filter(status=statuses[0])
            else:
                queryset = queryset.filter(status__in=statuses)
        if charge_type:
            types = [t.strip() for t in charge_type.split(",") if t.strip()]
            if len(types) == 1:
                queryset = queryset.filter(charge_type=types[0])
            else:
                queryset = queryset.filter(charge_type__in=types)
        elif exclude_deposits and exclude_deposits.lower() in ("true", "1", "yes"):
            queryset = queryset.exclude(charge_type="security_deposit")
        if due_date_from:
            queryset = queryset.filter(due_date__gte=due_date_from)
        if due_date_to:
            queryset = queryset.filter(due_date__lte=due_date_to)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = RentChargeSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = RentChargeSerializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Rent Charges"],
        summary="Retrieve rent charge details",
        description="Retrieve details of a specific rent charge if authorized.",
        responses={
            200: success_envelope("RentChargeDetailResponse", RentChargeSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    def retrieve(self, request, pk=None):
        try:
            charge = list_user_rent_charges(user=request.user).get(pk=pk)
        except RentCharge.DoesNotExist:
            return Response(
                {"success": False, "error": {"code": "NOT_FOUND", "message": "Rent charge not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_owner = _matches_user(charge.tenancy.property.owner_id, request.user)
        is_tenant = _matches_user(charge.tenancy.tenant_id, request.user)
        is_admin = getattr(request.user, "is_platform_admin", False) or getattr(request.user, "is_staff", False)

        if not (is_owner or is_tenant or is_admin):
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": "You do not have access to this rent charge."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = RentChargeSerializer(charge)
        return Response({
            "success": True,
            "data": serializer.data,
        })

