from django.db import transaction

from apps.properties.models import Amenity, PropertyAmenity
from apps.properties.services.exceptions import InvalidAmenityError


def validate_active_amenities(amenity_ids):
    """
    Validate that all provided amenity IDs exist and are active.
    Returns the queryset of active Amenity instances.
    Raises InvalidAmenityError if any ID is missing, duplicate, or inactive.
    """
    if not amenity_ids:
        return Amenity.objects.none()

    unique_ids = set(amenity_ids)
    active_amenities = Amenity.objects.filter(id__in=unique_ids, is_active=True)

    if active_amenities.count() != len(unique_ids):
        found_ids = set(active_amenities.values_list("id", flat=True))
        invalid_ids = [str(aid) for aid in unique_ids if aid not in found_ids]
        raise InvalidAmenityError(
            f"The following amenity IDs are invalid, nonexistent, or inactive: {', '.join(invalid_ids)}"
        )

    return active_amenities


@transaction.atomic
def assign_property_amenities(*, property_instance, amenity_ids):
    """
    Assign active amenities to a property without duplicating existing ones.
    """
    if not amenity_ids:
        return []

    active_amenities = validate_active_amenities(amenity_ids)

    existing_amenity_ids = set(
        PropertyAmenity.objects.filter(property=property_instance).values_list(
            "amenity_id", flat=True
        )
    )

    new_associations = []
    for amenity in active_amenities:
        if amenity.id not in existing_amenity_ids:
            new_associations.append(
                PropertyAmenity(property=property_instance, amenity=amenity)
            )

    if new_associations:
        PropertyAmenity.objects.bulk_create(new_associations)

    return new_associations


@transaction.atomic
def sync_property_amenities(*, property_instance, amenity_ids):
    """
    Synchronize property amenities to match the provided list of amenity IDs exactly.
    Deletes removed amenities and adds new active amenities.
    """
    if amenity_ids is None:
        return

    unique_ids = set(amenity_ids)
    if unique_ids:
        validate_active_amenities(unique_ids)

    current_associations = PropertyAmenity.objects.filter(property=property_instance)
    current_amenity_ids = set(current_associations.values_list("amenity_id", flat=True))

    # Determine deletions and additions
    to_delete = current_amenity_ids - unique_ids
    to_add = unique_ids - current_amenity_ids

    if to_delete:
        current_associations.filter(amenity_id__in=to_delete).delete()

    if to_add:
        new_records = [
            PropertyAmenity(property=property_instance, amenity_id=aid)
            for aid in to_add
        ]
        PropertyAmenity.objects.bulk_create(new_records)

