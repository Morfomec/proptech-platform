import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.properties.models import (
    Amenity,
    AmenityCategory,
    FurnishingStatus,
    Property,
    PropertyAmenity,
    PropertyCategory,
    PropertyImage,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class PropertyModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_test@example.com",
            password="securepassword123",
            first_name="Alice",
            last_name="Owner",
            is_owner=True,
        )
        self.valid_residential_data = {
            "owner": self.owner,
            "title": "Greenwood Apartment 3B",
            "description": "Spacious 3-bedroom apartment with garden view.",
            "category": PropertyCategory.RESIDENTIAL,
            "property_type": PropertyType.APARTMENT,
            "address_line_1": "123 Main Road",
            "locality": "Indiranagar",
            "city": "Bengaluru",
            "district": "Bengaluru Urban",
            "state": "Karnataka",
            "pin_code": "560038",
            "country_code": "IN",
            "built_up_area": Decimal("1450.00"),
            "bedrooms": 3,
            "bathrooms": Decimal("2.0"),
            "furnishing_status": FurnishingStatus.SEMI_FURNISHED,
            "parking_spaces": 1,
            "status": PropertyStatus.DRAFT,
        }

    # ============================================================
    # 1. Property Creation & UUID Primary Key
    # ============================================================
    def test_property_creation_and_uuid(self):
        prop = Property.objects.create(**self.valid_residential_data)

        self.assertIsInstance(prop.id, uuid.UUID)
        self.assertEqual(prop.title, "Greenwood Apartment 3B")
        self.assertIsNotNone(prop.created_at)
        self.assertIsNotNone(prop.updated_at)
        self.assertIn("Greenwood Apartment 3B", str(prop))
        self.assertIn("Bengaluru", str(prop))

    # ============================================================
    # 2. Owner Relationship & Cascade
    # ============================================================
    def test_owner_relationship(self):
        prop = Property.objects.create(**self.valid_residential_data)

        self.assertEqual(prop.owner, self.owner)
        self.assertIn(prop, self.owner.properties.all())

        # Test cascading deletion
        owner_id = self.owner.id
        self.owner.delete()
        self.assertFalse(Property.objects.filter(owner_id=owner_id).exists())

    # ============================================================
    # 3. Default Draft Status
    # ============================================================
    def test_default_draft_status(self):
        data = self.valid_residential_data.copy()
        data.pop("status", None)
        prop = Property.objects.create(**data)

        self.assertEqual(prop.status, PropertyStatus.DRAFT)

    # ============================================================
    # 4. Residential and Commercial Property Types
    # ============================================================
    def test_residential_property_types(self):
        residential_types = [
            PropertyType.INDEPENDENT_HOUSE,
            PropertyType.VILLA,
            PropertyType.APARTMENT,
            PropertyType.STUDIO_APARTMENT,
            PropertyType.OTHER,
        ]
        for ptype in residential_types:
            data = self.valid_residential_data.copy()
            data["title"] = f"Res Property {ptype}"
            data["property_type"] = ptype
            prop = Property.objects.create(**data)
            self.assertEqual(prop.property_type, ptype)

    def test_commercial_property_types(self):
        commercial_types = [
            PropertyType.OFFICE,
            PropertyType.SHOP,
            PropertyType.SHOWROOM,
            PropertyType.WAREHOUSE,
            PropertyType.OTHER,
        ]
        for ptype in commercial_types:
            prop = Property.objects.create(
                owner=self.owner,
                title=f"Comm Property {ptype}",
                category=PropertyCategory.COMMERCIAL,
                property_type=ptype,
                address_line_1="Tech Park Floor 4",
                locality="Whitefield",
                city="Bengaluru",
                district="Bengaluru Urban",
                state="Karnataka",
                pin_code="560066",
                built_up_area=Decimal("3500.00"),
                status=PropertyStatus.DRAFT,
            )
            self.assertEqual(prop.property_type, ptype)

    # ============================================================
    # 5. Invalid Category / Property Type Combinations
    # ============================================================
    def test_invalid_category_type_combinations(self):
        # Residential cannot be 'warehouse'
        with self.assertRaises(ValidationError) as ctx:
            Property.objects.create(
                owner=self.owner,
                title="Invalid Residential Warehouse",
                category=PropertyCategory.RESIDENTIAL,
                property_type=PropertyType.WAREHOUSE,
                address_line_1="Industrial Area 1",
                locality="Peenya",
                city="Bengaluru",
                district="Bengaluru Urban",
                state="Karnataka",
                pin_code="560058",
            )
        self.assertIn("property_type", ctx.exception.message_dict)

        # Commercial cannot be 'villa'
        with self.assertRaises(ValidationError) as ctx:
            Property.objects.create(
                owner=self.owner,
                title="Invalid Commercial Villa",
                category=PropertyCategory.COMMERCIAL,
                property_type=PropertyType.VILLA,
                address_line_1="Palm Grove Road",
                locality="Koramangala",
                city="Bengaluru",
                district="Bengaluru Urban",
                state="Karnataka",
                pin_code="560034",
            )
        self.assertIn("property_type", ctx.exception.message_dict)

    # ============================================================
    # 6. Coordinate Validation
    # ============================================================
    def test_coordinate_validation(self):
        # Valid coordinates
        data = self.valid_residential_data.copy()
        data["latitude"] = Decimal("12.9716000")
        data["longitude"] = Decimal("77.5946000")
        prop = Property.objects.create(**data)
        self.assertEqual(prop.latitude, Decimal("12.9716000"))
        self.assertEqual(prop.longitude, Decimal("77.5946000"))

        # Both null in draft -> allowed
        data_null = self.valid_residential_data.copy()
        data_null["latitude"] = None
        data_null["longitude"] = None
        data_null["status"] = PropertyStatus.DRAFT
        prop_null = Property.objects.create(**data_null)
        self.assertIsNone(prop_null.latitude)
        self.assertIsNone(prop_null.longitude)

        # Only latitude populated -> error
        with self.assertRaises(ValidationError) as ctx:
            data_bad = self.valid_residential_data.copy()
            data_bad["latitude"] = Decimal("12.9716")
            data_bad["longitude"] = None
            Property.objects.create(**data_bad)
        self.assertIn("coordinates", ctx.exception.message_dict)

        # Only longitude populated -> error
        with self.assertRaises(ValidationError) as ctx:
            data_bad = self.valid_residential_data.copy()
            data_bad["latitude"] = None
            data_bad["longitude"] = Decimal("77.5946")
            Property.objects.create(**data_bad)
        self.assertIn("coordinates", ctx.exception.message_dict)

        # Latitude out of bounds (> 90) -> error
        with self.assertRaises(ValidationError) as ctx:
            data_bad = self.valid_residential_data.copy()
            data_bad["latitude"] = Decimal("95.0000000")
            data_bad["longitude"] = Decimal("77.5946000")
            Property.objects.create(**data_bad)
        self.assertIn("latitude", ctx.exception.message_dict)

        # Longitude out of bounds (< -180) -> error
        with self.assertRaises(ValidationError) as ctx:
            data_bad = self.valid_residential_data.copy()
            data_bad["latitude"] = Decimal("12.9716000")
            data_bad["longitude"] = Decimal("-185.0000000")
            Property.objects.create(**data_bad)
        self.assertIn("longitude", ctx.exception.message_dict)

        # Non-draft (available) status with NULL coordinates -> allowed (coordinates are optional)
        data_avail_null = self.valid_residential_data.copy()
        data_avail_null["status"] = PropertyStatus.AVAILABLE
        data_avail_null["latitude"] = None
        data_avail_null["longitude"] = None
        prop_avail_null = Property.objects.create(**data_avail_null)
        self.assertEqual(prop_avail_null.status, PropertyStatus.AVAILABLE)
        self.assertIsNone(prop_avail_null.latitude)
        self.assertIsNone(prop_avail_null.longitude)

    # ============================================================
    # 7. Built-up Area, Parking Spaces and Indian PIN Code Validation
    # ============================================================
    def test_built_up_area_and_pin_code_validation(self):
        # Built up area <= 0
        with self.assertRaises(ValidationError) as ctx:
            data_bad = self.valid_residential_data.copy()
            data_bad["built_up_area"] = Decimal("0.00")
            Property.objects.create(**data_bad)
        self.assertIn("built_up_area", ctx.exception.message_dict)

        # Parking spaces < 0
        with self.assertRaises(ValidationError) as ctx:
            data_bad = self.valid_residential_data.copy()
            data_bad["parking_spaces"] = -1
            Property.objects.create(**data_bad)
        self.assertIn("parking_spaces", ctx.exception.message_dict)

        # Invalid PIN code for IN
        with self.assertRaises(ValidationError) as ctx:
            data_bad = self.valid_residential_data.copy()
            data_bad["pin_code"] = "5600"
            Property.objects.create(**data_bad)
        self.assertIn("pin_code", ctx.exception.message_dict)

        with self.assertRaises(ValidationError) as ctx:
            data_bad = self.valid_residential_data.copy()
            data_bad["pin_code"] = "ABC123"
            Property.objects.create(**data_bad)
        self.assertIn("pin_code", ctx.exception.message_dict)

    def test_draft_creation_with_incomplete_details(self):
        # In draft, physical specs, coordinates, and optional fields can be omitted
        minimal_draft = Property.objects.create(
            owner=self.owner,
            title="Minimal Draft Property",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Sample Building",
            locality="Central Area",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560001",
            # All optional/incomplete fields omitted or None
            description=None,
            address_line_2=None,
            landmark=None,
            latitude=None,
            longitude=None,
            built_up_area=None,
            bedrooms=None,
            bathrooms=None,
            furnishing_status=None,
            parking_details=None,
            status=PropertyStatus.DRAFT,
        )
        self.assertEqual(minimal_draft.status, PropertyStatus.DRAFT)
        self.assertIsNone(minimal_draft.latitude)
        self.assertIsNone(minimal_draft.bedrooms)
        self.assertIsNone(minimal_draft.built_up_area)

    # ============================================================
    # 8. Residential Physical Specs Validation in Non-Draft
    # ============================================================
    def test_residential_specs_validation_in_non_draft(self):
        # Residential in non-draft without bedrooms
        with self.assertRaises(ValidationError) as ctx:
            data = self.valid_residential_data.copy()
            data["status"] = PropertyStatus.AVAILABLE
            data["latitude"] = Decimal("12.9716")
            data["longitude"] = Decimal("77.5946")
            data["bedrooms"] = None
            Property.objects.create(**data)
        self.assertIn("bedrooms", ctx.exception.message_dict)

        # Residential in non-draft with all required fields -> succeeds
        data_valid = self.valid_residential_data.copy()
        data_valid["status"] = PropertyStatus.AVAILABLE
        data_valid["latitude"] = Decimal("12.9716")
        data_valid["longitude"] = Decimal("77.5946")
        data_valid["bedrooms"] = 2
        data_valid["bathrooms"] = Decimal("2.0")
        prop = Property.objects.create(**data_valid)
        self.assertEqual(prop.status, PropertyStatus.AVAILABLE)

        # Commercial in non-draft without bedrooms/bathrooms -> succeeds
        comm_prop = Property.objects.create(
            owner=self.owner,
            title="Commercial Office Space",
            category=PropertyCategory.COMMERCIAL,
            property_type=PropertyType.OFFICE,
            address_line_1="CBD Towers Floor 2",
            locality="MG Road",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560001",
            latitude=Decimal("12.9750"),
            longitude=Decimal("77.6000"),
            status=PropertyStatus.AVAILABLE,
            bedrooms=None,
            bathrooms=None,
        )
        self.assertEqual(comm_prop.status, PropertyStatus.AVAILABLE)

    # ============================================================
    # 9. Property Image Relationships
    # ============================================================
    def test_property_image_relationships(self):
        prop = Property.objects.create(**self.valid_residential_data)

        img1 = PropertyImage.objects.create(
            property=prop,
            image_url="https://storage.example.com/prop1/living-room.jpg",
            caption="Living Room",
            display_order=0,
            is_primary=True,
        )

        img2 = PropertyImage.objects.create(
            property=prop,
            image_url="https://storage.example.com/prop1/kitchen.jpg",
            caption="Kitchen",
            display_order=1,
            is_primary=False,
        )

        self.assertIsInstance(img1.id, uuid.UUID)
        self.assertEqual(prop.images.count(), 2)
        self.assertEqual(prop.images.first(), img1)

    # ============================================================
    # 10. Single Primary Image Constraint
    # ============================================================
    def test_single_primary_image_constraint(self):
        prop = Property.objects.create(**self.valid_residential_data)

        # Create first primary image -> succeeds
        PropertyImage.objects.create(
            property=prop,
            image_url="https://storage.example.com/prop1/facade.jpg",
            caption="Front View",
            is_primary=True,
        )

        # Attempting to create second primary image for the SAME property -> IntegrityError
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                PropertyImage.objects.create(
                    property=prop,
                    image_url="https://storage.example.com/prop1/garden.jpg",
                    caption="Garden",
                    is_primary=True,
                )

        # Multiple non-primary images for the same property -> succeeds
        PropertyImage.objects.create(
            property=prop,
            image_url="https://storage.example.com/prop1/bedroom.jpg",
            caption="Bedroom",
            is_primary=False,
        )
        PropertyImage.objects.create(
            property=prop,
            image_url="https://storage.example.com/prop1/balcony.jpg",
            caption="Balcony",
            is_primary=False,
        )
        self.assertEqual(prop.images.count(), 3)

        # Different property can have its own primary image -> succeeds
        prop2_data = self.valid_residential_data.copy()
        prop2_data["title"] = "Second Property"
        prop2 = Property.objects.create(**prop2_data)

        prop2_img = PropertyImage.objects.create(
            property=prop2,
            image_url="https://storage.example.com/prop2/main.jpg",
            is_primary=True,
        )
        self.assertTrue(prop2_img.is_primary)

    # ============================================================
    # 11. Amenity Relationships & M2M
    # ============================================================
    def test_amenity_category_validation(self):
        # All 8 controlled categories succeed
        for cat in AmenityCategory.values:
            amenity = Amenity.objects.create(
                name=f"Amenity {cat}",
                category=cat,
            )
            self.assertEqual(amenity.category, cat)

        # Unapproved category raises ValidationError
        with self.assertRaises(ValidationError) as ctx:
            Amenity.objects.create(
                name="Invalid Amenity",
                category="entertainment_vip",
            )
        self.assertIn("category", ctx.exception.message_dict)

    def test_amenity_relationships(self):
        prop = Property.objects.create(**self.valid_residential_data)

        gym = Amenity.objects.create(
            name="Fitness Centre",
            category=AmenityCategory.RECREATION,
            description="Fully equipped modern gym.",
        )
        backup = Amenity.objects.create(
            name="100% Power Backup",
            category=AmenityCategory.POWER_BACKUP,
            description="Diesel generator power backup.",
        )

        self.assertIsInstance(gym.id, uuid.UUID)
        self.assertIsNotNone(gym.created_at)
        self.assertIsNotNone(gym.updated_at)

        # Add amenities via through-model
        PropertyAmenity.objects.create(property=prop, amenity=gym)
        PropertyAmenity.objects.create(property=prop, amenity=backup)

        self.assertEqual(prop.amenities.count(), 2)
        self.assertIn(gym, prop.amenities.all())
        self.assertIn(backup, prop.amenities.all())
        self.assertIn(prop, gym.properties.all())

    # ============================================================
    # 12. Duplicate PropertyAmenity Prevention
    # ============================================================
    def test_duplicate_property_amenity_prevention(self):
        prop = Property.objects.create(**self.valid_residential_data)
        elevator = Amenity.objects.create(
            name="Passenger Elevator",
            category=AmenityCategory.BUILDING,
        )

        PropertyAmenity.objects.create(property=prop, amenity=elevator)

        # Adding the same amenity to the same property again -> IntegrityError
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                PropertyAmenity.objects.create(property=prop, amenity=elevator)
