from datetime import date, timedelta
from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.listings.models import Listing, ListingStatus, ReviewStatus
from apps.properties.models import (
    Amenity,
    AmenityCategory,
    FurnishingStatus,
    Property,
    PropertyCategory,
    PropertyImage,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class ListingAPITests(APITestCase):
    def setUp(self):
        # 1. Users
        self.tenant_user = User.objects.create_user(
            email="tenant_listings@example.com",
            password="securepassword123",
            first_name="Tina",
            last_name="Tenant",
            is_tenant=True,
            is_owner=False,
        )

        self.owner_a = User.objects.create_user(
            email="owner_a_listings@example.com",
            password="securepassword123",
            first_name="Alice",
            last_name="Owner",
            is_tenant=False,
            is_owner=True,
        )

        self.owner_b = User.objects.create_user(
            email="owner_b_listings@example.com",
            password="securepassword123",
            first_name="Bob",
            last_name="Owner",
            is_tenant=False,
            is_owner=True,
        )

        self.admin_user = User.objects.create_superuser(
            email="admin_listings@example.com",
            password="securepassword123",
            first_name="Admin",
            last_name="User",
        )

        # 2. Amenities
        self.amenity = Amenity.objects.create(
            name="High-speed Wi-Fi",
            category=AmenityCategory.CONNECTIVITY,
            is_active=True,
        )

        # 3. Properties
        self.property_a = Property.objects.create(
            owner=self.owner_a,
            title="Kozhikode Sunset Villa",
            description="Spectacular sea view villa in Kozhikode.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            address_line_1="Beach Road 10",
            locality="Kozhikode Beach",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            country_code="IN",
            built_up_area=Decimal("2500.00"),
            bedrooms=4,
            bathrooms=Decimal("4.0"),
            furnishing_status=FurnishingStatus.FULLY_FURNISHED,
            parking_spaces=2,
            latitude=Decimal("11.2588"),
            longitude=Decimal("75.7804"),
            status=PropertyStatus.DRAFT,
        )
        self.property_a.amenities.add(self.amenity)
        self.image_a = PropertyImage.objects.create(
            property=self.property_a,
            image_url="https://images.example.com/kozhikode/villa.jpg",
            caption="Front Elevation",
            display_order=1,
            is_primary=True,
        )

        self.property_b = Property.objects.create(
            owner=self.owner_b,
            title="Bengaluru Tech Park Studio",
            description="Compact studio near Manyata tech park.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.STUDIO_APARTMENT,
            address_line_1="Outer Ring Road",
            locality="Hebbal",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560045",
            country_code="IN",
            status=PropertyStatus.DRAFT,
        )

        # 4. Listings for Owner A's Property A
        self.published_listing = Listing.objects.create(
            property=self.property_a,
            title="Spacious 4BHK Sea-facing Villa for Rent",
            description="Available immediately for discerning tenants.",
            monthly_rent=Decimal("45000.00"),
            security_deposit=Decimal("150000.00"),
            available_from=date.today() + timedelta(days=5),
            status=ListingStatus.PUBLISHED,
            review_status=ReviewStatus.PENDING,  # Notice: pending review should NOT block public browsing in MVP
        )

        # Secondary property for draft testing
        self.property_a2 = Property.objects.create(
            owner=self.owner_a,
            title="Wayanad Plantation Retreat",
            description="Scenic cottage surrounded by tea estates.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.INDEPENDENT_HOUSE,
            address_line_1="Estate Road 5",
            locality="Meppadi",
            city="Wayanad",
            district="Wayanad",
            state="Kerala",
            pin_code="673577",
            status=PropertyStatus.DRAFT,
        )

        self.draft_listing = Listing.objects.create(
            property=self.property_a2,
            title="Rustic Plantation Cottage for Rent",
            description="Draft listing under preparation.",
            monthly_rent=Decimal("20000.00"),
            security_deposit=Decimal("60000.00"),
            status=ListingStatus.DRAFT,
        )

        # Property for Owner B with closed listing
        self.property_b_closed = Property.objects.create(
            owner=self.owner_b,
            title="Indiranagar Duplex",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="100ft Road",
            locality="Indiranagar",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560038",
            status=PropertyStatus.DRAFT,
        )
        self.closed_listing = Listing.objects.create(
            property=self.property_b_closed,
            title="Indiranagar Duplex - Historical Listing",
            monthly_rent=Decimal("60000.00"),
            status=ListingStatus.CLOSED,
        )

    # ============================================================
    # 1. Public Browsing (List & Detail)
    # ============================================================
    def test_public_list_returns_only_published_listings(self):
        # Anonymous client
        response = self.client.get(reverse("listings:listing-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data.get("data", response.data.get("results", []))
        listing_ids = [item["id"] for item in results]

        self.assertIn(str(self.published_listing.id), listing_ids)
        self.assertNotIn(str(self.draft_listing.id), listing_ids)
        self.assertNotIn(str(self.closed_listing.id), listing_ids)

        # Verify property summary is embedded without owner private info
        published_item = next(item for item in results if item["id"] == str(self.published_listing.id))
        self.assertIn("property", published_item)
        self.assertEqual(published_item["property"]["city"], "Kozhikode")
        self.assertNotIn("owner", published_item["property"])
        self.assertNotIn("email", published_item["property"])

    def test_public_detail_published_listing_success(self):
        # Anonymous client retrieves published listing
        url = reverse("listings:listing-detail", kwargs={"pk": self.published_listing.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        data = response.data["data"]

        self.assertEqual(data["id"], str(self.published_listing.id))
        self.assertEqual(data["title"], self.published_listing.title)
        self.assertEqual(Decimal(str(data["monthly_rent"])), Decimal("45000.00"))

        # Verify embedded property detail
        prop_data = data["property"]
        self.assertEqual(prop_data["id"], str(self.property_a.id))
        self.assertEqual(prop_data["city"], "Kozhikode")
        self.assertEqual(len(prop_data["images"]), 1)
        self.assertEqual(len(prop_data["amenities"]), 1)

        # Strictly no private owner email or review details exposed to public
        self.assertNotIn("owner", prop_data)
        self.assertNotIn("email", prop_data)
        self.assertNotIn("reviewed_by", data)
        self.assertNotIn("rejection_reason", data)

    def test_public_detail_draft_or_closed_listing_returns_404(self):
        # Anonymous client accessing draft listing -> 404
        url_draft = reverse("listings:listing-detail", kwargs={"pk": self.draft_listing.id})
        res_draft = self.client.get(url_draft)
        self.assertEqual(res_draft.status_code, status.HTTP_404_NOT_FOUND)

        # Anonymous client accessing closed listing -> 404
        url_closed = reverse("listings:listing-detail", kwargs={"pk": self.closed_listing.id})
        res_closed = self.client.get(url_closed)
        self.assertEqual(res_closed.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_cannot_view_unowned_draft_listing(self):
        self.client.force_authenticate(user=self.tenant_user)
        url_draft = reverse("listings:listing-detail", kwargs={"pk": self.draft_listing.id})
        response = self.client.get(url_draft)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_view_own_draft_listing(self):
        self.client.force_authenticate(user=self.owner_a)
        url_draft = reverse("listings:listing-detail", kwargs={"pk": self.draft_listing.id})
        response = self.client.get(url_draft)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["id"], str(self.draft_listing.id))

    # ============================================================
    # 2. Owner Listings Feed (/api/v1/listings/me/)
    # ============================================================
    def test_me_endpoint_requires_authenticated_owner(self):
        # Unauthenticated -> 401
        res = self.client.get(reverse("listings:listing-me"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Tenant-only user -> 403
        self.client.force_authenticate(user=self.tenant_user)
        res_tenant = self.client.get(reverse("listings:listing-me"))
        self.assertEqual(res_tenant.status_code, status.HTTP_403_FORBIDDEN)

    def test_me_endpoint_returns_only_authenticated_owners_listings(self):
        self.client.force_authenticate(user=self.owner_a)
        res = self.client.get(reverse("listings:listing-me"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        results = res.data.get("data", res.data.get("results", []))
        listing_ids = [item["id"] for item in results]

        # Owner A owns published_listing and draft_listing
        self.assertIn(str(self.published_listing.id), listing_ids)
        self.assertIn(str(self.draft_listing.id), listing_ids)

        # Owner A does not own Owner B's closed_listing
        self.assertNotIn(str(self.closed_listing.id), listing_ids)

    def test_admin_can_view_all_listings_in_me(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get(reverse("listings:listing-me"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        results = res.data.get("data", res.data.get("results", []))
        listing_ids = [item["id"] for item in results]
        self.assertIn(str(self.published_listing.id), listing_ids)
        self.assertIn(str(self.closed_listing.id), listing_ids)

    # ============================================================
    # 3. Listing Creation (POST /api/v1/listings/)
    # ============================================================
    def test_create_listing_requires_owner_authentication(self):
        payload = {
            "property_id": str(self.property_b.id),
            "title": "Unauthenticated Attempt",
            "monthly_rent": "15000.00",
        }
        res_anon = self.client.post(reverse("listings:listing-list"), payload)
        self.assertEqual(res_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(user=self.tenant_user)
        res_tenant = self.client.post(reverse("listings:listing-list"), payload)
        self.assertEqual(res_tenant.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_create_draft_listing(self):
        self.client.force_authenticate(user=self.owner_b)
        payload = {
            "property_id": str(self.property_b.id),
            "title": "Modern Studio Apartment in Hebbal",
            "description": "Ideal for IT professionals working nearby.",
            "monthly_rent": "18000.00",
            "security_deposit": "50000.00",
            "available_from": str(date.today() + timedelta(days=10)),
            "publish": False,
        }
        res = self.client.post(reverse("listings:listing-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["success"])

        data = res.data["data"]
        self.assertEqual(data["title"], payload["title"])
        self.assertEqual(data["status"], ListingStatus.DRAFT)
        self.assertIsNone(data["published_at"])

    def test_owner_cannot_create_and_publish_without_images(self):
        self.client.force_authenticate(user=self.owner_b)
        payload = {
            "property_id": str(self.property_b.id),
            "title": "Immediate Publish Studio Without Images",
            "monthly_rent": "22000.00",
            "publish": True,
        }
        res = self.client.post(reverse("listings:listing-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        errors = res.data.get("errors", res.data)
        self.assertIn("property", errors)
        self.assertIn("at least one uploaded image", str(errors["property"]))

    def test_owner_can_create_and_publish_immediately(self):
        PropertyImage.objects.create(
            property=self.property_b,
            image_url="https://images.example.com/bengaluru/studio.jpg",
            caption="Living Space",
            is_primary=True,
        )
        self.client.force_authenticate(user=self.owner_b)
        payload = {
            "property_id": str(self.property_b.id),
            "title": "Immediate Publish Studio",
            "monthly_rent": "22000.00",
            "publish": True,
        }
        res = self.client.post(reverse("listings:listing-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        data = res.data["data"]
        self.assertEqual(data["status"], ListingStatus.PUBLISHED)
        self.assertIsNotNone(data["published_at"])

    def test_create_listing_rejects_cross_owner_property(self):
        # Owner B attempts to create listing for Owner A's property
        self.client.force_authenticate(user=self.owner_b)
        payload = {
            "property_id": str(self.property_a.id),
            "title": "Hijacked Property Listing",
            "monthly_rent": "30000.00",
        }
        res = self.client.post(reverse("listings:listing-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_listing_rejects_forbidden_fields(self):
        self.client.force_authenticate(user=self.owner_b)
        payload = {
            "property_id": str(self.property_b.id),
            "title": "Tampered Payload",
            "monthly_rent": "20000.00",
            "owner_id": str(self.owner_b.id),
            "review_status": "approved",
            "published_at": "2026-01-01T00:00:00Z",
        }
        res = self.client.post(reverse("listings:listing-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", res.data.get("errors", {}))

    def test_create_listing_duplicate_open_listing_rejection(self):
        # Owner A already has published_listing on property_a
        self.client.force_authenticate(user=self.owner_a)
        payload = {
            "property_id": str(self.property_a.id),
            "title": "Duplicate Listing Attempt",
            "monthly_rent": "50000.00",
        }
        res = self.client.post(reverse("listings:listing-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data["success"])

    # ============================================================
    # 4. Listing Update (PATCH /api/v1/listings/{id}/)
    # ============================================================
    def test_owner_can_update_editable_fields(self):
        self.client.force_authenticate(user=self.owner_a)
        url = reverse("listings:listing-detail", kwargs={"pk": self.draft_listing.id})
        payload = {
            "title": "Updated Cottage Title",
            "monthly_rent": "24000.00",
        }
        res = self.client.patch(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["title"], "Updated Cottage Title")
        self.assertEqual(Decimal(str(res.data["data"]["monthly_rent"])), Decimal("24000.00"))

    def test_update_listing_rejects_cross_owner(self):
        # Owner B tries to update Owner A's listing
        self.client.force_authenticate(user=self.owner_b)
        url = reverse("listings:listing-detail", kwargs={"pk": self.draft_listing.id})
        res = self.client.patch(url, {"title": "Intruder Update"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_listing_rejects_immutable_fields(self):
        self.client.force_authenticate(user=self.owner_a)
        url = reverse("listings:listing-detail", kwargs={"pk": self.draft_listing.id})
        payload = {
            "property_id": str(self.property_b.id),
        }
        res = self.client.patch(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ============================================================
    # 5. Lifecycle Actions: Publish, Pause, Close
    # ============================================================
    def test_publish_draft_listing_without_images_rejected(self):
        self.client.force_authenticate(user=self.owner_a)
        url = reverse("listings:listing-publish", kwargs={"pk": self.draft_listing.id})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        errors = res.data.get("errors", res.data)
        self.assertIn("property", errors)
        self.assertIn("at least one uploaded image", str(errors["property"]))

    def test_publish_draft_listing_with_images_succeeds(self):
        # Attach image to property_a2 (which explicitly has no coordinates)
        self.assertIsNone(self.property_a2.latitude)
        self.assertIsNone(self.property_a2.longitude)
        PropertyImage.objects.create(
            property=self.property_a2,
            image_url="https://images.example.com/wayanad/retreat.jpg",
            caption="Retreat View",
            is_primary=True,
        )

        self.client.force_authenticate(user=self.owner_a)
        url = reverse("listings:listing-publish", kwargs={"pk": self.draft_listing.id})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["status"], ListingStatus.PUBLISHED)
        self.assertIsNotNone(res.data["data"]["published_at"])
        # Review status remains pending without blocking publication
        self.draft_listing.refresh_from_db()
        self.assertEqual(self.draft_listing.review_status, ReviewStatus.PENDING)
        self.assertEqual(self.draft_listing.status, ListingStatus.PUBLISHED)

    def test_publish_closed_listing_rejected(self):
        self.client.force_authenticate(user=self.owner_b)
        url = reverse("listings:listing-publish", kwargs={"pk": self.closed_listing.id})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pause_published_listing(self):
        self.client.force_authenticate(user=self.owner_a)
        url = reverse("listings:listing-pause", kwargs={"pk": self.published_listing.id})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["status"], ListingStatus.PAUSED)

    def test_pause_draft_listing_rejected(self):
        self.client.force_authenticate(user=self.owner_a)
        url = reverse("listings:listing-pause", kwargs={"pk": self.draft_listing.id})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_close_listing_releases_property_for_new_listing(self):
        self.client.force_authenticate(user=self.owner_a)

        # 1. Close the published listing on property_a
        close_url = reverse("listings:listing-close", kwargs={"pk": self.published_listing.id})
        res_close = self.client.post(close_url)
        self.assertEqual(res_close.status_code, status.HTTP_200_OK)
        self.assertEqual(res_close.data["data"]["status"], ListingStatus.CLOSED)

        # 2. Owner can now open a brand new listing on property_a
        new_payload = {
            "property_id": str(self.property_a.id),
            "title": "Brand New Tenancy Offer for Villa",
            "monthly_rent": "48000.00",
            "publish": False,
        }
        res_create = self.client.post(reverse("listings:listing-list"), new_payload, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_create.data["data"]["title"], new_payload["title"])

    def test_cross_owner_actions_rejected_with_404(self):
        self.client.force_authenticate(user=self.owner_b)

        # Owner B attempts publish on Owner A's listing -> 404
        res_pub = self.client.post(reverse("listings:listing-publish", kwargs={"pk": self.published_listing.id}))
        self.assertEqual(res_pub.status_code, status.HTTP_404_NOT_FOUND)

        # Owner B attempts pause on Owner A's listing -> 404
        res_pause = self.client.post(reverse("listings:listing-pause", kwargs={"pk": self.published_listing.id}))
        self.assertEqual(res_pause.status_code, status.HTTP_404_NOT_FOUND)

        # Owner B attempts close on Owner A's listing -> 404
        res_close = self.client.post(reverse("listings:listing-close", kwargs={"pk": self.published_listing.id}))
        self.assertEqual(res_close.status_code, status.HTTP_404_NOT_FOUND)
