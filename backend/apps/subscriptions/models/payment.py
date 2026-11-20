from decimal import Decimal
import uuid
from django.core.exceptions import ValidationError
from django.db import models

from apps.subscriptions.models.plan import SubscriptionPlan
from apps.subscriptions.models.subscription import Subscription


class SubscriptionPaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SUCCESSFUL = "successful", "Successful"
    FAILED = "failed", "Failed"


class SubscriptionPaymentMethod(models.TextChoices):
    CARD = "card", "Card"
    UPI = "upi", "UPI"
    NET_BANKING = "net_banking", "Net Banking"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    MANUAL_ADMIN = "manual_admin", "Manual Admin"


class SubscriptionPayment(models.Model):
    """
    Financial billing records for owner subscriptions.
    Stores immutable log of subscription renewal/upgrade payments.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.PROTECT,
        related_name="payments",
        db_column="subscription_id",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="payments",
        db_column="plan_id",
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")

    payment_method = models.CharField(
        max_length=30,
        choices=SubscriptionPaymentMethod.choices,
        null=True,
        blank=True,
    )
    transaction_reference = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        unique=True,
    )

    status = models.CharField(
        max_length=20,
        choices=SubscriptionPaymentStatus.choices,
        default=SubscriptionPaymentStatus.PENDING,
    )

    billing_period_start = models.DateTimeField(null=True, blank=True)
    billing_period_end = models.DateTimeField(null=True, blank=True)

    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "subscription_payments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["subscription_id", "created_at"],
                name="idx_sub_pay_sub_created",
            ),
            models.Index(
                fields=["status", "created_at"],
                name="idx_sub_pay_status_created",
            ),
            models.Index(
                fields=["transaction_reference"],
                name="idx_sub_pay_tx_ref",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=Decimal("0.00")),
                name="chk_sub_pay_amount_non_negative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(billing_period_start__isnull=True)
                    | models.Q(billing_period_end__isnull=True)
                    | models.Q(billing_period_end__gt=models.F("billing_period_start"))
                ),
                name="chk_sub_pay_period_end_after_start",
            ),
        ]

    def __str__(self):
        return f"SubscriptionPayment({self.subscription_id} - {self.amount} {self.currency} [{self.status}])"

    def clean(self):
        super().clean()
        if self.amount is not None and self.amount < Decimal("0.00"):
            raise ValidationError({"amount": "Payment amount cannot be negative."})

        if (
            self.billing_period_start
            and self.billing_period_end
            and self.billing_period_end <= self.billing_period_start
        ):
            raise ValidationError(
                {
                    "billing_period_end": (
                        "Billing period end must be strictly after billing period start."
                    )
                }
            )

