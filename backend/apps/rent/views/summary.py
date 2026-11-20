from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardResultsSetPagination
from apps.core.schemas import ApiErrorResponseSerializer, success_envelope
from apps.rent.serializers import (
    FinancialTransactionSerializer,
    RentSummarySerializer,
    SecurityDepositItemSerializer,
)
from apps.rent.services import (
    get_owner_rent_summary,
    list_security_deposits,
    list_user_transactions,
)
from apps.rent.services.exceptions import PaymentPermissionError, RentError


class RentSummaryView(APIView):
    """
    View for retrieving portfolio-level financial aggregates.
    Calculates total billed, net collected, outstanding rent, overdue rent,
    and security deposits held strictly for the authenticated user's portfolio.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Rent Summary"],
        summary="Owner financial summary",
        description="Retrieve portfolio-level aggregates for rent, collections, outstanding and overdue balances, and security deposits held.",
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
        ],
        responses={
            200: success_envelope("RentSummaryResponse", RentSummarySerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    def get(self, request):
        tenancy_id = request.query_params.get("tenancy_id")
        property_id = request.query_params.get("property_id")

        try:
            summary_data = get_owner_rent_summary(
                user=request.user,
                tenancy_id=tenancy_id,
                property_id=property_id,
            )
        except PaymentPermissionError as exc:
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": str(exc)}},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response({
            "success": True,
            "data": summary_data,
        })


class SecurityDepositsView(APIView):
    """
    View for retrieving per-tenancy security deposit records across the user's portfolio.
    Shows agreed deposit, deposit received, outstanding deposit, adjustments/deductions,
    refunds, and current deposit held.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Rent Summary"],
        summary="Security deposits breakdown",
        description="Retrieve security deposit details for each tenancy in the portfolio.",
        parameters=[
            OpenApiParameter(
                name="role",
                type=str,
                description="Workspace role ('owner' or 'tenant'). Defaults to 'owner'.",
                required=False,
            ),
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
        ],
        responses={
            200: success_envelope("SecurityDepositListResponse", SecurityDepositItemSerializer(many=True)),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    def get(self, request):
        role = request.query_params.get("role", "owner")
        tenancy_id = request.query_params.get("tenancy_id")
        property_id = request.query_params.get("property_id")

        try:
            deposits = list_security_deposits(
                user=request.user,
                tenancy_id=tenancy_id,
                property_id=property_id,
                role=role,
            )
        except PaymentPermissionError as exc:
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": str(exc)}},
                status=status.HTTP_403_FORBIDDEN,
            )
        except RentError as exc:
            return Response(
                {"success": False, "error": {"code": "BAD_REQUEST", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SecurityDepositItemSerializer(deposits, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        })


class FinancialTransactionsView(APIView):
    """
    View for retrieving a unified chronological stream of financial transactions
    (rent payments, deposit payments, and refunds) across the owner's portfolio.
    """

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Rent Summary"],
        summary="Unified financial transactions",
        description="Retrieve combined payments and refunds in chronological order.",
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
                name="transaction_type",
                type=str,
                description="Filter by type ('all', 'rent_payment', 'deposit_payment', 'refund').",
                required=False,
            ),
        ],
        responses={
            200: success_envelope("FinancialTransactionListResponse", FinancialTransactionSerializer(many=True)),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    )
    def get(self, request):
        tenancy_id = request.query_params.get("tenancy_id")
        property_id = request.query_params.get("property_id")
        transaction_type = request.query_params.get("transaction_type")

        try:
            transactions = list_user_transactions(
                user=request.user,
                role="owner",
                tenancy_id=tenancy_id,
                property_id=property_id,
                transaction_type=transaction_type,
            )
        except PaymentPermissionError as exc:
            return Response(
                {"success": False, "error": {"code": "FORBIDDEN", "message": str(exc)}},
                status=status.HTTP_403_FORBIDDEN,
            )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(transactions, request)
        if page is not None:
            serializer = FinancialTransactionSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = FinancialTransactionSerializer(transactions, many=True)
        return Response({
            "success": True,
            "data": serializer.data,
        })


