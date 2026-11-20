from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.core.pagination import StandardResultsSetPagination
from apps.core.schemas import ApiErrorResponseSerializer, success_envelope
from apps.rent.models import PaymentRefund
from apps.rent.serializers import (
    PaymentRefundSerializer,
    ProcessRefundRequestSerializer,
)
from apps.rent.services import (
    fail_refund,
    get_refund_details,
    list_user_refunds,
    process_refund,
)
from apps.rent.services.exceptions import (
    PaymentPermissionError,
    RefundError,
    RefundPermissionError,
    RefundValidationError,
    RentError,
    TenancyNotFoundError,
)


class RefundViewSet(viewsets.GenericViewSet):
    """
    ViewSet for retrieving and managing individual refund records.
    """

    queryset = PaymentRefund.objects.none()
    serializer_class = PaymentRefundSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    lookup_value_regex = r"[0-9a-f-]{36}"

    def _translate_exception(self, exc):
        if isinstance(exc, (PaymentPermissionError, RefundPermissionError)):
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": str(exc)}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if isinstance(exc, (TenancyNotFoundError, RefundError)) and "not exist" in str(exc).lower():
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
        tags=["Refunds"],
        summary="List user refunds",
        description="Retrieve all refunds for payments belonging to the authenticated user's portfolio.",
        parameters=[
            OpenApiParameter(
                name="payment_id",
                type=str,
                description="Optional payment UUID filter.",
                required=False,
            ),
            OpenApiParameter(
                name="status",
                type=str,
                description="Optional refund status filter (pending, completed, failed).",
                required=False,
            ),
        ],
        responses={
            200: success_envelope("RefundListResponse", PaymentRefundSerializer(many=True)),
            401: ApiErrorResponseSerializer,
        },
    )
    def list(self, request):
        role = request.query_params.get("role")
        payment_id = request.query_params.get("payment_id") or request.query_params.get("payment")
        status_param = request.query_params.get("status")

        try:
            queryset = list_user_refunds(
                user=request.user,
                role=role,
                payment_id=payment_id,
                status=status_param,
            )
        except RentError as exc:
            return self._translate_exception(exc)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = PaymentRefundSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = PaymentRefundSerializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


    @extend_schema(
        tags=["Refunds"],
        summary="Retrieve refund details",
        description="Retrieve details of a specific refund record if authorized.",
        responses={
            200: success_envelope("PaymentRefundDetailResponse", PaymentRefundSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    def retrieve(self, request, pk=None):
        try:
            refund = get_refund_details(user=request.user, refund_id=pk)
        except RentError as exc:
            return self._translate_exception(exc)

        serializer = PaymentRefundSerializer(refund)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Refunds"],
        summary="Process a pending refund",
        description="Execute reversals and complete a pending refund. Owners/admins only.",
        request=ProcessRefundRequestSerializer,
        responses={
            200: success_envelope("PaymentRefundProcessResponse", PaymentRefundSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["post"], url_path="process")
    def process(self, request, pk=None):
        req_serializer = ProcessRefundRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        ref = req_serializer.validated_data.get("refund_reference")

        try:
            refund = process_refund(user=request.user, refund_id=pk, refund_reference=ref)
        except RentError as exc:
            return self._translate_exception(exc)

        serializer = PaymentRefundSerializer(refund)
        return Response({
            "success": True,
            "message": "Refund processed successfully.",
            "data": serializer.data,
        })

    @extend_schema(
        tags=["Refunds"],
        summary="Mark refund as failed",
        description="Mark a pending refund as failed without reversing allocations. Owners/admins only.",
        responses={
            200: success_envelope("PaymentRefundFailResponse", PaymentRefundSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["post"], url_path="fail")
    def fail(self, request, pk=None):
        reason = request.data.get("reason")
        try:
            refund = fail_refund(user=request.user, refund_id=pk, reason=reason)
        except RentError as exc:
            return self._translate_exception(exc)

        serializer = PaymentRefundSerializer(refund)
        return Response({
            "success": True,
            "message": "Refund marked as failed.",
            "data": serializer.data,
        })

