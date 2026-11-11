from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.listings.models import Listing, ListingStatus, SavedProperty
from apps.properties.models import (
    FurnishingStatus,
    Property,
    PropertyCategory,
    PropertyImage,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class SavedPropertyAPITests(APITestCase):
    def setUp(self):
        # 1. Users
        self.tenant_a = User.objects.create_user(
            email="tenant_a@example.com",
            password="securepassword123",
            first_name="Alice",
            last_name="Tenant",
            is_tenant=True,
            is_owner=False,
        )

        self.tenant_b = User.objects.create_user(
            email="tenant_b@example.com",
            password="securepassword123",
            first_name="Bob",
            last_name="Tenant",
            is_tenant=True,
            is_owner=False,
        )

        self.owner_user = User.objects.create_user(
            email="owner_saved_prop@example.com",
            password="securepassword123",
            first_name="Oscar",
            last_name="Owner",
            is_tenant=True,  # Owner who also has Tenant capability
            is_owner=True,
        )

        # 2. Properties
        self.public_property = Property.objects.create(
            owner=self.owner_user,
            title="Kozhikode Marine Drive Luxury Flat",
            description="Premium beachfront residential flat.",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Beach Road 101",
            locality="Kozhikode Beach",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            country_code="IN",
            built_up_area=Decimal("1800.00"),
            bedrooms=3,
            bathrooms=Decimal("3.0"),
            furnishing_status=FurnishingStatus.FULLY_FURNISHED,
            parking_spaces=1,
            status=PropertyStatus.AVAILABLE,
        )
        self.public_image = PropertyImage.objects.create(
            property=self.public_property,
            image_url="https://images.example.com/kozhikode/marine.jpg",
            caption="Living Room",
            display_order=1,
            is_primary=True,
        )

        # Active published listing makes public_property publicly discoverable
        self.published_listing = Listing.objects.create(
            property=self.public_property,
            title="3BHK Luxury Beachfront Apartment for Rent",
            monthly_rent=Decimal("38000.00"),
            security_deposit=Decimal("120000.00"),
            status=ListingStatus.PUBLISHED,
        )

        # Unpublished property (only draft listing)
        self.unlisted_property = Property.objects.create(
            owner=self.owner_user,
            title="Private Farmhouse in Wayanad",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.INDEPENDENT_HOUSE,
            address_line_1="Estate Lane 4",
            locality="Vythiri",
            city="Wayanad",
            district="Wayanad",
            state="Kerala",
            pin_code="673576",
            status=PropertyStatus.DRAFT,
        )
        self.draft_listing = Listing.objects.create(
            property=self.unlisted_property,
            title="Quiet Farmhouse for Rent",
            monthly_rent=Decimal("25000.00"),
            status=ListingStatus.DRAFT,
        )

    # ============================================================
    # 1. Authenticated user saves public property
    # ============================================================
    def test_authenticated_user_saves_public_property(self):
        self.client.force_authenticate(user=self.tenant_a)
        url = reverse("listings:saved-property-list")
        payload = {"property_id": str(self.public_property.id)}

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        data = response.data["data"]

        self.assertEqual(data["property_id"], str(self.public_property.id))
        self.assertTrue(data["is_available"])
        self.assertEqual(data["property"]["city"], "Kozhikode")
        self.assertEqual(Decimal(str(data["listing"]["monthly_rent"])), Decimal("38000.00"))

        # Verify record in database
        self.assertTrue(
            SavedProperty.objects.filter(
                user=self.tenant_a,
                property=self.public_property,
            ).exists()
        )

    # ============================================================
    # 2. Repeated save does not create duplicates
    # ============================================================
    def test_repeated_save_does_not_create_duplicates(self):
        self.client.force_authenticate(user=self.tenant_a)
        url = reverse("listings:saved-property-list")
        payload = {"property_id": str(self.public_property.id)}

        # First save
        res1 = self.client.post(url, payload, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second save (idempotent)
        res2 = self.client.post(url, payload, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data["success"])

        # Exactly 1 record in database
        count = SavedProperty.objects.filter(
            user=self.tenant_a,
            property=self.public_property,
        ).count()
        self.assertEqual(count, 1)

    # ============================================================
    # 3. Unauthenticated users cannot save or access saved properties
    # ============================================================
    def test_unauthenticated_cannot_access_saved_properties(self):
        # Unauthenticated POST -> 401
        res_post = self.client.post(
            reverse("listings:saved-property-list"),
            {"property_id": str(self.public_property.id)},
        )
        self.assertEqual(res_post.status_code, status.HTTP_401_UNAUTHORIZED)

        # Unauthenticated GET -> 401
        res_get = self.client.get(reverse("listings:saved-property-list"))
        self.assertEqual(res_get.status_code, status.HTTP_401_UNAUTHORIZED)

        # Unauthenticated DELETE -> 401
        res_del = self.client.delete(
            reverse("listings:saved-property-detail", kwargs={"property_id": self.public_property.id})
        )
        self.assertEqual(res_del.status_code, status.HTTP_401_UNAUTHORIZED)

    # ============================================================
    # 4. User A cannot see User B's bookmarks
    # ============================================================
    def test_user_a_cannot_see_user_b_bookmarks(self):
        # Create second public property
        prop_b = Property.objects.create(
            owner=self.owner_user,
            title="Kochi Waterfront Condo",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Marine Drive",
            locality="Ernakulam",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682011",
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )
        PropertyImage.objects.create(
            property=prop_b,
            image_url="https://images.example.com/kochi/waterfront.jpg",
            is_primary=True,
        )
        Listing.objects.create(
            property=prop_b,
            title="Waterfront Condo for Rent",
            monthly_rent=Decimal("45000.00"),
            status=ListingStatus.PUBLISHED,
        )

        # User A bookmarks public_property
        SavedProperty.objects.create(user=self.tenant_a, property=self.public_property)

        # User B bookmarks prop_b
        SavedProperty.objects.create(user=self.tenant_b, property=prop_b)

        # User A queries /saved-properties/
        self.client.force_authenticate(user=self.tenant_a)
        res_a = self.client.get(reverse("listings:saved-property-list"))
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)

        results_a = res_a.data.get("data", res_a.data.get("results", []))
        prop_ids_a = [item["property_id"] for item in results_a]

        self.assertIn(str(self.public_property.id), prop_ids_a)
        self.assertNotIn(str(prop_b.id), prop_ids_a)

    # ============================================================
    # 5. User A cannot remove User B's bookmarks
    # ============================================================
    def test_user_a_cannot_remove_user_b_bookmarks(self):
        # User B bookmarks public_property
        saved_b = SavedProperty.objects.create(user=self.tenant_b, property=self.public_property)

        # User A attempts to DELETE User B's saved property
        self.client.force_authenticate(user=self.tenant_a)
        url = reverse("listings:saved-property-detail", kwargs={"property_id": self.public_property.id})
        res = self.client.delete(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # User B's bookmark MUST still exist
        self.assertTrue(SavedProperty.objects.filter(id=saved_b.id).exists())

    # ============================================================
    # 6. User can remove their own bookmark
    # ============================================================
    def test_user_can_remove_own_bookmark(self):
        SavedProperty.objects.create(user=self.tenant_a, property=self.public_property)

        self.client.force_authenticate(user=self.tenant_a)
        url = reverse("listings:saved-property-detail", kwargs={"property_id": self.public_property.id})
        res = self.client.delete(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])

        # Record is removed from database
        self.assertFalse(
            SavedProperty.objects.filter(
                user=self.tenant_a,
                property=self.public_property,
            ).exists()
        )

    # ============================================================
    # 7. Repeated removal is handled gracefully
    # ============================================================
    def test_repeated_removal_handled_gracefully(self):
        self.client.force_authenticate(user=self.tenant_a)
        url = reverse("listings:saved-property-detail", kwargs={"property_id": self.public_property.id})

        # Bookmark does not exist initially; removal succeeds gracefully
        res1 = self.client.delete(url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertTrue(res1.data["success"])

        # Second attempt succeeds gracefully without 500 error
        res2 = self.client.delete(url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data["success"])

    # ============================================================
    # 8. Unpublished properties cannot be saved
    # ============================================================
    def test_unpublished_property_cannot_be_saved(self):
        self.client.force_authenticate(user=self.tenant_a)
        url = reverse("listings:saved-property-list")
        payload = {"property_id": str(self.unlisted_property.id)}

        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data["success"])

        # Verify not in DB
        self.assertFalse(
            SavedProperty.objects.filter(
                user=self.tenant_a,
                property=self.unlisted_property,
            ).exists()
        )

    # ============================================================
    # 9. Saved property whose listing is later paused/closed remains safe
    # ============================================================
    def test_saved_property_when_listing_paused_or_closed_remains_safe(self):
        # 1. Tenant A bookmarks public property while it is published
        self.client.force_authenticate(user=self.tenant_a)
        SavedProperty.objects.create(user=self.tenant_a, property=self.public_property)

        # 2. Owner subsequently pauses the listing
        self.published_listing.status = ListingStatus.PAUSED
        self.published_listing.save()

        # 3. Tenant A queries their saved properties
        res = self.client.get(reverse("listings:saved-property-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        results = res.data.get("data", res.data.get("results", []))
        self.assertEqual(len(results), 1)

        item = results[0]
        self.assertEqual(item["property_id"], str(self.public_property.id))
        self.assertFalse(item["is_available"])
        self.assertIsNone(item["listing"])

        # Private property details are masked/safe
        prop_data = item["property"]
        self.assertEqual(prop_data["status"], "unavailable")
        self.assertFalse(prop_data["is_available"])
        self.assertNotIn("address_line_1", prop_data)
        self.assertNotIn("built_up_area", prop_data)
        self.assertNotIn("bedrooms", prop_data)

    # ============================================================
    # 10. Pagination works correctly
    # ============================================================
    def test_saved_properties_pagination(self):
        self.client.force_authenticate(user=self.tenant_a)

        # Create 25 properties with published listings and bookmark them
        for i in range(25):
            prop = Property.objects.create(
                owner=self.owner_user,
                title=f"Sample Pagination Flat {i}",
                category=PropertyCategory.RESIDENTIAL,
                property_type=PropertyType.APARTMENT,
                address_line_1=f"Road {i}",
                locality="Kakkanad",
                city="Kochi",
                district="Ernakulam",
                state="Kerala",
                pin_code="682030",
                bedrooms=2,
                bathrooms=Decimal("2.0"),
                status=PropertyStatus.AVAILABLE,
            )
            PropertyImage.objects.create(
                property=prop,
                image_url=f"https://images.example.com/kochi/flat_{i}.jpg",
                is_primary=True,
            )
            Listing.objects.create(
                property=prop,
                title=f"Flat {i} for Rent",
                monthly_rent=Decimal("20000.00"),
                status=ListingStatus.PUBLISHED,
            )
            SavedProperty.objects.create(user=self.tenant_a, property=prop)

        # Page 1
        res_page1 = self.client.get(f"{reverse('listings:saved-property-list')}?page=1")
        self.assertEqual(res_page1.status_code, status.HTTP_200_OK)
        self.assertEqual(res_page1.data["count"], 25)
        self.assertEqual(len(res_page1.data["results"]), 20)
        self.assertIsNotNone(res_page1.data["next"])

        # Page 2
        res_page2 = self.client.get(f"{reverse('listings:saved-property-list')}?page=2")
        self.assertEqual(res_page2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_page2.data["results"]), 5)
        self.assertIsNone(res_page2.data["next"])

    # ============================================================
    # 11. Owner with tenant capability can save properties
    # ============================================================
    def test_owner_with_tenant_capability_can_save_property(self):
        self.client.force_authenticate(user=self.owner_user)
        url = reverse("listings:saved-property-list")
        payload = {"property_id": str(self.public_property.id)}

        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            SavedProperty.objects.filter(
                user=self.owner_user,
                property=self.public_property,
            ).exists()
        )

    # ============================================================
    # 12. Rejection of client-supplied user identity
    # ============================================================
    def test_reject_client_supplied_user_id(self):
        self.client.force_authenticate(user=self.tenant_a)
        url = reverse("listings:saved-property-list")
        payload = {
            "property_id": str(self.public_property.id),
            "user_id": str(self.tenant_b.id),
        }

        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", res.data.get("errors", {}))

    def test_saved_property_create_and_delete_envelopes_and_absolute_image_urls(self):
        PropertyImage.objects.filter(property=self.public_property).delete()
        PropertyImage.objects.create(
            property=self.public_property,
            image_url="/media/properties/saved_sample.jpg",
            is_primary=True,
        )
        self.client.force_authenticate(user=self.tenant_a)

        create_res = self.client.post(
            reverse("listings:saved-property-list"),
            {"property_id": str(self.public_property.id)},
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            create_res.data["data"]["property"]["primary_image_url"],
            "http://testserver/media/properties/saved_sample.jpg",
        )

        list_res = self.client.get(reverse("listings:saved-property-list"))
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertTrue(list_res.data["success"])
        self.assertEqual(list_res.data["data"], list_res.data["results"])
        self.assertEqual(
            list_res.data["data"][0]["property"]["primary_image_url"],
            "http://testserver/media/properties/saved_sample.jpg",
        )

        del_res = self.client.delete(
            reverse(
                "listings:saved-property-detail",
                kwargs={"property_id": self.public_property.id},
            )
        )
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertTrue(del_res.data["success"])
        self.assertIn("data", del_res.data)
        self.assertIsNone(del_res.data["data"])

    def test_saved_properties_enforce_public_visibility_and_mask_non_available_properties(self):
        self.client.force_authenticate(user=self.tenant_a)
        save_url = reverse("listings:saved-property-list")

        # Cannot save non-available properties even if a published listing exists in DB.
        for hidden_status in (
            PropertyStatus.DRAFT,
            PropertyStatus.INACTIVE,
            PropertyStatus.MAINTENANCE,
            PropertyStatus.OCCUPIED,
        ):
            hidden_prop = Property.objects.create(
                owner=self.owner_user,
                title=f"Hidden Saved {hidden_status}",
                category=PropertyCategory.RESIDENTIAL,
                property_type=PropertyType.APARTMENT,
                address_line_1="Secret Rd",
                locality="Hidden",
                city="Kozhikode",
                district="Kozhikode",
                state="Kerala",
                pin_code="673001",
                bedrooms=2,
                bathrooms=Decimal("2.0"),
                status=hidden_status,
            )
            PropertyImage.objects.create(
                property=hidden_prop,
                image_url=f"https://images.example.com/hidden_{hidden_status}.jpg",
                is_primary=True,
            )
            Listing.objects.create(
                property=hidden_prop,
                title=f"Hidden Listing {hidden_status}",
                monthly_rent=Decimal("31000.00"),
                status=ListingStatus.PUBLISHED,
            )
            res = self.client.post(
                save_url,
                {"property_id": str(hidden_prop.id)},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Saved property that later turns unavailable masks listing/property details cleanly.
        SavedProperty.objects.create(user=self.tenant_a, property=self.public_property)
        for non_available_status in (
            PropertyStatus.DRAFT,
            PropertyStatus.MAINTENANCE,
            PropertyStatus.INACTIVE,
            PropertyStatus.OCCUPIED,
        ):
            with self.subTest(property_status=non_available_status):
                Property.objects.filter(pk=self.public_property.pk).update(
                    status=non_available_status
                )
                list_res = self.client.get(save_url)
                self.assertEqual(list_res.status_code, status.HTTP_200_OK)
                item = list_res.data["results"][0]
                self.assertFalse(item["is_available"])
                self.assertIsNone(item["listing"])
                self.assertEqual(item["property"]["status"], "unavailable")
                self.assertNotIn("address_line_1", item["property"])
                self.assertNotIn("bedrooms", item["property"])

