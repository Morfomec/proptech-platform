import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

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


class PropertyAPITests(APITestCase):
    def setUp(self):
        # Tenant user with is_owner=False
        self.tenant_user = User.objects.create_user(
            email="tenant_api@example.com",
            password="securepassword123",
            first_name="Tom",
            last_name="Tenant",
            is_tenant=True,
            is_owner=False,
        )

        # Owner A
        self.owner_a = User.objects.create_user(
            email="owner_a@example.com",
            password="securepassword123",
            first_name="Alice",
            last_name="Owner",
            is_tenant=False,
            is_owner=True,
        )

        # Owner B
        self.owner_b = User.objects.create_user(
            email="owner_b@example.com",
            password="securepassword123",
            first_name="Bob",
            last_name="Owner",
            is_tenant=False,
            is_owner=True,
        )

        # Admin User
        self.admin_user = User.objects.create_superuser(
            email="admin_api@example.com",
            password="securepassword123",
            first_name="Admin",
            last_name="User",
        )

        # Active & Inactive Amenities
        self.active_amenity = Amenity.objects.create(
            name="Clubhouse",
            category=AmenityCategory.RECREATION,
            is_active=True,
        )
        self.inactive_amenity = Amenity.objects.create(
            name="Valet Parking",
            category=AmenityCategory.BUILDING,
            is_active=False,
        )

        # Property belonging to Owner A
        self.property_a = Property.objects.create(
            owner=self.owner_a,
            title="Sunrise Luxury Flat",
            description="East-facing apartment",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Building 10",
            locality="Whitefield",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560066",
            status=PropertyStatus.DRAFT,
        )

        # Property belonging to Owner B
        self.property_b = Property.objects.create(
            owner=self.owner_b,
            title="Greenwood Cottage",
            description="Charming villa",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            address_line_1="Villa 4",
            locality="Sarjapur",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560035",
            status=PropertyStatus.DRAFT,
        )

        self.valid_creation_payload = {
            "title": "Modern Studio in Indiranagar",
            "description": "Fully furnished studio apartment.",
            "category": PropertyCategory.RESIDENTIAL,
            "property_type": PropertyType.STUDIO_APARTMENT,
            "address_line_1": "12 100ft Road",
            "locality": "Indiranagar",
            "city": "Bengaluru",
            "district": "Bengaluru Urban",
            "state": "Karnataka",
            "pin_code": "560038",
            "country_code": "IN",
            "built_up_area": "650.00",
            "furnishing_status": FurnishingStatus.FULLY_FURNISHED,
            "parking_spaces": 1,
            "status": PropertyStatus.DRAFT,
        }

    # ============================================================
    # 1. Authentication & Tenant Authorization
    # ============================================================
    def test_unauthenticated_access_rejection(self):
        # List properties requires auth -> 401
        res = self.client.get(reverse("properties:property-list"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Create property requires auth -> 401
        res = self.client.post(reverse("properties:property-list"), self.valid_creation_payload)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Amenities catalogue requires auth -> 401
        res = self.client.get(reverse("properties:amenity-list"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tenant_access_rejection_for_owner_list_and_detail(self):
        self.client.force_authenticate(user=self.tenant_user)

        # Tenant attempting to list owner properties -> 403 Forbidden
        res = self.client.get(reverse("properties:property-list"))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Tenant attempting to access /properties/me/ -> 403 Forbidden
        res = self.client.get(reverse("properties:property-my-properties"))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Tenant attempting to retrieve an existing property -> 403 Forbidden
        res = self.client.get(reverse("properties:property-detail", kwargs={"pk": self.property_a.id}))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_property_creation_activates_owner_capability(self):
        self.client.force_authenticate(user=self.tenant_user)
        self.assertFalse(self.tenant_user.is_owner)

        payload = self.valid_creation_payload.copy()
        payload["amenity_ids"] = [str(self.active_amenity.id)]

        res = self.client.post(reverse("properties:property-list"), payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["data"]["title"], "Modern Studio in Indiranagar")

        # Verify owner capability is activated in DB
        self.tenant_user.refresh_from_db()
        self.assertTrue(self.tenant_user.is_owner)
        self.assertTrue(self.tenant_user.is_tenant)  # Multi-capability maintained

        # Verify property in DB belongs to this user
        new_prop = Property.objects.get(id=res.data["data"]["id"])
        self.assertEqual(new_prop.owner, self.tenant_user)
        self.assertEqual(new_prop.amenities.count(), 1)

    # ============================================================
    # 2. Owner-Specific List Filtering & Isolation
    # ============================================================
    def test_owner_specific_list_filtering(self):
        self.client.force_authenticate(user=self.owner_a)

        res = self.client.get(reverse("properties:property-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # In case pagination envelope is used
        results = res.data.get("data", res.data.get("results", []))
        property_ids = [item["id"] for item in results]

        self.assertIn(str(self.property_a.id), property_ids)
        self.assertNotIn(str(self.property_b.id), property_ids)

    def test_owner_me_convenience_endpoint(self):
        self.client.force_authenticate(user=self.owner_a)

        res = self.client.get(reverse("properties:property-my-properties"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        results = res.data.get("data", res.data.get("results", []))
        property_ids = [item["id"] for item in results]
        self.assertIn(str(self.property_a.id), property_ids)
        self.assertNotIn(str(self.property_b.id), property_ids)

    # ============================================================
    # 3. Property Detail Access & Cross-Owner Rejection
    # ============================================================
    def test_property_detail_access_by_owner(self):
        self.client.force_authenticate(user=self.owner_a)

        res = self.client.get(reverse("properties:property-detail", kwargs={"pk": self.property_a.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["id"], str(self.property_a.id))
        self.assertEqual(res.data["data"]["owner"]["email"], self.owner_a.email)

    def test_cross_owner_detail_update_delete_rejection(self):
        # Owner B tries to access Owner A's property
        self.client.force_authenticate(user=self.owner_b)

        # Detail -> 404 (scoped queryset)
        res_get = self.client.get(reverse("properties:property-detail", kwargs={"pk": self.property_a.id}))
        self.assertEqual(res_get.status_code, status.HTTP_404_NOT_FOUND)

        # Update -> 404
        res_patch = self.client.patch(
            reverse("properties:property-detail", kwargs={"pk": self.property_a.id}),
            {"title": "Hacked Title"},
        )
        self.assertEqual(res_patch.status_code, status.HTTP_404_NOT_FOUND)

        # Delete -> 404
        res_del = self.client.delete(reverse("properties:property-detail", kwargs={"pk": self.property_a.id}))
        self.assertEqual(res_del.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_access_cross_owner_property(self):
        self.client.force_authenticate(user=self.admin_user)

        # Admin lists all properties across different owners
        res_list = self.client.get(reverse("properties:property-list"))
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        results = res_list.data.get("data", res_list.data.get("results", []))
        property_ids = [item["id"] for item in results]
        self.assertIn(str(self.property_a.id), property_ids)
        self.assertIn(str(self.property_b.id), property_ids)

        # Admin accesses specific property detail
        res = self.client.get(reverse("properties:property-detail", kwargs={"pk": self.property_a.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["id"], str(self.property_a.id))

    def test_cross_owner_image_operations_rejected(self):
        # Create an image on Owner A's property
        img = PropertyImage.objects.create(
            property=self.property_a,
            image_url="https://storage.example.com/sunrise/balcony.jpg",
            is_primary=True,
        )

        # Owner B attempts to add image to Owner A's property -> 404
        self.client.force_authenticate(user=self.owner_b)
        res_add = self.client.post(
            reverse("properties:property-images", kwargs={"pk": self.property_a.id}),
            {"image_url": "https://storage.example.com/hacked.jpg"},
        )
        self.assertEqual(res_add.status_code, status.HTTP_404_NOT_FOUND)

        # Owner B attempts to delete image on Owner A's property -> 404
        res_del = self.client.delete(
            reverse("properties:property-delete-image", kwargs={"pk": self.property_a.id, "image_id": img.id})
        )
        self.assertEqual(res_del.status_code, status.HTTP_404_NOT_FOUND)

        # Owner B attempts to set primary on Owner A's property -> 404
        res_primary = self.client.post(
            reverse("properties:property-set-primary-image", kwargs={"pk": self.property_a.id, "image_id": img.id})
        )
        self.assertEqual(res_primary.status_code, status.HTTP_404_NOT_FOUND)

    # ============================================================
    # 4. Property Updates & Deletion
    # ============================================================
    def test_successful_property_update(self):
        self.client.force_authenticate(user=self.owner_a)

        res = self.client.patch(
            reverse("properties:property-detail", kwargs={"pk": self.property_a.id}),
            {"title": "Sunrise Luxury Flat - Renovated"},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["title"], "Sunrise Luxury Flat - Renovated")

        self.property_a.refresh_from_db()
        self.assertEqual(self.property_a.title, "Sunrise Luxury Flat - Renovated")

    def test_property_owner_cannot_be_changed_via_api(self):
        self.client.force_authenticate(user=self.owner_a)

        res = self.client.patch(
            reverse("properties:property-detail", kwargs={"pk": self.property_a.id}),
            {"owner": str(self.owner_b.id)},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        self.property_a.refresh_from_db()
        self.assertEqual(self.property_a.owner, self.owner_a)

    def test_successful_property_deletion(self):
        self.client.force_authenticate(user=self.owner_a)
        prop_id = self.property_a.id

        res = self.client.delete(reverse("properties:property-detail", kwargs={"pk": prop_id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(Property.objects.filter(id=prop_id).exists())

    # ============================================================
    # 5. Image Addition, Removal & Primary Selection
    # ============================================================
    def test_image_endpoints(self):
        self.client.force_authenticate(user=self.owner_a)

        # 1. Add Image 1 (is_primary=True)
        res_img1 = self.client.post(
            reverse("properties:property-images", kwargs={"pk": self.property_a.id}),
            {"image_url": "https://storage.example.com/sunrise/facade.jpg", "is_primary": True},
        )
        self.assertEqual(res_img1.status_code, status.HTTP_201_CREATED)
        img1_id = res_img1.data["data"]["id"]
        self.assertTrue(res_img1.data["data"]["is_primary"])

        # 2. Add Image 2 (is_primary=True) -> Automatically unsets Image 1 as primary
        res_img2 = self.client.post(
            reverse("properties:property-images", kwargs={"pk": self.property_a.id}),
            {"image_url": "https://storage.example.com/sunrise/garden.jpg", "is_primary": True},
        )
        self.assertEqual(res_img2.status_code, status.HTTP_201_CREATED)
        img2_id = res_img2.data["data"]["id"]

        img1_obj = PropertyImage.objects.get(id=img1_id)
        img2_obj = PropertyImage.objects.get(id=img2_id)
        self.assertFalse(img1_obj.is_primary)
        self.assertTrue(img2_obj.is_primary)

        # 3. List images
        res_list = self.client.get(
            reverse("properties:property-images", kwargs={"pk": self.property_a.id})
        )
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data["data"]), 2)

        # 4. Set Image 1 back to primary
        res_set_primary = self.client.post(
            reverse("properties:property-set-primary-image", kwargs={"pk": self.property_a.id, "image_id": img1_id})
        )
        self.assertEqual(res_set_primary.status_code, status.HTTP_200_OK)
        img1_obj.refresh_from_db()
        img2_obj.refresh_from_db()
        self.assertTrue(img1_obj.is_primary)
        self.assertFalse(img2_obj.is_primary)

        # 5. Delete Image 2
        res_del = self.client.delete(
            reverse("properties:property-delete-image", kwargs={"pk": self.property_a.id, "image_id": img2_id})
        )
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(PropertyImage.objects.filter(id=img2_id).exists())

    # ============================================================
    # 6. Active Amenity Catalogue
    # ============================================================
    def test_active_amenity_catalogue(self):
        # Available to any authenticated user
        self.client.force_authenticate(user=self.tenant_user)

        res = self.client.get(reverse("properties:amenity-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        amenity_names = [a["name"] for a in res.data["data"]]
        self.assertIn("Clubhouse", amenity_names)
        self.assertNotIn("Valet Parking", amenity_names)  # Inactive omitted

    # ============================================================
    # 7. Invalid Payload Handling & Response Structures
    # ============================================================
    def test_invalid_payload_handling(self):
        self.client.force_authenticate(user=self.owner_a)

        # Mismatched category and property type
        bad_payload = self.valid_creation_payload.copy()
        bad_payload["property_type"] = PropertyType.WAREHOUSE

        res = self.client.post(reverse("properties:property-list"), bad_payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data["success"])
        self.assertIn("property_type", res.data["errors"])

