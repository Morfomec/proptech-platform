from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max, Q
from django.utils import timezone

from apps.core.permissions import _matches_user
from apps.leasing.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Tenancy,
    TenancyStatus,
    TenancyTermsHistory,
    TermsProposalStatus,
)
from apps.leasing.services.exceptions import (
    TenancyApplicationError,
    TenancyNotFoundError,
    TenancyOverlapError,
    TenancyOwnershipError,
    TenancyStateError,
)
from apps.notifications.models import (
    NotificationType,
    RelatedObjectType,
)
from apps.notifications.services import create_notification
from apps.listings.models import Listing, ListingStatus
from apps.listings.services.listing_service import pause_listing
from apps.properties.models import Property, PropertyStatus


def _get_locked_property(*, property_id):
    """Lock a property before changing its tenancy state."""
    try:
        return Property.objects.select_for_update().get(pk=property_id)
    except Property.DoesNotExist:
        raise TenancyNotFoundError("Property not found.")


def _get_locked_tenancy(*, tenancy_id):
    """Retrieve and lock a tenancy."""
    try:
        return Tenancy.objects.select_for_update().get(pk=tenancy_id)
    except Tenancy.DoesNotExist:
        raise TenancyNotFoundError("Tenancy not found.")


def _verify_property_owner(*, property, owner):
    """Ensure the requesting owner owns the property."""
    if not _matches_user(property.owner, owner):
        raise TenancyOwnershipError(
            "You do not have permission to manage this property."
        )


def _verify_tenant_account(*, tenant, property):
    """Ensure the selected tenant user is active, has tenant capability, and is not the owner."""
    if not tenant:
        raise ValidationError({"tenant": "A valid tenant user is required."})

    if not getattr(tenant, "is_active", False):
        raise ValidationError(
            {"tenant": "Selected tenant account is inactive."}
        )

    if not getattr(tenant, "is_tenant", False):
        raise ValidationError(
            {"tenant": "Selected user must have tenant capability."}
        )

    if _matches_user(property.owner_id, tenant):
        raise ValidationError(
            {"tenant": "Property owner cannot be their own tenant."}
        )


def _verify_property_available_for_tenancy(*, property, exclude_tenancy_id=None):
    """
    Ensure property status allows confirming or activating a tenancy.

    Requires 'available' status, except when 'occupied' is held by another active
    (non-overlapping) tenancy on the property as part of a follow-on tenancy lifecycle.
    """
    if property.status == PropertyStatus.AVAILABLE:
        return

    if property.status == PropertyStatus.OCCUPIED:
        other_active_tenancies = Tenancy.objects.filter(
            property=property,
            status=TenancyStatus.ACTIVE,
        )
        if exclude_tenancy_id is not None:
            other_active_tenancies = other_active_tenancies.exclude(
                pk=exclude_tenancy_id
            )
        if other_active_tenancies.exists():
            return

    raise TenancyStateError(
        {
            "property": (
                f"Tenancies cannot be confirmed or activated while the property is in "
                f"'{property.status}' status."
            )
        }
    )


def _resolve_and_lock_application(*, application=None, application_id=None, property, tenant):
    """
    Resolve and lock an application (after Property lock to keep lock order consistent),
    validating approval status, applicant match, property match, and single linkage.
    """
    target_app_id = application.pk if application is not None else application_id
    if target_app_id is None:
        return None

    try:
        locked_application = (
            Application.objects
            .select_for_update()
            .select_related("listing", "listing__property")
            .get(pk=target_app_id)
        )
    except Application.DoesNotExist:
        raise TenancyApplicationError(
            {"application": "Specified application does not exist."}
        )

    if locked_application.status != ApplicationStatus.APPROVED:
        raise TenancyApplicationError(
            {"application": "Only approved applications can be linked to a tenancy."}
        )

    if locked_application.applicant_id != tenant.id:
        raise TenancyApplicationError(
            {"application": "Application applicant must match the tenancy tenant."}
        )

    if locked_application.listing.property_id != property.id:
        raise TenancyApplicationError(
            {"application": "Application property must match the tenancy property."}
        )

    if Tenancy.objects.filter(application=locked_application).exists():
        raise TenancyApplicationError(
            {"application": "This application is already linked to a tenancy."}
        )

    return locked_application


def _check_overlapping_tenancies(*, property, start_date, end_date, exclude_tenancy_id=None):
    """
    Explicitly check for overlapping confirmed or active tenancies on the property
    using inclusive boundaries [] and treating NULL end_date as infinity.
    """
    qs = Tenancy.objects.filter(
        property=property,
        status__in=[TenancyStatus.CONFIRMED, TenancyStatus.ACTIVE],
    )
    if exclude_tenancy_id is not None:
        qs = qs.exclude(pk=exclude_tenancy_id)

    overlap_filter = Q(end_date__isnull=True) | Q(end_date__gte=start_date)
    if end_date is not None:
        overlap_filter &= Q(start_date__lte=end_date)

    if qs.filter(overlap_filter).exists():
        raise TenancyOverlapError(
            {"start_date": "Another confirmed or active tenancy overlaps this period."}
        )


def _get_locked_property_and_tenancy(*, tenancy_id):
    """
    Always lock Property first and Tenancy second.
    This maintains consistent lock ordering.
    """
    try:
        property_id = Tenancy.objects.values_list(
            "property_id", flat=True
        ).get(pk=tenancy_id)
    except Tenancy.DoesNotExist:
        raise TenancyNotFoundError("Tenancy not found.")

    property = _get_locked_property(property_id=property_id)
    tenancy = _get_locked_tenancy(tenancy_id=tenancy_id)

    return property, tenancy


def _pause_published_listing(*, property, owner):
    """Pause the published listing associated with this property."""
    listing = Listing.objects.filter(
        property=property,
        status=ListingStatus.PUBLISHED,
    ).first()

    if listing:
        pause_listing(
            owner=owner,
            listing_instance=listing,
        )


def _save_tenancy(*, tenancy):
    """
    Validate and save tenancy.
    Translate PostgreSQL exclusion and application uniqueness violations into domain errors.
    """
    try:
        with transaction.atomic():
            tenancy.full_clean()
            tenancy.save()
    except IntegrityError as exc:
        cause = exc.__cause__
        diagnostic = getattr(cause, "diag", None)
        constraint_name = getattr(
            diagnostic, "constraint_name", None
        )

        if constraint_name == "excl_tenancy_property_no_overlap":
            raise TenancyOverlapError(
                {"start_date": "Another confirmed or active tenancy overlaps this period."}
            ) from exc

        if (constraint_name and "application" in constraint_name) or (
            "application_id" in str(exc)
        ):
            raise TenancyApplicationError(
                {"application": "This application is already linked to a tenancy."}
            ) from exc

        raise


@transaction.atomic
def create_tenancy(
    *,
    owner,
    property_id,
    tenant,
    start_date,
    end_date=None,
    monthly_rent,
    security_deposit=Decimal("0.00"),
    rent_due_day=1,
    application=None,
    application_id=None,
    notes=None,
):
    """
    Create and confirm a tenancy for an owner's property.
    Automatically pauses any published listing for the property.
    """

    property = _get_locked_property(property_id=property_id)
    _verify_property_owner(property=property, owner=owner)
    _verify_tenant_account(tenant=tenant, property=property)
    _verify_property_available_for_tenancy(property=property)

    locked_application = _resolve_and_lock_application(
        application=application,
        application_id=application_id,
        property=property,
        tenant=tenant,
    )

    _check_overlapping_tenancies(
        property=property,
        start_date=start_date,
        end_date=end_date,
    )

    now = timezone.now()
    tenancy = Tenancy(
        property=property,
        tenant=tenant,
        application=locked_application,
        start_date=start_date,
        end_date=end_date,
        monthly_rent=monthly_rent,
        security_deposit=security_deposit,
        rent_due_day=rent_due_day,
        status=TenancyStatus.PENDING,
        proposed_at=now,
        proposed_by=owner,
        notes=notes,
    )

    _save_tenancy(tenancy=tenancy)

    # If the previous version is still PENDING, mark it SUPERSEDED.
    # Preserve ACCEPTED or REJECTED versions unchanged.
    latest_terms = (
        TenancyTermsHistory.objects
        .filter(tenancy=tenancy)
        .order_by("-version")
        .first()
    )
    if latest_terms and latest_terms.status == TermsProposalStatus.PENDING:
        latest_terms.transition_status(
            TermsProposalStatus.SUPERSEDED,
            responded_at=now,
        )

    latest_version = latest_terms.version if latest_terms else 0
    next_version = latest_version + 1

    TenancyTermsHistory.objects.create(
        tenancy=tenancy,
        version=next_version,
        proposed_by=owner,
        monthly_rent=tenancy.monthly_rent,
        security_deposit=tenancy.security_deposit,
        start_date=tenancy.start_date,
        end_date=tenancy.end_date,
        rent_due_day=tenancy.rent_due_day,
        notes=tenancy.notes,
        status=TermsProposalStatus.PENDING,
    )

    create_notification(
        user=tenancy.tenant,
        notification_type=NotificationType.TENANCY_PROPOSED,
        title="Tenancy proposal received",
        message=f"The property owner has sent you a tenancy proposal for '{property.title}'. Please review and approve the terms.",
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )

    return tenancy


@transaction.atomic
def accept_tenancy_proposal(*, tenant, tenancy_id):
    """
    Allow the tenant to review and accept the proposed tenancy terms.
    Transitions tenancy from PENDING -> CONFIRMED and pauses any published listing.
    """
    property, tenancy = _get_locked_property_and_tenancy(tenancy_id=tenancy_id)

    if not _matches_user(tenancy.tenant, tenant):
        raise TenancyOwnershipError(
            "Only the tenant associated with this proposal can accept it."
        )

    if tenancy.status != TenancyStatus.PENDING:
        if tenancy.status in [TenancyStatus.CONFIRMED, TenancyStatus.ACTIVE]:
            raise TenancyStateError(
                {"status": "This tenancy proposal has already been accepted."}
            )
        if tenancy.status == TenancyStatus.REJECTED:
            raise TenancyStateError(
                {"status": "Cannot accept a rejected proposal. The owner must update the proposal terms first."}
            )
        raise TenancyStateError(
            {"status": f"Cannot accept a tenancy proposal in '{tenancy.status}' status."}
        )

    _verify_property_available_for_tenancy(
        property=property,
        exclude_tenancy_id=tenancy.pk,
    )
    _check_overlapping_tenancies(
        property=property,
        start_date=tenancy.start_date,
        end_date=tenancy.end_date,
        exclude_tenancy_id=tenancy.pk,
    )

    now = timezone.now()
    tenancy.status = TenancyStatus.CONFIRMED
    tenancy.tenant_responded_at = now
    _save_tenancy(tenancy=tenancy)

    pending_terms = (
        TenancyTermsHistory.objects
        .filter(tenancy=tenancy, status=TermsProposalStatus.PENDING)
        .order_by("-version")
        .first()
    )
    if pending_terms:
        pending_terms.transition_status(
            TermsProposalStatus.ACCEPTED,
            responded_at=now,
        )

    # Pause listing once tenancy is confirmed by tenant
    _pause_published_listing(
        property=property,
        owner=property.owner,
    )

    create_notification(
        user=property.owner,
        notification_type=NotificationType.TENANCY_CONFIRMED,
        title="Tenancy proposal accepted",
        message=f"Tenant {tenancy.tenant.first_name or tenancy.tenant.email} has accepted the tenancy terms for '{property.title}'.",
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )

    return tenancy


@transaction.atomic
def reject_tenancy_proposal(*, tenant, tenancy_id, reason=None):
    """
    Allow the tenant to reject the proposed tenancy terms.
    Transitions tenancy from PENDING -> REJECTED and records rejection reason.
    """
    property, tenancy = _get_locked_property_and_tenancy(tenancy_id=tenancy_id)

    if not _matches_user(tenancy.tenant, tenant):
        raise TenancyOwnershipError(
            "Only the tenant associated with this proposal can reject it."
        )

    if tenancy.status != TenancyStatus.PENDING:
        raise TenancyStateError(
            {"status": f"Cannot reject a tenancy proposal in '{tenancy.status}' status."}
        )

    now = timezone.now()
    tenancy.status = TenancyStatus.REJECTED
    tenancy.tenant_responded_at = now
    clean_reason = str(reason).strip() if reason else None
    tenancy.rejection_reason = clean_reason
    _save_tenancy(tenancy=tenancy)

    pending_terms = (
        TenancyTermsHistory.objects
        .filter(tenancy=tenancy, status=TermsProposalStatus.PENDING)
        .order_by("-version")
        .first()
    )
    if pending_terms:
        pending_terms.transition_status(
            TermsProposalStatus.REJECTED,
            responded_at=now,
            rejection_reason=clean_reason,
        )

    reason_msg = f" Reason: {clean_reason}" if clean_reason else ""
    create_notification(
        user=property.owner,
        notification_type=NotificationType.TENANCY_REJECTED,
        title="Tenancy proposal rejected",
        message=f"Tenant {tenancy.tenant.first_name or tenancy.tenant.email} has rejected the tenancy terms for '{property.title}'.{reason_msg}",
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )

    return tenancy


@transaction.atomic
def update_tenancy_proposal(
    *,
    owner,
    tenancy_id,
    start_date=None,
    end_date=None,
    monthly_rent=None,
    security_deposit=None,
    rent_due_day=None,
    notes=None,
):
    """
    Allow the owner to update proposed terms for a tenancy that is pending, confirmed, or rejected.
    Updating the terms resets the proposal to PENDING status, requiring renewed tenant approval.
    """
    property, tenancy = _get_locked_property_and_tenancy(tenancy_id=tenancy_id)
    _verify_property_owner(property=property, owner=owner)

    allowed_update_statuses = [
        TenancyStatus.PENDING,
        TenancyStatus.CONFIRMED,
        TenancyStatus.REJECTED,
    ]
    if tenancy.status not in allowed_update_statuses:
        raise TenancyStateError(
            {"status": f"Cannot update proposed terms for a tenancy in '{tenancy.status}' status."}
        )

    if start_date is not None:
        tenancy.start_date = start_date
    if end_date is not None:
        tenancy.end_date = end_date
    if monthly_rent is not None:
        tenancy.monthly_rent = monthly_rent
    if security_deposit is not None:
        tenancy.security_deposit = security_deposit
    if rent_due_day is not None:
        tenancy.rent_due_day = rent_due_day
    if notes is not None:
        tenancy.notes = notes

    _check_overlapping_tenancies(
        property=property,
        start_date=tenancy.start_date,
        end_date=tenancy.end_date,
        exclude_tenancy_id=tenancy.pk,
    )

    now = timezone.now()
    tenancy.status = TenancyStatus.PENDING
    tenancy.proposed_at = now
    tenancy.proposed_by = owner
    tenancy.tenant_responded_at = None
    tenancy.rejection_reason = None

    _save_tenancy(tenancy=tenancy)

    # If the previous version is still PENDING, mark it SUPERSEDED.
    # Preserve ACCEPTED or REJECTED versions unchanged.
    latest_terms = (
        TenancyTermsHistory.objects
        .filter(tenancy=tenancy)
        .order_by("-version")
        .first()
    )
    if latest_terms and latest_terms.status == TermsProposalStatus.PENDING:
        latest_terms.transition_status(
            TermsProposalStatus.SUPERSEDED,
            responded_at=now,
        )

    latest_version = latest_terms.version if latest_terms else 0
    next_version = latest_version + 1

    TenancyTermsHistory.objects.create(
        tenancy=tenancy,
        version=next_version,
        proposed_by=owner,
        monthly_rent=tenancy.monthly_rent,
        security_deposit=tenancy.security_deposit,
        start_date=tenancy.start_date,
        end_date=tenancy.end_date,
        rent_due_day=tenancy.rent_due_day,
        notes=tenancy.notes,
        status=TermsProposalStatus.PENDING,
    )

    create_notification(
        user=tenancy.tenant,
        notification_type=NotificationType.TENANCY_PROPOSED,
        title="Tenancy proposal terms updated",
        message=f"The owner has updated the tenancy proposal terms for '{property.title}'. Please review and approve the new terms.",
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )

    return tenancy


@transaction.atomic
def activate_tenancy(
    *,
    owner,
    tenancy_id,
    move_in_date=None,
):
    """Activate a confirmed tenancy and record actual move-in."""

    property, tenancy = _get_locked_property_and_tenancy(
        tenancy_id=tenancy_id
    )

    _verify_property_owner(property=property, owner=owner)

    if tenancy.status != TenancyStatus.CONFIRMED:
        if tenancy.status == TenancyStatus.PENDING:
            raise TenancyStateError(
                {"status": "Cannot activate tenancy. The tenant has not yet accepted the proposed terms."}
            )
        if tenancy.status == TenancyStatus.REJECTED:
            raise TenancyStateError(
                {"status": "Rejected tenancy proposals cannot be activated."}
            )
        raise TenancyStateError(
            {"status": "Only confirmed tenancies can be activated."}
        )

    _verify_property_available_for_tenancy(
        property=property,
        exclude_tenancy_id=tenancy.pk,
    )
    _check_overlapping_tenancies(
        property=property,
        start_date=tenancy.start_date,
        end_date=tenancy.end_date,
        exclude_tenancy_id=tenancy.pk,
    )

    move_in_date = move_in_date or timezone.localdate()

    tenancy.actual_move_in_date = move_in_date
    tenancy.status = TenancyStatus.ACTIVE

    _save_tenancy(tenancy=tenancy)

    # Ensure a published listing cannot remain available.
    _pause_published_listing(
        property=property,
        owner=owner,
    )

    property.status = PropertyStatus.OCCUPIED
    property.save(update_fields=["status", "updated_at"])

    # Generate initial rent charge for active tenancy via rent service
    from apps.rent.services import generate_initial_rent_charge
    generate_initial_rent_charge(tenancy=tenancy)

    create_notification(
        user=tenancy.tenant,
        notification_type=NotificationType.TENANCY_ACTIVATED,
        title="Tenancy activated",
        message="Your tenancy is now active.",
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )
    return tenancy


@transaction.atomic
def cancel_tenancy(*, owner, tenancy_id):
    """Cancel a pending or confirmed tenancy."""

    property, tenancy = _get_locked_property_and_tenancy(
        tenancy_id=tenancy_id
    )

    _verify_property_owner(property=property, owner=owner)

    if tenancy.status not in (
        TenancyStatus.PENDING,
        TenancyStatus.CONFIRMED,
        TenancyStatus.REJECTED,
    ):
        raise TenancyStateError(
            {"status": "Only pending, confirmed, or rejected tenancies can be cancelled."}
        )

    tenancy.status = TenancyStatus.CANCELLED
    _save_tenancy(tenancy=tenancy)

    if tenancy.application_id:
        linked_application = (
            Application.objects
            .select_for_update()
            .filter(pk=tenancy.application_id)
            .first()
        )
        if linked_application and linked_application.status == ApplicationStatus.APPROVED:
            linked_application.status = ApplicationStatus.TENANCY_CANCELLED
            linked_application.save(update_fields=["status", "updated_at"])
            ApplicationStatusHistory.objects.create(
                application=linked_application,
                previous_status=ApplicationStatus.APPROVED,
                new_status=ApplicationStatus.TENANCY_CANCELLED,
                changed_by=owner,
                change_reason="Linked tenancy was cancelled by the property owner.",
            )

    create_notification(
        user=tenancy.tenant,
        notification_type=NotificationType.TENANCY_CANCELLED,
        title="Tenancy cancelled",
        message="Your tenancy has been cancelled by the property owner.",
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )

    # Do not automatically republish the listing.
    return tenancy


def get_tenancy_settlement_preview(*, owner, tenancy_id) -> dict:
    """
    Returns pre-calculated settlement numbers for checkout:
    agreed deposit, deposit received, prior refunds, and current deposit held.
    """
    property, tenancy = _get_locked_property_and_tenancy(tenancy_id=tenancy_id)
    _verify_property_owner(property=property, owner=owner)

    from django.db.models import Sum
    from apps.rent.models import (
        PaymentAllocation,
        PaymentRefund,
        PaymentRefundStatus,
        PaymentStatus,
        RentCharge,
        RentChargeType,
    )

    deposit_charges = RentCharge.objects.filter(
        tenancy=tenancy, charge_type=RentChargeType.SECURITY_DEPOSIT
    )
    agreed_deposit = tenancy.security_deposit or Decimal("0.00")
    deposit_allocations = PaymentAllocation.objects.filter(
        tenancy=tenancy,
        rent_charge__in=deposit_charges,
        payment__status=PaymentStatus.COMPLETED,
    )
    effective_deposit_received = sum(
        (a.effective_amount for a in deposit_allocations), Decimal("0.00")
    )

    prior_refunds = (
        PaymentRefund.objects.filter(
            payment__tenancy=tenancy,
            payment__allocations__rent_charge__in=deposit_charges,
            status=PaymentRefundStatus.COMPLETED,
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    deposit_held = max(Decimal("0.00"), effective_deposit_received - prior_refunds)

    return {
        "tenancy_id": tenancy.id,
        "agreed_deposit": str(agreed_deposit.quantize(Decimal("0.01"))),
        "deposit_received": str(effective_deposit_received.quantize(Decimal("0.01"))),
        "prior_refunds": str(prior_refunds.quantize(Decimal("0.01"))),
        "deposit_held": str(deposit_held.quantize(Decimal("0.01"))),
        "max_refundable_amount": str(deposit_held.quantize(Decimal("0.01"))),
        "status": tenancy.status,
    }


@transaction.atomic
def end_tenancy(
    *,
    owner,
    tenancy_id,
    move_out_date=None,
    settle_deposit=False,
    deductions=None,
    refund_amount=None,
    refund_reference=None,
):
    """
    End an active tenancy and record actual move-out.
    Optionally settles the security deposit: records itemised deductions
    and executes net refund via PaymentRefund and reversal services.
    Enforces: Total deductions + completed refunds <= effective deposit received.
    """

    property, tenancy = _get_locked_property_and_tenancy(
        tenancy_id=tenancy_id
    )

    _verify_property_owner(property=property, owner=owner)

    if tenancy.status != TenancyStatus.ACTIVE:
        raise TenancyStateError(
            {"status": "Only active tenancies can be ended."}
        )

    move_out_date = move_out_date or timezone.localdate()

    if settle_deposit:
        from django.db.models import Sum
        from apps.rent.models import (
            Payment,
            PaymentAllocation,
            PaymentRefund,
            PaymentRefundStatus,
            PaymentStatus,
            RentCharge,
            RentChargeStatus,
            RentChargeType,
        )
        from apps.rent.services import create_refund

        deposit_charges = RentCharge.objects.filter(
            tenancy=tenancy, charge_type=RentChargeType.SECURITY_DEPOSIT
        )
        deposit_allocations = PaymentAllocation.objects.filter(
            tenancy=tenancy,
            rent_charge__in=deposit_charges,
            payment__status=PaymentStatus.COMPLETED,
        )
        effective_deposit_received = sum(
            (a.effective_amount for a in deposit_allocations), Decimal("0.00")
        )

        prior_refunds = (
            PaymentRefund.objects.filter(
                payment__tenancy=tenancy,
                payment__allocations__rent_charge__in=deposit_charges,
                status=PaymentRefundStatus.COMPLETED,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        total_deductions = Decimal("0.00")
        deduction_items_text = []

        if deductions:
            for idx, item in enumerate(deductions):
                try:
                    amt = Decimal(str(item.get("amount", "0"))).quantize(Decimal("0.01"))
                except Exception:
                    raise TenancyStateError({"deductions": f"Invalid amount in deduction item #{idx + 1}."})

                if amt <= Decimal("0.00"):
                    raise TenancyStateError({"deductions": f"Deduction amount must be strictly greater than zero in item #{idx + 1}."})

                reason = str(item.get("reason") or "").strip()
                if not reason:
                    raise TenancyStateError({"deductions": f"Reason is required for deduction item #{idx + 1}."})

                total_deductions += amt
                deduction_items_text.append(f"{reason} (₹{amt})")

        refund_val = Decimal(str(refund_amount or "0.00")).quantize(Decimal("0.01"))
        if refund_val < Decimal("0.00"):
            raise TenancyStateError({"settlement": "Refund amount cannot be negative."})

        # Invariant check: deductions + prior refunds + new refund <= deposit received
        if total_deductions + prior_refunds + refund_val > effective_deposit_received:
            raise TenancyStateError({
                "settlement": (
                    f"Total deductions (₹{total_deductions}) and refund (₹{refund_val}) "
                    f"exceed effective deposit held (₹{effective_deposit_received - prior_refunds})."
                )
            })

        # Option A Record for Deductions
        if total_deductions > Decimal("0.00"):
            summary_text = "; ".join(deduction_items_text)
            deduction_desc = f"Move-out deductions: {summary_text} [Approved by {owner.email} on {move_out_date}]"[:255]
            RentCharge.objects.create(
                tenancy=tenancy,
                charge_type=RentChargeType.MAINTENANCE,
                billing_period_start=move_out_date,
                billing_period_end=move_out_date,
                due_date=move_out_date,
                amount=total_deductions,
                status=RentChargeStatus.PAID,
                description=deduction_desc,
            )

        # Process Refund if requested
        if refund_val > Decimal("0.00"):
            dep_payment = Payment.objects.filter(
                tenancy=tenancy,
                allocations__rent_charge__in=deposit_charges,
                status=PaymentStatus.COMPLETED,
            ).first()
            if not dep_payment:
                dep_payment = Payment.objects.filter(
                    tenancy=tenancy, status=PaymentStatus.COMPLETED
                ).first()

            if not dep_payment:
                raise TenancyStateError({
                    "settlement": "Cannot process refund: no completed deposit payment found for this tenancy."
                })

            refund_reason = f"Checkout deposit settlement: Refund ₹{refund_val} (Deductions: ₹{total_deductions})"
            create_refund(
                user=owner,
                payment_id=dep_payment.id,
                amount=refund_val,
                reason=refund_reason[:255],
                refund_reference=refund_reference,
                status=PaymentRefundStatus.COMPLETED,
            )

    tenancy.actual_move_out_date = move_out_date
    tenancy.status = TenancyStatus.ENDED

    _save_tenancy(tenancy=tenancy)

    # Only mark the property available if no other active tenancy exists
    # and the property is not in maintenance or inactive status.
    has_other_active_tenancy = Tenancy.objects.filter(
        property=property,
        status=TenancyStatus.ACTIVE,
    ).exclude(pk=tenancy.pk).exists()

    if not has_other_active_tenancy and property.status not in {
        PropertyStatus.MAINTENANCE,
        PropertyStatus.INACTIVE,
    }:
        property.status = PropertyStatus.AVAILABLE
        property.save(update_fields=["status", "updated_at"])

    create_notification(
        user=tenancy.tenant,
        notification_type=NotificationType.TENANCY_ENDED,
        title="Tenancy ended",
        message="Your tenancy has officially ended.",
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )
    
    # The listing intentionally remains paused.
    return tenancy
