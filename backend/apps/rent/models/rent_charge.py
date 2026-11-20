from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models.base import BaseModel


class RentChargeType(models.TextChoices):
    RENT = "rent", "Rent"
    SECURITY_DEPOSIT = "security_deposit", "Security Deposit"
    LATE_FEE = "late_fee", "Late Fee"
    UTILITY = "utility", "Utility"
    MAINTENANCE = "maintenance", "Maintenance"
    OTHER = "other", "Other"


class RentChargeStatus(models.TextChoices):
    UNPAID = "unpaid", "Unpaid"
    PARTIALLY_PAID = "partially_paid", "Partially Paid"
    PAID = "paid", "Paid"
    WAIVED = "waived", "Waived"
    CANCELLED = "cancelled", "Cancelled"


class RentCharge(BaseModel):
    """
    Financial obligation (charge) linked to a tenancy.
    Tracks billing period, due date, amount, and settlement status.
    """

    tenancy = models.ForeignKey(
        "leasing.Tenancy",
        on_delete=models.PROTECT,
        related_name="rent_charges",
        db_column="tenancy_id",
    )

    charge_type = models.CharField(
        max_length=30,
        choices=RentChargeType.choices,
        default=RentChargeType.RENT,
    )

    billing_period_start = models.DateField()
    billing_period_end = models.DateField()

    due_date = models.DateField()

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    status = models.CharField(
        max_length=20,
        choices=RentChargeStatus.choices,
        default=RentChargeStatus.UNPAID,
    )

    description = models.CharField(
        max_length=255,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "rent_charges"
        ordering = ["due_date", "created_at"]
        indexes = [
            models.Index(fields=["status", "due_date"], name="idx_rent_charge_status_due"),
            models.Index(fields=["tenancy", "due_date"], name="idx_rent_charge_ten_due"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["id", "tenancy"],
                name="uq_rent_charge_id_tenancy",
            ),
            models.UniqueConstraint(
                fields=["tenancy", "charge_type", "billing_period_start"],
                name="uq_rent_charge_ten_type_period",
            ),
            models.CheckConstraint(
                condition=models.Q(amount__gt=Decimal("0.00")),
                name="chk_rent_charge_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(billing_period_end__gte=models.F("billing_period_start")),
                name="chk_rent_charge_period_end_gte_start",
            ),
        ]

    def __str__(self):
        try:
            prop_title = self.tenancy.property.title
        except Exception:
            prop_title = f"Tenancy {self.tenancy_id}"
        return f"{prop_title} — {self.get_charge_type_display()} (₹{self.amount})"

    def clean(self):
        super().clean()
        if self.amount is not None and self.amount <= Decimal("0.00"):
            raise ValidationError({"amount": "Charge amount must be strictly greater than zero."})

        if (
            self.billing_period_start
            and self.billing_period_end
            and self.billing_period_end < self.billing_period_start
        ):
            raise ValidationError(
                {"billing_period_end": "Billing period end date cannot be earlier than start date."}
            )

    @property
    def is_overdue(self) -> bool:
        """
        Dynamically determine if the charge is overdue:
        due_date < current date, and status is unpaid or partially_paid.
        Waived and cancelled charges are never overdue.
        """
        if self.status in (
            RentChargeStatus.PAID,
            RentChargeStatus.WAIVED,
            RentChargeStatus.CANCELLED,
        ):
            return False
        return self.due_date < timezone.localdate()

