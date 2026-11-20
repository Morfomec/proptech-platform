from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.properties.models import PropertyCategory, PropertyType
from apps.subscriptions.models import SubscriptionPaymentMethod, SubscriptionPaymentStatus
from apps.subscriptions.services import record_subscription_payment

User = get_user_model()


class SubscriptionAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_api@example.com",
            password="StrongPassword123!",
            first_name="Owner",
            last_name="User",
            is_active=True,
            is_owner=True,
            email_verified_at=timezone.now(),
        )
        self.other_user = User.objects.create_user(
            email="other_api@example.com",
            password="StrongPassword123!",
            first_name="Other",
            last_name="User",
            is_active=True,
            is_owner=True,
            email_verified_at=timezone.now(),
        )
        self.tenant_user = User.objects.create_user(
            email="tenant_api@example.com",
            password="StrongPassword123!",
            first_name="Tenant",
            last_name="User",
            is_active=True,
            is_owner=False,
            is_tenant=True,
            email_verified_at=timezone.now(),
        )

    def test_list_subscription_plans_public(self):
        url = reverse("subscriptions:subscription-plan-list")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(len(res.data["data"]), 4)
        codes = [p["code"] for p in res.data["data"]]
        self.assertIn("starter", codes)
        self.assertIn("enterprise", codes)

    def test_get_my_subscription_unauthenticated(self):
        url = reverse("subscriptions:subscription-me")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_my_subscription_authenticated(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse("subscriptions:subscription-me")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["data"]["status"], "trialing")
        self.assertEqual(res.data["data"]["plan"]["code"], "starter")
        self.assertTrue(res.data["data"]["is_entitled_to_quota"])

    def test_get_quota_utilization_api(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse("subscriptions:subscription-quota")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["data"]["properties_count"], 0)
        self.assertEqual(res.data["data"]["max_properties"], 5)
        self.assertEqual(res.data["data"]["remaining_quota"], 5)
        self.assertFalse(res.data["data"]["is_quota_exceeded"])

    def test_upgrade_subscription_api(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse("subscriptions:subscription-upgrade")

        # Invalid plan code -> 400
        res_invalid = self.client.post(url, {"plan_code": "non_existent"})
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid plan code -> 200
        res = self.client.post(url, {"plan_code": "growth"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["data"]["plan"]["code"], "growth")

        # Quota API reflects new limit 12
        quota_res = self.client.get(reverse("subscriptions:subscription-quota"))
        self.assertEqual(quota_res.data["data"]["max_properties"], 12)

    def test_cancel_subscription_api(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse("subscriptions:subscription-cancel")
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["data"]["status"], "cancelled")

    def test_list_payment_history_api(self):
        self.client.force_authenticate(user=self.owner)

        # Fetch me to initialize subscription
        sub_res = self.client.get(reverse("subscriptions:subscription-me"))
        sub_id = sub_res.data["data"]["id"]

        # Record a payment
        record_subscription_payment(
            subscription_id=sub_id,
            amount=Decimal("399.00"),
            payment_method=SubscriptionPaymentMethod.UPI,
            transaction_reference="API_TXN_001",
            status=SubscriptionPaymentStatus.SUCCESSFUL,
        )

        payments_url = reverse("subscriptions:subscription-payments")
        res = self.client.get(payments_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Check either unpaginated list or paginated results
        payment_list = res.data["data"]["results"] if isinstance(res.data["data"], dict) and "results" in res.data["data"] else res.data["data"]
        self.assertEqual(len(payment_list), 1)
        self.assertEqual(payment_list[0]["transaction_reference"], "API_TXN_001")

        # Cross-user isolation: other_user cannot see owner's payments
        self.client.force_authenticate(user=self.other_user)
        other_res = self.client.get(payments_url)
        self.assertEqual(other_res.status_code, status.HTTP_200_OK)
        other_list = other_res.data["data"]["results"] if isinstance(other_res.data["data"], dict) and "results" in other_res.data["data"] else other_res.data["data"]
        self.assertEqual(len(other_list), 0)

    def test_tenant_access_to_subscription_me_denied(self):
        self.client.force_authenticate(user=self.tenant_user)
        url = reverse("subscriptions:subscription-me")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(res.data["success"])
        self.assertEqual(res.data["error"]["code"], "FORBIDDEN")

    def test_tenant_access_to_quota_denied(self):
        self.client.force_authenticate(user=self.tenant_user)
        url = reverse("subscriptions:subscription-quota")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_activate_trial_api_verified_user(self):
        verified_user = User.objects.create_user(
            email="verified_trial@example.com",
            password="StrongPassword123!",
            is_active=True,
            is_owner=False,
            email_verified_at=timezone.now(),
        )
        self.client.force_authenticate(user=verified_user)
        url = reverse("subscriptions:subscription-activate-trial")
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["data"]["status"], "trialing")
        self.assertEqual(res.data["data"]["plan"]["code"], "starter")

        verified_user.refresh_from_db()
        self.assertTrue(verified_user.is_owner)

    def test_activate_trial_api_unverified_user_rejected(self):
        unverified_user = User.objects.create_user(
            email="unverified_trial@example.com",
            password="StrongPassword123!",
            is_active=True,
            is_owner=False,
            email_verified_at=None,
        )
        self.client.force_authenticate(user=unverified_user)
        url = reverse("subscriptions:subscription-activate-trial")
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data["success"])
        self.assertIn("Email verification is required", res.data["error"]["message"])

        unverified_user.refresh_from_db()
        self.assertFalse(unverified_user.is_owner)

    def test_activate_trial_api_unauthenticated_rejected(self):
        url = reverse("subscriptions:subscription-activate-trial")
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_activate_trial_api_idempotent(self):
        user = User.objects.create_user(
            email="idempotent_trial@example.com",
            password="StrongPassword123!",
            is_active=True,
            is_owner=False,
            email_verified_at=timezone.now(),
        )
        self.client.force_authenticate(user=user)
        url = reverse("subscriptions:subscription-activate-trial")
        res1 = self.client.post(url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        trial_ends_at = res1.data["data"]["trial_ends_at"]

        # Call again
        res2 = self.client.post(url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["data"]["trial_ends_at"], trial_ends_at)
        self.assertEqual(res2.data["data"]["id"], res1.data["data"]["id"])
