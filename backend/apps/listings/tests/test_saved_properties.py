import uuid

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.listings.models import SavedProperty
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType

User = get_user_model()


class SavedPropertyModelTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email="tenant1@example.com",
            password="securepassword123",
            first_name="Tom",
            last_name="Tenant",
            is_tenant=True,
        )
        self.user2 = User.objects.create_user(
            email="tenant2@example.com",
            password="securepassword123",
            first_name="Tina",
            last_name="Tenant",
            is_tenant=True,
        )
        self.owner = User.objects.create_user(
            email="owner_saved@example.com",
            password="securepassword123",
            first_name="Oscar",
            last_name="Owner",
            is_owner=True,
        )
        self.property1 = Property.objects.create(
            owner=self.owner,
            title="Kozhikode Coastal Haven",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Beach Road 10",
            locality="Kozhikode Beach",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            status=PropertyStatus.DRAFT,
        )
        self.property2 = Property.objects.create(
            owner=self.owner,
            title="Malabar Greens Villa",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            address_line_1="Mavoor Road 50",
            locality="Medical College",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673008",
            status=PropertyStatus.DRAFT,
        )

    # ============================================================
    # 1. Creation and Relationships
    # ============================================================
    def test_user_can_save_property(self):
        saved = SavedProperty.objects.create(
            user=self.user1,
            property=self.property1,
        )

        self.assertIsInstance(saved.id, uuid.UUID)
        self.assertEqual(saved.user, self.user1)
        self.assertEqual(saved.property, self.property1)
        self.assertIsNotNone(saved.created_at)
        self.assertEqual(
            str(saved),
            f"{self.user1.email} saved {self.property1.title}",
        )

    def test_reverse_relationships(self):
        SavedProperty.objects.create(user=self.user1, property=self.property1)

        self.assertEqual(self.user1.saved_properties.count(), 1)
        self.assertEqual(self.user1.saved_properties.first().property, self.property1)

        self.assertEqual(self.property1.saved_by_users.count(), 1)
        self.assertEqual(self.property1.saved_by_users.first().user, self.user1)

    # ============================================================
    # 2. Multi-user & Multi-property Independence
    # ============================================================
    def test_different_users_can_save_same_property(self):
        saved1 = SavedProperty.objects.create(user=self.user1, property=self.property1)
        saved2 = SavedProperty.objects.create(user=self.user2, property=self.property1)

        self.assertNotEqual(saved1.id, saved2.id)
        self.assertEqual(self.property1.saved_by_users.count(), 2)

    def test_same_user_can_save_different_properties(self):
        saved1 = SavedProperty.objects.create(user=self.user1, property=self.property1)
        saved2 = SavedProperty.objects.create(user=self.user1, property=self.property2)

        self.assertNotEqual(saved1.id, saved2.id)
        self.assertEqual(self.user1.saved_properties.count(), 2)

    # ============================================================
    # 3. Uniqueness Enforcement (user, property)
    # ============================================================
    def test_cannot_save_same_property_twice_validation_error(self):
        SavedProperty.objects.create(user=self.user1, property=self.property1)

        duplicate = SavedProperty(user=self.user1, property=self.property1)
        with self.assertRaises(ValidationError) as ctx:
            duplicate.full_clean()
        self.assertIn("property", ctx.exception.message_dict)

    def test_cannot_save_same_property_twice_database_integrity_error(self):
        SavedProperty.objects.create(user=self.user1, property=self.property1)

        duplicate = SavedProperty(user=self.user1, property=self.property1)
        with self.assertRaises((IntegrityError, ValidationError)):
            with transaction.atomic():
                duplicate.save()

    # ============================================================
    # 4. Deletion & Re-saving Behavior
    # ============================================================
    def test_unsaving_property_allows_re_saving_later(self):
        # 1. Save property
        saved = SavedProperty.objects.create(user=self.user1, property=self.property1)
        self.assertEqual(SavedProperty.objects.filter(user=self.user1).count(), 1)

        # 2. Un-save (hard delete row)
        saved.delete()
        self.assertEqual(SavedProperty.objects.filter(user=self.user1).count(), 0)

        # 3. Re-save the same property successfully
        re_saved = SavedProperty.objects.create(user=self.user1, property=self.property1)
        self.assertIsNotNone(re_saved.id)
        self.assertEqual(SavedProperty.objects.filter(user=self.user1).count(), 1)

    # ============================================================
    # 5. Cascade Deletion Integrity
    # ============================================================
    def test_deleting_user_cascades_saved_property(self):
        SavedProperty.objects.create(user=self.user1, property=self.property1)
        self.assertEqual(SavedProperty.objects.count(), 1)

        self.user1.delete()
        self.assertEqual(SavedProperty.objects.count(), 0)

    def test_deleting_property_cascades_saved_property(self):
        SavedProperty.objects.create(user=self.user1, property=self.property1)
        self.assertEqual(SavedProperty.objects.count(), 1)

        self.property1.delete()
        self.assertEqual(SavedProperty.objects.count(), 0)

