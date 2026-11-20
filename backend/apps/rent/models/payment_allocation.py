import uuid
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models

from apps.rent.models.payment import Payment
from apps.rent.models.rent_charge import RentCharge


class PaymentAllocation(models.Model):
    """
    Allocation record linking a payment to a rent charge within the same tenancy.
    Composite foreign keys enforce tenancy consistency.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    payment = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        related_name="allocations",
        db_column="payment_id",
    )
    rent_charge = models.ForeignKey(
        RentCharge,
        on_delete=models.PROTECT,
        related_name="allocations",
        db_column="rent_charge_id",
    )

    # Redundant by design: enables composite foreign keys ensuring payment and charge belong to the same tenancy
    tenancy = models.ForeignKey(
        "leasing.Tenancy",
        on_delete=models.PROTECT,
        related_name="payment_allocations",
        db_column="tenancy_id",
    )

    allocated_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payment_allocations"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["rent_charge"], name="idx_pay_alloc_rent_charge"),
            models.Index(fields=["tenancy"], name="idx_pay_alloc_tenancy"),
            models.Index(fields=["payment", "tenancy"], name="idx_pay_alloc_pmt_ten"),
            models.Index(fields=["rent_charge", "tenancy"], name="idx_pay_alloc_chg_ten"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["payment", "rent_charge"],
                name="uq_payment_rent_charge_allocation",
            ),
            models.UniqueConstraint(
                fields=["id", "tenancy"],
                name="uq_payment_allocation_id_tenancy",
            ),
            models.CheckConstraint(
                condition=models.Q(allocated_amount__gt=Decimal("0.00")),
                name="chk_payment_allocated_amount_positive",
            ),
        ]

    def __str__(self):
        return f"PaymentAllocation({self.id}: Payment {self.payment_id} -> Charge {self.rent_charge_id} [₹{self.allocated_amount}])"

    def clean(self):
        super().clean()
        if self.allocated_amount is not None and self.allocated_amount <= Decimal("0.00"):
            raise ValidationError(
                {"allocated_amount": "Allocated amount must be strictly greater than zero."}
            )

        if self.payment_id and self.tenancy_id and self.payment.tenancy_id != self.tenancy_id:
            raise ValidationError(
                {"tenancy": "Payment tenancy must match allocation tenancy."}
            )

        if self.rent_charge_id and self.tenancy_id and self.rent_charge.tenancy_id != self.tenancy_id:
            raise ValidationError(
                {"tenancy": "Rent charge tenancy must match allocation tenancy."}
            )

    @property
    def effective_amount(self) -> Decimal:
        """Allocated amount minus any successful reversals."""
        from apps.rent.models.payment_refund import PaymentRefundStatus

        reversed_total = (
            self.reversals.filter(refund__status=PaymentRefundStatus.COMPLETED).aggregate(
                total=models.Sum("reversed_amount")
            )["total"]
            or Decimal("0.00")
        )
        return max(Decimal("0.00"), self.allocated_amount - reversed_total)

