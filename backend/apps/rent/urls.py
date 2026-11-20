from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.rent.views import (
    FinancialTransactionsView,
    PaymentViewSet,
    RefundViewSet,
    RentChargeViewSet,
    RentSummaryView,
    SecurityDepositsView,
)

app_name = "rent"

router = DefaultRouter()
router.register("payments", PaymentViewSet, basename="payment")
router.register("refunds", RefundViewSet, basename="refund")
router.register("rent-charges", RentChargeViewSet, basename="rent-charge")

urlpatterns = [
    path("rent/summary/", RentSummaryView.as_view(), name="rent-summary"),
    path("rent/security-deposits/", SecurityDepositsView.as_view(), name="security-deposits"),
    path("rent/transactions/", FinancialTransactionsView.as_view(), name="financial-transactions"),
] + router.urls


