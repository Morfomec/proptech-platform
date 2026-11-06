import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError

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
from apps.properties.serializers import (
    AmenitySerializer,
    PropertyCreateSerializer,
    PropertyDetailSerializer,
    PropertyImageSerializer,
    PropertyListSerializer,
    PropertyUpdateSerializer,
)

User = get_user_model()


class PropertySerializerTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="serializer_owner@example.com",
            password="password123",
            first_name="Alice",
            last_name="Owner",
            is_owner=True,
        )

        self.valid_payload = {
            "title": "Skyline Heights",
            "description": "Modern urban flat",
            "category": PropertyCategory.RESIDENTIAL,
            "property_type": PropertyType.APARTMENT,
            "address_line_1": "Flat 401, Skyline Towers",
            "locality": "HSR Layout",
            "city": "Bengaluru",
            "district": "Bengaluru Urban",
            "state": "Karnataka",
            "pin_code": "560102",
            "country_code": "IN",
            "latitude": "12.9121000",
            "longitude": "77.6446000",
            "built_up_area": "1150.00",
            "bedrooms": 2,
            "bathrooms": "2.0",
            "furnishing_status": FurnishingStatus.FULLY_FURNISHED,
            "parking_spaces": 1,
            "status": PropertyStatus.DRAFT,
        }

    # ============================================================
    # 1. Valid Creation and Update Payloads
    # ============================================================
    def test_valid_creation_payload(self):
        serializer = PropertyCreateSerializer(data=self.valid_payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["title"], "Skyline Heights")

    def test_valid_update_payload(self):
        prop = Property.objects.create(
            owner=self.owner,
            **{k: Decimal(v) if k in ["built_up_area", "bathrooms", "latitude", "longitude"] else v for k, v in self.valid_payload.items()}
        )

        update_payload = {
            "title": "Renovated Skyline Heights",
            "bedrooms": 3,
        }
        serializer = PropertyUpdateSerializer(instance=prop, data=update_payload, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["title"], "Renovated Skyline Heights")
        self.assertEqual(serializer.validated_data["bedrooms"], 3)

    # ============================================================
    # 2. Invalid Category / Property-Type Combinations
    # ============================================================
    def test_invalid_category_property_type_combination(self):
        # Residential cannot be 'warehouse'
        bad_payload = self.valid_payload.copy()
        bad_payload["property_type"] = PropertyType.WAREHOUSE

        serializer = PropertyCreateSerializer(data=bad_payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("property_type", serializer.errors)

        # Commercial cannot be 'villa'
        bad_comm_payload = self.valid_payload.copy()
        bad_comm_payload["category"] = PropertyCategory.COMMERCIAL
        bad_comm_payload["property_type"] = PropertyType.VILLA

        serializer = PropertyCreateSerializer(data=bad_comm_payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("property_type", serializer.errors)

    # ============================================================
    # 3. Invalid Coordinates and Specifications
    # ============================================================
    def test_invalid_coordinates(self):
        # Only latitude provided
        bad_payload = self.valid_payload.copy()
        bad_payload["latitude"] = "12.9121"
        bad_payload["longitude"] = None
        serializer = PropertyCreateSerializer(data=bad_payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("coordinates", serializer.errors)

        # Latitude out of range
        bad_payload = self.valid_payload.copy()
        bad_payload["latitude"] = "95.0000"
        serializer = PropertyCreateSerializer(data=bad_payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("latitude", serializer.errors)

        # Non-draft status requires coordinates
        bad_payload = self.valid_payload.copy()
        bad_payload["status"] = PropertyStatus.AVAILABLE
        bad_payload["latitude"] = None
        bad_payload["longitude"] = None
        serializer = PropertyCreateSerializer(data=bad_payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("coordinates", serializer.errors)

    def test_invalid_specifications(self):
        # Built up area <= 0
        bad_payload = self.valid_payload.copy()
        bad_payload["built_up_area"] = "-100.00"
        serializer = PropertyCreateSerializer(data=bad_payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("built_up_area", serializer.errors)

        # Negative parking spaces
        bad_payload = self.valid_payload.copy()
        bad_payload["parking_spaces"] = -2
        serializer = PropertyCreateSerializer(data=bad_payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("parking_spaces", serializer.errors)

        # Invalid Indian PIN code
        bad_payload = self.valid_payload.copy()
        bad_payload["pin_code"] = "12345"
        serializer = PropertyCreateSerializer(data=bad_payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("pin_code", serializer.errors)

    # ============================================================
    # 4. Prohibited Owner IDs and Capability Flags
    # ============================================================
    def test_attempts_to_submit_owner_or_capability_flags_are_rejected(self):
        # Attempting to supply owner
        payload = self.valid_payload.copy()
        payload["owner"] = str(uuid.uuid4())
        serializer = PropertyCreateSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

        # Attempting to supply owner_id
        payload = self.valid_payload.copy()
        payload["owner_id"] = str(uuid.uuid4())
        serializer = PropertyCreateSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

        # Attempting to supply capability flags
        payload = self.valid_payload.copy()
        payload["is_owner"] = True
        serializer = PropertyCreateSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

        # Update serializer also rejects capability flags
        serializer_update = PropertyUpdateSerializer(data={"is_platform_admin": True})
        self.assertFalse(serializer_update.is_valid())
        self.assertIn("non_field_errors", serializer_update.errors)

    # ============================================================
    # 5. Detail and List Representation Serializers
    # ============================================================
    def test_property_detail_and_list_serializers(self):
        prop = Property.objects.create(
            owner=self.owner,
            title="City Centre Penthouse",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="MG Road",
            locality="Central",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560001",
            status=PropertyStatus.DRAFT,
        )

        img = PropertyImage.objects.create(
            property=prop,
            image_url="https://images.example.com/penthouse.jpg",
            caption="Living area",
            is_primary=True,
        )

        amenity = Amenity.objects.create(
            name="Rooftop Pool",
            category=AmenityCategory.RECREATION,
        )
        prop.amenities.add(amenity)

        # Detail Serializer
        detail_data = PropertyDetailSerializer(prop).data
        self.assertEqual(detail_data["id"], str(prop.id))
        self.assertEqual(detail_data["owner"]["email"], self.owner.email)
        self.assertEqual(len(detail_data["images"]), 1)
        self.assertEqual(detail_data["images"][0]["image_url"], "https://images.example.com/penthouse.jpg")
        self.assertEqual(len(detail_data["amenities"]), 1)
        self.assertEqual(detail_data["amenities"][0]["name"], "Rooftop Pool")

        # List Serializer
        list_data = PropertyListSerializer(prop).data
        self.assertEqual(list_data["id"], str(prop.id))
        self.assertEqual(list_data["primary_image_url"], "https://images.example.com/penthouse.jpg")

