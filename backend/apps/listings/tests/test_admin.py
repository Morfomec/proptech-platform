from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.listings.models import Listing, ListingStatus, ReviewStatus
from apps.properties.models import Property, PropertyCategory, PropertyImage, PropertyStatus, PropertyType

User = get_user_model()


class ListingAdminModerationTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            email="admin_moderator@example.com",
            password="adminpassword123",
            first_name="Platform",
            last_name="Admin",
        )
        self.owner_user = User.objects.create_user(
            email="owner_mod@example.com",
            password="ownerpassword123",
            first_name="Oliver",
            last_name="Owner",
            is_owner=True,
        )
        self.tenant_user = User.objects.create_user(
            email="tenant_mod@example.com",
            password="tenantpassword123",
            first_name="Tina",
            last_name="Tenant",
            is_tenant=True,
        )

        self.property = Property.objects.create(
            owner=self.owner_user,
            title="Seaside Penthouse",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Marine Drive 10",
            locality="Kozhikode Beach",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            bedrooms=3,
            bathrooms=Decimal("3.0"),
            status=PropertyStatus.AVAILABLE,
        )
        self.photo1 = PropertyImage.objects.create(
            property=self.property,
            image_url="https://images.example.com/penthouse/living.jpg",
            caption="Living Room with Ocean View",
            display_order=1,
            is_primary=True,
        )
        self.photo2 = PropertyImage.objects.create(
            property=self.property,
            image_url="https://images.example.com/penthouse/master.jpg",
            caption="Master Bedroom",
            display_order=2,
            is_primary=False,
        )

        self.listing = Listing.objects.create(
            property=self.property,
            title="Seaside Penthouse for Rent",
            monthly_rent=Decimal("45000.00"),
            status=ListingStatus.DRAFT,
            review_status=ReviewStatus.PENDING,
        )

    def test_change_form_renders_photos_gallery_and_moderation_bar(self):
        self.client.force_login(self.admin_user)
        change_url = reverse("admin:listings_listing_change", args=[self.listing.pk])
        res = self.client.get(change_url)
        self.assertEqual(res.status_code, 200)

        content = res.content.decode("utf-8")
        # Photos gallery
        self.assertIn("Living Room with Ocean View", content)
        self.assertIn("Master Bedroom", content)
        self.assertIn("https://images.example.com/penthouse/living.jpg", content)
        self.assertIn("Total <strong>2</strong> photo(s) uploaded", content)

        # Moderation action bar
        self.assertIn("Awaiting Review", content)
        self.assertIn("Approve & Publish", content)
        self.assertIn("Reject Listing", content)

        # Property summary card
        self.assertIn("Seaside Penthouse", content)
        self.assertIn("3 Beds", content)
        self.assertIn("3.0 Baths", content)
        self.assertIn("Open Property Record", content)

    def test_admin_single_listing_approve_view(self):
        self.client.force_login(self.admin_user)
        approve_url = reverse("admin:listings_listing_approve", args=[self.listing.pk])

        res = self.client.get(approve_url, follow=True)
        self.assertEqual(res.status_code, 200)

        self.listing.refresh_from_db()
        self.assertEqual(self.listing.review_status, ReviewStatus.APPROVED)
        self.assertEqual(self.listing.status, ListingStatus.PUBLISHED)
        self.assertEqual(self.listing.reviewed_by, self.admin_user)
        self.assertIsNotNone(self.listing.reviewed_at)

    def test_admin_single_listing_reject_view(self):
        self.client.force_login(self.admin_user)
        reject_url = reverse("admin:listings_listing_reject", args=[self.listing.pk])

        # GET displays rejection form and pre-fills reason if provided via query param
        get_res = self.client.get(reject_url + "?reason=Photos+are+blurry")
        self.assertEqual(get_res.status_code, 200)
        content = get_res.content.decode("utf-8")
        self.assertIn("Confirm", content)
        self.assertIn("Reject Listing", content)
        self.assertIn("Photos are blurry", content)

        # POST with reason executes rejection
        post_res = self.client.post(
            reject_url,
            {"rejection_reason": "Inaccurate rent pricing for this locality."},
            follow=True,
        )
        self.assertEqual(post_res.status_code, 200)

        self.listing.refresh_from_db()
        self.assertEqual(self.listing.review_status, ReviewStatus.REJECTED)
        self.assertEqual(self.listing.status, ListingStatus.DRAFT)
        self.assertEqual(self.listing.rejection_reason, "Inaccurate rent pricing for this locality.")
        self.assertEqual(self.listing.reviewed_by, self.admin_user)

    def test_rejected_listing_hides_reject_button_and_blocks_duplicate_rejection(self):
        self.listing.review_status = ReviewStatus.REJECTED
        self.listing.rejection_reason = "Already rejected for blurry photos"
        self.listing.save()

        self.client.force_login(self.admin_user)
        change_url = reverse("admin:listings_listing_change", args=[self.listing.pk])
        res = self.client.get(change_url)
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # In moderation bar, Reject Listing button is hidden for already rejected listings
        self.assertNotIn("id=\"moderation-bar-reject-btn\"", content)
        self.assertIn("Approve & Publish", content)
        self.assertIn("Reason given to owner:", content)

        # Visiting reject view directly redirects with a warning
        reject_url = reverse("admin:listings_listing_reject", args=[self.listing.pk])
        rej_res = self.client.get(reject_url, follow=True)
        self.assertEqual(rej_res.status_code, 200)
        self.assertIn("already rejected", rej_res.content.decode("utf-8"))

    def test_resubmitted_listing_displays_resubmitted_badge_and_filter(self):
        from django.utils import timezone
        # Simulate a listing that was previously rejected and then resubmitted by the owner
        self.listing.review_status = ReviewStatus.PENDING
        self.listing.reviewed_by = self.admin_user
        self.listing.reviewed_at = timezone.now()
        self.listing.save()

        self.client.force_login(self.admin_user)

        # 1. List view table displays "Resubmitted"
        changelist_url = reverse("admin:listings_listing_changelist")
        res = self.client.get(changelist_url)
        self.assertEqual(res.status_code, 200)
        self.assertIn("Resubmitted", res.content.decode("utf-8"))

        # 2. Moderation stage filter works
        filter_res = self.client.get(changelist_url + "?moderation_stage=resubmitted")
        self.assertEqual(filter_res.status_code, 200)
        self.assertIn("Seaside Penthouse", filter_res.content.decode("utf-8"))

        # 3. Detail change page displays "Resubmitted for Review"
        change_url = reverse("admin:listings_listing_change", args=[self.listing.pk])
        detail_res = self.client.get(change_url)
        self.assertEqual(detail_res.status_code, 200)
        content = detail_res.content.decode("utf-8")
        self.assertIn("Resubmitted for Review", content)

    def test_unapproved_listings_displayed_before_approved_listings(self):
        # Create an approved listing on another property created AFTER the pending listing
        property2 = Property.objects.create(
            owner=self.owner_user,
            title="Second Property",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Marine Drive 20",
            locality="Kozhikode Beach",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )
        PropertyImage.objects.create(
            property=property2,
            image_url="https://images.example.com/penthouse/prop2.jpg",
            display_order=1,
            is_primary=True,
        )
        approved_listing = Listing.objects.create(
            property=property2,
            title="Approved Later Listing",
            monthly_rent=Decimal("60000.00"),
            status=ListingStatus.PUBLISHED,
            review_status=ReviewStatus.APPROVED,
        )

        self.client.force_login(self.admin_user)
        changelist_url = reverse("admin:listings_listing_changelist")
        res = self.client.get(changelist_url)
        self.assertEqual(res.status_code, 200)

        # Pending listing must be ordered before the approved listing in results
        results = list(res.context["cl"].queryset)
        self.assertIn(self.listing, results)
        self.assertIn(approved_listing, results)
        self.assertLess(results.index(self.listing), results.index(approved_listing))

    def test_rejected_listing_hides_reject_button_and_blocks_duplicate_rejection(self):
        self.listing.review_status = ReviewStatus.REJECTED
        self.listing.rejection_reason = "Already rejected for blurry photos"
        self.listing.save()

        self.client.force_login(self.admin_user)
        change_url = reverse("admin:listings_listing_change", args=[self.listing.pk])
        res = self.client.get(change_url)
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # In moderation bar, Reject Listing button is hidden for already rejected listings
        self.assertNotIn("id=\"moderation-bar-reject-btn\"", content)
        self.assertIn("Approve & Publish", content)
        self.assertIn("Reason given to owner:", content)

        # Visiting reject view directly redirects with a warning
        reject_url = reverse("admin:listings_listing_reject", args=[self.listing.pk])
        rej_res = self.client.get(reject_url, follow=True)
        self.assertEqual(rej_res.status_code, 200)
        self.assertIn("already rejected", rej_res.content.decode("utf-8"))

    def test_resubmitted_listing_displays_resubmitted_badge_and_filter(self):
        from django.utils import timezone
        # Simulate a listing that was previously rejected and then resubmitted by the owner
        self.listing.review_status = ReviewStatus.PENDING
        self.listing.reviewed_by = self.admin_user
        self.listing.reviewed_at = timezone.now()
        self.listing.save()

        self.client.force_login(self.admin_user)

        # 1. List view table displays "Resubmitted"
        changelist_url = reverse("admin:listings_listing_changelist")
        res = self.client.get(changelist_url)
        self.assertEqual(res.status_code, 200)
        self.assertIn("Resubmitted", res.content.decode("utf-8"))

        # 2. Moderation stage filter works
        filter_res = self.client.get(changelist_url + "?moderation_stage=resubmitted")
        self.assertEqual(filter_res.status_code, 200)
        self.assertIn("Seaside Penthouse", filter_res.content.decode("utf-8"))

        # 3. Detail change page displays "Resubmitted for Review"
        change_url = reverse("admin:listings_listing_change", args=[self.listing.pk])
        detail_res = self.client.get(change_url)
        self.assertEqual(detail_res.status_code, 200)
        content = detail_res.content.decode("utf-8")
        self.assertIn("Resubmitted for Review", content)

    def test_non_admin_cannot_access_moderation_views(self):
        self.client.force_login(self.tenant_user)
        approve_url = reverse("admin:listings_listing_approve", args=[self.listing.pk])
        res = self.client.get(approve_url)
        # Redirected to admin login or forbidden
        self.assertIn(res.status_code, [302, 403])
