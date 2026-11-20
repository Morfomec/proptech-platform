from decimal import Decimal
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import QuerySet, Sum
from django.utils import timezone

from apps.core.permissions import _matches_user
from apps.notifications.models import NotificationType, RelatedObjectType
from apps.notifications.services import create_notification
from apps.rent.models import (
    Payment,
    PaymentAllocation,
    PaymentAllocationReversal,
    PaymentRefund,
    PaymentRefundStatus,
    PaymentStatus,
    RentCharge,
    RentChargeStatus,
)
from apps.rent.services.allocation_service import (
    get_charge_effective_allocated_total,
    get_payment_effective_allocated_total,
)
from apps.rent.services.exceptions import (
    PaymentPermissionError,
    RefundError,
    RefundPermissionError,
    RefundValidationError,
)


def get_payment_refundable_amount(*, payment: Payment) -> Decimal:
    """
    Calculate remaining refundable amount for a completed payment:
    remaining_refundable = payment.amount - sum(successful_refunds).
    """
    if payment.status != PaymentStatus.COMPLETED:
        return Decimal("0.00")

    successful_refunds = (
        PaymentRefund.objects.filter(
            payment=payment,
            status=PaymentRefundStatus.COMPLETED,
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )
    return max(Decimal("0.00"), payment.amount - successful_refunds)


def get_payment_unallocated_balance(*, payment: Payment) -> Decimal:
    """
    Calculate available unallocated balance on the payment:
    remaining_refundable - effective_allocated_amount.
    """
    refundable = get_payment_refundable_amount(payment=payment)
    effective_allocated = get_payment_effective_allocated_total(payment=payment)
    return max(Decimal("0.00"), refundable - effective_allocated)


def _verify_user_can_manage_refunds(*, user, payment: Payment) -> None:
    """Verify user is property owner or platform admin. Tenants cannot manage refunds."""
    is_owner = _matches_user(payment.tenancy.property.owner_id, user)
    is_admin = getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)

    if not (is_owner or is_admin):
        raise RefundPermissionError("Only property owners and administrators can create or process refunds.")


def _verify_user_can_view_refunds(*, user, payment: Payment) -> None:
    """Verify user is property owner, tenant, or platform admin."""
    is_owner = _matches_user(payment.tenancy.property.owner_id, user)
    is_tenant = _matches_user(payment.tenancy.tenant_id, user)
    is_admin = getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)

    if not (is_owner or is_tenant or is_admin):
        raise PaymentPermissionError("You do not have permission to view refunds for this payment.")


@transaction.atomic
def execute_refund_reversals(*, refund: PaymentRefund, payment: Payment) -> None:
    """
    Execute reverse-chronology allocation reversals for a successful refund.
    
    Rules:
    1. Unallocated balance must be refunded first.
    2. Only reverse allocations when refund amount exceeds payment's available unallocated balance.
    3. Use reverse allocation chronology: most recently created allocations first (created_at DESC, id DESC).
    4. Never modify original PaymentAllocation records or amounts.
    5. Recalculate affected rent charge statuses using effective allocations.
    """
    # Calculate prior unallocated balance (excluding this refund)
    prior_refunds = (
        PaymentRefund.objects.filter(
            payment=payment,
            status=PaymentRefundStatus.COMPLETED,
        )
        .exclude(pk=refund.pk)
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )
    prior_effective_allocated = get_payment_effective_allocated_total(payment=payment)
    prior_unallocated = max(
        Decimal("0.00"),
        (payment.amount - prior_refunds) - prior_effective_allocated,
    )

    absorbed_by_unallocated = min(refund.amount, prior_unallocated)
    amount_to_reverse = refund.amount - absorbed_by_unallocated

    if amount_to_reverse <= Decimal("0.00"):
        return

    # Lock and fetch allocations in reverse chronology (newest allocation first)
    allocations = (
        PaymentAllocation.objects.select_for_update()
        .filter(payment=payment)
        .order_by("-created_at", "-id")
    )

    for alloc in allocations:
        if amount_to_reverse <= Decimal("0.00"):
            break

        alloc_effective = alloc.effective_amount
        if alloc_effective <= Decimal("0.00"):
            continue

        reversal_amount = min(amount_to_reverse, alloc_effective)

        PaymentAllocationReversal.objects.create(
            refund=refund,
            allocation=alloc,
            rent_charge=alloc.rent_charge,
            tenancy_id=payment.tenancy_id,
            reversed_amount=reversal_amount,
        )

        amount_to_reverse -= reversal_amount

        # Lock and recalculate rent charge status
        charge = RentCharge.objects.select_for_update().get(pk=alloc.rent_charge_id)
        effective_paid = get_charge_effective_allocated_total(rent_charge=charge)

        if effective_paid >= charge.amount:
            charge.status = RentChargeStatus.PAID
        elif effective_paid > Decimal("0.00"):
            charge.status = RentChargeStatus.PARTIALLY_PAID
        else:
            charge.status = RentChargeStatus.UNPAID

        charge.save(update_fields=["status", "updated_at"])

    if amount_to_reverse > Decimal("0.00"):
        raise RefundError(
            f"Failed to reverse sufficient allocations: ₹{amount_to_reverse} could not be reversed."
        )


@transaction.atomic
def create_refund(
    *,
    user,
    payment_id,
    amount: Decimal,
    reason: str,
    currency: str = "INR",
    refund_reference: Optional[str] = None,
    status: str = PaymentRefundStatus.COMPLETED,
) -> PaymentRefund:
    """
    Create a partial or full refund for a completed payment.
    Owners and admins only.
    """
    try:
        payment = (
            Payment.objects.select_for_update()
            .select_related("tenancy", "tenancy__property", "tenancy__tenant")
            .get(pk=payment_id)
        )
    except Payment.DoesNotExist:
        raise RefundError(f"Payment with ID '{payment_id}' does not exist.")

    _verify_user_can_manage_refunds(user=user, payment=payment)

    if payment.status != PaymentStatus.COMPLETED:
        raise RefundValidationError(
            f"Only completed payments can be refunded. Current status is '{payment.status}'."
        )

    if amount is None or amount <= Decimal("0.00"):
        raise RefundValidationError("Refund amount must be strictly greater than zero.")

    remaining_refundable = get_payment_refundable_amount(payment=payment)
    if amount > remaining_refundable:
        raise RefundValidationError(
            f"Requested refund amount (₹{amount}) exceeds remaining refundable balance (₹{remaining_refundable})."
        )

    if refund_reference is not None:
        refund_reference = refund_reference.strip() or None

    now = timezone.now()
    processed_at = now if status == PaymentRefundStatus.COMPLETED else None

    refund = PaymentRefund(
        payment=payment,
        amount=amount,
        currency=currency,
        reason=reason,
        status=status,
        refund_reference=refund_reference,
        processed_at=processed_at,
        created_by=user,
    )
    refund.full_clean()
    refund.save()

    if status == PaymentRefundStatus.COMPLETED:
        execute_refund_reversals(refund=refund, payment=payment)

        # Notify tenant
        tenancy = payment.tenancy
        create_notification(
            user=tenancy.tenant,
            notification_type=NotificationType.SYSTEM_ALERT if hasattr(NotificationType, "SYSTEM_ALERT") else NotificationType.TENANCY_ACTIVATED,
            title="Refund Processed",
            message=(
                f"A refund of {amount} {currency} for {tenancy.property.title} "
                f"has been processed. Reason: {reason}."
            ),
            related_object_type=RelatedObjectType.TENANCY,
            related_object_id=tenancy.id,
        )

    return refund


@transaction.atomic
def process_refund(
    *,
    user,
    refund_id,
    refund_reference: Optional[str] = None,
) -> PaymentRefund:
    """
    Process a pending refund successfully and execute allocation reversals.
    """
    try:
        refund = (
            PaymentRefund.objects.select_for_update()
            .select_related("payment", "payment__tenancy", "payment__tenancy__property", "payment__tenancy__tenant")
            .get(pk=refund_id)
        )
    except PaymentRefund.DoesNotExist:
        raise RefundError(f"Refund with ID '{refund_id}' does not exist.")

    _verify_user_can_manage_refunds(user=user, payment=refund.payment)

    if refund.status == PaymentRefundStatus.COMPLETED:
        raise RefundValidationError("This refund has already been processed.")

    if refund.status == PaymentRefundStatus.FAILED:
        raise RefundValidationError("Failed refunds cannot be processed.")

    payment = Payment.objects.select_for_update().get(pk=refund.payment_id)

    remaining_refundable = get_payment_refundable_amount(payment=payment)
    if refund.amount > remaining_refundable:
        raise RefundValidationError(
            f"Refund amount (₹{refund.amount}) exceeds remaining refundable balance (₹{remaining_refundable})."
        )

    refund.status = PaymentRefundStatus.COMPLETED
    refund.processed_at = timezone.now()
    if refund_reference is not None:
        refund.refund_reference = refund_reference.strip() or None

    refund.save(update_fields=["status", "processed_at", "refund_reference", "updated_at"])

    execute_refund_reversals(refund=refund, payment=payment)

    # Notify tenant
    tenancy = refund.payment.tenancy
    create_notification(
        user=tenancy.tenant,
        notification_type=NotificationType.SYSTEM_ALERT if hasattr(NotificationType, "SYSTEM_ALERT") else NotificationType.TENANCY_ACTIVATED,
        title="Refund Processed",
        message=(
            f"A refund of {refund.amount} {refund.currency} for {tenancy.property.title} "
            f"has been processed. Reason: {refund.reason}."
        ),
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )

    return refund


@transaction.atomic
def fail_refund(
    *,
    user,
    refund_id,
    reason: Optional[str] = None,
) -> PaymentRefund:
    """
    Mark a pending refund as failed. Does not alter allocations or balances.
    """
    try:
        refund = (
            PaymentRefund.objects.select_for_update()
            .select_related("payment", "payment__tenancy", "payment__tenancy__property")
            .get(pk=refund_id)
        )
    except PaymentRefund.DoesNotExist:
        raise RefundError(f"Refund with ID '{refund_id}' does not exist.")

    _verify_user_can_manage_refunds(user=user, payment=refund.payment)

    if refund.status != PaymentRefundStatus.PENDING:
        raise RefundValidationError(
            f"Only pending refunds can be marked as failed. Current status is '{refund.status}'."
        )

    refund.status = PaymentRefundStatus.FAILED
    if reason:
        refund.reason = f"{refund.reason} [Failed: {reason}]"[:255]

    refund.save(update_fields=["status", "reason", "updated_at"])
    return refund


def list_payment_refunds(*, user, payment_id) -> QuerySet[PaymentRefund]:
    """Retrieve refund history for a payment after verifying user permissions."""
    try:
        payment = (
            Payment.objects.select_related("tenancy", "tenancy__property")
            .get(pk=payment_id)
        )
    except Payment.DoesNotExist:
        raise RefundError(f"Payment with ID '{payment_id}' does not exist.")

    _verify_user_can_view_refunds(user=user, payment=payment)
    return PaymentRefund.objects.filter(payment=payment).select_related("created_by").order_by("-created_at")


def list_user_refunds(*, user, role: Optional[str] = None, payment_id=None, status=None) -> QuerySet[PaymentRefund]:
    """
    List all refunds for payments accessible to the user.
    - role='owner': refunds for payments on their owned properties.
    - role='tenant': refunds for payments on their leased tenancies.
    - Admins: all refunds.
    """
    if getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False):
        qs = PaymentRefund.objects.all().select_related(
            "payment", "payment__tenancy", "payment__tenancy__property", "created_by"
        )
    elif role == "owner":
        if not (getattr(user, "is_owner", False) or getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)):
            raise RefundPermissionError("You do not have permission to access owner workspace resources.")
        qs = PaymentRefund.objects.filter(
            payment__tenancy__property__owner=user
        ).select_related(
            "payment", "payment__tenancy", "payment__tenancy__property", "created_by"
        )
    elif role == "tenant":
        if not (getattr(user, "is_tenant", False) or getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)):
            raise RefundPermissionError("You do not have permission to access tenant workspace resources.")
        qs = PaymentRefund.objects.filter(
            payment__tenancy__tenant=user
        ).select_related(
            "payment", "payment__tenancy", "payment__tenancy__property", "created_by"
        )
    else:
        from django.db.models import Q
        qs = PaymentRefund.objects.filter(
            Q(payment__tenancy__property__owner=user) | Q(payment__tenancy__tenant=user)
        ).distinct().select_related(
            "payment", "payment__tenancy", "payment__tenancy__property", "created_by"
        )

    if payment_id:
        qs = qs.filter(payment_id=payment_id)
    if status:
        qs = qs.filter(status=status)

    return qs.prefetch_related("allocation_reversals").order_by("-created_at")



def get_refund_details(*, user, refund_id) -> PaymentRefund:
    """Retrieve details of a refund after verifying user permissions."""
    try:
        refund = (
            PaymentRefund.objects.select_related(
                "payment",
                "payment__tenancy",
                "payment__tenancy__property",
                "created_by",
            )
            .get(pk=refund_id)
        )
    except PaymentRefund.DoesNotExist:
        raise RefundError(f"Refund with ID '{refund_id}' does not exist.")

    _verify_user_can_view_refunds(user=user, payment=refund.payment)
    return refund
