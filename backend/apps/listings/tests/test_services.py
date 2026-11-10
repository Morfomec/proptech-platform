from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.listings.models import Listing, ListingStatus, ReviewStatus
from apps.listings.services.exceptions import (
    DuplicateOpenListingError,
    ListingNotFoundError,
    ListingOwnershipError,
    ListingStateError,
    PropertyImageRequiredError,
)
from apps.listings.services.listing_service import (
    close_listing,
    create_listing,
    get_listing_by_id,
    get_listing_for_owner,
    pause_listing,
    publish_listing,
    update_listing,
)
from apps.properties.models import (
    Property,
    PropertyCategory,
    PropertyImage,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class ListingServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_service@example.com",
            password="securepassword123",
            first_name="Alice",
            last_name="Owner",
            is_owner=True,
        )
        self.other_user = User.objects.create_user(
            email="intruder@example.com",
            password="securepassword123",
            first_name="Eve",
            last_name="Intruder",
            is_owner=True,
        )
        self.property = Property.objects.create(
            owner=self.owner,
            title="Kozhikode Sea Breeze Villa",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            address_line_1="Beach Road 42",
            locality="Vellayil",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673011",
            status=PropertyStatus.DRAFT,
            # Coordinates are explicitly omitted to verify they remain optional for publishing
            latitude=None,
            longitude=None,
        )
        self.property_image = PropertyImage.objects.create(
            property=self.property,
            image_url="https://images.example.com/seabreeze/villa.jpg",
            display_order=1,
            is_primary=True,
        )
        self.property_without_image = Property.objects.create(
            owner=self.owner,
            title="Malappuram Hillside Cottage",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.INDEPENDENT_HOUSE,
            address_line_1="Hilltop Road 1",
            locality="Manjeri",
            city="Malappuram",
            district="Malappuram",
            state="Kerala",
            pin_code="676121",
            status=PropertyStatus.DRAFT,
            latitude=None,
            longitude=None,
        )
        self.valid_payload = {
            "title": "Sea Breeze Villa for Rent",
            "description": "Luxurious beachfront villa available for long-term lease.",
            "monthly_rent": Decimal("35000.00"),
            "security_deposit": Decimal("100000.00"),
            "available_from": date.today() + timedelta(days=7),
        }

    # ============================================================
    # 1. create_listing
    # ============================================================
    def test_owner_can_create_draft_listing(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=False,
        )

        self.assertIsNotNone(listing.id)
        self.assertEqual(listing.property, self.property)
        self.assertEqual(listing.owner, self.owner)
        self.assertEqual(listing.title, "Sea Breeze Villa for Rent")
        self.assertEqual(listing.status, ListingStatus.DRAFT)
        self.assertEqual(listing.review_status, ReviewStatus.PENDING)
        self.assertIsNone(listing.published_at)

    def test_owner_can_create_and_publish_immediately(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=True,
        )

        self.assertEqual(listing.status, ListingStatus.PUBLISHED)
        self.assertIsNotNone(listing.published_at)
        # Approval not required
        self.assertEqual(listing.review_status, ReviewStatus.PENDING)

    def test_non_owner_cannot_create_listing_for_property(self):
        with self.assertRaises(ListingOwnershipError):
            create_listing(
                owner=self.other_user,
                property_instance=self.property,
                validated_data=self.valid_payload,
            )

    def test_unauthenticated_owner_cannot_create_listing(self):
        class AnonymousMock:
            is_authenticated = False

        with self.assertRaises(ListingOwnershipError):
            create_listing(
                owner=AnonymousMock(),
                property_instance=self.property,
                validated_data=self.valid_payload,
            )

    def test_cannot_create_second_open_listing_for_same_property(self):
        # Create first draft listing
        create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
        )

        # Attempt to create second listing while first is draft
        with self.assertRaises(DuplicateOpenListingError):
            create_listing(
                owner=self.owner,
                property_instance=self.property,
                validated_data={"title": "Second Listing", "monthly_rent": Decimal("40000.00")},
            )

    def test_client_supplied_owner_or_review_fields_are_ignored(self):
        malicious_payload = self.valid_payload.copy()
        malicious_payload["owner"] = self.other_user
        malicious_payload["owner_id"] = self.other_user.id
        malicious_payload["review_status"] = ReviewStatus.APPROVED
        malicious_payload["reviewed_by"] = self.other_user

        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=malicious_payload,
        )

        self.assertEqual(listing.owner, self.owner)
        self.assertEqual(listing.review_status, ReviewStatus.PENDING)
        self.assertIsNone(listing.reviewed_by)

    # ============================================================
    # 2. update_listing
    # ============================================================
    def test_owner_can_update_editable_fields(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
        )

        updated = update_listing(
            owner=self.owner,
            listing_instance=listing,
            validated_data={
                "title": "Updated Sea Breeze Villa",
                "monthly_rent": Decimal("38000.00"),
                "security_deposit": Decimal("110000.00"),
                "description": "Updated description with new amenities.",
            },
        )

        self.assertEqual(updated.title, "Updated Sea Breeze Villa")
        self.assertEqual(updated.monthly_rent, Decimal("38000.00"))
        self.assertEqual(updated.security_deposit, Decimal("110000.00"))
        self.assertEqual(updated.description, "Updated description with new amenities.")

    def test_update_respects_numeric_constraints(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
        )

        with self.assertRaises(ValidationError):
            update_listing(
                owner=self.owner,
                listing_instance=listing,
                validated_data={"monthly_rent": Decimal("-500.00")},
            )

    def test_update_prohibits_altering_property_or_ownership(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
        )

        with self.assertRaises(ListingOwnershipError):
            update_listing(
                owner=self.owner,
                listing_instance=listing,
                validated_data={"owner_id": self.other_user.id},
            )

    def test_non_owner_cannot_update_listing(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
        )

        with self.assertRaises(ListingOwnershipError):
            update_listing(
                owner=self.other_user,
                listing_instance=listing,
                validated_data={"title": "Hacked Title"},
            )

    # ============================================================
    # 3. publish_listing
    # ============================================================
    def test_owner_can_publish_draft_listing(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=False,
        )
        self.assertEqual(listing.status, ListingStatus.DRAFT)
        self.assertIsNone(listing.published_at)

        published = publish_listing(owner=self.owner, listing_instance=listing)
        self.assertEqual(published.status, ListingStatus.PUBLISHED)
        self.assertIsNotNone(published.published_at)

    def test_publishing_is_idempotent_if_already_published(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=True,
        )
        first_published_at = listing.published_at

        # Publish again
        re_published = publish_listing(owner=self.owner, listing_instance=listing)
        self.assertEqual(re_published.status, ListingStatus.PUBLISHED)
        self.assertEqual(re_published.published_at, first_published_at)

    def test_cannot_publish_closed_listing_directly(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
        )
        close_listing(owner=self.owner, listing_instance=listing)

        with self.assertRaises(ListingStateError):
            publish_listing(owner=self.owner, listing_instance=listing)

    def test_cannot_publish_listing_when_property_has_no_images(self):
        draft_listing = create_listing(
            owner=self.owner,
            property_instance=self.property_without_image,
            validated_data=self.valid_payload,
            publish=False,
        )
        self.assertEqual(draft_listing.status, ListingStatus.DRAFT)

        with self.assertRaises(PropertyImageRequiredError) as exc_context:
            publish_listing(owner=self.owner, listing_instance=draft_listing)

        self.assertIn("property", exc_context.exception.message_dict)
        self.assertIn("at least one uploaded image", exc_context.exception.message_dict["property"][0])

    def test_cannot_create_and_publish_immediately_when_property_has_no_images(self):
        with self.assertRaises(PropertyImageRequiredError) as exc_context:
            create_listing(
                owner=self.owner,
                property_instance=self.property_without_image,
                validated_data=self.valid_payload,
                publish=True,
            )

        self.assertIn("property", exc_context.exception.message_dict)
        self.assertIn("at least one uploaded image", exc_context.exception.message_dict["property"][0])

    def test_owner_can_create_draft_listing_without_property_images(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property_without_image,
            validated_data=self.valid_payload,
            publish=False,
        )
        self.assertIsNotNone(listing.id)
        self.assertEqual(listing.status, ListingStatus.DRAFT)
        self.assertEqual(listing.property.images.count(), 0)

    def test_publishing_succeeds_when_image_is_added_to_property_without_images(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property_without_image,
            validated_data=self.valid_payload,
            publish=False,
        )
        # Verify initial zero-image publish attempt is blocked
        with self.assertRaises(PropertyImageRequiredError):
            publish_listing(owner=self.owner, listing_instance=listing)

        # Upload image to property
        PropertyImage.objects.create(
            property=self.property_without_image,
            image_url="https://images.example.com/hillside/main.jpg",
            display_order=1,
            is_primary=True,
        )

        published = publish_listing(owner=self.owner, listing_instance=listing)
        self.assertEqual(published.status, ListingStatus.PUBLISHED)
        self.assertIsNotNone(published.published_at)

    def test_publishing_with_images_and_no_coordinates_succeeds(self):
        # self.property has image but latitude and longitude are None
        self.assertIsNone(self.property.latitude)
        self.assertIsNone(self.property.longitude)
        self.assertTrue(self.property.images.exists())

        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=False,
        )
        published = publish_listing(owner=self.owner, listing_instance=listing)
        self.assertEqual(published.status, ListingStatus.PUBLISHED)

    def test_publishing_when_review_status_is_pending_does_not_prevent_publication(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=False,
        )
        self.assertEqual(listing.review_status, ReviewStatus.PENDING)

        published = publish_listing(owner=self.owner, listing_instance=listing)
        self.assertEqual(published.status, ListingStatus.PUBLISHED)
        self.assertEqual(published.review_status, ReviewStatus.PENDING)

    # ============================================================
    # 4. pause_listing & republishing
    # ============================================================
    def test_owner_can_pause_published_listing(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=True,
        )
        published_at = listing.published_at

        paused = pause_listing(owner=self.owner, listing_instance=listing)
        self.assertEqual(paused.status, ListingStatus.PAUSED)
        self.assertEqual(paused.published_at, published_at)

    def test_cannot_pause_draft_listing(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=False,
        )

        with self.assertRaises(ListingStateError):
            pause_listing(owner=self.owner, listing_instance=listing)

    def test_republishing_paused_listing_preserves_published_at(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=True,
        )
        original_ts = listing.published_at

        paused = pause_listing(owner=self.owner, listing_instance=listing)
        republished = publish_listing(owner=self.owner, listing_instance=paused)

        self.assertEqual(republished.status, ListingStatus.PUBLISHED)
        self.assertEqual(republished.published_at, original_ts)

    # ============================================================
    # 5. close_listing
    # ============================================================
    def test_closing_listing_releases_open_listing_restriction(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
            publish=True,
        )

        closed = close_listing(owner=self.owner, listing_instance=listing)
        self.assertEqual(closed.status, ListingStatus.CLOSED)

        # Now the property restriction is freed; owner can create a new listing
        new_listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Fresh Listing for Sea Breeze Villa",
                "monthly_rent": Decimal("39000.00"),
            },
            publish=False,
        )
        self.assertIsNotNone(new_listing.id)
        self.assertEqual(new_listing.status, ListingStatus.DRAFT)
        self.assertEqual(Listing.objects.filter(property=self.property).count(), 2)

    # ============================================================
    # 6. get_listing helpers
    # ============================================================
    def test_get_listing_by_id_and_for_owner(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data=self.valid_payload,
        )

        fetched = get_listing_by_id(listing_id=listing.id)
        self.assertEqual(fetched.id, listing.id)

        owner_fetched = get_listing_for_owner(owner=self.owner, listing_id=listing.id)
        self.assertEqual(owner_fetched.id, listing.id)

        with self.assertRaises(ListingOwnershipError):
            get_listing_for_owner(owner=self.other_user, listing_id=listing.id)

        with self.assertRaises(ListingNotFoundError):
            get_listing_by_id(listing_id="00000000-0000-0000-0000-000000000000")

