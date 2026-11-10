from django.core.exceptions import ValidationError
from django.db import transaction

from apps.properties.models import Property
from apps.properties.services.amenity_service import (
    assign_property_amenities,
    sync_property_amenities,
)
from apps.properties.services.exceptions import PropertyOwnershipError

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


@transaction.atomic
def update_property(*, property_instance, validated_data, amenity_ids=None):
    """
    Update an existing property.
    Enforces that ownership cannot be altered through update operations.
    Runs full model validation before saving.
    Optionally synchronizes associated amenities.
    """
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

    # Update attributes on model instance
    for field_name, value in clean_data.items():
        setattr(property_instance, field_name, value)

    # Explicitly run full model validation before saving
    property_instance.full_clean()
    property_instance.save()

    # Synchronize amenities if amenity_ids was explicitly passed
    if amenity_ids is not None:
        sync_property_amenities(
            property_instance=property_instance,
            amenity_ids=amenity_ids,
        )

    return property_instance


@transaction.atomic
def delete_property(*, property_instance):
    """
    Delete a property instance within an atomic transaction.
    """
    property_instance.delete()
    return True

