from typing import Optional, Tuple
import uuid

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Prefetch

from apps.listings.models import Listing, ListingStatus, SavedProperty
from apps.listings.services.exceptions import (
    ListingOwnershipError,
    PropertyNotDiscoverableError,
)
from apps.properties.models import Property


def _verify_user_authentication(user) -> None:
    """Verify that the user is authenticated."""
    if not user or not getattr(user, "is_authenticated", False):
        raise ListingOwnershipError(
            {"user": "An authenticated user is required for this operation."}
        )


def is_property_discoverable(property_instance: Property) -> bool:
    """
    Determine whether a physical property is currently publicly discoverable.
    In accordance with marketplace visibility rules, a property is discoverable
    if and only if it has an active published listing.
    """
    return Listing.objects.filter(
        property=property_instance,
        status=ListingStatus.PUBLISHED,
    ).exists()


@transaction.atomic
def save_property(
    *,
    user,
    property_instance: Optional[Property] = None,
    property_id: Optional[uuid.UUID] = None,
) -> Tuple[SavedProperty, bool]:
    """
    Bookmark a property for the authenticated user.

    - Verifies user authentication.
    - Resolves property instance if only ID is provided.
    - Enforces that only properties with an active published listing can be saved.
    - Concurrency-safe and idempotent: repeated saves return the existing record
      without raising duplicate constraint errors.
    - Returns (saved_property_instance, created_boolean).
    """
    _verify_user_authentication(user)

    if property_instance is None:
        if property_id is None:
            raise ValidationError({"property_id": "A property or property_id must be provided."})
        try:
            property_instance = Property.objects.get(pk=property_id)
        except (Property.DoesNotExist, ValueError):
            raise ValidationError({"property_id": "Specified property does not exist."})

    # Enforce discovery rule: only properties with published listings can be bookmarked
    if not is_property_discoverable(property_instance):
        raise PropertyNotDiscoverableError(
            {"property": "Cannot save property. Only properties with active published listings can be saved."}
        )

    # Idempotent bookmark creation
    try:
        saved_property, created = SavedProperty.objects.get_or_create(
            user=user,
            property=property_instance,
        )
    except IntegrityError:
        saved_property = SavedProperty.objects.get(
            user=user,
            property=property_instance,
        )
        created = False

    return saved_property, created


def get_saved_properties(*, user):
    """
    Retrieve all saved property bookmarks for the authenticated user.

    - Scoped strictly to the requesting user.
    - Ordered chronologically (newest bookmark first).
    - Optimizes related queries using select_related and prefetch_related,
      including prefetching currently published listings to assess real-time availability.
    """
    _verify_user_authentication(user)

    published_listings_prefetch = Prefetch(
        "property__listings",
        queryset=Listing.objects.filter(status=ListingStatus.PUBLISHED),
        to_attr="active_published_listings",
    )

    return (
        SavedProperty.objects.filter(user=user)
        .select_related("property")
        .prefetch_related(
            "property__images",
            "property__amenities",
            published_listings_prefetch,
        )
        .order_by("-created_at")
    )


def remove_saved_property(*, user, property_id: uuid.UUID) -> bool:
    """
    Remove a saved property bookmark for the authenticated user.

    - Scoped strictly to the requesting user: User A cannot delete User B's bookmark.
    - Idempotent: repeated removals return gracefully without unhandled exceptions.
    - Returns True if a bookmark was deleted, False if none existed.
    """
    _verify_user_authentication(user)

    deleted_count, _ = SavedProperty.objects.filter(
        user=user,
        property_id=property_id,
    ).delete()

    return deleted_count > 0

