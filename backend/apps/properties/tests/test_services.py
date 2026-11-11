from datetime import date
import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.leasing.models import Tenancy, TenancyStatus
from apps.listings.models import Listing, ListingStatus
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
from apps.properties.services import (
    InvalidAmenityError,
    PropertyOwnershipError,
    PropertyProtectedError,
    add_property_image,
    assign_property_amenities,
    create_property,
    delete_property,
    remove_property_image,
    set_primary_image,
    sync_property_amenities,
    update_property,
)
from apps.properties.services.image_service import MAX_IMAGES_PER_PROPERTY

User = get_user_model()


class PropertyServiceTests(TestCase):
    def setUp(self):
        # A new tenant user with is_owner=False
        self.user = User.objects.create_user(
            email="tenant_user@example.com",
            password="securepassword123",
            first_name="John",
            last_name="Doe",
            is_tenant=True,
            is_owner=False,
        )

        self.other_user = User.objects.create_user(
            email="other_user@example.com",
            password="securepassword123",
            first_name="Jane",
            last_name="Smith",
            is_tenant=True,
            is_owner=False,
        )

        self.active_amenity_1 = Amenity.objects.create(
            name="Swimming Pool",
            category=AmenityCategory.RECREATION,
            is_active=True,
        )
        self.active_amenity_2 = Amenity.objects.create(
            name="24x7 Security",
            category=AmenityCategory.SAFETY,
            is_active=True,
        )
        self.inactive_amenity = Amenity.objects.create(
            name="Sauna",
            category=AmenityCategory.RECREATION,
            is_active=False,
        )

        self.valid_property_data = {
            "title": "Palm Grove Apartment",
            "description": "Lovely 2BHK apartment.",
            "category": PropertyCategory.RESIDENTIAL,
            "property_type": PropertyType.APARTMENT,
            "address_line_1": "100 Palm Avenue",
            "locality": "Koramangala",
            "city": "Bengaluru",
            "district": "Bengaluru Urban",
            "state": "Karnataka",
            "pin_code": "560034",
            "country_code": "IN",
            "built_up_area": Decimal("1200.00"),
            "bedrooms": 2,
            "bathrooms": Decimal("2.0"),
            "furnishing_status": FurnishingStatus.SEMI_FURNISHED,
            "parking_spaces": 1,
            "status": PropertyStatus.DRAFT,
        }

    # ============================================================
    # 1. Property Creation & Owner Activation
    # ============================================================
    def test_successful_property_creation_and_owner_activation(self):
        self.assertFalse(self.user.is_owner)

        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
            amenity_ids=[self.active_amenity_1.id, self.active_amenity_2.id],
        )

        # Re-fetch user from DB to verify persistence
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_owner)
        self.assertTrue(self.user.is_tenant)  # Remains tenant as well
        self.assertEqual(prop.owner, self.user)
        self.assertEqual(prop.amenities.count(), 2)

    def test_draft_creation_activates_owner_capability(self):
        data = self.valid_property_data.copy()
        data["status"] = PropertyStatus.DRAFT
        data["latitude"] = None
        data["longitude"] = None
        data["bedrooms"] = None

        self.assertFalse(self.user.is_owner)
        prop = create_property(
            owner=self.user,
            validated_data=data,
        )

        self.user.refresh_from_db()
        self.assertTrue(self.user.is_owner)
        self.assertEqual(prop.status, PropertyStatus.DRAFT)

    def test_failed_creation_does_not_activate_owner_capability(self):
        invalid_data = self.valid_property_data.copy()
        # Residential cannot be a warehouse
        invalid_data["property_type"] = PropertyType.WAREHOUSE

        self.assertFalse(self.user.is_owner)

        with self.assertRaises(ValidationError):
            create_property(
                owner=self.user,
                validated_data=invalid_data,
            )

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_owner)
        self.assertEqual(Property.objects.filter(owner=self.user).count(), 0)

    def test_owner_is_derived_from_authenticated_user_never_client_payload(self):
        data = self.valid_property_data.copy()
        # Client attempts to spoof owner_id
        data["owner"] = self.other_user
        data["owner_id"] = self.other_user.id
        data["is_owner"] = True

        prop = create_property(
            owner=self.user,
            validated_data=data,
        )

        self.assertEqual(prop.owner, self.user)
        self.assertNotEqual(prop.owner, self.other_user)

    def test_model_validation_is_executed_before_saving(self):
        # Invalid coordinate
        data = self.valid_property_data.copy()
        data["latitude"] = Decimal("99.9999")  # > 90

        with self.assertRaises(ValidationError) as ctx:
            create_property(
                owner=self.user,
                validated_data=data,
            )

        self.assertIn("latitude", ctx.exception.message_dict)

    # ============================================================
    # 2. Property Updates & Deletion
    # ============================================================
    def test_successful_update(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )

        updated_prop = update_property(
            property_instance=prop,
            validated_data={"title": "Updated Palm Grove Villa"},
        )

        self.assertEqual(updated_prop.title, "Updated Palm Grove Villa")
        prop.refresh_from_db()
        self.assertEqual(prop.title, "Updated Palm Grove Villa")

    def test_owner_cannot_be_changed_during_update(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )

        with self.assertRaises(PropertyOwnershipError):
            update_property(
                property_instance=prop,
                validated_data={"owner": self.other_user},
            )

        with self.assertRaises(PropertyOwnershipError):
            update_property(
                property_instance=prop,
                validated_data={"owner_id": self.other_user.id},
            )

        prop.refresh_from_db()
        self.assertEqual(prop.owner, self.user)

    def test_successful_deletion(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )
        prop_id = prop.id

        result = delete_property(property_instance=prop)
        self.assertTrue(result)
        self.assertFalse(Property.objects.filter(id=prop_id).exists())

    # ============================================================
    # 3. Property Image Management
    # ============================================================
    def test_add_and_remove_property_images(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )

        img1 = add_property_image(
            property_instance=prop,
            image_url="https://images.example.com/prop1/living.jpg",
            caption="Living Room",
        )
        img2 = add_property_image(
            property_instance=prop,
            image_url="https://images.example.com/prop1/bedroom.jpg",
            caption="Master Bedroom",
        )

        self.assertEqual(prop.images.count(), 2)
        self.assertEqual(img1.display_order, 0)
        self.assertEqual(img2.display_order, 1)

        # Remove image
        remove_property_image(image_instance=img1)
        self.assertEqual(prop.images.count(), 1)
        self.assertFalse(PropertyImage.objects.filter(id=img1.id).exists())

    def test_set_and_change_primary_image(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )

        img1 = add_property_image(
            property_instance=prop,
            image_url="https://images.example.com/prop1/first.jpg",
            is_primary=True,
        )
        self.assertTrue(img1.is_primary)

        # Add second image as primary -> automatically unsets img1
        img2 = add_property_image(
            property_instance=prop,
            image_url="https://images.example.com/prop1/second.jpg",
            is_primary=True,
        )

        img1.refresh_from_db()
        img2.refresh_from_db()
        self.assertFalse(img1.is_primary)
        self.assertTrue(img2.is_primary)

        # Switch primary back to img1 using set_primary_image
        set_primary_image(property_instance=prop, image_instance=img1)
        img1.refresh_from_db()
        img2.refresh_from_db()
        self.assertTrue(img1.is_primary)
        self.assertFalse(img2.is_primary)

        # Only 1 primary image exists for property
        self.assertEqual(prop.images.filter(is_primary=True).count(), 1)

    # ============================================================
    # 4. Amenity Management
    # ============================================================
    def test_assign_active_amenities(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )

        assign_property_amenities(
            property_instance=prop,
            amenity_ids=[self.active_amenity_1.id, self.active_amenity_2.id],
        )
        self.assertEqual(prop.amenities.count(), 2)

    def test_reject_inactive_or_nonexistent_amenities(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )

        # Inactive amenity rejected
        with self.assertRaises(InvalidAmenityError):
            assign_property_amenities(
                property_instance=prop,
                amenity_ids=[self.inactive_amenity.id],
            )

        # Nonexistent amenity rejected
        with self.assertRaises(InvalidAmenityError):
            assign_property_amenities(
                property_instance=prop,
                amenity_ids=[uuid.uuid4()],
            )

        # Property amenities remain unchanged
        self.assertEqual(prop.amenities.count(), 0)

    def test_prevent_duplicate_amenity_assignments(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )

        # Assign first time
        assign_property_amenities(
            property_instance=prop,
            amenity_ids=[self.active_amenity_1.id],
        )
        self.assertEqual(prop.amenities.count(), 1)

        # Assign same amenity again -> handled safely without duplicate records or error
        assign_property_amenities(
            property_instance=prop,
            amenity_ids=[self.active_amenity_1.id],
        )
        self.assertEqual(prop.amenities.count(), 1)

    def test_sync_property_amenities(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
            amenity_ids=[self.active_amenity_1.id],
        )
        self.assertEqual(list(prop.amenities.values_list("id", flat=True)), [self.active_amenity_1.id])

        # Sync to amenity_2 only
        sync_property_amenities(
            property_instance=prop,
            amenity_ids=[self.active_amenity_2.id],
        )
        self.assertEqual(list(prop.amenities.values_list("id", flat=True)), [self.active_amenity_2.id])

    # ============================================================
    # 5. Deletion Protection & Image Boundary Guards
    # ============================================================
    def test_delete_property_protected_by_tenancy_raises_error(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )
        Tenancy.objects.create(
            property=prop,
            tenant=self.other_user,
            start_date=date(2026, 8, 1),
            monthly_rent=Decimal("20000.00"),
        )

        with self.assertRaises(PropertyProtectedError):
            delete_property(property_instance=prop)
        self.assertTrue(Property.objects.filter(pk=prop.pk).exists())

    def test_add_property_image_enforces_max_limit(self):
        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )
        for idx in range(MAX_IMAGES_PER_PROPERTY):
            add_property_image(
                property_instance=prop,
                image_url=f"https://images.example.com/prop/{idx}.jpg",
            )

        with self.assertRaises(ValidationError):
            add_property_image(
                property_instance=prop,
                image_url="https://images.example.com/prop/overflow.jpg",
            )

    def test_set_primary_image_rejects_cross_property_image(self):
        prop_a = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )
        prop_b = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )
        img_b = add_property_image(
            property_instance=prop_b,
            image_url="https://images.example.com/prop_b/main.jpg",
        )

        with self.assertRaises(ValidationError):
            set_primary_image(property_instance=prop_a, image_instance=img_b)

    def test_platform_admin_cannot_create_update_or_delete_properties_via_service(self):
        admin_user = User.objects.create_superuser(
            email="prop_service_admin@example.com",
            password="securepassword123",
            first_name="Admin",
            last_name="Service",
        )
        with self.assertRaises(PropertyOwnershipError):
            create_property(
                owner=admin_user,
                validated_data=self.valid_property_data.copy(),
            )

        prop = create_property(
            owner=self.user,
            validated_data=self.valid_property_data.copy(),
        )

        with self.assertRaises(PropertyOwnershipError):
            update_property(
                property_instance=prop,
                validated_data={"title": "Admin Attempt"},
                actor=admin_user,
            )

        with self.assertRaises(PropertyOwnershipError):
            delete_property(property_instance=prop, actor=admin_user)

        prop.refresh_from_db()
        self.assertEqual(prop.title, self.valid_property_data["title"])

    # ============================================================
    # 6. Property Status Preservation & Controlled Transitions
    # ============================================================
    def test_editing_existing_property_preserves_status_and_blocks_draft_downgrade(self):
        data = self.valid_property_data.copy()
        data["status"] = PropertyStatus.AVAILABLE
        prop = create_property(owner=self.user, validated_data=data)

        # Editing content without status preserves AVAILABLE status
        updated = update_property(
            property_instance=prop,
            validated_data={"title": "Updated Available Title"},
            actor=self.user,
        )
        updated.refresh_from_db()
        self.assertEqual(updated.status, PropertyStatus.AVAILABLE)
        self.assertEqual(updated.title, "Updated Available Title")

        # Attempting to downgrade AVAILABLE property back to DRAFT is rejected
        with self.assertRaises(ValidationError) as ctx:
            update_property(
                property_instance=updated,
                validated_data={"status": PropertyStatus.DRAFT},
                actor=self.user,
            )
        self.assertIn("status", ctx.exception.message_dict)
        updated.refresh_from_db()
        self.assertEqual(updated.status, PropertyStatus.AVAILABLE)

    def test_controlled_status_transitions_pause_published_listing_and_protect_occupancy(self):
        data = self.valid_property_data.copy()
        data["status"] = PropertyStatus.AVAILABLE
        prop = create_property(owner=self.user, validated_data=data)
        listing = Listing.objects.create(
            property=prop,
            title="Live Listing",
            monthly_rent=Decimal("25000.00"),
            status=ListingStatus.PUBLISHED,
        )

        # Moving AVAILABLE -> MAINTENANCE pauses published listing automatically
        update_property(
            property_instance=prop,
            validated_data={"status": PropertyStatus.MAINTENANCE},
            actor=self.user,
        )
        prop.refresh_from_db()
        listing.refresh_from_db()
        self.assertEqual(prop.status, PropertyStatus.MAINTENANCE)
        self.assertEqual(listing.status, ListingStatus.PAUSED)

        # Cannot manually set OCCUPIED via update_property
        with self.assertRaises(ValidationError) as ctx:
            update_property(
                property_instance=prop,
                validated_data={"status": PropertyStatus.OCCUPIED},
                actor=self.user,
            )
        self.assertIn("status", ctx.exception.message_dict)

        # Cannot change status out of OCCUPIED while an ACTIVE tenancy exists
        Property.objects.filter(pk=prop.pk).update(status=PropertyStatus.OCCUPIED)
        prop.refresh_from_db()
        Tenancy.objects.create(
            property=prop,
            tenant=self.other_user,
            start_date=date(2026, 8, 1),
            monthly_rent=Decimal("25000.00"),
            status=TenancyStatus.ACTIVE,
        )

        with self.assertRaises(ValidationError) as ctx_occ:
            update_property(
                property_instance=prop,
                validated_data={"status": PropertyStatus.AVAILABLE},
                actor=self.user,
            )
        self.assertIn("status", ctx_occ.exception.message_dict)
        prop.refresh_from_db()
        self.assertEqual(prop.status, PropertyStatus.OCCUPIED)

