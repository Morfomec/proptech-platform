import uuid

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.notifications.models import NotificationType
from apps.notifications.services import create_notification

User = get_user_model()


class NotificationAPITests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            email="notif_api_a@example.com",
            password="securepassword123",
            is_active=True,
        )
        self.user_b = User.objects.create_user(
            email="notif_api_b@example.com",
            password="securepassword123",
            is_active=True,
            is_owner=True,
        )
        self.admin = User.objects.create_superuser(
            email="notif_api_admin@example.com",
            password="securepassword123",
        )

    def test_all_notification_endpoints_require_authentication(self):
        fake_id = str(uuid.uuid4())
        endpoints = [
            ("get", reverse("notifications:notification-list")),
            ("get", reverse("notifications:notification-detail", kwargs={"pk": fake_id})),
            ("get", reverse("notifications:notification-unread-count")),
            ("post", reverse("notifications:notification-read", kwargs={"pk": fake_id})),
            ("post", reverse("notifications:notification-read-all")),
        ]
        for method, url in endpoints:
            res = getattr(self.client, method)(url)
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_pagination_and_is_read_filtering(self):
        created = []
        for idx in range(5):
            created.append(
                create_notification(
                    user=self.user_a,
                    notification_type=NotificationType.TENANCY_CREATED,
                    title=f"Notice {idx}",
                    message=f"Message {idx}",
                )
            )
        # Mark two as read.
        self.client.force_authenticate(user=self.user_a)
        for item in created[:2]:
            self.client.post(
                reverse("notifications:notification-read", kwargs={"pk": item.id})
            )

        # Create one for user_b to ensure strict scoping.
        create_notification(
            user=self.user_b,
            notification_type=NotificationType.APPLICATION_SUBMITTED,
            title="User B Notice",
            message="User B Message",
        )

        # Page size = 2 pagination
        page_res = self.client.get(
            reverse("notifications:notification-list"),
            {"page": 1, "page_size": 2},
        )
        self.assertEqual(page_res.status_code, status.HTTP_200_OK)
        self.assertEqual(page_res.data["count"], 5)
        self.assertEqual(len(page_res.data["results"]), 2)
        self.assertIsNotNone(page_res.data["next"])

        # Filter unread only
        unread_res = self.client.get(
            reverse("notifications:notification-list"),
            {"is_read": "false"},
        )
        self.assertEqual(unread_res.status_code, status.HTTP_200_OK)
        self.assertEqual(unread_res.data["count"], 3)

        # Filter read only
        read_res = self.client.get(
            reverse("notifications:notification-list"),
            {"is_read": "true"},
        )
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        self.assertEqual(read_res.data["count"], 2)

    def test_retrieve_unread_count_read_and_read_all(self):
        n1 = create_notification(
            user=self.user_a,
            notification_type=NotificationType.APPLICATION_APPROVED,
            title="Approved",
            message="Approved.",
        )
        n2 = create_notification(
            user=self.user_a,
            notification_type=NotificationType.TENANCY_CONFIRMED,
            title="Confirmed",
            message="Confirmed.",
        )
        n_other = create_notification(
            user=self.user_b,
            notification_type=NotificationType.APPLICATION_SUBMITTED,
            title="Other",
            message="Other.",
        )

        self.client.force_authenticate(user=self.user_a)

        # Unread count initially 2
        count_res = self.client.get(reverse("notifications:notification-unread-count"))
        self.assertEqual(count_res.status_code, status.HTTP_200_OK)
        self.assertTrue(count_res.data["success"])
        self.assertEqual(count_res.data["data"]["unread_count"], 2)

        # Retrieve one -> 200 envelope
        det_res = self.client.get(
            reverse("notifications:notification-detail", kwargs={"pk": n1.id})
        )
        self.assertEqual(det_res.status_code, status.HTTP_200_OK)
        self.assertTrue(det_res.data["success"])
        self.assertEqual(det_res.data["data"]["id"], str(n1.id))

        # Mark one read -> 200, idempotent
        read_res = self.client.post(
            reverse("notifications:notification-read", kwargs={"pk": n1.id})
        )
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        self.assertTrue(read_res.data["data"]["is_read"])
        self.assertIsNotNone(read_res.data["data"]["read_at"])
        first_read_at = read_res.data["data"]["read_at"]

        repeat_res = self.client.post(
            reverse("notifications:notification-read", kwargs={"pk": n1.id})
        )
        self.assertEqual(repeat_res.status_code, status.HTTP_200_OK)
        self.assertEqual(repeat_res.data["data"]["read_at"], first_read_at)

        # Read-all marks remaining unread (1) and leaves user_b untouched.
        read_all_res = self.client.post(reverse("notifications:notification-read-all"))
        self.assertEqual(read_all_res.status_code, status.HTTP_200_OK)
        self.assertTrue(read_all_res.data["success"])
        self.assertEqual(read_all_res.data["data"]["updated_count"], 1)

        final_count = self.client.get(reverse("notifications:notification-unread-count"))
        self.assertEqual(final_count.data["data"]["unread_count"], 0)

        n2.refresh_from_db()
        n_other.refresh_from_db()
        self.assertTrue(n2.is_read)
        self.assertFalse(n_other.is_read)

    def test_recipient_only_isolation_including_platform_admin(self):
        notif_a = create_notification(
            user=self.user_a,
            notification_type=NotificationType.APPLICATION_APPROVED,
            title="Private Notice",
            message="For user A only.",
        )

        # Both another user AND platform admin receive 404 on retrieve/read and 0 in list/unread-count.
        for actor in (self.user_b, self.admin):
            self.client.force_authenticate(user=actor)
            self.assertEqual(
                self.client.get(reverse("notifications:notification-list")).data["count"],
                0,
            )
            self.assertEqual(
                self.client.get(reverse("notifications:notification-unread-count")).data["data"]["unread_count"],
                0,
            )
            det = self.client.get(
                reverse("notifications:notification-detail", kwargs={"pk": notif_a.id})
            )
            self.assertEqual(det.status_code, status.HTTP_404_NOT_FOUND)
            mark_read = self.client.post(
                reverse("notifications:notification-read", kwargs={"pk": notif_a.id})
            )
            self.assertEqual(mark_read.status_code, status.HTTP_404_NOT_FOUND)
            self.assertFalse(mark_read.data["success"])

