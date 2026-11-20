from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models.base import BaseModel


class PaymentMethod(models.TextChoices):
    UPI = "upi", "UPI"
    BANK_TRANSFER = "bank_transfer", "Bank Transfer"
    CARD = "card", "Card"
    NET_BANKING = "net_banking", "Net Banking"
    CASH = "cash", "Cash"
    CHEQUE = "cheque", "Cheque"
    OTHER = "other", "Other"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class Payment(BaseModel):
    """
    Payment recorded against a tenancy.
    Represents actual cash, bank transfer, UPI, or recorded receipts.
    """

    tenancy = models.ForeignKey(
        "leasing.Tenancy",
        on_delete=models.PROTECT,
        related_name="payments",
        db_column="tenancy_id",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    currency = models.CharField(
        max_length=3,
        default="INR",
    )

    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
    )
    transaction_reference = models.CharField(
        max_length=255,
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    notes = models.TextField(
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenancy", "created_at"], name="idx_payment_tenancy_created"),
            models.Index(fields=["status", "created_at"], name="idx_payment_status_created"),
            models.Index(fields=["transaction_reference"], name="idx_payment_tx_reference"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["id", "tenancy"],
                name="uq_payment_id_tenancy",
            ),
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="chk_payment_amount_positive",
            ),
            models.UniqueConstraint(
                fields=["transaction_reference"],
                condition=models.Q(transaction_reference__isnull=False)
                & ~models.Q(transaction_reference=""),
                name="uq_payment_transaction_reference",
            ),
        ]

    def __str__(self):
        return f"Payment({self.id} - {self.tenancy_id}: {self.amount} {self.currency} [{self.status}])"

    def clean(self):
        super().clean()
        if self.amount is not None and self.amount <= Decimal("0.00"):
            raise ValidationError({"amount": "Payment amount must be strictly greater than zero."})

