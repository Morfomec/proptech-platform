from django.apps import apps
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import ProtectedError
from django.utils import timezone

from apps.core.permissions import _matches_user
from apps.properties.models import Property, PropertyStatus
from apps.properties.services.amenity_service import (
    assign_property_amenities,
    sync_property_amenities,
)
from apps.properties.services.exceptions import (
    PropertyOwnershipError,
    PropertyProtectedError,
)

FORBIDDEN_CLIENT_FIELDS = {
    "owner",
    "owner_id",
    "is_owner",
    "is_tenant",
    "is_platform_admin",
}


@transaction.atomic
def create_property(*, owner, validated_data, amenity_ids=None):
    """
    Create and persist a new property owned by the authenticated user.
    Executes model validation before saving.
    Atomically activates Owner capability (is_owner=True) upon successful persistence.
    If property creation or amenity assignment fails, owner activation is rolled back.
    """
    if not owner or not getattr(owner, "is_authenticated", False):
        raise ValidationError({"owner": "An authenticated user is required to create a property."})

    if getattr(owner, "is_platform_admin", False):
        raise PropertyOwnershipError(
            {"owner": "Platform administrators cannot create properties."}
        )

    # Sanitize payload: never allow client-supplied owner or capability flags
    clean_data = {
        key: value
        for key, value in validated_data.items()
        if key not in FORBIDDEN_CLIENT_FIELDS
    }

    # Extract amenity_ids if embedded in payload
    if amenity_ids is None and "amenity_ids" in clean_data:
        amenity_ids = clean_data.pop("amenity_ids")
    elif "amenity_ids" in clean_data:
        clean_data.pop("amenity_ids")

    # Instantiate Property with derived owner
    requested_status = clean_data.get("status", PropertyStatus.DRAFT)
    if requested_status == PropertyStatus.OCCUPIED:
        raise ValidationError(
            {"status": "New properties cannot be created directly in occupied status."}
        )

    property_instance = Property(owner=owner, **clean_data)

    # Explicitly run full model validation before saving
    property_instance.full_clean()
    property_instance.save()

    # Assign initial amenities if provided
    if amenity_ids:
        assign_property_amenities(
            property_instance=property_instance,
            amenity_ids=amenity_ids,
        )

    # Owner Capability Activation:
    # First successful property creation (including drafts) activates Owner capability
    if not owner.is_owner:
        owner.is_owner = True
        owner.save(update_fields=["is_owner", "updated_at"])

    return property_instance


def _verify_property_mutation_actor(*, property_instance, actor):
    """Verify an explicit actor is a non-admin owner of the property."""
    if actor is None:
        return

    if getattr(actor, "is_platform_admin", False):
        raise PropertyOwnershipError(
            {"owner": "Platform administrators cannot modify or delete owner properties."}
        )

    if not _matches_user(property_instance.owner_id, actor):
        raise PropertyOwnershipError(
            {"owner": "You do not have permission to modify or delete this property."}
        )


ALLOWED_PROPERTY_STATUS_TRANSITIONS = {
    PropertyStatus.DRAFT: {PropertyStatus.AVAILABLE},
    PropertyStatus.AVAILABLE: {PropertyStatus.MAINTENANCE, PropertyStatus.INACTIVE},
    PropertyStatus.MAINTENANCE: {PropertyStatus.AVAILABLE, PropertyStatus.INACTIVE},
    PropertyStatus.INACTIVE: {PropertyStatus.AVAILABLE, PropertyStatus.MAINTENANCE},
    PropertyStatus.OCCUPIED: {PropertyStatus.AVAILABLE, PropertyStatus.MAINTENANCE, PropertyStatus.INACTIVE},
}


def _apply_property_status_transition(*, property_instance, new_status):
    """
    Validate and apply controlled owner-initiated property status transitions.
    - Prevents downgrading existing properties back to draft.
    - Prevents manually setting occupied status (managed by tenancy lifecycle).
    - Prevents leaving occupied status while an active tenancy exists.
    - Pauses published listings if property transitions to maintenance or inactive.
    """
    current_status = property_instance.status
    if new_status == current_status:
        return

    if new_status == PropertyStatus.DRAFT:
        raise ValidationError(
            {"status": "An existing non-draft property cannot be reverted to draft status."}
        )

    if new_status == PropertyStatus.OCCUPIED:
        raise ValidationError(
            {"status": "Property occupancy is managed through active tenancies and cannot be set manually."}
        )

    allowed_targets = ALLOWED_PROPERTY_STATUS_TRANSITIONS.get(current_status, set())
    if new_status not in allowed_targets:
        raise ValidationError(
            {
                "status": (
                    f"Cannot transition property status from '{current_status}' to '{new_status}'."
                )
            }
        )

    if current_status == PropertyStatus.OCCUPIED:
        Tenancy = apps.get_model("leasing", "Tenancy")
        if Tenancy.objects.filter(property=property_instance, status="active").exists():
            raise ValidationError(
                {"status": "Cannot change property status while an active tenancy is ongoing."}
            )

    if new_status in {PropertyStatus.MAINTENANCE, PropertyStatus.INACTIVE}:
        Listing = apps.get_model("listings", "Listing")
        Listing.objects.filter(
            property=property_instance,
            status="published",
        ).update(status="paused", updated_at=timezone.now())

    property_instance.status = new_status


@transaction.atomic
def update_property(*, property_instance, validated_data, amenity_ids=None, actor=None):
    """
    Update an existing property.
    Enforces that ownership cannot be altered and property status transitions follow domain rules.
    Runs full model validation before saving.
    Optionally synchronizes associated amenities.
    """
    _verify_property_mutation_actor(property_instance=property_instance, actor=actor)

    # Strict ownership check: client cannot transfer or modify owner
    if "owner" in validated_data or "owner_id" in validated_data:
        new_owner = validated_data.get("owner") or validated_data.get("owner_id")
        if new_owner != property_instance.owner and new_owner != property_instance.owner_id:
            raise PropertyOwnershipError(
                {"owner": "Property ownership cannot be transferred or modified."}
            )

    clean_data = {
        key: value
        for key, value in validated_data.items()
        if key not in FORBIDDEN_CLIENT_FIELDS
    }

    # Extract amenity_ids if embedded in payload
    if amenity_ids is None and "amenity_ids" in clean_data:
        amenity_ids = clean_data.pop("amenity_ids")
    elif "amenity_ids" in clean_data:
        clean_data.pop("amenity_ids")

    locked_property = Property.objects.select_for_update().get(pk=property_instance.pk)

    if "status" in clean_data:
        new_status = clean_data.pop("status")
        _apply_property_status_transition(
            property_instance=locked_property,
            new_status=new_status,
        )

    # Update remaining attributes on model instance
    for field_name, value in clean_data.items():
        setattr(locked_property, field_name, value)

    # Explicitly run full model validation before saving
    locked_property.full_clean()
    locked_property.save()

    # Synchronize amenities if amenity_ids was explicitly passed
    if amenity_ids is not None:
        sync_property_amenities(
            property_instance=locked_property,
            amenity_ids=amenity_ids,
        )

    property_instance.refresh_from_db()
    return locked_property


@transaction.atomic
def delete_property(*, property_instance, actor=None):
    """
    Delete a property instance within an atomic transaction.
    Prevents deleting a property referenced by protected relationships such as tenancies.
    """
    _verify_property_mutation_actor(property_instance=property_instance, actor=actor)
    try:
        property_instance.delete()
    except ProtectedError as exc:
        raise PropertyProtectedError(
            {
                "property": (
                    "This property cannot be deleted because it has associated tenancies."
                )
            }
        ) from exc
    return True

