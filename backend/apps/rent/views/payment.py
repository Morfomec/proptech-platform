from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.core.pagination import StandardResultsSetPagination
from apps.core.schemas import ApiErrorResponseSerializer, success_envelope
from apps.rent.models import Payment
from apps.rent.serializers import (
    CreateRefundRequestSerializer,
    PaymentRefundSerializer,
    PaymentSerializer,
    RecordPaymentRequestSerializer,
)
from apps.rent.services import (
    create_refund,
    list_payment_refunds,
    list_tenancy_payments,
    list_user_payments,
    record_payment,
)
from apps.rent.services.exceptions import (
    PaymentPermissionError,
    RefundError,
    RefundPermissionError,
    RefundValidationError,
    RentError,
    TenancyNotFoundError,
)


class PaymentViewSet(viewsets.GenericViewSet):
    """
    ViewSet for recording and viewing payments against tenancies.
    Ensures strict object-level access: owners and tenants can only view/record
    payments for tenancies they belong to.
    """

    queryset = Payment.objects.none()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    lookup_value_regex = r"[0-9a-f-]{36}"

    def _translate_exception(self, exc):
        if isinstance(exc, (PaymentPermissionError, RefundPermissionError)):
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": str(exc)}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if isinstance(exc, TenancyNotFoundError):
            return Response(
                {"success": False, "error": {"code": "NOT_FOUND", "message": str(exc)}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if isinstance(exc, RefundValidationError):
            return Response(
                {"success": False, "error": {"code": "VALIDATION_ERROR", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raise DRFValidationError({"detail": str(exc)})

    @extend_schema(
        tags=["Payments"],
        summary="List user payments",
        description="Retrieve all payments recorded for tenancies owned by or leased to the authenticated user.",
        parameters=[
            OpenApiParameter(
                name="tenancy_id",
                type=str,
                description="Optional tenancy UUID filter.",
                required=False,
            )
        ],
        responses={
            200: success_envelope("PaymentListResponse", PaymentSerializer(many=True)),
            401: ApiErrorResponseSerializer,
        },
    )
    def list(self, request):
        role = request.query_params.get("role")
        tenancy_id = request.query_params.get("tenancy_id")
        try:
            if tenancy_id:
                queryset = list_tenancy_payments(user=request.user, tenancy_id=tenancy_id)
            else:
                queryset = list_user_payments(user=request.user, role=role)
        except RentError as exc:
            return self._translate_exception(exc)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = PaymentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = PaymentSerializer(queryset, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Payments"],
        summary="Record a payment",
        description="Manually record a payment receipt against an authorized tenancy.",
        request=RecordPaymentRequestSerializer,
        responses={
            201: success_envelope("PaymentRecordResponse", PaymentSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    def create(self, request):
        req_serializer = RecordPaymentRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        data = req_serializer.validated_data

        try:
            payment = record_payment(
                user=request.user,
                tenancy_id=data["tenancy_id"],
                amount=data["amount"],
                currency=data.get("currency", "INR"),
                payment_method=data["payment_method"],
                transaction_reference=data.get("transaction_reference"),
                status=data.get("status", "completed"),
                paid_at=data.get("paid_at"),
                notes=data.get("notes"),
                target_charge_type=data.get("target_charge_type", "rent"),
                rent_charge_id=data.get("rent_charge_id"),
            )
        except RentError as exc:
            return self._translate_exception(exc)

        serializer = PaymentSerializer(payment, context={"request": request})
        return Response(
            {
                "success": True,
                "message": "Payment recorded successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["Payments"],
        summary="Retrieve payment details",
        description="Retrieve details of a specific payment record if authorized.",
        responses={
            200: success_envelope("PaymentDetailResponse", PaymentSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    def retrieve(self, request, pk=None):
        try:
            payment = (
                Payment.objects.select_related("tenancy", "tenancy__property", "tenancy__tenant")
                .prefetch_related("allocations", "allocations__rent_charge")
                .get(pk=pk)
            )
        except Payment.DoesNotExist:
            return Response(
                {"success": False, "error": {"code": "NOT_FOUND", "message": "Payment not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        from apps.core.permissions import _matches_user
        is_owner = _matches_user(payment.tenancy.property.owner_id, request.user)
        is_tenant = _matches_user(payment.tenancy.tenant_id, request.user)
        is_admin = getattr(request.user, "is_platform_admin", False) or getattr(request.user, "is_staff", False)

        if not (is_owner or is_tenant or is_admin):
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": "You do not have access to this payment."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PaymentSerializer(payment, context={"request": request})
        return Response({
            "success": True,
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Payments"],
        summary="Payment refunds",
        description="List refunds for this payment (GET) or request/record a new refund (POST). Owners/admins only for creation.",
        request=CreateRefundRequestSerializer,
        responses={
            200: success_envelope("PaymentRefundListResponse", PaymentRefundSerializer(many=True)),
            201: success_envelope("PaymentRefundCreateResponse", PaymentRefundSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["get", "post"], url_path="refunds")
    def refunds(self, request, pk=None):
        if request.method.lower() == "get":
            try:
                queryset = list_payment_refunds(user=request.user, payment_id=pk)
            except RentError as exc:
                return self._translate_exception(exc)

            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = PaymentRefundSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = PaymentRefundSerializer(queryset, many=True)
            return Response({"success": True, "data": serializer.data})

        # POST
        req_serializer = CreateRefundRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        data = req_serializer.validated_data

        try:
            refund = create_refund(
                user=request.user,
                payment_id=pk,
                amount=data["amount"],
                reason=data["reason"],
                currency=data.get("currency", "INR"),
                refund_reference=data.get("refund_reference"),
                status=data.get("status", "completed"),
            )
        except RentError as exc:
            return self._translate_exception(exc)

        serializer = PaymentRefundSerializer(refund)
        return Response(
            {
                "success": True,
                "message": "Refund processed successfully." if refund.status == "completed" else "Refund request created.",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )
