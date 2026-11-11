from apps.accounts.serializers import resend_email_verification
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.accounts.models import User
from apps.accounts.services.email_verification import generate_verification_token

User = get_user_model()


class AuthenticationViewsTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.register_url = reverse("accounts:register")
        self.verify_url = reverse("accounts:verify-email")

        self.valid_registration_payload = {
            "first_name": "Test",
            "last_name": "User",
            "email": "api_user@example.com",
            "password": "SecurePassword123!",
            "password_confirm": "SecurePassword123!",
        }

    def test_registration_view_success(self):
        response = self.client.post(self.register_url, self.valid_registration_payload)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["email"], "api_user@example.com")

        # Verify DB state
        user = User.objects.get(email="api_user@example.com")
        self.assertFalse(user.is_active)
        self.assertTrue(hasattr(user, "profile"))

    def test_registration_view_validation_error(self):
        payload = self.valid_registration_payload.copy()
        payload["password_confirm"] = "Mismatched123!"

        response = self.client.post(self.register_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])

    def test_verify_email_view_success(self):
        user = User.objects.create_user(
            email="to_verify@example.com",
            password="Password123!",
            is_active=False,
            email_verified_at=None,
        )
        token = generate_verification_token(user)

        response = self.client.post(self.verify_url, {"user_id": str(user.id), "token": token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNotNone(user.email_verified_at)

    def test_verify_email_view_invalid_token(self):
        user = User.objects.create_user(
            email="to_fail@example.com",
            password="Password123!",
            is_active=False,
        )
        generate_verification_token(user)

        response = self.client.post(self.verify_url, {"user_id": str(user.id), "token": "wrong_token"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])

    def test_registration_view_delegates_to_serializer_save(self):
        from unittest.mock import patch
        from apps.accounts.serializers.registration import RegistrationSerializer

        with patch.object(RegistrationSerializer, "save") as mock_save:
            mock_save.return_value = User(id="00000000-0000-0000-0000-000000000001", email="mocked@example.com")
            payload = self.valid_registration_payload.copy()
            payload["email"] = "mocked@example.com"
            response = self.client.post(self.register_url, payload)

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            mock_save.assert_called_once()

    def test_registration_view_throttling(self):
        from django.core.cache import cache

        cache.clear()

        # Registration throttle rate is 5/minute
        for i in range(5):
            payload = self.valid_registration_payload.copy()
            payload["email"] = f"user_{i}@example.com"
            response = self.client.post(self.register_url, payload)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # 6th request from same IP within the minute window should be throttled
        payload = self.valid_registration_payload.copy()
        payload["email"] = "user_throttled@example.com"
        response = self.client.post(self.register_url, payload)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        cache.clear()

    def test_verify_email_view_throttling(self):
        from django.core.cache import cache

        cache.clear()

        user = User.objects.create_user(
            email="throttle_verify@example.com",
            password="Password123!",
            is_active=False,
        )
        token = generate_verification_token(user)

        # Email verification throttle rate is 10/minute
        for _ in range(10):
            response = self.client.post(self.verify_url, {"user_id": str(user.id), "token": "invalid_probe"})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # 11th request should be throttled
        response = self.client.post(self.verify_url, {"user_id": str(user.id), "token": token})
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        cache.clear()

    def test_login_success(self):
        user = User.objects.create_user(
            email="user@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )

        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "user@example.com",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])
        self.assertEqual(response.data["data"]["user"]["id"], str(user.id))


    def test_login_invalid_password(self):
        User.objects.create_user(
            email="user@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )

        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "user@example.com",
                "password": "WrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)


    def test_login_unverified_account(self):
        User.objects.create_user(
            email="user@example.com",
            password="StrongPassword123!",
            is_active=False,
        )

        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "user@example.com",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)



    def test_login_returns_valid_jwt_tokens(self):
        User.objects.create_user(
            email="user@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )

        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "user@example.com",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        access = response.data["data"]["access"]
        refresh = response.data["data"]["refresh"]

        self.assertTrue(AccessToken(access))
        self.assertTrue(RefreshToken(refresh))


class RefreshTokenViewTests(APITestCase):
    def setUp(self):
        from datetime import timedelta
        from django.core.cache import cache

        cache.clear()
        self.refresh_url = reverse("accounts:token-refresh")
        self.user = User.objects.create_user(
            email="token_user@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )
        self.initial_refresh = RefreshToken.for_user(self.user)
        self.initial_refresh_token = str(self.initial_refresh)
        self.initial_access_token = str(self.initial_refresh.access_token)

    def test_successful_refresh(self):
        response = self.client.post(
            self.refresh_url,
            {"refresh": self.initial_refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["message"], "Token refreshed successfully.")
        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])

    def test_new_access_token_generation(self):
        response = self.client.post(
            self.refresh_url,
            {"refresh": self.initial_refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new_access = response.data["data"]["access"]
        self.assertTrue(AccessToken(new_access))
        self.assertNotEqual(new_access, self.initial_access_token)

    def test_refresh_token_rotation(self):
        response = self.client.post(
            self.refresh_url,
            {"refresh": self.initial_refresh_token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new_refresh = response.data["data"]["refresh"]
        self.assertTrue(RefreshToken(new_refresh))
        self.assertNotEqual(new_refresh, self.initial_refresh_token)

    def test_old_refresh_token_rejected_after_rotation(self):
        # Initial refresh succeeds
        response1 = self.client.post(
            self.refresh_url,
            {"refresh": self.initial_refresh_token},
            format="json",
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Attempt to reuse the old refresh token must be rejected
        response2 = self.client.post(
            self.refresh_url,
            {"refresh": self.initial_refresh_token},
            format="json",
        )
        self.assertEqual(response2.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response2.data["success"])

    def test_invalid_refresh_token(self):
        response = self.client.post(
            self.refresh_url,
            {"refresh": "invalid.jwt.token_string"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    def test_expired_refresh_token(self):
        from datetime import timedelta

        expired_token = RefreshToken.for_user(self.user)
        expired_token.set_exp(lifetime=-timedelta(days=1))

        response = self.client.post(
            self.refresh_url,
            {"refresh": str(expired_token)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    def test_inactive_user_rejected(self):
        inactive_user = User.objects.create_user(
            email="inactive_token_user@example.com",
            password="StrongPassword123!",
            is_active=False,
            email_verified_at=timezone.now(),
        )
        token = RefreshToken.for_user(inactive_user)

        response = self.client.post(
            self.refresh_url,
            {"refresh": str(token)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    def test_unverified_user_rejected(self):
        unverified_user = User.objects.create_user(
            email="unverified_token_user@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=None,
        )
        token = RefreshToken.for_user(unverified_user)

        response = self.client.post(
            self.refresh_url,
            {"refresh": str(token)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    def test_missing_refresh_token(self):
        response = self.client.post(
            self.refresh_url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("refresh", response.data["errors"])

    def test_malformed_request_payload(self):
        # Payload with unexpected fields
        response = self.client.post(
            self.refresh_url,
            {
                "refresh": self.initial_refresh_token,
                "unexpected_field": "disallowed",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("non_field_errors", response.data["errors"])


class LogoutViewTests(APITestCase):
    def setUp(self):
        self.logout_url = reverse("accounts:logout")
        self.refresh_url = reverse("accounts:token-refresh")
        self.user = User.objects.create_user(
            email="logout_test_user@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )
        self.refresh_token = RefreshToken.for_user(self.user)
        self.refresh_token_str = str(self.refresh_token)
        self.access_token_str = str(self.refresh_token.access_token)

        # Authenticate client with user's access token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token_str}")

    def test_successful_logout(self):
        response = self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token_str},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["message"], "Logged out successfully.")
        self.assertIsNone(response.data["data"])

    def test_refresh_token_becomes_blacklisted(self):
        from rest_framework_simplejwt.exceptions import TokenError

        response = self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token_str},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Direct SimpleJWT check confirming token is blacklisted
        with self.assertRaises(TokenError):
            RefreshToken(self.refresh_token_str)

    def test_blacklisted_refresh_token_cannot_be_reused_to_refresh(self):
        # Logout to blacklist token
        self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token_str},
            format="json",
        )

        # Attempt to use blacklisted token to refresh
        response = self.client.post(
            self.refresh_url,
            {"refresh": self.refresh_token_str},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    def test_invalid_refresh_token(self):
        response = self.client.post(
            self.logout_url,
            {"refresh": "invalid.jwt.token"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    def test_expired_refresh_token(self):
        from datetime import timedelta

        expired_token = RefreshToken.for_user(self.user)
        expired_token.set_exp(lifetime=-timedelta(days=1))

        response = self.client.post(
            self.logout_url,
            {"refresh": str(expired_token)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    def test_already_blacklisted_refresh_token(self):
        # First logout succeeds
        self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token_str},
            format="json",
        )

        # Second logout with same token is rejected
        response = self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token_str},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    def test_missing_refresh_token(self):
        response = self.client.post(
            self.logout_url,
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("refresh", response.data["errors"])

    def test_unauthenticated_logout_request(self):
        # Clear authorization header
        self.client.credentials()

        response = self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token_str},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_a_cannot_invalidate_user_b_refresh_token(self):
        user_b = User.objects.create_user(
            email="user_b@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )
        user_b_refresh = RefreshToken.for_user(user_b)
        user_b_refresh_str = str(user_b_refresh)

        # Client is authenticated as User A (self.user), tries to blacklist User B's token
        response = self.client.post(
            self.logout_url,
            {"refresh": user_b_refresh_str},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

        # User B's refresh token must remain completely valid and functional
        token_check = RefreshToken(user_b_refresh_str)
        self.assertIsNotNone(token_check)

        refresh_response = self.client.post(
            self.refresh_url,
            {"refresh": user_b_refresh_str},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)

    def test_authenticated_user_access_token_remains_valid_until_expiration(self):
        from rest_framework_simplejwt.authentication import JWTAuthentication

        # Logout with refresh token
        response = self.client.post(
            self.logout_url,
            {"refresh": self.refresh_token_str},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Existing access token remains valid for authentication until its natural expiration
        validated_token = JWTAuthentication().get_validated_token(self.access_token_str)
        user = JWTAuthentication().get_user(validated_token)
        self.assertEqual(user.id, self.user.id)


class PasswordResetRequestViewTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.url = reverse("accounts:password-reset-request")
        self.user = User.objects.create_user(
            email="reset_view_user@example.com",
            password="StrongPassword123!",
            first_name="Alice",
            last_name="Smith",
            is_active=True,
            email_verified_at=timezone.now(),
        )

    def test_valid_request_for_existing_account(self):
        response = self.client.post(
            self.url,
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "If an account exists with this email, a password reset link will be sent.",
        )
        self.assertIsNone(response.data["data"])

    def test_password_reset_email_sent(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url,
                {"email": self.user.email},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        email = mail.outbox[0]
        self.assertIn("Reset your PropTech Platform password", email.subject)
        self.assertIn(self.user.email, email.to)
        self.assertIn("/reset-password?uid=", email.body)

    def test_nonexistent_email_returns_same_generic_response(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url,
                {"email": "unknown_address@example.com"},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "If an account exists with this email, a password reset link will be sent.",
        )
        self.assertIsNone(response.data["data"])
        self.assertEqual(len(mail.outbox), 0)

    def test_inactive_account_returns_same_generic_response(self):
        self.user.is_active = False
        self.user.save()

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url,
                {"email": self.user.email},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "If an account exists with this email, a password reset link will be sent.",
        )
        self.assertIsNone(response.data["data"])
        self.assertEqual(len(mail.outbox), 0)

    def test_email_normalization(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url,
                {"email": f"  {self.user.email.upper()}  "},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.user.email, mail.outbox[0].to)

    def test_new_request_invalidates_previous_token(self):
        from apps.accounts.models import PasswordResetToken

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                self.url,
                {"email": self.user.email},
                format="json",
            )
        first_hash = PasswordResetToken.objects.get(user=self.user).token_hash

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                self.url,
                {"email": self.user.email},
                format="json",
            )
        second_hash = PasswordResetToken.objects.get(user=self.user).token_hash

        self.assertNotEqual(first_hash, second_hash)
        self.assertEqual(PasswordResetToken.objects.filter(user=self.user).count(), 1)

    def test_raw_token_not_stored_in_database(self):
        import hashlib
        import re
        from apps.accounts.models import PasswordResetToken

        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                self.url,
                {"email": self.user.email},
                format="json",
            )

        token_record = PasswordResetToken.objects.get(user=self.user)
        email_body = mail.outbox[0].body

        # Extract token query param from reset-password URL in email body
        match = re.search(r"token=([A-Za-z0-9_-]+)", email_body)
        self.assertIsNotNone(match)
        raw_token = match.group(1)

        # Raw token must not equal token_hash stored in database
        self.assertNotEqual(raw_token, token_record.token_hash)
        # SHA-256 of raw token must match token_hash
        expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        self.assertEqual(token_record.token_hash, expected_hash)

    def test_token_expires_after_30_minutes(self):
        from datetime import timedelta
        from apps.accounts.models import PasswordResetToken

        now = timezone.now()
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                self.url,
                {"email": self.user.email},
                format="json",
            )

        token_record = PasswordResetToken.objects.get(user=self.user)
        self.assertTrue(token_record.expires_at > now + timedelta(minutes=29))
        self.assertTrue(token_record.expires_at <= now + timedelta(minutes=31))

    def test_rate_limiting_works(self):
        from django.core.cache import cache

        cache.clear()

        # Rate limit is 3/hour
        for _ in range(3):
            response = self.client.post(
                self.url,
                {"email": self.user.email},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 4th request must be throttled
        response = self.client.post(
            self.url,
            {"email": self.user.email},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        cache.clear()

    def test_email_delivery_failure_does_not_reveal_existence_or_expose_tokens(self):
        from unittest.mock import patch

        with patch("apps.core.email.EmailService.send_email", side_effect=Exception("SMTP Outage")):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    self.url,
                    {"email": self.user.email},
                    format="json",
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "If an account exists with this email, a password reset link will be sent.",
        )
        self.assertIsNone(response.data["data"])


class PasswordResetConfirmViewTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        from apps.accounts.services.password_reset import generate_password_reset_token

        cache.clear()
        self.confirm_url = reverse("accounts:password-reset-confirm")
        self.login_url = reverse("accounts:login")
        self.refresh_url = reverse("accounts:token-refresh")

        self.user = User.objects.create_user(
            email="confirm_test_user@example.com",
            password="OriginalPassword123!",
            first_name="Jane",
            last_name="Doe",
            is_active=True,
            email_verified_at=timezone.now(),
        )
        self.raw_token = generate_password_reset_token(self.user)
        self.valid_payload = {
            "uid": str(self.user.id),
            "token": self.raw_token,
            "new_password": "NewSecurePassword123!",
            "confirm_password": "NewSecurePassword123!",
        }

    def test_successful_password_reset(self):
        response = self.client.post(
            self.confirm_url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "Password has been reset successfully.",
        )
        self.assertIsNone(response.data["data"])

    def test_password_is_actually_updated_and_old_password_rejected(self):
        # 1. Reset password
        response = self.client.post(
            self.confirm_url,
            self.valid_payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 2. Database verification
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecurePassword123!"))
        self.assertFalse(self.user.check_password("OriginalPassword123!"))

        # 3. Old password login fails
        old_login = self.client.post(
            self.login_url,
            {
                "email": self.user.email,
                "password": "OriginalPassword123!",
            },
            format="json",
        )
        self.assertEqual(old_login.status_code, status.HTTP_401_UNAUTHORIZED)

        # 4. New password login succeeds
        new_login = self.client.post(
            self.login_url,
            {
                "email": self.user.email,
                "password": "NewSecurePassword123!",
            },
            format="json",
        )
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
        self.assertTrue(new_login.data["success"])

    def test_password_confirmation_mismatch(self):
        payload = self.valid_payload.copy()
        payload["confirm_password"] = "MismatchedPassword123!"

        response = self.client.post(
            self.confirm_url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("confirm_password", response.data["errors"])

    def test_weak_password_rejected(self):
        payload = self.valid_payload.copy()
        payload["new_password"] = "weak"
        payload["confirm_password"] = "weak"

        response = self.client.post(
            self.confirm_url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("new_password", response.data["errors"])

    def test_invalid_uuid(self):
        payload = self.valid_payload.copy()
        payload["uid"] = "not-a-valid-uuid"

        response = self.client.post(
            self.confirm_url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("uid", response.data["errors"])

    def test_invalid_token(self):
        payload = self.valid_payload.copy()
        payload["token"] = "completely_wrong_raw_token"

        response = self.client.post(
            self.confirm_url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "Invalid or expired password reset token.",
        )

    def test_expired_token(self):
        from datetime import timedelta
        from apps.accounts.models import PasswordResetToken

        token_record = PasswordResetToken.objects.get(user=self.user)
        token_record.expires_at = timezone.now() - timedelta(minutes=1)
        token_record.save()

        response = self.client.post(
            self.confirm_url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertEqual(
            response.data["message"],
            "Invalid or expired password reset token.",
        )
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_previously_used_token_rejected(self):
        # First confirmation succeeds
        response1 = self.client.post(
            self.confirm_url,
            self.valid_payload,
            format="json",
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Repeated confirmation with the same token must fail
        response2 = self.client.post(
            self.confirm_url,
            {
                "uid": str(self.user.id),
                "token": self.raw_token,
                "new_password": "YetAnotherPassword123!",
                "confirm_password": "YetAnotherPassword123!",
            },
            format="json",
        )
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response2.data["success"])

    def test_replaced_token_rejected(self):
        from apps.accounts.services.password_reset import generate_password_reset_token

        first_raw_token = self.raw_token
        second_raw_token = generate_password_reset_token(self.user)

        # Attempt with first (now superseded) token fails
        payload1 = self.valid_payload.copy()
        payload1["token"] = first_raw_token
        response1 = self.client.post(
            self.confirm_url,
            payload1,
            format="json",
        )
        self.assertEqual(response1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response1.data["success"])

        # Attempt with second (current) token succeeds
        payload2 = self.valid_payload.copy()
        payload2["token"] = second_raw_token
        response2 = self.client.post(
            self.confirm_url,
            payload2,
            format="json",
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertTrue(response2.data["success"])

    def test_reset_token_deleted_after_success(self):
        from apps.accounts.models import PasswordResetToken

        self.assertTrue(PasswordResetToken.objects.filter(user=self.user).exists())

        response = self.client.post(
            self.confirm_url,
            self.valid_payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify token record was removed
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_outstanding_refresh_tokens_blacklisted_and_old_refresh_tokens_rejected(self):
        from rest_framework_simplejwt.tokens import RefreshToken

        # Issue refresh token to user before reset
        refresh_token = RefreshToken.for_user(self.user)
        refresh_token_str = str(refresh_token)

        # Confirm password reset
        response = self.client.post(
            self.confirm_url,
            self.valid_payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Old refresh token cannot be used to refresh tokens
        refresh_response = self.client.post(
            self.refresh_url,
            {"refresh": refresh_token_str},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_concurrent_repeated_confirmation_cannot_reuse_token(self):
        # Simulating concurrent/repeated requests:
        # First request succeeds
        res1 = self.client.post(self.confirm_url, self.valid_payload, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Second concurrent/repeated request with identical payload fails
        res2 = self.client.post(self.confirm_url, self.valid_payload, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res2.data["success"])

    def test_missing_request_fields(self):
        for field in ["uid", "token", "new_password", "confirm_password"]:
            payload = self.valid_payload.copy()
            del payload[field]

            response = self.client.post(
                self.confirm_url,
                payload,
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertFalse(response.data["success"])
            self.assertIn(field, response.data["errors"])

    def test_unexpected_request_fields(self):
        payload = self.valid_payload.copy()
        payload["malicious_extra"] = "disallowed_field"

        response = self.client.post(
            self.confirm_url,
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("non_field_errors", response.data["errors"])


class ChangePasswordViewTests(APITestCase):
    def setUp(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.models import UserProfile

        self.url = reverse("accounts:change-password")
        self.login_url = reverse("accounts:login")
        self.refresh_url = reverse("accounts:token-refresh")
        self.reset_confirm_url = reverse("accounts:password-reset-confirm")

        self.user = User.objects.create_user(
            email="changepw_view_user@example.com",
            password="OriginalPassword123!",
            first_name="Bob",
            last_name="Builder",
            is_active=True,
            is_tenant=True,
            is_owner=False,
            is_platform_admin=False,
            email_verified_at=timezone.now(),
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            phone_number="+9876543210",
        )

        self.refresh_token = RefreshToken.for_user(self.user)
        self.access_token_str = str(self.refresh_token.access_token)
        self.refresh_token_str = str(self.refresh_token)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token_str}")

        self.valid_payload = {
            "current_password": "OriginalPassword123!",
            "new_password": "NewSecurePassword456!",
            "confirm_password": "NewSecurePassword456!",
        }

    def test_successful_password_change(self):
        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["message"], "Password changed successfully.")
        self.assertIsNone(response.data["data"])

    def test_no_new_jwt_tokens_returned(self):
        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data.get("data"))
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)

    def test_unauthenticated_request_rejected(self):
        self.client.credentials()  # Clear auth headers

        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_incorrect_current_password(self):
        payload = self.valid_payload.copy()
        payload["current_password"] = "IncorrectPassword123!"

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("current_password", response.data["errors"])

    def test_new_password_and_confirmation_mismatch(self):
        payload = self.valid_payload.copy()
        payload["confirm_password"] = "MismatchedPassword999!"

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("confirm_password", response.data["errors"])

    def test_weak_password_rejected(self):
        payload = self.valid_payload.copy()
        payload["new_password"] = "weak"
        payload["confirm_password"] = "weak"

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("new_password", response.data["errors"])

    def test_missing_fields(self):
        for field in ["current_password", "new_password", "confirm_password"]:
            payload = self.valid_payload.copy()
            del payload[field]

            response = self.client.post(
                self.url,
                payload,
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertFalse(response.data["success"])
            self.assertIn(field, response.data["errors"])

    def test_unexpected_fields(self):
        payload = self.valid_payload.copy()
        payload["unexpected_extra"] = "disallowed"

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("non_field_errors", response.data["errors"])

    def test_old_password_no_longer_works_and_new_password_works(self):
        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Clear credentials to test unauthenticated login
        self.client.credentials()

        # Login with old password must fail
        old_login = self.client.post(
            self.login_url,
            {
                "email": self.user.email,
                "password": "OriginalPassword123!",
            },
            format="json",
        )
        self.assertEqual(old_login.status_code, status.HTTP_401_UNAUTHORIZED)

        # Login with new password must succeed
        new_login = self.client.post(
            self.login_url,
            {
                "email": self.user.email,
                "password": "NewSecurePassword456!",
            },
            format="json",
        )
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
        self.assertTrue(new_login.data["success"])

    def test_outstanding_refresh_tokens_blacklisted_and_cannot_be_used(self):
        # Existing refresh token before password change
        old_refresh_str = self.refresh_token_str

        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Attempt to refresh token using old refresh token must be rejected
        self.client.credentials()
        refresh_response = self.client.post(
            self.refresh_url,
            {"refresh": old_refresh_str},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_outstanding_password_reset_token_is_invalidated(self):
        from apps.accounts.services.password_reset import generate_password_reset_token

        # User had previously requested a password reset link
        reset_token = generate_password_reset_token(self.user)

        # User now changes password directly while logged in
        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Attempting to subsequently use that old password reset link must fail
        self.client.credentials()
        reset_confirm_response = self.client.post(
            self.reset_confirm_url,
            {
                "uid": str(self.user.id),
                "token": reset_token,
                "new_password": "AnotherNewPassword789!",
                "confirm_password": "AnotherNewPassword789!",
            },
            format="json",
        )
        self.assertEqual(reset_confirm_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(reset_confirm_response.data["success"])

    def test_existing_user_profile_and_capability_fields_remain_unchanged(self):
        response = self.client.post(
            self.url,
            self.valid_payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.profile.refresh_from_db()

        self.assertEqual(self.user.email, "changepw_view_user@example.com")
        self.assertEqual(self.user.first_name, "Bob")
        self.assertEqual(self.user.last_name, "Builder")
        self.assertTrue(self.user.is_tenant)
        self.assertFalse(self.user.is_owner)
        self.assertFalse(self.user.is_platform_admin)
        self.assertEqual(self.profile.phone_number, "+9876543210")


class ProfileViewTests(APITestCase):
    def setUp(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.models import UserProfile

        self.url = reverse("accounts:profile")

        self.user = User.objects.create_user(
            email="profile_view_user@example.com",
            password="StrongPassword123!",
            first_name="Jane",
            last_name="Doe",
            is_active=True,
            is_tenant=True,
            is_owner=False,
            is_platform_admin=False,
            email_verified_at=timezone.now(),
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            phone_number="+15551234567",
            bio="Real estate enthusiast.",
            profile_image="https://example.com/jane.jpg",
        )

        refresh = RefreshToken.for_user(self.user)
        self.access_token_str = str(refresh.access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access_token_str}")

    # --- GET Tests ---

    def test_get_profile_authenticated_success_and_response_structure(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["message"], "Profile retrieved successfully.")

        data = response.data["data"]
        self.assertEqual(data["id"], str(self.user.id))
        self.assertEqual(data["email"], self.user.email)
        self.assertEqual(data["first_name"], "Jane")
        self.assertEqual(data["last_name"], "Doe")
        self.assertEqual(data["phone_number"], "+15551234567")
        self.assertEqual(data["bio"], "Real estate enthusiast.")
        self.assertEqual(data["profile_image"], "https://example.com/jane.jpg")
        self.assertTrue(data["is_tenant"])
        self.assertFalse(data["is_owner"])
        self.assertFalse(data["is_platform_admin"])
        self.assertIsNotNone(data["email_verified_at"])
        self.assertTrue(data["has_usable_password"])
        self.assertEqual(data["auth_providers"], ["password"])

    def test_get_profile_google_only_user_reports_auth_method(self):
        from apps.accounts.models import SocialAccount

        google_user = User.objects.create_user(
            email="google_only_view@example.com",
            password=None,
            is_active=True,
            is_tenant=True,
        )
        google_user.set_unusable_password()
        google_user.save(update_fields=["password"])
        SocialAccount.objects.create(
            user=google_user,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id="google-view-sub-1",
        )
        self.client.force_authenticate(user=google_user)

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertFalse(data["has_usable_password"])
        self.assertEqual(data["auth_providers"], ["google"])

    def test_get_profile_does_not_expose_another_users_profile(self):
        from apps.accounts.models import UserProfile

        other_user = User.objects.create_user(
            email="other_secret_user@example.com",
            password="OtherPassword123!",
            first_name="SecretFirst",
            last_name="SecretLast",
        )
        UserProfile.objects.create(
            user=other_user,
            phone_number="+19999999999",
            bio="Confidential profile.",
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertEqual(data["email"], self.user.email)
        self.assertNotEqual(data["email"], other_user.email)
        self.assertNotEqual(data["phone_number"], "+19999999999")
        self.assertNotEqual(data["bio"], "Confidential profile.")

    def test_get_profile_unauthenticated_returns_401(self):
        self.client.credentials()  # Clear auth headers

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- PATCH Tests ---

    def test_patch_updates_first_name_and_last_name(self):
        payload = {
            "first_name": "JaneUpdated",
            "last_name": "DoeUpdated",
        }
        response = self.client.patch(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["message"], "Profile updated successfully.")
        self.assertEqual(response.data["data"]["first_name"], "JaneUpdated")
        self.assertEqual(response.data["data"]["last_name"], "DoeUpdated")

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "JaneUpdated")
        self.assertEqual(self.user.last_name, "DoeUpdated")

    def test_patch_updates_phone_number_bio_and_profile_image(self):
        payload = {
            "phone_number": "+18887776666",
            "bio": "New bio statement.",
            "profile_image": "https://example.com/updated_avatar.png",
        }
        response = self.client.patch(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        data = response.data["data"]
        self.assertEqual(data["phone_number"], "+18887776666")
        self.assertEqual(data["bio"], "New bio statement.")
        self.assertEqual(data["profile_image"], "https://example.com/updated_avatar.png")

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone_number, "+18887776666")
        self.assertEqual(self.profile.bio, "New bio statement.")
        self.assertEqual(self.profile.profile_image, "https://example.com/updated_avatar.png")

    def test_patch_updates_fields_from_both_models_in_single_request(self):
        payload = {
            "first_name": "DualFirst",
            "phone_number": "+10002223333",
        }
        response = self.client.patch(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["first_name"], "DualFirst")
        self.assertEqual(response.data["data"]["phone_number"], "+10002223333")

        self.user.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(self.user.first_name, "DualFirst")
        self.assertEqual(self.profile.phone_number, "+10002223333")

    def test_patch_partial_update_preserves_unincluded_fields(self):
        payload = {"first_name": "JustFirstName"}
        response = self.client.patch(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.profile.refresh_from_db()

        self.assertEqual(self.user.first_name, "JustFirstName")
        self.assertEqual(self.user.last_name, "Doe")
        self.assertEqual(self.profile.phone_number, "+15551234567")
        self.assertEqual(self.profile.bio, "Real estate enthusiast.")
        self.assertEqual(self.profile.profile_image, "https://example.com/jane.jpg")

    def test_patch_updated_values_persist_in_database(self):
        payload = {
            "first_name": "PersistedName",
            "bio": "Persisted bio description.",
        }
        response = self.client.patch(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.profile.refresh_from_db()

        self.assertEqual(self.user.first_name, "PersistedName")
        self.assertEqual(self.profile.bio, "Persisted bio description.")

    def test_patch_empty_payload_returns_400(self):
        response = self.client.patch(self.url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])

    def test_patch_unexpected_fields_returns_400(self):
        payload = {
            "first_name": "Jane",
            "unknown_attribute": "disallowed",
        }
        response = self.client.patch(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertIn("non_field_errors", response.data["errors"])

    def test_patch_attempts_to_modify_email_or_capability_fields_return_400(self):
        # Read-only fields cannot be submitted as updates; when submitted alone they yield an empty update payload
        for field, value in [
            ("email", "new_email@example.com"),
            ("is_owner", True),
            ("is_tenant", False),
            ("is_platform_admin", True),
            ("email_verified_at", "2026-01-01T00:00:00Z"),
            ("has_usable_password", False),
            ("auth_providers", ["google"]),
        ]:
            response = self.client.patch(self.url, {field: value}, format="json")
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Field {field} modification should return 400 Bad Request.",
            )
            self.assertFalse(response.data["success"])

        # Verify none of these fields were mutated in DB
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "profile_view_user@example.com")
        self.assertTrue(self.user.is_tenant)
        self.assertFalse(self.user.is_owner)
        self.assertFalse(self.user.is_platform_admin)

    def test_patch_unauthenticated_returns_401(self):
        self.client.credentials()  # Clear auth headers

        response = self.client.patch(self.url, {"first_name": "Hacker"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_updating_one_user_profile_does_not_affect_another_user(self):
        from apps.accounts.models import UserProfile

        other_user = User.objects.create_user(
            email="isolated_user@example.com",
            password="OtherPassword123!",
            first_name="IsolatedFirst",
            last_name="IsolatedLast",
        )
        other_profile = UserProfile.objects.create(
            user=other_user,
            phone_number="+17770001111",
            bio="Isolated bio.",
        )

        response = self.client.patch(
            self.url,
            {
                "first_name": "JaneModified",
                "phone_number": "+15559990000",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        other_user.refresh_from_db()
        other_profile.refresh_from_db()

        self.assertEqual(other_user.first_name, "IsolatedFirst")
        self.assertEqual(other_user.last_name, "IsolatedLast")
        self.assertEqual(other_profile.phone_number, "+17770001111")
        self.assertEqual(other_profile.bio, "Isolated bio.")


class ResendEmailVerificationViewTests(APITestCase):
    def setUp(self):
        self.url = reverse("accounts:resend-email-verification")

    def test_resend_verification_returns_generic_200_for_eligible_and_unknown_email(self):
        from django.core.cache import cache

        cache.clear()
        User.objects.create_user(
            email="unverified_api@example.com",
            password="Password123!",
            is_active=False,
            email_verified_at=None,
        )

        res_eligible = self.client.post(
            self.url,
            {"email": "unverified_api@example.com"},
            format="json",
        )
        res_unknown = self.client.post(
            self.url,
            {"email": "missing@example.com"},
            format="json",
        )

        self.assertEqual(res_eligible.status_code, status.HTTP_200_OK)
        self.assertEqual(res_unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(res_eligible.data["message"], res_unknown.data["message"])
        cache.clear()

    def test_resend_verification_invalid_email_and_rate_limiting(self):
        from django.core.cache import cache

        cache.clear()
        invalid_res = self.client.post(
            self.url,
            {"email": "not-an-email"},
            format="json",
        )
        self.assertEqual(invalid_res.status_code, status.HTTP_400_BAD_REQUEST)
        cache.clear()

        # Rate limit is 3/hour
        for _ in range(3):
            res = self.client.post(
                self.url,
                {"email": "ratelimit@example.com"},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        throttled = self.client.post(
            self.url,
            {"email": "ratelimit@example.com"},
            format="json",
        )
        self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        cache.clear()


class AuthEndpointThrottlingTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.login_url = reverse("accounts:login")
        self.google_auth_url = reverse("accounts:google-auth")
        self.refresh_url = reverse("accounts:token-refresh")
        self.reset_confirm_url = reverse("accounts:password-reset-confirm")
        self.register_url = reverse("accounts:register")

        self.user = User.objects.create_user(
            email="throttle_auth@example.com",
            password="StrongPassword123!",
            first_name="Throttle",
            last_name="Tester",
            is_active=True,
            email_verified_at=timezone.now(),
        )

    def tearDown(self):
        from django.core.cache import cache

        cache.clear()

    def test_login_view_rate_limiting_and_non_enumeration(self):
        # Configured rate is 10/minute; requests below limit succeed/fail normally.
        for i in range(10):
            email = self.user.email if i == 0 else f"unknown_{i}@example.com"
            password = "StrongPassword123!" if i == 0 else "WrongPassword123!"
            expected = status.HTTP_200_OK if i == 0 else status.HTTP_401_UNAUTHORIZED
            res = self.client.post(
                self.login_url,
                {"email": email, "password": password},
                format="json",
            )
            self.assertEqual(res.status_code, expected)

        # 11th request returns 429 regardless of whether account exists.
        throttled_existing = self.client.post(
            self.login_url,
            {"email": self.user.email, "password": "StrongPassword123!"},
            format="json",
        )
        throttled_unknown = self.client.post(
            self.login_url,
            {"email": "missing_user@example.com", "password": "AnyPassword123!"},
            format="json",
        )

        self.assertEqual(throttled_existing.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(throttled_unknown.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(throttled_existing.data["success"])
        self.assertIsNone(throttled_existing.data["errors"])
        self.assertNotIn(self.user.email, throttled_existing.data["message"])

    def test_refresh_token_view_rate_limiting(self):
        current_refresh = str(RefreshToken.for_user(self.user))

        # Configured rate is 30/minute: rotating refreshes within limit succeed.
        for _ in range(30):
            res = self.client.post(
                self.refresh_url,
                {"refresh": current_refresh},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            current_refresh = res.data["data"]["refresh"]

        # 31st request within minute window is throttled.
        throttled = self.client.post(
            self.refresh_url,
            {"refresh": current_refresh},
            format="json",
        )
        self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(throttled.data["success"])
        self.assertIsNone(throttled.data["errors"])

    def test_password_reset_confirm_view_rate_limiting_and_non_enumeration(self):
        from apps.accounts.services.password_reset import generate_password_reset_token

        raw_token = generate_password_reset_token(self.user)

        # Configured rate is 5/minute: 4 invalid attempts + 1 valid confirmation succeed.
        for _ in range(4):
            bad_res = self.client.post(
                self.reset_confirm_url,
                {
                    "uid": str(self.user.id),
                    "token": "wrong-token",
                    "new_password": "NewStrongPassword123!",
                    "confirm_password": "NewStrongPassword123!",
                },
                format="json",
            )
            self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)

        ok_res = self.client.post(
            self.reset_confirm_url,
            {
                "uid": str(self.user.id),
                "token": raw_token,
                "new_password": "NewStrongPassword123!",
                "confirm_password": "NewStrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(ok_res.status_code, status.HTTP_200_OK)

        # 6th request returns 429 regardless of whether uid exists.
        throttled = self.client.post(
            self.reset_confirm_url,
            {
                "uid": "00000000-0000-0000-0000-000000000000",
                "token": "wrong-token",
                "new_password": "NewStrongPassword123!",
                "confirm_password": "NewStrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(throttled.data["success"])
        self.assertIsNone(throttled.data["errors"])

    def test_throttle_scopes_operate_independently(self):
        from unittest.mock import patch

        # Exhaust the "login" scope (10/minute).
        for _ in range(10):
            res = self.client.post(
                self.login_url,
                {"email": self.user.email, "password": "WrongPassword123!"},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        self.assertEqual(
            self.client.post(
                self.login_url,
                {"email": self.user.email, "password": "StrongPassword123!"},
                format="json",
            ).status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

        # Other scopes remain unaffected and functional.
        refresh_token_str = str(RefreshToken.for_user(self.user))
        self.assertEqual(
            self.client.post(
                self.refresh_url,
                {"refresh": refresh_token_str},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

        from apps.accounts.services.password_reset import generate_password_reset_token

        reset_token = generate_password_reset_token(self.user)
        self.assertEqual(
            self.client.post(
                self.reset_confirm_url,
                {
                    "uid": str(self.user.id),
                    "token": reset_token,
                    "new_password": "AnotherStrongPassword123!",
                    "confirm_password": "AnotherStrongPassword123!",
                },
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

        with self.settings(GOOGLE_CLIENT_ID="test-client-id.apps.googleusercontent.com"):
            with patch(
                "apps.accounts.services.google_auth.id_token.verify_oauth2_token",
                return_value={
                    "iss": "https://accounts.google.com",
                    "sub": "sub-scope-test",
                    "email": "scope_google@example.com",
                    "email_verified": True,
                    "given_name": "Scope",
                    "family_name": "Tester",
                    "aud": "test-client-id.apps.googleusercontent.com",
                },
            ):
                self.assertEqual(
                    self.client.post(
                        self.google_auth_url,
                        {"credential": "valid-google-token"},
                        format="json",
                    ).status_code,
                    status.HTTP_200_OK,
                )

        self.assertEqual(
            self.client.post(
                self.register_url,
                {
                    "first_name": "Scope",
                    "last_name": "User",
                    "email": "scope_reg@example.com",
                    "password": "StrongPassword123!",
                    "password_confirm": "StrongPassword123!",
                },
                format="json",
            ).status_code,
            status.HTTP_201_CREATED,
        )