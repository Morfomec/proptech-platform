import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.notifications.models import (
    Notification,
    NotificationType,
    RelatedObjectType,
)

User = get_user_model()


class NotificationModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="notif_user@example.com",
            password="securepassword123",
            first_name="Maya",
            last_name="Tenant",
            is_active=True,
        )
        self.other_user = User.objects.create_user(
            email="notif_other@example.com",
            password="securepassword123",
            first_name="Noah",
            last_name="Owner",
            is_active=True,
            is_owner=True,
        )

    def _build_notification_data(self, **overrides):
        data = {
            "user": self.user,
            "notification_type": NotificationType.APPLICATION_SUBMITTED,
            "title": "New application received",
            "message": "A tenant submitted an application for your listing.",
        }
        data.update(overrides)
        return data

    # ============================================================
    # 1. Notification Creation, Defaults, Timestamps & String Repr
    # ============================================================
    def test_notification_creation_uuid_defaults_and_timestamps(self):
        notification = Notification.objects.create(
            **self._build_notification_data()
        )

        self.assertIsInstance(notification.id, uuid.UUID)
        self.assertEqual(notification.user, self.user)
        self.assertEqual(
            notification.notification_type,
            NotificationType.APPLICATION_SUBMITTED,
        )
        self.assertEqual(notification.title, "New application received")
        self.assertEqual(
            notification.message,
            "A tenant submitted an application for your listing.",
        )
        self.assertFalse(notification.is_read)
        self.assertIsNone(notification.read_at)
        self.assertIsNone(notification.related_object_type)
        self.assertIsNone(notification.related_object_id)
        self.assertIsNotNone(notification.created_at)

        field_names = {f.name for f in Notification._meta.get_fields()}
        self.assertNotIn("updated_at", field_names)
        self.assertFalse(hasattr(notification, "updated_at"))

    def test_required_fields_rejected_by_full_clean(self):
        for required_field in (
            "user",
            "notification_type",
            "title",
            "message",
        ):
            data = self._build_notification_data()
            data.pop(required_field)
            notification = Notification(**data)
            with self.assertRaises(ValidationError) as ctx:
                notification.full_clean()
            self.assertIn(required_field, ctx.exception.message_dict)

    def test_string_representation(self):
        notification = Notification.objects.create(
            **self._build_notification_data(
                notification_type=NotificationType.TENANCY_CONFIRMED
            )
        )
        self.assertEqual(
            str(notification),
            f"{NotificationType.TENANCY_CONFIRMED} - {self.user}",
        )

    # ============================================================
    # 2. User Relationship & CASCADE Deletion
    # ============================================================
    def test_user_relationship_and_cascade_deletion(self):
        user_notification = Notification.objects.create(
            **self._build_notification_data(user=self.user)
        )
        other_notification = Notification.objects.create(
            **self._build_notification_data(user=self.other_user)
        )

        self.assertIn(user_notification, self.user.notifications.all())
        self.assertNotIn(other_notification, self.user.notifications.all())

        user_notif_id = user_notification.id
        self.user.delete()

        self.assertFalse(
            Notification.objects.filter(pk=user_notif_id).exists()
        )
        self.assertTrue(
            Notification.objects.filter(pk=other_notification.id).exists()
        )

    # ============================================================
    # 3. NotificationType & RelatedObjectType Choices
    # ============================================================
    def test_supported_notification_type_choices(self):
        expected_types = [
            "application_submitted",
            "application_under_review",
            "application_approved",
            "application_rejected",
            "application_withdrawn",
            "tenancy_created",
            "tenancy_confirmed",
            "tenancy_activated",
            "tenancy_cancelled",
            "tenancy_ended",
            "document_uploaded",
        ]
        self.assertEqual(NotificationType.values, expected_types)

        for notif_type in expected_types:
            notification = Notification(
                **self._build_notification_data(notification_type=notif_type)
            )
            notification.full_clean()
            notification.save()
            self.assertEqual(notification.notification_type, notif_type)

    def test_supported_related_object_type_choices(self):
        expected_related_types = ["application", "tenancy", "document"]
        self.assertEqual(RelatedObjectType.values, expected_related_types)

        for rel_type in expected_related_types:
            notification = Notification(
                **self._build_notification_data(
                    related_object_type=rel_type,
                    related_object_id=uuid.uuid4(),
                )
            )
            notification.full_clean()
            notification.save()
            self.assertEqual(notification.related_object_type, rel_type)

    def test_invalid_choices_rejected_by_full_clean(self):
        invalid_type = Notification(
            **self._build_notification_data(
                notification_type="rent_payment_received"
            )
        )
        with self.assertRaises(ValidationError) as ctx:
            invalid_type.full_clean()
        self.assertIn("notification_type", ctx.exception.message_dict)

        invalid_related_type = Notification(
            **self._build_notification_data(
                related_object_type="invoice",
                related_object_id=uuid.uuid4(),
            )
        )
        with self.assertRaises(ValidationError) as ctx:
            invalid_related_type.full_clean()
        self.assertIn("related_object_type", ctx.exception.message_dict)

    # ============================================================
    # 4. Related-Object Nullable & UUID Storage
    # ============================================================
    def test_related_object_fields_nullable_and_uuid_storage(self):
        unlinked = Notification(
            **self._build_notification_data(
                related_object_type=None,
                related_object_id=None,
            )
        )
        unlinked.full_clean()
        unlinked.save()
        unlinked.refresh_from_db()

        self.assertIsNone(unlinked.related_object_type)
        self.assertIsNone(unlinked.related_object_id)

        for rel_type in (
            RelatedObjectType.APPLICATION,
            RelatedObjectType.TENANCY,
            RelatedObjectType.DOCUMENT,
        ):
            target_id = uuid.uuid4()
            linked = Notification.objects.create(
                **self._build_notification_data(
                    related_object_type=rel_type,
                    related_object_id=target_id,
                )
            )
            linked.refresh_from_db()
            self.assertEqual(linked.related_object_type, rel_type)
            self.assertEqual(linked.related_object_id, target_id)
            self.assertIsInstance(linked.related_object_id, uuid.UUID)

    # ============================================================
    # 5. Default Ordering (-created_at)
    # ============================================================
    def test_default_ordering_is_newest_first(self):
        oldest = Notification.objects.create(
            **self._build_notification_data(title="Oldest")
        )
        middle = Notification.objects.create(
            **self._build_notification_data(title="Middle")
        )
        newest = Notification.objects.create(
            **self._build_notification_data(title="Newest")
        )

        now = timezone.now()
        Notification.objects.filter(pk=oldest.pk).update(
            created_at=now - timedelta(minutes=10)
        )
        Notification.objects.filter(pk=middle.pk).update(
            created_at=now - timedelta(minutes=5)
        )
        Notification.objects.filter(pk=newest.pk).update(created_at=now)

        ordered_ids = list(
            Notification.objects.filter(user=self.user).values_list(
                "id", flat=True
            )
        )
        self.assertEqual(ordered_ids, [newest.id, middle.id, oldest.id])

