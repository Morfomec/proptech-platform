from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.core.permissions import _matches_user
from apps.leasing.models import (
    Application,
    ApplicationStatus,
    Tenancy,
    TenancyStatus,
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
    """Create a pending tenancy for an owner's property."""

    property = _get_locked_property(property_id=property_id)
    _verify_property_owner(property=property, owner=owner)
    _verify_tenant_account(tenant=tenant, property=property)

    locked_application = _resolve_and_lock_application(
        application=application,
        application_id=application_id,
        property=property,
        tenant=tenant,
    )

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
        notes=notes,
    )

    _save_tenancy(tenancy=tenancy)

    create_notification(
        user=tenancy.tenant,
        notification_type=NotificationType.TENANCY_CREATED,
        title="New tenancy created",
        message="A new tenancy has been created for you.",
        related_object_type=RelatedObjectType.TENANCY,
        related_object_id=tenancy.id,
    )

    return tenancy


@transaction.atomic
def confirm_tenancy(*, owner, tenancy_id):
    """
    Confirm a pending tenancy.
    This reserves the property and pauses its published listing.
    """

    property, tenancy = _get_locked_property_and_tenancy(
        tenancy_id=tenancy_id
    )

    _verify_property_owner(property=property, owner=owner)

    if tenancy.status != TenancyStatus.PENDING:
        raise TenancyStateError(
            {"status": "Only pending tenancies can be confirmed."}
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

    tenancy.status = TenancyStatus.CONFIRMED
    _save_tenancy(tenancy=tenancy)

    _pause_published_listing(
        property=property,
        owner=owner,
    )

    create_notification(
        user=tenancy.tenant,
        notification_type=NotificationType.TENANCY_CONFIRMED,
        title="Tenancy confirmed",
        message="Your tenancy has been confirmed by the property owner.",
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
    ):
        raise TenancyStateError(
            {"status": "Only pending or confirmed tenancies can be cancelled."}
        )

    tenancy.status = TenancyStatus.CANCELLED
    _save_tenancy(tenancy=tenancy)

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


@transaction.atomic
def end_tenancy(
    *,
    owner,
    tenancy_id,
    move_out_date=None,
):
    """End an active tenancy and record actual move-out."""

    property, tenancy = _get_locked_property_and_tenancy(
        tenancy_id=tenancy_id
    )

    _verify_property_owner(property=property, owner=owner)

    if tenancy.status != TenancyStatus.ACTIVE:
        raise TenancyStateError(
            {"status": "Only active tenancies can be ended."}
        )

    move_out_date = move_out_date or timezone.localdate()

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
