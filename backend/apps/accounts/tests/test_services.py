from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import EmailVerificationToken, UserProfile
from apps.accounts.services.email_verification import (
    generate_verification_token,
    hash_token,
    send_verification_email,
    verify_email_token,
)
from apps.accounts.services.registration import register_user

User = get_user_model()


class EmailVerificationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="verify_test@example.com",
            password="securepassword123",
            first_name="Alice",
            last_name="Smith",
            is_active=False,
            email_verified_at=None,
        )

    def test_generate_verification_token_creates_record(self):
        raw_token = generate_verification_token(self.user)
        self.assertIsInstance(raw_token, str)
        self.assertTrue(len(raw_token) > 20)

        token_record = EmailVerificationToken.objects.get(user=self.user)
        self.assertEqual(token_record.token_hash, hash_token(raw_token))
        self.assertTrue(token_record.expires_at > timezone.now())

    def test_generate_verification_token_replaces_existing(self):
        first_token = generate_verification_token(self.user)
        second_token = generate_verification_token(self.user)

        self.assertNotEqual(first_token, second_token)
        self.assertEqual(EmailVerificationToken.objects.filter(user=self.user).count(), 1)
        record = EmailVerificationToken.objects.get(user=self.user)
        self.assertEqual(record.token_hash, hash_token(second_token))

    def test_verify_email_token_successful(self):
        raw_token = generate_verification_token(self.user)
        verified_user = verify_email_token(self.user.id, raw_token)

        self.assertIsNotNone(verified_user)
        self.assertTrue(verified_user.is_active)
        self.assertIsNotNone(verified_user.email_verified_at)
        # Token is single-use and should be deleted
        self.assertFalse(EmailVerificationToken.objects.filter(user=self.user).exists())

    def test_verify_email_token_invalid_hash(self):
        generate_verification_token(self.user)
        result = verify_email_token(self.user.id, "invalid_wrong_token")

        self.assertIsNone(result)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertIsNone(self.user.email_verified_at)

    def test_verify_email_token_expired(self):
        raw_token = generate_verification_token(self.user)
        # Expire the token
        token_record = EmailVerificationToken.objects.get(user=self.user)
        token_record.expires_at = timezone.now() - timedelta(hours=1)
        token_record.save()

        result = verify_email_token(self.user.id, raw_token)
        self.assertIsNone(result)
        self.assertFalse(EmailVerificationToken.objects.filter(user=self.user).exists())

    def test_verify_email_token_already_verified(self):
        self.user.email_verified_at = timezone.now()
        self.user.is_active = True
        self.user.save()

        raw_token = generate_verification_token(self.user)
        result = verify_email_token(self.user.id, raw_token)
        self.assertIsNone(result)

    def test_send_verification_email(self):
        raw_token = "dummy_token_12345"
        sent = send_verification_email(self.user, raw_token)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("Verify your PropTech Platform email", email.subject)
        self.assertIn(self.user.email, email.to)
        self.assertIn("dummy_token_12345", email.body)

    def test_send_verification_email_missing_frontend_url_in_production(self):
        from django.core.exceptions import ImproperlyConfigured
        from django.test import override_settings

        with override_settings(DEBUG=False, FRONTEND_URL=""):
            with self.assertRaises(ImproperlyConfigured):
                send_verification_email(self.user, "dummy_token")


class RegistrationServiceTests(TestCase):
    def test_register_user_creates_inactive_account_and_profile(self):
        with patch("apps.accounts.services.registration.send_verification_email") as mock_send:
            with self.captureOnCommitCallbacks(execute=True):
                user = register_user(
                    email="new_registrant@example.com",
                    password="strongPassword123!",
                    first_name="Bob",
                    last_name="Marley",
                )

            self.assertEqual(user.email, "new_registrant@example.com")
            self.assertFalse(user.is_active)
            self.assertIsNone(user.email_verified_at)
            self.assertTrue(user.is_tenant)
            self.assertFalse(user.is_owner)
            self.assertFalse(user.is_platform_admin)

            # Profile creation check
            self.assertTrue(UserProfile.objects.filter(user=user).exists())

            # Verification token record check
            self.assertTrue(EmailVerificationToken.objects.filter(user=user).exists())

            # Email trigger check (called on commit)
            mock_send.assert_called_once()

    def test_register_user_duplicate_email_raises_duplicate_error(self):
        from apps.accounts.services.registration import DuplicateEmailError

        register_user(
            email="existing_user@example.com",
            password="strongPassword123!",
        )

        with self.assertRaises(DuplicateEmailError):
            register_user(
                email="EXISTING_USER@example.com",
                password="anotherPassword123!",
            )


class RefreshTokenServiceTests(TestCase):
    def setUp(self):
        self.verified_user = User.objects.create_user(
            email="refresh_svc_test@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )

    def test_refresh_token_service_success(self):
        from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
        from apps.accounts.services.refresh_token import refresh_token

        initial_refresh = RefreshToken.for_user(self.verified_user)
        initial_refresh_str = str(initial_refresh)

        result = refresh_token(refresh=initial_refresh_str)

        self.assertIn("access", result)
        self.assertIn("refresh", result)
        self.assertNotEqual(result["refresh"], initial_refresh_str)

        # Validate that returned tokens are valid JWTs
        self.assertTrue(AccessToken(result["access"]))
        self.assertTrue(RefreshToken(result["refresh"]))

    def test_refresh_token_service_blacklists_old_token(self):
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.services.refresh_token import refresh_token

        initial_refresh = RefreshToken.for_user(self.verified_user)
        initial_refresh_str = str(initial_refresh)

        # First refresh succeeds
        refresh_token(refresh=initial_refresh_str)

        # Reusing the old rotated token must fail
        with self.assertRaises(AuthenticationFailed):
            refresh_token(refresh=initial_refresh_str)

    def test_refresh_token_service_inactive_user(self):
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.services.refresh_token import refresh_token

        self.verified_user.is_active = False
        self.verified_user.save()

        token = RefreshToken.for_user(self.verified_user)

        with self.assertRaises(AuthenticationFailed):
            refresh_token(refresh=str(token))

    def test_refresh_token_service_unverified_user(self):
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.services.refresh_token import refresh_token

        self.verified_user.email_verified_at = None
        self.verified_user.save()

        token = RefreshToken.for_user(self.verified_user)

        with self.assertRaises(AuthenticationFailed):
            refresh_token(refresh=str(token))

    def test_refresh_token_service_invalid_token(self):
        from rest_framework.exceptions import AuthenticationFailed
        from apps.accounts.services.refresh_token import refresh_token

        with self.assertRaises(AuthenticationFailed):
            refresh_token(refresh="totally_invalid_token_string")


class LogoutServiceTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email="logout_user1@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )
        self.user2 = User.objects.create_user(
            email="logout_user2@example.com",
            password="StrongPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )

    def test_logout_user_success_blacklists_token(self):
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.services.logout import logout_user

        refresh = RefreshToken.for_user(self.user1)
        refresh_str = str(refresh)

        logout_user(user=self.user1, refresh=refresh_str)

        # Token must now be blacklisted
        with self.assertRaises(TokenError):
            RefreshToken(refresh_str)

    def test_logout_user_cannot_blacklist_another_users_token(self):
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.services.logout import logout_user

        user2_refresh = RefreshToken.for_user(self.user2)
        user2_refresh_str = str(user2_refresh)

        # User 1 attempts to logout with User 2's refresh token
        with self.assertRaises(AuthenticationFailed):
            logout_user(user=self.user1, refresh=user2_refresh_str)

        # User 2's token must NOT have been blacklisted
        token_check = RefreshToken(user2_refresh_str)
        self.assertIsNotNone(token_check)

    def test_logout_user_invalid_token(self):
        from rest_framework.exceptions import AuthenticationFailed
        from apps.accounts.services.logout import logout_user

        with self.assertRaises(AuthenticationFailed):
            logout_user(user=self.user1, refresh="invalid_token_string")

    def test_logout_user_expired_token(self):
        from datetime import timedelta
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.services.logout import logout_user

        expired_token = RefreshToken.for_user(self.user1)
        expired_token.set_exp(lifetime=-timedelta(days=1))

        with self.assertRaises(AuthenticationFailed):
            logout_user(user=self.user1, refresh=str(expired_token))

    def test_logout_user_already_blacklisted_token(self):
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.services.logout import logout_user

        refresh = RefreshToken.for_user(self.user1)
        refresh_str = str(refresh)

        # First logout blacklists the token
        logout_user(user=self.user1, refresh=refresh_str)

        # Second logout must fail because token is already blacklisted
        with self.assertRaises(AuthenticationFailed):
            logout_user(user=self.user1, refresh=refresh_str)


class PasswordResetServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reset_user@example.com",
            password="StrongPassword123!",
            first_name="Jane",
            last_name="Doe",
            is_active=True,
            email_verified_at=timezone.now(),
        )

    def test_request_password_reset_success(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import request_password_reset

        with self.captureOnCommitCallbacks(execute=True):
            result = request_password_reset(email="reset_user@example.com")

        self.assertIsNone(result)
        self.assertTrue(PasswordResetToken.objects.filter(user=self.user).exists())
        self.assertEqual(len(mail.outbox), 1)

        email = mail.outbox[0]
        self.assertIn("Reset your PropTech Platform password", email.subject)
        self.assertIn(self.user.email, email.to)
        self.assertIn("/reset-password?uid=", email.body)

    def test_raw_token_not_stored_in_database(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import (
            generate_password_reset_token,
            hash_token,
        )

        raw_token = generate_password_reset_token(self.user)
        token_record = PasswordResetToken.objects.get(user=self.user)

        self.assertNotEqual(token_record.token_hash, raw_token)
        self.assertEqual(token_record.token_hash, hash_token(raw_token))

    def test_token_expires_in_30_minutes(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import generate_password_reset_token

        now = timezone.now()
        generate_password_reset_token(self.user)
        token_record = PasswordResetToken.objects.get(user=self.user)

        self.assertTrue(token_record.expires_at > now + timedelta(minutes=29))
        self.assertTrue(token_record.expires_at <= now + timedelta(minutes=31))

    def test_new_request_invalidates_previous_token(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import (
            generate_password_reset_token,
            hash_token,
        )

        first_raw = generate_password_reset_token(self.user)
        second_raw = generate_password_reset_token(self.user)

        self.assertNotEqual(first_raw, second_raw)
        self.assertEqual(PasswordResetToken.objects.filter(user=self.user).count(), 1)

        token_record = PasswordResetToken.objects.get(user=self.user)
        self.assertEqual(token_record.token_hash, hash_token(second_raw))
        self.assertNotEqual(token_record.token_hash, hash_token(first_raw))

    def test_nonexistent_email_does_not_create_token_or_send_email(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import request_password_reset

        with self.captureOnCommitCallbacks(execute=True):
            result = request_password_reset(email="nonexistent@example.com")

        self.assertIsNone(result)
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_inactive_account_does_not_create_token_or_send_email(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import request_password_reset

        self.user.is_active = False
        self.user.save()

        with self.captureOnCommitCallbacks(execute=True):
            result = request_password_reset(email=self.user.email)

        self.assertIsNone(result)
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_unverified_account_does_not_create_token_or_send_email(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import request_password_reset

        self.user.email_verified_at = None
        self.user.save()

        with self.captureOnCommitCallbacks(execute=True):
            result = request_password_reset(email=self.user.email)

        self.assertIsNone(result)
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_email_normalization_in_service(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import request_password_reset

        with self.captureOnCommitCallbacks(execute=True):
            result = request_password_reset(email="  RESET_USER@EXAMPLE.COM  ")

        self.assertIsNone(result)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(PasswordResetToken.objects.filter(user=self.user).exists())


class PasswordResetConfirmServiceTests(TestCase):
    def setUp(self):
        from apps.accounts.models import User
        from apps.accounts.services.password_reset import generate_password_reset_token

        self.user = User.objects.create_user(
            email="reset_target@example.com",
            password="OldPassword123!",
            first_name="Reset",
            last_name="Target",
            is_active=True,
            email_verified_at=timezone.now(),
        )
        self.raw_token = generate_password_reset_token(self.user)

    def test_successful_password_reset(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import confirm_password_reset

        result = confirm_password_reset(
            user_id=self.user.id,
            raw_token=self.raw_token,
            new_password="NewSecurePassword123!",
        )

        self.assertIsNotNone(result)
        self.assertEqual(result.id, self.user.id)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecurePassword123!"))
        self.assertFalse(self.user.check_password("OldPassword123!"))

        # Token record must be deleted
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_invalid_token_rejected(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import confirm_password_reset

        result = confirm_password_reset(
            user_id=self.user.id,
            raw_token="wrong_token_entirely",
            new_password="NewSecurePassword123!",
        )

        self.assertIsNone(result)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPassword123!"))
        self.assertTrue(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_expired_token_rejected_and_deleted(self):
        from datetime import timedelta
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import confirm_password_reset

        token_record = PasswordResetToken.objects.get(user=self.user)
        token_record.expires_at = timezone.now() - timedelta(minutes=5)
        token_record.save()

        result = confirm_password_reset(
            user_id=self.user.id,
            raw_token=self.raw_token,
            new_password="NewSecurePassword123!",
        )

        self.assertIsNone(result)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OldPassword123!"))
        # Expired token is cleaned up
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_previously_used_token_rejected(self):
        from apps.accounts.services.password_reset import confirm_password_reset

        # First use succeeds
        first_result = confirm_password_reset(
            user_id=self.user.id,
            raw_token=self.raw_token,
            new_password="NewSecurePassword123!",
        )
        self.assertIsNotNone(first_result)

        # Second use with the same token must fail
        second_result = confirm_password_reset(
            user_id=self.user.id,
            raw_token=self.raw_token,
            new_password="AnotherPassword123!",
        )
        self.assertIsNone(second_result)

    def test_replaced_token_rejected(self):
        from apps.accounts.services.password_reset import (
            confirm_password_reset,
            generate_password_reset_token,
        )

        first_token = self.raw_token
        second_token = generate_password_reset_token(self.user)

        # First token is now replaced/invalidated
        result_old = confirm_password_reset(
            user_id=self.user.id,
            raw_token=first_token,
            new_password="NewSecurePassword123!",
        )
        self.assertIsNone(result_old)

        # Second token succeeds
        result_new = confirm_password_reset(
            user_id=self.user.id,
            raw_token=second_token,
            new_password="NewSecurePassword123!",
        )
        self.assertIsNotNone(result_new)

    def test_invalid_user_id_rejected(self):
        import uuid
        from apps.accounts.services.password_reset import confirm_password_reset

        result = confirm_password_reset(
            user_id=uuid.uuid4(),
            raw_token=self.raw_token,
            new_password="NewSecurePassword123!",
        )
        self.assertIsNone(result)

    def test_inactive_user_rejected(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.password_reset import confirm_password_reset

        self.user.is_active = False
        self.user.save()

        result = confirm_password_reset(
            user_id=self.user.id,
            raw_token=self.raw_token,
            new_password="NewSecurePassword123!",
        )
        self.assertIsNone(result)
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_outstanding_refresh_tokens_blacklisted(self):
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.models import User
        from apps.accounts.services.password_reset import confirm_password_reset

        other_user = User.objects.create_user(
            email="other_active@example.com",
            password="OtherPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )

        user_token1 = RefreshToken.for_user(self.user)
        user_token2 = RefreshToken.for_user(self.user)
        other_user_token = RefreshToken.for_user(other_user)

        # Confirm password reset
        result = confirm_password_reset(
            user_id=self.user.id,
            raw_token=self.raw_token,
            new_password="NewSecurePassword123!",
        )
        self.assertIsNotNone(result)

        # Both of target user's refresh tokens must be blacklisted
        with self.assertRaises(TokenError) as ctx1:
            RefreshToken(str(user_token1)).check_blacklist()
        self.assertIn("blacklisted", str(ctx1.exception).lower())

        with self.assertRaises(TokenError) as ctx2:
            RefreshToken(str(user_token2)).check_blacklist()
        self.assertIn("blacklisted", str(ctx2.exception).lower())

        # Other user's refresh token must NOT be blacklisted
        try:
            RefreshToken(str(other_user_token)).check_blacklist()
        except TokenError:
            self.fail("Other user's token should not be blacklisted.")


class ChangePasswordServiceTests(TestCase):
    def setUp(self):
        from apps.accounts.models import User, UserProfile

        self.user = User.objects.create_user(
            email="changepw_target@example.com",
            password="OriginalSecretPassword123!",
            first_name="Alice",
            last_name="Tester",
            is_active=True,
            is_tenant=True,
            is_owner=True,
            is_platform_admin=False,
            email_verified_at=timezone.now(),
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            phone_number="+1234567890",
        )

    def test_successful_password_change(self):
        from apps.accounts.services.change_password import change_password

        result = change_password(
            user=self.user,
            current_password="OriginalSecretPassword123!",
            new_password="BrandNewSecretPassword123!",
        )

        self.assertEqual(result.id, self.user.id)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNewSecretPassword123!"))
        self.assertFalse(self.user.check_password("OriginalSecretPassword123!"))

    def test_incorrect_current_password_rejected(self):
        from apps.accounts.services.change_password import (
            InvalidCurrentPasswordError,
            change_password,
        )

        with self.assertRaises(InvalidCurrentPasswordError):
            change_password(
                user=self.user,
                current_password="WrongCurrentPassword123!",
                new_password="BrandNewSecretPassword123!",
            )

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OriginalSecretPassword123!"))
        self.assertFalse(self.user.check_password("BrandNewSecretPassword123!"))

    def test_all_outstanding_refresh_tokens_blacklisted(self):
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import RefreshToken
        from apps.accounts.models import User
        from apps.accounts.services.change_password import change_password

        other_user = User.objects.create_user(
            email="other_cpw_user@example.com",
            password="OtherPassword123!",
            is_active=True,
            email_verified_at=timezone.now(),
        )

        token1 = RefreshToken.for_user(self.user)
        token2 = RefreshToken.for_user(self.user)
        other_token = RefreshToken.for_user(other_user)

        change_password(
            user=self.user,
            current_password="OriginalSecretPassword123!",
            new_password="BrandNewSecretPassword123!",
        )

        with self.assertRaises(TokenError) as ctx1:
            RefreshToken(str(token1)).check_blacklist()
        self.assertIn("blacklisted", str(ctx1.exception).lower())

        with self.assertRaises(TokenError) as ctx2:
            RefreshToken(str(token2)).check_blacklist()
        self.assertIn("blacklisted", str(ctx2.exception).lower())

        # Other user's token is NOT blacklisted
        try:
            RefreshToken(str(other_token)).check_blacklist()
        except TokenError:
            self.fail("Other user's refresh token should remain valid.")

    def test_outstanding_password_reset_token_invalidated(self):
        from apps.accounts.models import PasswordResetToken
        from apps.accounts.services.change_password import change_password
        from apps.accounts.services.password_reset import generate_password_reset_token

        generate_password_reset_token(self.user)
        self.assertTrue(PasswordResetToken.objects.filter(user=self.user).exists())

        change_password(
            user=self.user,
            current_password="OriginalSecretPassword123!",
            new_password="BrandNewSecretPassword123!",
        )

        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_profile_and_capability_fields_remain_unchanged(self):
        from apps.accounts.services.change_password import change_password

        orig_email = self.user.email
        orig_first_name = self.user.first_name
        orig_last_name = self.user.last_name
        orig_is_tenant = self.user.is_tenant
        orig_is_owner = self.user.is_owner
        orig_is_platform_admin = self.user.is_platform_admin
        orig_email_verified_at = self.user.email_verified_at
        orig_phone = self.profile.phone_number

        change_password(
            user=self.user,
            current_password="OriginalSecretPassword123!",
            new_password="BrandNewSecretPassword123!",
        )

        self.user.refresh_from_db()
        self.profile.refresh_from_db()

        self.assertEqual(self.user.email, orig_email)
        self.assertEqual(self.user.first_name, orig_first_name)
        self.assertEqual(self.user.last_name, orig_last_name)
        self.assertEqual(self.user.is_tenant, orig_is_tenant)
        self.assertEqual(self.user.is_owner, orig_is_owner)
        self.assertEqual(self.user.is_platform_admin, orig_is_platform_admin)
        self.assertEqual(self.user.email_verified_at, orig_email_verified_at)
        self.assertEqual(self.profile.phone_number, orig_phone)


class ProfileServiceTests(TestCase):
    def setUp(self):
        from apps.accounts.models import User, UserProfile

        self.user = User.objects.create_user(
            email="profile_service_test@example.com",
            password="SecurePassword123!",
            first_name="OriginalFirst",
            last_name="OriginalLast",
            is_active=True,
            is_tenant=True,
            is_owner=False,
            is_platform_admin=False,
            email_verified_at=timezone.now(),
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            phone_number="+15550001111",
            bio="Original bio.",
            profile_image="https://example.com/original.jpg",
        )

    def test_updates_first_name(self):
        from apps.accounts.services.profile import update_user_profile

        updated_user = update_user_profile(
            user=self.user,
            validated_data={"first_name": "NewFirst"},
        )
        self.assertEqual(updated_user.first_name, "NewFirst")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "NewFirst")

    def test_updates_last_name(self):
        from apps.accounts.services.profile import update_user_profile

        updated_user = update_user_profile(
            user=self.user,
            validated_data={"last_name": "NewLast"},
        )
        self.assertEqual(updated_user.last_name, "NewLast")
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_name, "NewLast")

    def test_updates_phone_number(self):
        from apps.accounts.services.profile import update_user_profile

        update_user_profile(
            user=self.user,
            validated_data={"phone_number": "+19998887777"},
        )
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone_number, "+19998887777")

    def test_updates_bio(self):
        from apps.accounts.services.profile import update_user_profile

        update_user_profile(
            user=self.user,
            validated_data={"bio": "Updated bio text."},
        )
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.bio, "Updated bio text.")

    def test_updates_profile_image(self):
        from apps.accounts.services.profile import update_user_profile

        update_user_profile(
            user=self.user,
            validated_data={"profile_image": "https://example.com/new.png"},
        )
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.profile_image, "https://example.com/new.png")

    def test_updates_user_and_user_profile_fields_together(self):
        from apps.accounts.services.profile import update_user_profile

        update_user_profile(
            user=self.user,
            validated_data={
                "first_name": "CombinedFirst",
                "last_name": "CombinedLast",
                "phone_number": "+10001112222",
                "bio": "Combined bio.",
                "profile_image": "https://example.com/combined.jpg",
            },
        )
        self.user.refresh_from_db()
        self.profile.refresh_from_db()

        self.assertEqual(self.user.first_name, "CombinedFirst")
        self.assertEqual(self.user.last_name, "CombinedLast")
        self.assertEqual(self.profile.phone_number, "+10001112222")
        self.assertEqual(self.profile.bio, "Combined bio.")
        self.assertEqual(self.profile.profile_image, "https://example.com/combined.jpg")

    def test_preserves_fields_that_were_not_submitted(self):
        from apps.accounts.services.profile import update_user_profile

        update_user_profile(
            user=self.user,
            validated_data={"first_name": "OnlyFirstChanged"},
        )
        self.user.refresh_from_db()
        self.profile.refresh_from_db()

        self.assertEqual(self.user.first_name, "OnlyFirstChanged")
        self.assertEqual(self.user.last_name, "OriginalLast")
        self.assertEqual(self.profile.phone_number, "+15550001111")
        self.assertEqual(self.profile.bio, "Original bio.")
        self.assertEqual(self.profile.profile_image, "https://example.com/original.jpg")

    def test_creates_user_profile_if_one_does_not_exist_and_profile_fields_are_updated(self):
        from apps.accounts.models import User, UserProfile
        from apps.accounts.services.profile import update_user_profile

        user_without_profile = User.objects.create_user(
            email="initially_no_profile@example.com",
            password="SecurePassword123!",
            first_name="No",
            last_name="Profile",
        )
        self.assertFalse(UserProfile.objects.filter(user=user_without_profile).exists())

        update_user_profile(
            user=user_without_profile,
            validated_data={
                "phone_number": "+17778889999",
                "bio": "Created profile.",
            },
        )

        self.assertTrue(UserProfile.objects.filter(user=user_without_profile).exists())
        created_profile = user_without_profile.profile
        self.assertEqual(created_profile.phone_number, "+17778889999")
        self.assertEqual(created_profile.bio, "Created profile.")

    def test_does_not_change_email_or_capability_fields(self):
        from apps.accounts.services.profile import update_user_profile

        orig_email = self.user.email
        orig_is_tenant = self.user.is_tenant
        orig_is_owner = self.user.is_owner
        orig_is_platform_admin = self.user.is_platform_admin
        orig_email_verified_at = self.user.email_verified_at

        # Attempt to pass read-only fields directly to the service
        update_user_profile(
            user=self.user,
            validated_data={
                "first_name": "NewName",
                "email": "hacked@example.com",
                "is_tenant": False,
                "is_owner": True,
                "is_platform_admin": True,
                "email_verified_at": None,
            },
        )
        self.user.refresh_from_db()

        self.assertEqual(self.user.first_name, "NewName")
        self.assertEqual(self.user.email, orig_email)
        self.assertEqual(self.user.is_tenant, orig_is_tenant)
        self.assertEqual(self.user.is_owner, orig_is_owner)
        self.assertEqual(self.user.is_platform_admin, orig_is_platform_admin)
        self.assertEqual(self.user.email_verified_at, orig_email_verified_at)

    def test_correctly_handles_nullable_profile_values(self):
        from apps.accounts.services.profile import update_user_profile

        update_user_profile(
            user=self.user,
            validated_data={
                "phone_number": None,
                "bio": None,
                "profile_image": None,
            },
        )
        self.profile.refresh_from_db()

        self.assertIsNone(self.profile.phone_number)
        self.assertIsNone(self.profile.bio)
        self.assertIsNone(self.profile.profile_image)

    def test_returns_the_updated_user_instance(self):
        from apps.accounts.models import User
        from apps.accounts.services.profile import update_user_profile

        result = update_user_profile(
            user=self.user,
            validated_data={"first_name": "ReturnTest"},
        )
        self.assertIsInstance(result, User)
        self.assertEqual(result.id, self.user.id)
        self.assertEqual(result.first_name, "ReturnTest")

    def test_transaction_safety_rollback_on_failure(self):
        from unittest.mock import patch
        from apps.accounts.models import UserProfile
        from apps.accounts.services.profile import update_user_profile

        orig_first_name = self.user.first_name
        orig_bio = self.profile.bio

        with patch.object(UserProfile, "save", side_effect=Exception("Database failure during profile update")):
            with self.assertRaises(Exception):
                update_user_profile(
                    user=self.user,
                    validated_data={
                        "first_name": "ShouldRollbackFirst",
                        "bio": "ShouldRollbackBio",
                    },
                )

        self.user.refresh_from_db()
        self.profile.refresh_from_db()

        self.assertEqual(self.user.first_name, orig_first_name)
        self.assertEqual(self.profile.bio, orig_bio)






