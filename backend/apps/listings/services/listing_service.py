from typing import Any, Dict, Optional

from django.db import transaction
from django.db.models import Exists, OuterRef, Q, QuerySet
from django.utils import timezone

from apps.core.permissions import _matches_user
from apps.listings.models import (
    Listing,
    ListingStatus,
    ReviewStatus,
    OPEN_LISTING_STATUSES,
)
from apps.listings.services.exceptions import (
    DuplicateOpenListingError,
    ListingNotFoundError,
    ListingOwnershipError,
    ListingStateError,
    PropertyImageRequiredError,
)
from apps.properties.models import Property, PropertyImage, PropertyStatus

EDITABLE_LISTING_FIELDS = {
    "title",
    "description",
    "monthly_rent",
    "security_deposit",
    "available_from",
}

FORBIDDEN_IMMUTABLE_FIELDS = {
    "property",
    "property_id",
    "owner",
    "owner_id",
    "status",
    "review_status",
    "reviewed_by",
    "reviewed_by_id",
    "reviewed_at",
    "rejection_reason",
    "published_at",
    "id",
    "created_at",
    "updated_at",
}


def _verify_owner_authentication(owner) -> None:
    """Verify that the supplied user is authenticated and not a platform administrator."""
    if not owner or not getattr(owner, "is_authenticated", False):
        raise ListingOwnershipError(
            {"owner": "An authenticated user is required for this operation."}
        )
    if getattr(owner, "is_platform_admin", False):
        raise ListingOwnershipError(
            {"owner": "Platform administrators have read-only oversight and cannot perform listing operations."}
        )


def _verify_listing_ownership(owner, listing_instance: Listing) -> None:
    """Verify that the listing's parent property belongs to the authenticated user."""
    _verify_owner_authentication(owner)
    if not _matches_user(listing_instance.owner, owner):
        raise ListingOwnershipError(
            {"listing": "You do not have permission to perform operations on this listing."}
        )


def _prepare_property_for_publication(property_instance: Property) -> bool:
    """
    Ensure the associated property can back a published listing.

    - Properties in 'available' status remain available (returns False).
    - Properties in 'draft' status are eligible to transition to 'available' (returns True).
    - Properties in 'occupied', 'maintenance', or 'inactive' status are rejected.
    """
    if property_instance.status == PropertyStatus.AVAILABLE:
        return False

    if property_instance.status == PropertyStatus.DRAFT:
        return True

    raise ListingStateError(
        {
            "property": (
                f"Cannot publish listing while the property is in "
                f"'{property_instance.status}' status. The property must be available."
            )
        }
    )


def _promote_draft_property_to_available(property_instance: Property) -> None:
    """Transition a draft property to available within the active atomic transaction."""
    property_instance.status = PropertyStatus.AVAILABLE
    property_instance.full_clean()
    property_instance.save(update_fields=["status", "updated_at"])


@transaction.atomic
def create_listing(
    *,
    owner,
    property_instance: Property,
    validated_data: Dict[str, Any],
    publish: bool = False,
) -> Listing:
    """
    Create a new listing for a property owned by the authenticated user.

    - Verifies the property belongs to the owner.
    - Locks the property row to prevent concurrent open listing creation.
    - Enforces that no existing open listing (draft, published, paused) exists.
    - Supports initial creation as draft or immediate publication (publish=True).
    - Publishing does not require prior admin approval.
    """
    _verify_owner_authentication(owner)

    if not _matches_user(property_instance.owner_id, owner):
        raise ListingOwnershipError(
            {"property": "You can only create listings for properties you own."}
        )

    # Acquire lock on the property to serialize concurrent listing creation
    locked_property = Property.objects.select_for_update().get(pk=property_instance.pk)

    # Check for existing open listing on this property
    has_open_listing = Listing.objects.filter(
        property=locked_property,
        status__in=OPEN_LISTING_STATUSES,
    ).exists()

    if has_open_listing:
        raise DuplicateOpenListingError(
            {
                "property": (
                    f"Property '{locked_property.title}' already has an active open listing. "
                    "Close the existing listing before creating a new one."
                )
            }
        )

    # Determine initial publication status
    wants_publish = publish or validated_data.get("status") == ListingStatus.PUBLISHED

    # Publishing validates eligibility (draft -> available or already available) and image requirement
    should_promote_property = False
    if wants_publish:
        should_promote_property = _prepare_property_for_publication(locked_property)
        if not locked_property.images.exists():
            raise PropertyImageRequiredError(
                {
                    "property": (
                        "A property must have at least one uploaded image before its listing can be published."
                    )
                }
            )

    initial_status = ListingStatus.PUBLISHED if wants_publish else ListingStatus.DRAFT

    # Sanitize payload: allow only editable content fields
    clean_data = {
        k: v for k, v in validated_data.items() if k in EDITABLE_LISTING_FIELDS
    }

    published_at_val = timezone.now() if initial_status == ListingStatus.PUBLISHED else None

    listing = Listing(
        property=locked_property,
        status=initial_status,
        published_at=published_at_val,
        review_status=ReviewStatus.PENDING,
        **clean_data,
    )

    listing.full_clean()
    listing.save()

    if should_promote_property:
        _promote_draft_property_to_available(locked_property)

    return listing


@transaction.atomic
def update_listing(
    *,
    owner,
    listing_instance: Listing,
    validated_data: Dict[str, Any],
) -> Listing:
    """
    Update editable details of an existing listing owned by the authenticated user.

    - Verifies ownership through the parent property.
    - Restricts modifications strictly to editable listing attributes:
      title, description, monthly_rent, security_deposit, available_from.
    - Rejects attempts to alter property association, ownership, review fields,
      status, or publication timestamps.
    """
    _verify_listing_ownership(owner, listing_instance)

    # Guard against attempts to mutate property or ownership
    if "property" in validated_data or "property_id" in validated_data:
        target_prop = validated_data.get("property") or validated_data.get("property_id")
        target_prop_pk = getattr(target_prop, "pk", target_prop)
        if str(target_prop_pk) != str(listing_instance.property_id):
            raise ListingOwnershipError(
                {"property": "The property association of a listing cannot be modified."}
            )

    if "owner" in validated_data or "owner_id" in validated_data:
        raise ListingOwnershipError(
            {"owner": "Listing ownership cannot be transferred or modified."}
        )

    # Lock row to avoid concurrent overwrite
    listing = Listing.objects.select_for_update().get(pk=listing_instance.pk)

    # Apply only permitted editable attributes
    for field_name in EDITABLE_LISTING_FIELDS:
        if field_name in validated_data:
            setattr(listing, field_name, validated_data[field_name])

    listing.full_clean()
    listing.save()
    return listing


@transaction.atomic
def publish_listing(
    *,
    owner,
    listing_instance: Listing,
) -> Listing:
    """
    Publish a draft or paused listing directly by the owner.

    - Verifies ownership.
    - Does not require admin review approval (review_status may remain pending or approved).
    - Idempotent if already published.
    - Prohibits publishing closed listings directly.
    - Sets published_at on initial publication and preserves it when republishing paused listings.
    """
    _verify_listing_ownership(owner, listing_instance)

    locked_property = Property.objects.select_for_update().get(pk=listing_instance.property_id)
    listing = Listing.objects.select_for_update().get(pk=listing_instance.pk)

    # Idempotent if already published
    if listing.status == ListingStatus.PUBLISHED:
        return listing

    # Reopening closed listings directly is prohibited
    if listing.status == ListingStatus.CLOSED:
        raise ListingStateError(
            {
                "status": (
                    "Closed listings cannot be published directly. "
                    "Please create a new listing for the property."
                )
            }
        )

    # Verify no other open listing exists on the property
    has_conflicting_open = (
        Listing.objects.filter(
            property_id=listing.property_id,
            status__in=OPEN_LISTING_STATUSES,
        )
        .exclude(pk=listing.pk)
        .exists()
    )

    if has_conflicting_open:
        raise DuplicateOpenListingError(
            {"property": "Another active listing is already open for this property."}
        )

    should_promote_property = _prepare_property_for_publication(locked_property)

    # Verify that the associated property has at least one uploaded image before publishing
    if not locked_property.images.exists():
        raise PropertyImageRequiredError(
            {
                "property": (
                    "A property must have at least one uploaded image before its listing can be published."
                )
            }
        )

    listing.status = ListingStatus.PUBLISHED

    # Set published_at only on first publication; preserve historical timestamp on republish
    if listing.published_at is None:
        listing.published_at = timezone.now()

    listing.full_clean()
    listing.save()

    if should_promote_property:
        _promote_draft_property_to_available(locked_property)

    return listing


@transaction.atomic
def pause_listing(
    *,
    owner,
    listing_instance: Listing,
) -> Listing:
    """
    Pause a published listing, temporarily withholding it from active display.

    - Verifies ownership.
    - Only published listings may be paused.
    - Idempotent if already paused.
    - Preserves historical published_at timestamp.
    """
    _verify_listing_ownership(owner, listing_instance)

    listing = Listing.objects.select_for_update().get(pk=listing_instance.pk)

    # Idempotent if already paused
    if listing.status == ListingStatus.PAUSED:
        return listing

    if listing.status != ListingStatus.PUBLISHED:
        raise ListingStateError(
            {
                "status": (
                    f"Cannot pause a listing in '{listing.status}' status. "
                    "Only published listings can be paused."
                )
            }
        )

    listing.status = ListingStatus.PAUSED
    listing.full_clean()
    listing.save()
    return listing


@transaction.atomic
def close_listing(
    *,
    owner,
    listing_instance: Listing,
) -> Listing:
    """
    Close an open listing (draft, published, or paused).

    - Verifies ownership.
    - Idempotent if already closed.
    - Releases the property's partial unique constraint so that new listings can be opened.
    """
    _verify_listing_ownership(owner, listing_instance)

    listing = Listing.objects.select_for_update().get(pk=listing_instance.pk)

    # Idempotent if already closed
    if listing.status == ListingStatus.CLOSED:
        return listing

    listing.status = ListingStatus.CLOSED
    listing.full_clean()
    listing.save()
    return listing


def get_listing_by_id(*, listing_id) -> Listing:
    """
    Retrieve a listing by primary key, or raise ListingNotFoundError.
    """
    try:
        return Listing.objects.select_related("property", "property__owner").get(pk=listing_id)
    except Listing.DoesNotExist:
        raise ListingNotFoundError(f"Listing with id '{listing_id}' does not exist.")


def get_public_listings_queryset(queryset: Optional[QuerySet] = None) -> QuerySet:
    """
    Filter a Listing queryset to records eligible for public rental discovery:
    - Listing status is 'published' (excludes draft, paused, closed)
    - Parent Property status is 'available' (excludes draft, maintenance, inactive, occupied)
    - Parent Property has at least one uploaded image (publication eligibility)
    """
    base_qs = queryset if queryset is not None else Listing.objects.all()
    has_image_subquery = Exists(
        PropertyImage.objects.filter(property_id=OuterRef("property_id"))
    )
    return base_qs.filter(
        has_image_subquery,
        status=ListingStatus.PUBLISHED,
        property__status=PropertyStatus.AVAILABLE,
    )


def get_visible_listings_for_user(
    *,
    user,
    queryset: Optional[QuerySet] = None,
) -> QuerySet:
    """
    Resolve listing visibility for detail endpoints:
    - Anonymous users and non-owners see only publicly discoverable listings.
    - Platform admins see all listings for read-only oversight.
    - Authenticated owners see publicly discoverable listings plus all listings
      belonging to their own properties (regardless of draft/paused/closed/inactive state).
    """
    base_qs = queryset if queryset is not None else Listing.objects.all()
    if not user or not getattr(user, "is_authenticated", False):
        return get_public_listings_queryset(base_qs)
    if getattr(user, "is_platform_admin", False):
        return base_qs

    has_image_subquery = Exists(
        PropertyImage.objects.filter(property_id=OuterRef("property_id"))
    )
    return base_qs.annotate(
        _has_property_image=has_image_subquery
    ).filter(
        Q(
            status=ListingStatus.PUBLISHED,
            property__status=PropertyStatus.AVAILABLE,
            _has_property_image=True,
        )
        | Q(property__owner=user)
    )


def get_listing_for_owner(*, owner, listing_id) -> Listing:
    """
    Retrieve a listing by primary key and verify that it belongs to the authenticated owner.
    """
    listing = get_listing_by_id(listing_id=listing_id)
    _verify_listing_ownership(owner, listing)
    return listing

