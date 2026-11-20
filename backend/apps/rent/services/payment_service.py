from decimal import Decimal
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.core.permissions import _matches_user
from apps.leasing.models import Tenancy, TenancyStatus
from apps.notifications.models import NotificationType, RelatedObjectType
from apps.notifications.services import create_notification
from apps.rent.models import Payment, PaymentMethod, PaymentStatus
from apps.rent.services.exceptions import (
    PaymentPermissionError,
    TenancyNotFoundError,
)


def get_tenancy_for_user(*, user, tenancy_id) -> Tenancy:
    """
    Retrieve tenancy and verify user is either the property owner or the tenant.
    """
    try:
        tenancy = Tenancy.objects.select_related("property", "property__owner", "tenant").get(pk=tenancy_id)
    except Tenancy.DoesNotExist:
        raise TenancyNotFoundError(f"Tenancy with ID '{tenancy_id}' not found.")

    is_owner = _matches_user(tenancy.property.owner_id, user)
    is_tenant = _matches_user(tenancy.tenant_id, user)
    is_admin = getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)

    if not (is_owner or is_tenant or is_admin):
        raise PaymentPermissionError("You do not have permission to view or manage payments for this tenancy.")

    return tenancy


@transaction.atomic
def record_payment(
    *,
    user,
    tenancy_id,
    amount: Decimal,
    payment_method: str,
    currency: str = "INR",
    transaction_reference: Optional[str] = None,
    status: str = PaymentStatus.COMPLETED,
    paid_at=None,
    notes: Optional[str] = None,
    target_charge_type: str = "rent",
    rent_charge_id: Optional[str] = None,
) -> Payment:
    """
    Record a manual or verified payment for a tenancy.
    Both property owner and tenant (or admin) can record or report a payment.
    Enforces positive amount, valid choices, and partial unique transaction reference.
    Classifies payments strictly between rent and security deposit.
    """
    tenancy = get_tenancy_for_user(user=user, tenancy_id=tenancy_id)

    if tenancy.status not in (TenancyStatus.ACTIVE, TenancyStatus.CONFIRMED, TenancyStatus.ENDED):
        raise ValidationError(
            f"Payments cannot be recorded for a tenancy in '{tenancy.status}' status."
        )

    if amount is None or amount <= Decimal("0.00"):
        raise ValidationError({"amount": "Payment amount must be strictly greater than zero."})

    now = timezone.now()
    if status == PaymentStatus.COMPLETED and not paid_at:
        paid_at = now

    # Check for empty string transaction_reference and treat as None
    if transaction_reference is not None:
        transaction_reference = transaction_reference.strip() or None

    # Prepend classification tag for security deposit if not present
    if target_charge_type == "security_deposit":
        if notes and "[Security Deposit]" not in notes:
            notes = f"[Security Deposit] {notes}"
        elif not notes:
            notes = "[Security Deposit]"

    payment = Payment(
        tenancy=tenancy,
        amount=amount,
        currency=currency,
        payment_method=payment_method,
        transaction_reference=transaction_reference,
        status=status,
        paid_at=paid_at,
        notes=notes,
    )
    payment.full_clean()
    payment.save()

    # Automatic FIFO Allocation for completed payments strictly separated by charge type
    if payment.status == PaymentStatus.COMPLETED:
        from apps.rent.services.allocation_service import allocate_payment_fifo
        allocate_payment_fifo(
            payment_id=payment.id,
            target_charge_type=target_charge_type,
            rent_charge_id=rent_charge_id,
        )

    # Send in-app notification to the counterparty
    is_owner = _matches_user(tenancy.property.owner_id, user)
    recipient = tenancy.tenant if is_owner else tenancy.property.owner
    title = "Payment Recorded"
    message = (
        f"A payment of {amount} {currency} ({payment.get_payment_method_display()}) "
        f"has been recorded for {tenancy.property.title}."
    )
    create_notification(
        user=recipient,
        notification_type=NotificationType.SYSTEM_ALERT if hasattr(NotificationType, "SYSTEM_ALERT") else NotificationType.TENANCY_ACTIVATED,
        title=title,
        message=message,
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )

    return payment


def list_tenancy_payments(*, user, tenancy_id) -> QuerySet[Payment]:
    """
    Return all payments recorded against a tenancy, verified for user authorization.
    """
    tenancy = get_tenancy_for_user(user=user, tenancy_id=tenancy_id)
    return (
        Payment.objects.filter(tenancy=tenancy)
        .select_related("tenancy", "tenancy__property", "tenancy__tenant")
        .prefetch_related("allocations", "allocations__rent_charge")
        .order_by("-created_at")
    )


def list_user_payments(*, user, role: Optional[str] = None) -> QuerySet[Payment]:
    """
    List payments accessible to the user across all their tenancies.
    - role='owner': payments for properties they own (requires owner capability).
    - role='tenant': payments for tenancies where they are the tenant (requires tenant capability).
    - Admins: all payments.
    """
    if getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False):
        return (
            Payment.objects.all()
            .select_related("tenancy", "tenancy__property", "tenancy__tenant")
            .prefetch_related("allocations", "allocations__rent_charge")
            .order_by("-created_at")
        )

    from django.db.models import Q

    if role == "owner":
        if not (getattr(user, "is_owner", False) or getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)):
            raise PaymentPermissionError("You do not have permission to access owner workspace resources.")
        base_qs = Payment.objects.filter(tenancy__property__owner=user)
    elif role == "tenant":
        if not (getattr(user, "is_tenant", False) or getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)):
            raise PaymentPermissionError("You do not have permission to access tenant workspace resources.")
        base_qs = Payment.objects.filter(tenancy__tenant=user)
    else:
        base_qs = Payment.objects.filter(
            Q(tenancy__property__owner=user) | Q(tenancy__tenant=user)
        ).distinct()

    return (
        base_qs.select_related("tenancy", "tenancy__property", "tenancy__tenant")
        .prefetch_related("allocations", "allocations__rent_charge")
        .order_by("-created_at")
    )


