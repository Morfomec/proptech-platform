import uuid
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.rent.models.payment import Payment


class PaymentRefundStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class PaymentRefund(models.Model):
    """
    Tracks return of funds for completed payments.
    Follows approved DBML payment_refunds schema.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    payment = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        related_name="refunds",
        db_column="payment_id",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    currency = models.CharField(
        max_length=3,
        default="INR",
    )

    reason = models.CharField(
        max_length=255,
    )
    status = models.CharField(
        max_length=20,
        choices=PaymentRefundStatus.choices,
        default=PaymentRefundStatus.PENDING,
    )

    refund_reference = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    processed_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_payment_refunds",
        db_column="created_by",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payment_refunds"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["payment"], name="idx_pay_refund_payment"),
            models.Index(fields=["status", "created_at"], name="idx_pay_refund_stat_created"),
            models.Index(fields=["created_by", "created_at"], name="idx_pay_refund_creator_created"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="chk_payment_refund_amount_positive",
            ),
        ]

    def __str__(self):
        return f"PaymentRefund({self.id}: Payment {self.payment_id} [₹{self.amount} - {self.status}])"

    def clean(self):
        super().clean()
        if self.amount is not None and self.amount <= Decimal("0.00"):
            raise ValidationError({"amount": "Refund amount must be strictly greater than zero."})

