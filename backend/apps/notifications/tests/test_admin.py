import uuid
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from apps.notifications.admin import NotificationAdmin
from apps.notifications.models import Notification, NotificationType

User = get_user_model()


class NotificationAdminChangelistTests(TestCase):
    """
    Tests for the improved Django Unfold Notifications Changelist UI:
    1. Full UUID 'id' removed from list_display.
    2. 'S.No.' (serial_number) added as the first column.
    3. Sequential row numbers generated dynamically, respecting pagination, filtering and search.
    4. Database schema untouched (no serial-number database field).
    5. UUID preserved as read-only field on detail page.
    6. Preserved User, Notification Type, Title, Read Status, and Created At columns.
    7. Reusable SerialNumberAdminMixin behavior.
    """

    def setUp(self):
        self.client = Client()
        self.superuser = User.objects.create_superuser(
            email="notif_admin@example.com",
            password="AdminPassword123!",
            first_name="Admin",
            last_name="User",
        )
        self.target_user = User.objects.create_user(
            email="target_user@example.com",
            password="UserPassword123!",
        )

        # Create 12 distinct notifications to test pagination and filtering
        self.notifications = []
        for i in range(1, 13):
            notif_type = (
                NotificationType.APPLICATION_SUBMITTED
                if i % 2 == 1
                else NotificationType.TENANCY_CREATED
            )
            is_read = (i % 3 == 0)
            n = Notification.objects.create(
                user=self.target_user,
                notification_type=notif_type,
                title=f"Notification Title {i:02d}",
                message=f"Detailed message body for notification {i}",
                is_read=is_read,
            )
            self.notifications.append(n)

    def test_list_display_columns_and_no_uuid_column(self):
        """Verify list_display contains S.No. as first column and omits UUID 'id'."""
        admin_instance = NotificationAdmin(Notification, None)
        expected_columns = (
            "serial_number",
            "user",
            "notification_type",
            "title",
            "show_read_status",
            "created_at",
        )
        self.assertEqual(admin_instance.list_display, expected_columns)
        self.assertNotIn("id", admin_instance.list_display)
        self.assertEqual(admin_instance.list_display[0], "serial_number")

    def test_changelist_renders_sno_header_and_sequential_numbers(self):
        """Verify changelist renders 'S.No.' column header and 1-indexed sequential numbers."""
        self.client.force_login(self.superuser)
        res = self.client.get(reverse("admin:notifications_notification_changelist"))
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # S.No. column header is present
        self.assertIn("S.No.", content)
        self.assertIn("column-serial_number", content)
        self.assertIn("field-serial_number", content)

        # Check context result_list serial numbers
        cl = res.context["cl"]
        serials = [getattr(obj, "_serial_number", None) for obj in cl.result_list]
        self.assertEqual(serials, list(range(1, 13)))

        # Required columns present
        self.assertIn("User", content)
        self.assertIn("Notification type", content)
        self.assertIn("Title", content)
        self.assertIn("Read", content)
        self.assertIn("Created at", content)

    def test_changelist_pagination_sequential_offsets(self):
        """Verify sequential numbering properly offsets across pages."""
        self.client.force_login(self.superuser)
        from django.test import RequestFactory
        from django.contrib.admin.sites import AdminSite

        class SmallPageNotificationAdmin(NotificationAdmin):
            list_per_page = 5

        site = AdminSite()
        admin = SmallPageNotificationAdmin(Notification, site)
        rf = RequestFactory()

        # Page 1 (offset: 1..5)
        req_p1 = rf.get("/admin/notifications/notification/?p=1")
        cl_p1 = admin.get_changelist_instance(req_p1)
        cl_p1.get_results(req_p1)
        serials_p1 = [getattr(obj, "_serial_number", None) for obj in cl_p1.result_list]
        self.assertEqual(serials_p1, [1, 2, 3, 4, 5])

        # Page 2 (offset: 6..10)
        req_p2 = rf.get("/admin/notifications/notification/?p=2")
        cl_p2 = admin.get_changelist_instance(req_p2)
        cl_p2.get_results(req_p2)
        serials_p2 = [getattr(obj, "_serial_number", None) for obj in cl_p2.result_list]
        self.assertEqual(serials_p2, [6, 7, 8, 9, 10])

        # Page 3 (offset: 11..12)
        req_p3 = rf.get("/admin/notifications/notification/?p=3")
        cl_p3 = admin.get_changelist_instance(req_p3)
        cl_p3.get_results(req_p3)
        serials_p3 = [getattr(obj, "_serial_number", None) for obj in cl_p3.result_list]
        self.assertEqual(serials_p3, [11, 12])

    def test_filtering_preserves_sequential_row_numbers(self):
        """Verify filtered changelist starts at S.No. 1 and sequences consecutively."""
        self.client.force_login(self.superuser)
        # Filter by is_read = True (4 out of 12 notifications)
        url = reverse("admin:notifications_notification_changelist") + "?is_read__exact=1"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)

        cl = res.context["cl"]
        self.assertEqual(cl.result_count, 4)
        serials = [getattr(obj, "_serial_number", None) for obj in cl.result_list]
        self.assertEqual(serials, [1, 2, 3, 4])

    def test_search_preserves_sequential_row_numbers(self):
        """Verify search results sequence consecutive S.No. from 1."""
        self.client.force_login(self.superuser)
        url = reverse("admin:notifications_notification_changelist") + "?q=Title 0"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)

        cl = res.context["cl"]
        # Matches Title 01 through 09 and Title 10 (containing terms 'Title' and '0') = 10 results
        self.assertEqual(cl.result_count, 10)
        serials = [getattr(obj, "_serial_number", None) for obj in cl.result_list]
        self.assertEqual(serials, list(range(1, 11)))

    def test_detail_page_preserves_uuid_as_readonly(self):
        """Verify notification detail page renders the UUID 'id' as a read-only field."""
        self.client.force_login(self.superuser)
        first_notif = self.notifications[0]
        url = reverse("admin:notifications_notification_change", args=[first_notif.id])
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # UUID is present in detail view
        self.assertIn(str(first_notif.id), content)
        # UUID field is read-only (not an editable <input name="id">)
        self.assertNotIn('<input type="text" name="id"', content)
        self.assertIn("readonly", content.lower())

    def test_no_database_field_added(self):
        """Verify no 'serial_number' field exists on Notification database model."""
        field_names = [f.name for f in Notification._meta.get_fields()]
        self.assertNotIn("serial_number", field_names)
        self.assertNotIn("s_no", field_names)
        self.assertIn("id", field_names)
