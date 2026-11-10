import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from apps.listings.models import Listing, ListingStatus, ReviewStatus
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType

User = get_user_model()


class ListingModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_listing@example.com",
            password="securepassword123",
            first_name="Alice",
            last_name="Owner",
            is_owner=True,
        )
        self.reviewer = User.objects.create_superuser(
            email="admin_listing@example.com",
            password="securepassword123",
            first_name="Bob",
            last_name="Admin",
        )
        self.property = Property.objects.create(
            owner=self.owner,
            title="Sunny Villa 101",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            address_line_1="100 Beach Road",
            locality="Calicut Beach",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            status=PropertyStatus.DRAFT,
        )
        self.valid_listing_data = {
            "property": self.property,
            "title": "Luxury Sea View Villa for Rent",
            "description": "Stunning villa overlooking the Arabian Sea with full amenities.",
            "monthly_rent": Decimal("45000.00"),
            "security_deposit": Decimal("150000.00"),
            "available_from": timezone.now().date(),
            "status": ListingStatus.DRAFT,
            "review_status": ReviewStatus.PENDING,
        }

    # ============================================================
    # 1. Listing Creation & UUID Primary Key
    # ============================================================
    def test_listing_creation_and_uuid(self):
        listing = Listing.objects.create(**self.valid_listing_data)

        self.assertIsInstance(listing.id, uuid.UUID)
        self.assertEqual(listing.title, "Luxury Sea View Villa for Rent")
        self.assertEqual(listing.monthly_rent, Decimal("45000.00"))
        self.assertEqual(listing.security_deposit, Decimal("150000.00"))
        self.assertEqual(listing.status, ListingStatus.DRAFT)
        self.assertEqual(listing.review_status, ReviewStatus.PENDING)
        self.assertIsNotNone(listing.created_at)
        self.assertIsNotNone(listing.updated_at)
        self.assertIsNone(listing.published_at)

    def test_listing_string_representation(self):
        listing = Listing.objects.create(**self.valid_listing_data)
        self.assertEqual(str(listing), f"{listing.title} (Draft)")

    # ============================================================
    # 2. Ownership Resolution via Property
    # ============================================================
    def test_listing_owner_derived_from_property(self):
        listing = Listing.objects.create(**self.valid_listing_data)
        self.assertEqual(listing.owner, self.owner)
        self.assertEqual(listing.property.owner, self.owner)

    # ============================================================
    # 3. Monthly Rent Constraints (>= 0)
    # ============================================================
    def test_negative_monthly_rent_raises_validation_error(self):
        data = self.valid_listing_data.copy()
        data["monthly_rent"] = Decimal("-100.00")
        listing = Listing(**data)

        with self.assertRaises(ValidationError) as ctx:
            listing.full_clean()
        self.assertIn("monthly_rent", ctx.exception.message_dict)

    def test_negative_monthly_rent_violates_db_check_constraint(self):
        data = self.valid_listing_data.copy()
        data["monthly_rent"] = Decimal("-50.00")
        listing = Listing(**data)

        with self.assertRaises((IntegrityError, ValidationError)):
            with transaction.atomic():
                listing.save()

    def test_zero_monthly_rent_is_permitted(self):
        data = self.valid_listing_data.copy()
        data["monthly_rent"] = Decimal("0.00")
        listing = Listing.objects.create(**data)
        self.assertEqual(listing.monthly_rent, Decimal("0.00"))

    # ============================================================
    # 4. Security Deposit Constraints (>= 0 when not null)
    # ============================================================
    def test_nullable_security_deposit_allowed(self):
        data = self.valid_listing_data.copy()
        data["security_deposit"] = None
        listing = Listing.objects.create(**data)
        self.assertIsNone(listing.security_deposit)

    def test_negative_security_deposit_raises_validation_error(self):
        data = self.valid_listing_data.copy()
        data["security_deposit"] = Decimal("-500.00")
        listing = Listing(**data)

        with self.assertRaises(ValidationError) as ctx:
            listing.full_clean()
        self.assertIn("security_deposit", ctx.exception.message_dict)

    def test_negative_security_deposit_violates_db_check_constraint(self):
        data = self.valid_listing_data.copy()
        data["security_deposit"] = Decimal("-10.00")
        listing = Listing(**data)

        with self.assertRaises((IntegrityError, ValidationError)):
            with transaction.atomic():
                listing.save()

    # ============================================================
    # 5. Partial Unique Constraint: uq_property_single_open_listing
    # ============================================================
    def test_cannot_have_two_draft_listings_for_same_property(self):
        Listing.objects.create(**self.valid_listing_data)

        duplicate_data = self.valid_listing_data.copy()
        duplicate_data["title"] = "Second Draft Listing"
        duplicate_listing = Listing(**duplicate_data)

        with self.assertRaises(ValidationError) as ctx:
            duplicate_listing.full_clean()
        self.assertIn("property", ctx.exception.message_dict)

        with self.assertRaises((IntegrityError, ValidationError)):
            with transaction.atomic():
                duplicate_listing.save()

    def test_cannot_have_draft_and_published_listing_for_same_property(self):
        Listing.objects.create(**self.valid_listing_data)  # Status: DRAFT

        published_data = self.valid_listing_data.copy()
        published_data["title"] = "Published Listing"
        published_data["status"] = ListingStatus.PUBLISHED
        duplicate_listing = Listing(**published_data)

        with self.assertRaises((IntegrityError, ValidationError)):
            with transaction.atomic():
                duplicate_listing.save()

    def test_closed_listing_permits_new_open_listing(self):
        # 1. First listing is closed
        first_listing_data = self.valid_listing_data.copy()
        first_listing_data["status"] = ListingStatus.CLOSED
        Listing.objects.create(**first_listing_data)

        # 2. A second listing can now be opened in draft status
        second_listing_data = self.valid_listing_data.copy()
        second_listing_data["title"] = "New Open Listing"
        second_listing_data["status"] = ListingStatus.DRAFT
        second_listing = Listing.objects.create(**second_listing_data)

        self.assertEqual(second_listing.status, ListingStatus.DRAFT)
        self.assertEqual(Listing.objects.filter(property=self.property).count(), 2)

    # ============================================================
    # 6. Publication Timestamping
    # ============================================================
    def test_publishing_listing_sets_published_at_automatically(self):
        data = self.valid_listing_data.copy()
        data["status"] = ListingStatus.PUBLISHED
        listing = Listing.objects.create(**data)

        self.assertIsNotNone(listing.published_at)

    def test_republishing_paused_listing_preserves_original_published_at(self):
        # 1. Create published listing
        data = self.valid_listing_data.copy()
        data["status"] = ListingStatus.PUBLISHED
        listing = Listing.objects.create(**data)
        original_published_at = listing.published_at

        # 2. Pause listing
        listing.status = ListingStatus.PAUSED
        listing.save()
        self.assertEqual(listing.published_at, original_published_at)

        # 3. Republish listing
        listing.status = ListingStatus.PUBLISHED
        listing.save()
        self.assertEqual(listing.published_at, original_published_at)

    # ============================================================
    # 7. Review Fields (nullable)
    # ============================================================
    def test_review_fields_assignment(self):
        listing = Listing.objects.create(**self.valid_listing_data)
        listing.review_status = ReviewStatus.APPROVED
        listing.reviewed_by = self.reviewer
        listing.reviewed_at = timezone.now()
        listing.save()

        listing.refresh_from_db()
        self.assertEqual(listing.review_status, ReviewStatus.APPROVED)
        self.assertEqual(listing.reviewed_by, self.reviewer)
        self.assertIsNotNone(listing.reviewed_at)
        self.assertIsNone(listing.rejection_reason)
