from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.accounts.serializers.registration import RegistrationSerializer


User = get_user_model()


class RegistrationSerializerTests(TestCase):
    def setUp(self):
        self.valid_data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@example.com",
            "password": "StrongPassword123!",
            "password_confirm": "StrongPassword123!",
        }

    def test_valid_registration_data(self):
        serializer = RegistrationSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["email"], "jane.doe@example.com")

    def test_passwords_do_not_match(self):
        data = self.valid_data.copy()
        data["password_confirm"] = "DifferentPassword123!"
        serializer = RegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("password_confirm", serializer.errors)

    def test_duplicate_email_case_insensitive(self):
        User.objects.create_user(
            email="jane.doe@example.com",
            password="existingPassword123",
        )
        data = self.valid_data.copy()
        data["email"] = "JANE.DOE@example.com"
        serializer = RegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_weak_password_validation(self):
        data = self.valid_data.copy()
        data["password"] = "123"
        data["password_confirm"] = "123"
        serializer = RegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)

    def test_unexpected_fields_rejected(self):
        data = self.valid_data.copy()
        data["role"] = "ADMIN"
        data["is_superuser"] = True
        serializer = RegistrationSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_concurrent_duplicate_email_handled_safely_on_save(self):
        from rest_framework import serializers

        serializer = RegistrationSerializer(data=self.valid_data)
        self.assertTrue(serializer.is_valid())

        # Simulate concurrent registration right before save()
        User.objects.create_user(
            email=self.valid_data["email"],
            password="otherPassword123!",
        )

        with self.assertRaises(serializers.ValidationError) as exc:
            serializer.save()

        self.assertIn("email", exc.exception.detail)


class RefreshTokenSerializerTests(TestCase):
    def test_valid_refresh_token_payload(self):
        from apps.accounts.serializers.refresh_token import RefreshTokenSerializer

        serializer = RefreshTokenSerializer(data={"refresh": "sample_token_string"})
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["refresh"], "sample_token_string")

    def test_missing_refresh_token(self):
        from apps.accounts.serializers.refresh_token import RefreshTokenSerializer

        serializer = RefreshTokenSerializer(data={})
        self.assertFalse(serializer.is_valid())
        self.assertIn("refresh", serializer.errors)

    def test_blank_refresh_token(self):
        from apps.accounts.serializers.refresh_token import RefreshTokenSerializer

        serializer = RefreshTokenSerializer(data={"refresh": "   "})
        self.assertFalse(serializer.is_valid())
        self.assertIn("refresh", serializer.errors)

    def test_unexpected_fields_rejected(self):
        from apps.accounts.serializers.refresh_token import RefreshTokenSerializer

        serializer = RefreshTokenSerializer(data={
            "refresh": "valid_token",
            "extra_field": "disallowed",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class LogoutSerializerTests(TestCase):
    def test_valid_logout_payload(self):
        from apps.accounts.serializers.logout import LogoutSerializer

        serializer = LogoutSerializer(data={"refresh": "sample_token_string"})
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["refresh"], "sample_token_string")

    def test_missing_refresh_token(self):
        from apps.accounts.serializers.logout import LogoutSerializer

        serializer = LogoutSerializer(data={})
        self.assertFalse(serializer.is_valid())
        self.assertIn("refresh", serializer.errors)

    def test_blank_refresh_token(self):
        from apps.accounts.serializers.logout import LogoutSerializer

        serializer = LogoutSerializer(data={"refresh": "   "})
        self.assertFalse(serializer.is_valid())
        self.assertIn("refresh", serializer.errors)

    def test_unexpected_fields_rejected(self):
        from apps.accounts.serializers.logout import LogoutSerializer

        serializer = LogoutSerializer(data={
            "refresh": "valid_token",
            "malicious_extra": "disallowed",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class PasswordResetRequestSerializerTests(TestCase):
    def test_valid_email_normalized(self):
        from apps.accounts.serializers.password_reset import PasswordResetRequestSerializer

        serializer = PasswordResetRequestSerializer(data={"email": "  USER@EXAMPLE.COM  "})
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["email"], "user@example.com")

    def test_missing_email(self):
        from apps.accounts.serializers.password_reset import PasswordResetRequestSerializer

        serializer = PasswordResetRequestSerializer(data={})
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_blank_email(self):
        from apps.accounts.serializers.password_reset import PasswordResetRequestSerializer

        serializer = PasswordResetRequestSerializer(data={"email": "   "})
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_invalid_email_format(self):
        from apps.accounts.serializers.password_reset import PasswordResetRequestSerializer

        serializer = PasswordResetRequestSerializer(data={"email": "not-an-email"})
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_unexpected_fields_rejected(self):
        from apps.accounts.serializers.password_reset import PasswordResetRequestSerializer

        serializer = PasswordResetRequestSerializer(data={
            "email": "user@example.com",
            "unexpected": "disallowed",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class PasswordResetConfirmSerializerTests(TestCase):
    def setUp(self):
        import uuid
        self.valid_uid = str(uuid.uuid4())
        self.valid_payload = {
            "uid": self.valid_uid,
            "token": "valid_reset_token_string",
            "new_password": "NewComplexPassword123!",
            "confirm_password": "NewComplexPassword123!",
        }

    def test_valid_payload_passes(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        serializer = PasswordResetConfirmSerializer(data=self.valid_payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_missing_required_fields(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        for field in ["uid", "token", "new_password", "confirm_password"]:
            data = self.valid_payload.copy()
            del data[field]
            serializer = PasswordResetConfirmSerializer(data=data)
            self.assertFalse(serializer.is_valid())
            self.assertIn(field, serializer.errors)

    def test_invalid_uuid_rejected(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        data = self.valid_payload.copy()
        data["uid"] = "invalid-not-a-uuid"
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("uid", serializer.errors)

    def test_password_mismatch_rejected(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        data = self.valid_payload.copy()
        data["confirm_password"] = "DifferentPassword123!"
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("confirm_password", serializer.errors)

    def test_weak_password_too_short_rejected(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        data = self.valid_payload.copy()
        data["new_password"] = "Short1!"
        data["confirm_password"] = "Short1!"
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)

    def test_weak_password_common_rejected(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        data = self.valid_payload.copy()
        data["new_password"] = "password"
        data["confirm_password"] = "password"
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)

    def test_weak_password_entirely_numeric_rejected(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        data = self.valid_payload.copy()
        data["new_password"] = "12345678"
        data["confirm_password"] = "12345678"
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)

    def test_blank_token_rejected(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        data = self.valid_payload.copy()
        data["token"] = "   "
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("token", serializer.errors)

    def test_unexpected_fields_rejected(self):
        from apps.accounts.serializers.password_reset import PasswordResetConfirmSerializer

        data = self.valid_payload.copy()
        data["extra_field"] = "malicious_payload"
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class ChangePasswordSerializerTests(TestCase):
    def setUp(self):
        from apps.accounts.models import User

        self.user = User.objects.create_user(
            email="changepw_serializer@example.com",
            password="CurrentPassword123!",
            first_name="John",
            last_name="Doe",
        )
        self.valid_payload = {
            "current_password": "CurrentPassword123!",
            "new_password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!",
        }

    def test_valid_payload_passes(self):
        from apps.accounts.serializers.change_password import ChangePasswordSerializer

        serializer = ChangePasswordSerializer(
            data=self.valid_payload,
            context={"user": self.user},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_missing_required_fields(self):
        from apps.accounts.serializers.change_password import ChangePasswordSerializer

        for field in ["current_password", "new_password", "confirm_password"]:
            data = self.valid_payload.copy()
            del data[field]
            serializer = ChangePasswordSerializer(
                data=data,
                context={"user": self.user},
            )
            self.assertFalse(serializer.is_valid())
            self.assertIn(field, serializer.errors)

    def test_password_mismatch_rejected(self):
        from apps.accounts.serializers.change_password import ChangePasswordSerializer

        data = self.valid_payload.copy()
        data["confirm_password"] = "MismatchedPassword123!"
        serializer = ChangePasswordSerializer(
            data=data,
            context={"user": self.user},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("confirm_password", serializer.errors)

    def test_weak_password_too_short_rejected(self):
        from apps.accounts.serializers.change_password import ChangePasswordSerializer

        data = self.valid_payload.copy()
        data["new_password"] = "Short1!"
        data["confirm_password"] = "Short1!"
        serializer = ChangePasswordSerializer(
            data=data,
            context={"user": self.user},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)

    def test_weak_password_common_rejected(self):
        from apps.accounts.serializers.change_password import ChangePasswordSerializer

        data = self.valid_payload.copy()
        data["new_password"] = "password"
        data["confirm_password"] = "password"
        serializer = ChangePasswordSerializer(
            data=data,
            context={"user": self.user},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)

    def test_weak_password_entirely_numeric_rejected(self):
        from apps.accounts.serializers.change_password import ChangePasswordSerializer

        data = self.valid_payload.copy()
        data["new_password"] = "12345678"
        data["confirm_password"] = "12345678"
        serializer = ChangePasswordSerializer(
            data=data,
            context={"user": self.user},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)

    def test_unexpected_fields_rejected(self):
        from apps.accounts.serializers.change_password import ChangePasswordSerializer

        data = self.valid_payload.copy()
        data["extra_unexpected"] = "malicious_data"
        serializer = ChangePasswordSerializer(
            data=data,
            context={"user": self.user},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class ProfileSerializerTests(TestCase):
    def setUp(self):
        from apps.accounts.models import User, UserProfile

        self.user = User.objects.create_user(
            email="profile_serializer_test@example.com",
            password="SecurePassword123!",
            first_name="Alice",
            last_name="Smith",
            is_tenant=True,
            is_owner=False,
            is_platform_admin=False,
            email_verified_at=timezone.now(),
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            phone_number="+15551234567",
            bio="Software engineer and real estate investor.",
            profile_image="https://example.com/avatar.jpg",
        )

    # --- Serialization Tests ---

    def test_correctly_serializes_user_fields(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(self.user)
        data = serializer.data

        self.assertEqual(data["id"], str(self.user.id))
        self.assertEqual(data["email"], self.user.email)
        self.assertEqual(data["first_name"], "Alice")
        self.assertEqual(data["last_name"], "Smith")
        self.assertTrue(data["is_tenant"])
        self.assertFalse(data["is_owner"])
        self.assertFalse(data["is_platform_admin"])
        self.assertIsNotNone(data["email_verified_at"])

    def test_correctly_serializes_user_profile_fields(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(self.user)
        data = serializer.data

        self.assertEqual(data["phone_number"], "+15551234567")
        self.assertEqual(data["bio"], "Software engineer and real estate investor.")
        self.assertEqual(data["profile_image"], "https://example.com/avatar.jpg")

    def test_handles_user_without_profile_returning_null_profile_fields(self):
        from apps.accounts.models import User
        from apps.accounts.serializers.profile import ProfileSerializer

        user_without_profile = User.objects.create_user(
            email="no_profile@example.com",
            password="SecurePassword123!",
            first_name="No",
            last_name="Profile",
            is_tenant=False,
            is_owner=True,
        )

        serializer = ProfileSerializer(user_without_profile)
        data = serializer.data

        self.assertEqual(data["id"], str(user_without_profile.id))
        self.assertEqual(data["email"], "no_profile@example.com")
        self.assertEqual(data["first_name"], "No")
        self.assertEqual(data["last_name"], "Profile")
        self.assertIsNone(data["phone_number"])
        self.assertIsNone(data["bio"])
        self.assertIsNone(data["profile_image"])

    # --- Validation Tests ---

    def test_accepts_valid_profile_data(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        payload = {
            "first_name": "UpdatedAlice",
            "last_name": "UpdatedSmith",
            "phone_number": "+19998887777",
            "bio": "Updated bio.",
            "profile_image": "https://example.com/new_avatar.png",
        }
        serializer = ProfileSerializer(data=payload, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data, payload)

    def test_accepts_partial_update_containing_only_first_name(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(data={"first_name": "NewFirst"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data, {"first_name": "NewFirst"})

    def test_accepts_updates_containing_only_phone_number_or_bio(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        phone_serializer = ProfileSerializer(data={"phone_number": "+1122334455"}, partial=True)
        self.assertTrue(phone_serializer.is_valid(), phone_serializer.errors)
        self.assertEqual(phone_serializer.validated_data, {"phone_number": "+1122334455"})

        bio_serializer = ProfileSerializer(data={"bio": "Just a new bio."}, partial=True)
        self.assertTrue(bio_serializer.is_valid(), bio_serializer.errors)
        self.assertEqual(bio_serializer.validated_data, {"bio": "Just a new bio."})

    def test_accepts_nullable_profile_fields_where_supported(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        payload = {
            "phone_number": None,
            "bio": None,
            "profile_image": None,
        }
        serializer = ProfileSerializer(data=payload, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data["phone_number"])
        self.assertIsNone(serializer.validated_data["bio"])
        self.assertIsNone(serializer.validated_data["profile_image"])

    def test_rejects_empty_payload(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(data={}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_rejects_unexpected_fields(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        payload = {
            "first_name": "Alice",
            "malicious_extra": "disallowed",
        }
        serializer = ProfileSerializer(data=payload, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_rejects_email_modifications(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(data={"email": "hacked@example.com"}, partial=True)
        self.assertFalse(serializer.is_valid())

    def test_rejects_is_owner_modifications(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(data={"is_owner": True}, partial=True)
        self.assertFalse(serializer.is_valid())

    def test_rejects_is_tenant_modifications(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(data={"is_tenant": False}, partial=True)
        self.assertFalse(serializer.is_valid())

    def test_rejects_is_platform_admin_modifications(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(data={"is_platform_admin": True}, partial=True)
        self.assertFalse(serializer.is_valid())

    def test_rejects_email_verified_at_modifications(self):
        from apps.accounts.serializers.profile import ProfileSerializer

        serializer = ProfileSerializer(data={"email_verified_at": "2026-01-01T00:00:00Z"}, partial=True)
        self.assertFalse(serializer.is_valid())

    def test_read_only_fields_never_accepted_as_editable_data(self):
        import uuid
        from apps.accounts.serializers.profile import ProfileSerializer

        payload = {
            "first_name": "AliceUpdated",
            "id": str(uuid.uuid4()),
            "email": "injected@example.com",
            "is_tenant": False,
            "is_owner": True,
            "is_platform_admin": True,
            "email_verified_at": "2026-01-01T00:00:00Z",
        }
        serializer = ProfileSerializer(data=payload, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        # Ensure only the editable field is in validated_data
        self.assertIn("first_name", serializer.validated_data)
        self.assertNotIn("id", serializer.validated_data)
        self.assertNotIn("email", serializer.validated_data)
        self.assertNotIn("is_tenant", serializer.validated_data)
        self.assertNotIn("is_owner", serializer.validated_data)
        self.assertNotIn("is_platform_admin", serializer.validated_data)
        self.assertNotIn("email_verified_at", serializer.validated_data)






