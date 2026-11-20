from decimal import Decimal
from typing import List, Optional

from django.db import transaction
from django.db.models import Sum

from apps.rent.models import (
    Payment,
    PaymentAllocation,
    PaymentStatus,
    RentCharge,
    RentChargeStatus,
    RentChargeType,
)
from apps.rent.services.exceptions import RentError


def get_payment_effective_allocated_total(*, payment: Payment) -> Decimal:
    """Return total effective amount currently allocated from this payment after successful reversals."""
    from apps.rent.models import PaymentAllocationReversal, PaymentRefundStatus

    allocated = (
        PaymentAllocation.objects.filter(payment=payment).aggregate(
            total=Sum("allocated_amount")
        )["total"]
        or Decimal("0.00")
    )
    reversed_total = (
        PaymentAllocationReversal.objects.filter(
            allocation__payment=payment,
            refund__status=PaymentRefundStatus.COMPLETED,
        ).aggregate(total=Sum("reversed_amount"))["total"]
        or Decimal("0.00")
    )
    return max(Decimal("0.00"), allocated - reversed_total)


def get_payment_allocated_total(*, payment: Payment) -> Decimal:
    """Return total effective amount currently allocated from this payment."""
    return get_payment_effective_allocated_total(payment=payment)


def get_charge_effective_allocated_total(*, rent_charge: RentCharge) -> Decimal:
    """Return total valid effective payment amounts allocated toward this rent charge."""
    from apps.rent.models import PaymentAllocationReversal, PaymentRefundStatus

    allocated = (
        PaymentAllocation.objects.filter(rent_charge=rent_charge).aggregate(
            total=Sum("allocated_amount")
        )["total"]
        or Decimal("0.00")
    )
    reversed_total = (
        PaymentAllocationReversal.objects.filter(
            rent_charge=rent_charge,
            refund__status=PaymentRefundStatus.COMPLETED,
        ).aggregate(total=Sum("reversed_amount"))["total"]
        or Decimal("0.00")
    )
    return max(Decimal("0.00"), allocated - reversed_total)


def get_charge_allocated_total(*, rent_charge: RentCharge) -> Decimal:
    """Return total effective payment amounts allocated toward this rent charge."""
    return get_charge_effective_allocated_total(rent_charge=rent_charge)


@transaction.atomic
def allocate_payment_fifo(
    *,
    payment_id,
    target_charge_type: Optional[str] = None,
    rent_charge_id: Optional[str] = None,
) -> List[PaymentAllocation]:
    """
    Automatic First-In, First-Out (FIFO) payment allocation.
    
    1. Locks the Payment row using select_for_update().
    2. Verifies payment status is 'completed'.
    3. Calculates eligible unallocated amount: payment.amount - sum(allocations).
    4. If unallocated <= 0, returns empty list (idempotent; already fully allocated).
    5. Determines target charge type:
       - Strictly separates rent payments from security deposit payments.
       - A deposit payment is never allocated to a rent charge.
       - A rent payment is never allocated to a deposit charge.
    6. Retrieves and locks eligible outstanding charges for this tenancy matching target_charge_type:
       - Status must NOT be 'waived' or 'cancelled'.
       - Ordered by oldest-first: due_date ASC, billing_period_start ASC, created_at ASC.
    7. For each charge, computes:
       outstanding = charge.amount - sum(existing allocations to charge)
       If outstanding > 0:
           alloc_amount = min(unallocated_payment, outstanding)
           Creates PaymentAllocation row.
           Updates unallocated_payment -= alloc_amount.
           Updates charge.status:
               - 'paid' if total allocations >= charge.amount
               - 'partially_paid' if 0 < total allocations < charge.amount
    8. Any excess payment amount remains unallocated on the payment record.
    9. Returns list of created PaymentAllocation instances.
    """
    # 1. Lock payment row
    try:
        payment = Payment.objects.select_for_update().get(pk=payment_id)
    except Payment.DoesNotExist:
        raise RentError(f"Payment with ID '{payment_id}' does not exist.")

    # 2. Verify status
    if payment.status != PaymentStatus.COMPLETED:
        return []

    # 3. Calculate remaining eligible amount
    from apps.rent.models import PaymentRefundStatus

    total_refunded = (
        payment.refunds.filter(status=PaymentRefundStatus.COMPLETED).aggregate(
            total=Sum("amount")
        )["total"]
        or Decimal("0.00")
    )
    allocated_so_far = get_payment_effective_allocated_total(payment=payment)
    unallocated_payment = (payment.amount - total_refunded) - allocated_so_far

    if unallocated_payment <= Decimal("0.00"):
        return []

    # 4. Resolve and classify target charge type
    if rent_charge_id:
        try:
            target_charge = RentCharge.objects.get(pk=rent_charge_id, tenancy_id=payment.tenancy_id)
            target_charge_type = target_charge.charge_type
        except RentCharge.DoesNotExist:
            pass

    if not target_charge_type:
        if payment.notes and "[Security Deposit]" in payment.notes:
            target_charge_type = RentChargeType.SECURITY_DEPOSIT
        else:
            target_charge_type = RentChargeType.RENT

    # 5. Retrieve and lock eligible charges for the same tenancy strictly matching target_charge_type
    charges_qs = (
        RentCharge.objects.select_for_update()
        .filter(tenancy_id=payment.tenancy_id, charge_type=target_charge_type)
        .exclude(status__in=[RentChargeStatus.WAIVED, RentChargeStatus.CANCELLED, RentChargeStatus.PAID])
        .order_by("due_date", "billing_period_start", "created_at")
    )

    if rent_charge_id:
        charges_qs = charges_qs.filter(pk=rent_charge_id)

    eligible_charges = list(charges_qs)
    created_allocations = []

    # 6. Allocate FIFO across charges
    for charge in eligible_charges:
        if unallocated_payment <= Decimal("0.00"):
            break

        # Calculate already allocated amount for this charge
        charge_allocated_so_far = get_charge_allocated_total(rent_charge=charge)
        outstanding = charge.amount - charge_allocated_so_far

        if outstanding <= Decimal("0.00"):
            # Charge was already fully covered by previous payments
            if charge.status != RentChargeStatus.PAID:
                charge.status = RentChargeStatus.PAID
                charge.save(update_fields=["status", "updated_at"])
            continue

        # Allocate the smaller of available payment or outstanding balance
        alloc_amount = min(unallocated_payment, outstanding)

        # Create allocation record
        allocation = PaymentAllocation.objects.create(
            payment=payment,
            rent_charge=charge,
            tenancy_id=payment.tenancy_id,
            allocated_amount=alloc_amount,
        )
        created_allocations.append(allocation)

        unallocated_payment -= alloc_amount
        new_total_charge_allocated = charge_allocated_so_far + alloc_amount

        # Update charge status
        if new_total_charge_allocated >= charge.amount:
            charge.status = RentChargeStatus.PAID
        elif new_total_charge_allocated > Decimal("0.00"):
            charge.status = RentChargeStatus.PARTIALLY_PAID
        else:
            charge.status = RentChargeStatus.UNPAID

        charge.save(update_fields=["status", "updated_at"])

    return created_allocations

