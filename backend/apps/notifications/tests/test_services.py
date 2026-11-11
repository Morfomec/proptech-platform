from datetime import timedelta
from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase
from django.utils import timezone

from apps.leasing.models import Application, ApplicationStatus
from apps.listings.models import Listing, ListingStatus
from apps.notifications.models import (
    Notification,
    NotificationType,
    RelatedObjectType,
)
from apps.notifications.services import (
    create_notification,
    get_notification_by_id,
    get_unread_notification_count,
    get_user_notifications,
    mark_all_notifications_as_read,
    mark_notification_as_read,
)
from apps.notifications.services.exceptions import (
    InvalidNotificationReferenceError,
    NotificationNotFoundError,
)
from apps.properties.models import (
    Property,
    PropertyCategory,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class NotificationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="notif_svc_user@example.com",
            password="securepassword123",
            is_active=True,
        )
        self.other_user = User.objects.create_user(
            email="notif_svc_other@example.com",
            password="securepassword123",
            is_active=True,
            is_owner=True,
        )
        self.property = Property.objects.create(
            owner=self.other_user,
            title="Palm View",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="10 Palm Ave",
            locality="HSR Layout",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560102",
            latitude=Decimal("12.9121181"),
            longitude=Decimal("77.6445548"),
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )
        self.listing = Listing.objects.create(
            property=self.property,
            title="Palm View Listing",
            monthly_rent=25000,
            status=ListingStatus.PUBLISHED,
        )
        self.application = Application.objects.create(
            listing=self.listing,
            applicant=self.user,
            status=ApplicationStatus.SUBMITTED,
        )

    def test_create_notification_unlinked_and_valid_polymorphic_reference(self):
        unlinked = create_notification(
            user=self.user,
            notification_type=NotificationType.TENANCY_CREATED,
            title="Welcome",
            message="Unlinked notice.",
        )
        self.assertIsNone(unlinked.related_object_type)
        self.assertIsNone(unlinked.related_object_id)

        linked = create_notification(
            user=self.other_user,
            notification_type=NotificationType.APPLICATION_SUBMITTED,
            title="New application",
            message="Application received.",
            related_object_type=RelatedObjectType.APPLICATION,
            related_object_id=self.application.id,
        )
        self.assertEqual(
            linked.related_object_type,
            RelatedObjectType.APPLICATION,
        )
        self.assertEqual(linked.related_object_id, self.application.id)

    def test_create_notification_validation_and_reference_errors(self):
        with self.assertRaises(ValueError):
            create_notification(
                user=AnonymousUser(),
                notification_type=NotificationType.APPLICATION_SUBMITTED,
                title="Title",
                message="Message",
            )

        with self.assertRaises(ValueError):
            create_notification(
                user=self.user,
                notification_type="invalid_type",
                title="Title",
                message="Message",
            )

        # Partial reference (type without id or id without type)
        with self.assertRaises(InvalidNotificationReferenceError):
            create_notification(
                user=self.user,
                notification_type=NotificationType.APPLICATION_SUBMITTED,
                title="Title",
                message="Message",
                related_object_type=RelatedObjectType.APPLICATION,
                related_object_id=None,
            )

        with self.assertRaises(InvalidNotificationReferenceError):
            create_notification(
                user=self.user,
                notification_type=NotificationType.APPLICATION_SUBMITTED,
                title="Title",
                message="Message",
                related_object_type=None,
                related_object_id=self.application.id,
            )

        # Unsupported related object type
        with self.assertRaises(InvalidNotificationReferenceError):
            create_notification(
                user=self.user,
                notification_type=NotificationType.APPLICATION_SUBMITTED,
                title="Title",
                message="Message",
                related_object_type="property",
                related_object_id=self.property.id,
            )

        # Nonexistent target ID
        with self.assertRaises(InvalidNotificationReferenceError):
            create_notification(
                user=self.user,
                notification_type=NotificationType.APPLICATION_SUBMITTED,
                title="Title",
                message="Message",
                related_object_type=RelatedObjectType.APPLICATION,
                related_object_id=uuid.uuid4(),
            )

    def test_recipient_filtering_unread_count_and_get_by_id(self):
        unread = create_notification(
            user=self.user,
            notification_type=NotificationType.APPLICATION_APPROVED,
            title="Approved",
            message="Approved.",
        )
        read = Notification.objects.create(
            user=self.user,
            notification_type=NotificationType.TENANCY_CONFIRMED,
            title="Confirmed",
            message="Confirmed.",
            is_read=True,
            read_at=timezone.now(),
        )
        other_notif = create_notification(
            user=self.other_user,
            notification_type=NotificationType.APPLICATION_SUBMITTED,
            title="Other",
            message="Other.",
        )

        self.assertEqual(
            set(get_user_notifications(user=self.user)),
            {unread, read},
        )
        self.assertEqual(
            list(get_user_notifications(user=self.user, is_read=False)),
            [unread],
        )
        self.assertEqual(
            list(get_user_notifications(user=self.user, is_read=True)),
            [read],
        )
        self.assertEqual(get_unread_notification_count(user=self.user), 1)
        self.assertEqual(
            get_notification_by_id(user=self.user, notification_id=unread.id),
            unread,
        )

        with self.assertRaises(NotificationNotFoundError):
            get_notification_by_id(
                user=self.user,
                notification_id=other_notif.id,
            )

    def test_mark_notification_as_read_is_idempotent_and_scoped(self):
        notif = create_notification(
            user=self.user,
            notification_type=NotificationType.APPLICATION_APPROVED,
            title="Approved",
            message="Approved.",
        )

        # Another user cannot mark it read.
        with self.assertRaises(NotificationNotFoundError):
            mark_notification_as_read(
                user=self.other_user,
                notification_id=notif.id,
            )

        updated = mark_notification_as_read(
            user=self.user,
            notification_id=notif.id,
        )
        self.assertTrue(updated.is_read)
        self.assertIsNotNone(updated.read_at)
        first_read_at = updated.read_at

        # Simulate later timestamp; second call must preserve original read_at.
        Notification.objects.filter(pk=notif.pk).update(
            read_at=first_read_at - timedelta(minutes=5)
        )
        notif.refresh_from_db()
        original_read_at = notif.read_at

        repeated = mark_notification_as_read(
            user=self.user,
            notification_id=notif.id,
        )
        self.assertTrue(repeated.is_read)
        self.assertEqual(repeated.read_at, original_read_at)

    def test_mark_all_notifications_as_read_scoped_and_preserves_already_read(self):
        already_read_at = timezone.now() - timedelta(hours=1)
        already_read = Notification.objects.create(
            user=self.user,
            notification_type=NotificationType.TENANCY_CREATED,
            title="Old",
            message="Old.",
            is_read=True,
            read_at=already_read_at,
        )
        unread_1 = create_notification(
            user=self.user,
            notification_type=NotificationType.TENANCY_CONFIRMED,
            title="Unread 1",
            message="Unread 1.",
        )
        unread_2 = create_notification(
            user=self.user,
            notification_type=NotificationType.TENANCY_ACTIVATED,
            title="Unread 2",
            message="Unread 2.",
        )
        other_unread = create_notification(
            user=self.other_user,
            notification_type=NotificationType.APPLICATION_SUBMITTED,
            title="Other Unread",
            message="Other Unread.",
        )

        updated_count = mark_all_notifications_as_read(user=self.user)
        self.assertEqual(updated_count, 2)
        self.assertEqual(get_unread_notification_count(user=self.user), 0)

        already_read.refresh_from_db()
        unread_1.refresh_from_db()
        unread_2.refresh_from_db()
        other_unread.refresh_from_db()

        self.assertEqual(already_read.read_at, already_read_at)
        self.assertTrue(unread_1.is_read and unread_1.read_at is not None)
        self.assertTrue(unread_2.is_read and unread_2.read_at is not None)
        self.assertFalse(other_unread.is_read)
        self.assertIsNone(other_unread.read_at)

