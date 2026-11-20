from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.listings.models import Listing, ListingStatus, ReviewStatus
from apps.listings.services import (
    approve_listing,
    close_listing,
    create_listing,
    get_public_listings_queryset,
    pause_listing,
    publish_listing,
    reject_listing,
    submit_listing_for_approval,
    update_listing,
)
from apps.listings.services.exceptions import (
    ListingOwnershipError,
    ListingStateError,
    PropertyImageRequiredError,
)
from apps.notifications.models import Notification, NotificationType
from apps.properties.models import Property, PropertyCategory, PropertyImage, PropertyStatus, PropertyType

User = get_user_model()


class AdminListingModerationTests(TestCase):
    """
    Comprehensive verification of Admin Listing Moderation across all 15 required business scenarios.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Users
        self.owner = User.objects.create_user(
            email="owner.moderation@example.com",
            password="StrongPassword123!",
            first_name="Alice",
            last_name="Owner",
            is_active=True,
            is_owner=True,
        )
        self.other_owner = User.objects.create_user(
            email="other.owner@example.com",
            password="StrongPassword123!",
            first_name="Bob",
            last_name="Owner",
            is_active=True,
            is_owner=True,
        )
        self.tenant = User.objects.create_user(
            email="tenant.moderation@example.com",
            password="StrongPassword123!",
            first_name="Charlie",
            last_name="Tenant",
            is_active=True,
        )
        self.admin = User.objects.create_superuser(
            email="admin.moderation@example.com",
            password="StrongPassword123!",
            first_name="Diana",
            last_name="Admin",
            is_platform_admin=True,
        )

        # 2. Properties
        self.property = Property.objects.create(
            owner=self.owner,
            title="Sunrise Luxury Flat",
            description="Premium apartment overlooking city center.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="MG Road 12",
            locality="Central",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682001",
            country_code="IN",
            bedrooms=3,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )

        # Property with image
        self.image = PropertyImage.objects.create(
            property=self.property,
            image_url="https://images.example.com/kochi/sunrise.jpg",
            caption="Living Room",
            is_primary=True,
        )

        # Property without images for validation tests
        self.property_no_image = Property.objects.create(
            owner=self.owner,
            title="Bare Shell Unit",
            description="No photos uploaded yet.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Industrial Area 4",
            locality="Kalamassery",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="683104",
            country_code="IN",
            bedrooms=2,
            bathrooms=Decimal("1.0"),
            status=PropertyStatus.AVAILABLE,
        )

    # ------------------------------------------------------------
    # 1. Newly created listings are drafts and not public
    # ------------------------------------------------------------
    def test_01_newly_created_listings_are_drafts_and_not_public(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse("listings:listing-list")
        payload = {
            "property_id": str(self.property.id),
            "title": "Kochi City Center Apartment",
            "description": "Lovely flat.",
            "monthly_rent": "30000.00",
            "security_deposit": "90000.00",
            "available_from": str(date.today() + timedelta(days=7)),
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        listing_data = res.data["data"]

        self.assertEqual(listing_data["status"], "draft")
        self.assertEqual(listing_data["review_status"], "draft")
        self.assertIsNone(listing_data["published_at"])

        # Check public list endpoint: must NOT return the newly created listing
        self.client.force_authenticate(user=None)
        public_res = self.client.get(url)
        self.assertEqual(public_res.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in public_res.data["results"]]
        self.assertNotIn(listing_data["id"], ids)

    # ------------------------------------------------------------
    # 2. Saving a draft does not submit it
    # ------------------------------------------------------------
    def test_02_saving_draft_does_not_submit_it(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Draft Listing",
                "monthly_rent": Decimal("25000.00"),
            },
        )
        self.assertEqual(listing.status, ListingStatus.DRAFT)
        self.assertEqual(listing.review_status, ReviewStatus.DRAFT)

        # Update editable details
        updated = update_listing(
            owner=self.owner,
            listing_instance=listing,
            validated_data={"title": "Updated Draft Title"},
        )
        self.assertEqual(updated.status, ListingStatus.DRAFT)
        self.assertEqual(updated.review_status, ReviewStatus.DRAFT)

    # ------------------------------------------------------------
    # 3. Owner can submit a valid draft
    # ------------------------------------------------------------
    def test_03_owner_can_submit_valid_draft(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Draft Flat to Submit",
                "monthly_rent": Decimal("35000.00"),
            },
        )

        self.client.force_authenticate(user=self.owner)
        url = reverse("listings:listing-submit", kwargs={"pk": listing.id})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["status"], "draft")
        self.assertEqual(res.data["data"]["review_status"], "pending")

        listing.refresh_from_db()
        self.assertEqual(listing.status, ListingStatus.DRAFT)
        self.assertEqual(listing.review_status, ReviewStatus.PENDING)

    # ------------------------------------------------------------
    # 4. Listings without required images cannot be submitted
    # ------------------------------------------------------------
    def test_04_listings_without_required_images_cannot_be_submitted(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property_no_image,
            validated_data={
                "title": "Photo-less Flat",
                "monthly_rent": Decimal("18000.00"),
            },
        )

        # Service layer check
        with self.assertRaises(PropertyImageRequiredError):
            submit_listing_for_approval(owner=self.owner, listing_instance=listing)

        # API check
        self.client.force_authenticate(user=self.owner)
        url = reverse("listings:listing-submit", kwargs={"pk": listing.id})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("at least one uploaded image", str(res.data))

    # ------------------------------------------------------------
    # 5. Rejected listings can be edited and resubmitted
    # ------------------------------------------------------------
    def test_05_rejected_listings_can_be_edited_and_resubmitted(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Flawed Title",
                "monthly_rent": Decimal("22000.00"),
            },
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing)

        # Admin rejects
        reject_listing(
            admin_user=self.admin,
            listing_instance=listing,
            rejection_reason="Description lacks details and photos are blurry.",
        )
        listing.refresh_from_db()
        self.assertEqual(listing.review_status, ReviewStatus.REJECTED)
        self.assertEqual(listing.rejection_reason, "Description lacks details and photos are blurry.")

        # Owner edits
        self.client.force_authenticate(user=self.owner)
        update_url = reverse("listings:listing-detail", kwargs={"pk": listing.id})
        patch_res = self.client.patch(
            update_url,
            {"title": "Polished and Corrected Apartment Title"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        # Owner resubmits
        submit_url = reverse("listings:listing-submit", kwargs={"pk": listing.id})
        sub_res = self.client.post(submit_url)
        self.assertEqual(sub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sub_res.data["data"]["review_status"], "pending")
        # Previous rejection reason must be cleared upon resubmission
        self.assertIsNone(sub_res.data["data"]["rejection_reason"])

        listing.refresh_from_db()
        self.assertEqual(listing.review_status, ReviewStatus.PENDING)
        self.assertIsNone(listing.rejection_reason)

    # ------------------------------------------------------------
    # 6. Rejection requires a reason
    # ------------------------------------------------------------
    def test_06_rejection_requires_a_reason(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Pending Flat",
                "monthly_rent": Decimal("25000.00"),
            },
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing)

        # Empty string reason
        with self.assertRaises(ValidationError):
            reject_listing(
                admin_user=self.admin,
                listing_instance=listing,
                rejection_reason="",
            )

        # Whitespace-only reason
        with self.assertRaises(ValidationError):
            reject_listing(
                admin_user=self.admin,
                listing_instance=listing,
                rejection_reason="   \n  ",
            )

    # ------------------------------------------------------------
    # 7. Non-admin users receive 403 on moderation operations
    # ------------------------------------------------------------
    def test_07_non_admin_users_cannot_perform_moderation(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Pending Approval Listing",
                "monthly_rent": Decimal("30000.00"),
            },
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing)

        # Non-admin user (tenant) attempting to approve
        with self.assertRaises(ListingOwnershipError):
            approve_listing(admin_user=self.tenant, listing_instance=listing)

        # Owner attempting to approve own listing
        with self.assertRaises(ListingOwnershipError):
            approve_listing(admin_user=self.owner, listing_instance=listing)

        # Non-admin user attempting to reject
        with self.assertRaises(ListingOwnershipError):
            reject_listing(
                admin_user=self.other_owner,
                listing_instance=listing,
                rejection_reason="Unauthorized",
            )

    # ------------------------------------------------------------
    # 8. Approved listings become publicly discoverable
    # ------------------------------------------------------------
    def test_08_approved_listings_become_publicly_discoverable(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Marketplace Ready Villa",
                "monthly_rent": Decimal("40000.00"),
            },
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing)

        # Approve by admin
        approved = approve_listing(admin_user=self.admin, listing_instance=listing)
        self.assertEqual(approved.status, ListingStatus.PUBLISHED)
        self.assertEqual(approved.review_status, ReviewStatus.APPROVED)
        self.assertEqual(approved.reviewed_by, self.admin)
        self.assertIsNotNone(approved.reviewed_at)
        self.assertIsNotNone(approved.published_at)

        # Public list endpoint
        self.client.force_authenticate(user=None)
        res = self.client.get(reverse("listings:listing-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in res.data["results"]]
        self.assertIn(str(listing.id), ids)

    # ------------------------------------------------------------
    # 9. Pending and rejected listings are excluded from public list APIs
    # ------------------------------------------------------------
    def test_09_pending_and_rejected_listings_excluded_from_public_list(self):
        # Create pending listing
        listing_pending = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Pending Item",
                "monthly_rent": Decimal("30000.00"),
            },
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing_pending)

        # Verify excluded from public queryset
        public_qs = get_public_listings_queryset()
        self.assertFalse(public_qs.filter(pk=listing_pending.pk).exists())

        # Reject listing
        reject_listing(
            admin_user=self.admin,
            listing_instance=listing_pending,
            rejection_reason="Inappropriate pricing",
        )
        self.assertFalse(public_qs.filter(pk=listing_pending.pk).exists())

        # Public API call
        self.client.force_authenticate(user=None)
        res = self.client.get(reverse("listings:listing-list"))
        ids = [item["id"] for item in res.data["results"]]
        self.assertNotIn(str(listing_pending.id), ids)

    # ------------------------------------------------------------
    # 10. Unapproved listing detail endpoints do not leak data
    # ------------------------------------------------------------
    def test_10_unapproved_listing_detail_endpoints_do_not_leak_data(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Confidential Draft Flat",
                "monthly_rent": Decimal("50000.00"),
            },
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing)

        detail_url = reverse("listings:listing-detail", kwargs={"pk": listing.id})

        # Anonymous user receives 404
        self.client.force_authenticate(user=None)
        anon_res = self.client.get(detail_url)
        self.assertEqual(anon_res.status_code, status.HTTP_404_NOT_FOUND)

        # Another tenant receives 404
        self.client.force_authenticate(user=self.tenant)
        tenant_res = self.client.get(detail_url)
        self.assertEqual(tenant_res.status_code, status.HTTP_404_NOT_FOUND)

        # Different owner receives 404
        self.client.force_authenticate(user=self.other_owner)
        other_owner_res = self.client.get(detail_url)
        self.assertEqual(other_owner_res.status_code, status.HTTP_404_NOT_FOUND)

        # True owner CAN view it
        self.client.force_authenticate(user=self.owner)
        owner_res = self.client.get(detail_url)
        self.assertEqual(owner_res.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_res.data["data"]["title"], "Confidential Draft Flat")

    # ------------------------------------------------------------
    # 11. Editing an approved listing immediately removes it from public visibility
    # ------------------------------------------------------------
    def test_11_editing_approved_listing_requires_reapproval(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Live Approved Listing",
                "monthly_rent": Decimal("40000.00"),
            },
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing)
        approve_listing(admin_user=self.admin, listing_instance=listing)

        # Verify it was public
        public_qs = get_public_listings_queryset()
        self.assertTrue(public_qs.filter(pk=listing.pk).exists())

        # Owner edits the listing details
        self.client.force_authenticate(user=self.owner)
        patch_url = reverse("listings:listing-detail", kwargs={"pk": listing.id})
        res = self.client.patch(patch_url, {"monthly_rent": "42000.00"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        listing.refresh_from_db()
        self.assertEqual(listing.status, ListingStatus.DRAFT)
        self.assertEqual(listing.review_status, ReviewStatus.DRAFT)
        self.assertIsNone(listing.published_at)

        # Immediately removed from public marketplace
        self.assertFalse(public_qs.filter(pk=listing.pk).exists())
        self.client.force_authenticate(user=None)
        pub_res = self.client.get(reverse("listings:listing-list"))
        ids = [item["id"] for item in pub_res.data["results"]]
        self.assertNotIn(str(listing.id), ids)

    # ------------------------------------------------------------
    # 12. Pausing and republishing an unchanged approved listing works without reapproval
    # ------------------------------------------------------------
    def test_12_pause_and_republish_approved_listing_works_without_reapproval(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={
                "title": "Stable Approved Flat",
                "monthly_rent": Decimal("32000.00"),
            },
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing)
        listing = approve_listing(admin_user=self.admin, listing_instance=listing)
        original_published_at = listing.published_at
        self.assertIsNotNone(original_published_at)

        # Owner pauses listing
        self.client.force_authenticate(user=self.owner)
        pause_url = reverse("listings:listing-pause", kwargs={"pk": listing.id})
        pause_res = self.client.post(pause_url)
        self.assertEqual(pause_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pause_res.data["data"]["status"], "paused")

        listing.refresh_from_db()
        self.assertEqual(listing.status, ListingStatus.PAUSED)
        self.assertEqual(listing.review_status, ReviewStatus.APPROVED)

        # Owner unpauses / republishes directly without new admin review
        pub_url = reverse("listings:listing-publish", kwargs={"pk": listing.id})
        pub_res = self.client.post(pub_url)
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_res.data["data"]["status"], "published")
        self.assertEqual(pub_res.data["data"]["review_status"], "approved")

        listing.refresh_from_db()
        self.assertEqual(listing.status, ListingStatus.PUBLISHED)
        self.assertEqual(listing.review_status, ReviewStatus.APPROVED)
        self.assertEqual(listing.published_at, original_published_at)

    # ------------------------------------------------------------
    # 13. Owners cannot manipulate moderation fields through API payloads
    # ------------------------------------------------------------
    def test_13_owners_cannot_manipulate_moderation_fields_in_payloads(self):
        self.client.force_authenticate(user=self.owner)

        # Attempt to inject review_status=approved in creation payload
        create_url = reverse("listings:listing-list")
        malicious_create_payload = {
            "property_id": str(self.property.id),
            "title": "Exploit Attempt",
            "monthly_rent": "30000.00",
            "review_status": "approved",
            "reviewed_by": str(self.admin.id),
        }
        res_create = self.client.post(create_url, malicious_create_payload, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("protected fields", str(res_create.data))

        # Create valid draft
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={"title": "Legit Draft", "monthly_rent": Decimal("30000.00")},
        )

        # Attempt to patch review_status directly
        patch_url = reverse("listings:listing-detail", kwargs={"pk": listing.id})
        malicious_patch = {
            "review_status": "approved",
            "rejection_reason": "Hacked",
            "status": "published",
        }
        res_patch = self.client.patch(patch_url, malicious_patch, format="json")
        self.assertEqual(res_patch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Forbidden fields", str(res_patch.data))

    # ------------------------------------------------------------
    # 14. Owners cannot moderate or access another owner's listing
    # ------------------------------------------------------------
    def test_14_cross_owner_isolation(self):
        listing_a = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={"title": "Owner A's Listing", "monthly_rent": Decimal("30000.00")},
        )

        # Owner B tries to submit Owner A's listing
        self.client.force_authenticate(user=self.other_owner)
        url_submit = reverse("listings:listing-submit", kwargs={"pk": listing_a.id})
        res_submit = self.client.post(url_submit)
        # Not found or forbidden under tenant/owner isolation
        self.assertIn(res_submit.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

        # Owner B tries to edit Owner A's listing
        url_edit = reverse("listings:listing-detail", kwargs={"pk": listing_a.id})
        res_edit = self.client.patch(url_edit, {"title": "Hacked Title"}, format="json")
        self.assertIn(res_edit.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

    # ------------------------------------------------------------
    # 15. Notifications dispatched on approve and reject
    # ------------------------------------------------------------
    def test_15_notifications_sent_on_moderation_decisions(self):
        listing = create_listing(
            owner=self.owner,
            property_instance=self.property,
            validated_data={"title": "Notified Flat", "monthly_rent": Decimal("30000.00")},
        )
        submit_listing_for_approval(owner=self.owner, listing_instance=listing)

        # Admin approves
        approve_listing(admin_user=self.admin, listing_instance=listing)
        notif_approved = Notification.objects.filter(
            user=self.owner,
            notification_type=NotificationType.LISTING_APPROVED,
        ).first()
        self.assertIsNotNone(notif_approved)
        self.assertIn("Approved", notif_approved.title)

        # Update to draft and reject
        listing.refresh_from_db()
        reject_listing(
            admin_user=self.admin,
            listing_instance=listing,
            rejection_reason="Rent is too high for this locality.",
        )
        notif_rejected = Notification.objects.filter(
            user=self.owner,
            notification_type=NotificationType.LISTING_REJECTED,
        ).first()
        self.assertIsNotNone(notif_rejected)
        self.assertIn("Rent is too high", notif_rejected.message)
