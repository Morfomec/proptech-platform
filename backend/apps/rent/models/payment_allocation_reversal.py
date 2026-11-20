import uuid
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models

from apps.rent.models.payment_allocation import PaymentAllocation
from apps.rent.models.payment_refund import PaymentRefund
from apps.rent.models.rent_charge import RentCharge


class PaymentAllocationReversal(models.Model):
    """
    Append-only ledger model tracking allocation reversals caused by payment refunds.
    Preserves original PaymentAllocation records permanently without modifying
    their original allocated amounts.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    refund = models.ForeignKey(
        PaymentRefund,
        on_delete=models.PROTECT,
        related_name="allocation_reversals",
        db_column="refund_id",
    )
    allocation = models.ForeignKey(
        PaymentAllocation,
        on_delete=models.PROTECT,
        related_name="reversals",
        db_column="allocation_id",
    )
    rent_charge = models.ForeignKey(
        RentCharge,
        on_delete=models.PROTECT,
        related_name="allocation_reversals",
        db_column="rent_charge_id",
    )
    tenancy = models.ForeignKey(
        "leasing.Tenancy",
        on_delete=models.PROTECT,
        related_name="payment_allocation_reversals",
        db_column="tenancy_id",
    )

    reversed_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payment_allocation_reversals"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["refund"], name="idx_pay_rev_refund"),
            models.Index(fields=["allocation"], name="idx_pay_rev_allocation"),
            models.Index(fields=["rent_charge"], name="idx_pay_rev_rent_charge"),
            models.Index(fields=["tenancy"], name="idx_pay_rev_tenancy"),
            models.Index(fields=["allocation", "tenancy"], name="idx_pay_rev_alloc_ten"),
            models.Index(fields=["rent_charge", "tenancy"], name="idx_pay_rev_chg_ten"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["refund", "allocation"],
                name="uq_refund_pay_alloc_reversal",
            ),
            models.CheckConstraint(
                condition=models.Q(reversed_amount__gt=Decimal("0.00")),
                name="chk_pay_alloc_reversal_positive",
            ),
        ]

    def __str__(self):
        return (
            f"PaymentAllocationReversal({self.id}: Refund {self.refund_id} "
            f"reversed ₹{self.reversed_amount} from Allocation {self.allocation_id})"
        )

    def clean(self):
        super().clean()
        if self.reversed_amount is not None and self.reversed_amount <= Decimal("0.00"):
            raise ValidationError(
                {"reversed_amount": "Reversed amount must be strictly greater than zero."}
            )

        if self.refund_id and self.allocation_id and self.refund.payment_id != self.allocation.payment_id:
            raise ValidationError(
                {"allocation": "Reversal allocation must belong to the refunded payment."}
            )

        if self.allocation_id and self.tenancy_id and self.allocation.tenancy_id != self.tenancy_id:
            raise ValidationError(
                {"tenancy": "Allocation tenancy must match reversal tenancy."}
            )

        if self.rent_charge_id and self.tenancy_id and self.rent_charge.tenancy_id != self.tenancy_id:
            raise ValidationError(
                {"tenancy": "Rent charge tenancy must match reversal tenancy."}
            )

