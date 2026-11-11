import uuid
from unittest.mock import Mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, transaction
from django.test import RequestFactory, TestCase
from django.utils import timezone

from apps.accounts.models import (
    EmailVerificationToken,
    PasswordResetToken,
    SocialAccount,
    UserProfile,
)
from apps.core.permissions import (
    IsAdmin,
    IsObjectOwner,
    IsOwner,
    IsOwnerOrReadOnly,
    IsTenant,
)

User = get_user_model()


class UserManagerTests(TestCase):
    def test_create_user_successful(self):
        user = User.objects.create_user(
            email="TestUser@Example.COM ",
            password="securepassword123",
            first_name="John",
            last_name="Doe",
        )
        self.assertEqual(user.email, "testuser@example.com")
        self.assertTrue(user.check_password("securepassword123"))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_active)
        self.assertIsInstance(user.id, uuid.UUID)

    def test_create_user_capability_defaults(self):
        user = User.objects.create_user(
            email="tenant_default@example.com",
            password="password123",
        )
        self.assertFalse(user.is_active)
        self.assertTrue(user.is_tenant)
        self.assertFalse(user.is_owner)
        self.assertFalse(user.is_platform_admin)

    def test_create_user_dual_capabilities(self):
        user = User.objects.create_user(
            email="dual_user@example.com",
            password="password123",
            is_tenant=True,
            is_owner=True,
        )
        self.assertFalse(user.is_active)
        self.assertTrue(user.is_tenant)
        self.assertTrue(user.is_owner)
        self.assertFalse(user.is_platform_admin)

    def test_normal_user_cannot_become_platform_admin(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(
                email="hacker@example.com",
                password="password123",
                is_platform_admin=True,
            )

    def test_create_user_without_email_raises_error(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="password123")

        with self.assertRaises(ValueError):
            User.objects.create_user(email=None, password="password123")

    def test_create_superuser_successful(self):
        admin_user = User.objects.create_superuser(
            email="admin@example.com",
            password="adminpassword123",
        )
        self.assertEqual(admin_user.email, "admin@example.com")
        self.assertTrue(admin_user.is_staff)
        self.assertTrue(admin_user.is_superuser)
        self.assertTrue(admin_user.is_active)
        self.assertTrue(admin_user.is_platform_admin)

    def test_create_superuser_invalid_flags(self):
        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                email="admin@example.com",
                password="adminpassword123",
                is_staff=False,
            )

        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                email="admin@example.com",
                password="adminpassword123",
                is_superuser=False,
            )

        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                email="admin@example.com",
                password="adminpassword123",
                is_platform_admin=False,
            )

        with self.assertRaises(ValueError):
            User.objects.create_superuser(
                email="admin@example.com",
                password="adminpassword123",
                is_active=False,
            )


class AccountsModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="tenant@example.com",
            password="password123",
            first_name="Jane",
            last_name="Smith",
        )

    def test_user_str_representation(self):
        self.assertEqual(str(self.user), "tenant@example.com")

    def test_user_profile_creation(self):
        profile = UserProfile.objects.create(
            user=self.user,
            phone_number="+1234567890",
            bio="Test bio",
        )
        self.assertIsInstance(profile.id, uuid.UUID)
        self.assertEqual(str(profile), "Profile: tenant@example.com")
        self.assertEqual(self.user.profile, profile)

    def test_social_account_creation(self):
        social = SocialAccount.objects.create(
            user=self.user,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id="google-uid-123456",
        )
        self.assertIsInstance(social.id, uuid.UUID)
        self.assertEqual(str(social), "google: tenant@example.com")
        self.assertIn(social, self.user.social_accounts.all())

    def test_social_account_unique_constraint(self):
        SocialAccount.objects.create(
            user=self.user,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id="google-uid-123456",
        )
        with self.assertRaises(IntegrityError):
            SocialAccount.objects.create(
                user=self.user,
                provider=SocialAccount.Provider.GOOGLE,
                provider_user_id="another-id",
            )

    def test_email_verification_token_model(self):
        token_obj = EmailVerificationToken.objects.create(
            user=self.user,
            token_hash="a" * 64,
            expires_at=timezone.now() + timezone.timedelta(hours=24),
        )
        self.assertIsInstance(token_obj.id, uuid.UUID)
        self.assertIn("Email verification for tenant@example.com", str(token_obj))

    def test_case_insensitive_email_unique_constraint(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create(
                    email="TENANT@EXAMPLE.COM",
                    password="password123",
                )

    def test_social_account_provider_user_uniqueness_and_cascade(self):
        other_user = User.objects.create_user(
            email="other_social@example.com",
            password="password123",
        )
        social = SocialAccount.objects.create(
            user=self.user,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id="shared-google-sub",
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                SocialAccount.objects.create(
                    user=other_user,
                    provider=SocialAccount.Provider.GOOGLE,
                    provider_user_id="shared-google-sub",
                )

        self.user.delete()
        self.assertFalse(SocialAccount.objects.filter(pk=social.pk).exists())

    def test_password_reset_token_model_uniqueness_and_cascade(self):
        expires = timezone.now() + timezone.timedelta(minutes=30)
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token_hash="b" * 64,
            expires_at=expires,
        )
        self.assertIsInstance(reset_token.id, uuid.UUID)
        self.assertEqual(self.user.password_reset_token, reset_token)
        self.assertIn("Password reset token for tenant@example.com", str(reset_token))
        self.assertIsNotNone(reset_token.created_at)

        other_user = User.objects.create_user(
            email="reset_other@example.com",
            password="password123",
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PasswordResetToken.objects.create(
                    user=other_user,
                    token_hash="b" * 64,
                    expires_at=expires,
                )

        self.user.delete()
        self.assertFalse(
            PasswordResetToken.objects.filter(pk=reset_token.pk).exists()
        )


class CapabilityPermissionsTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

        self.tenant_user = User.objects.create_user(
            email="tenant_only@example.com",
            password="password123",
            is_tenant=True,
            is_owner=False,
        )
        self.owner_user = User.objects.create_user(
            email="owner_only@example.com",
            password="password123",
            is_tenant=False,
            is_owner=True,
        )
        self.other_owner_user = User.objects.create_user(
            email="other_owner_only@example.com",
            password="password123",
            is_tenant=False,
            is_owner=True,
        )
        self.dual_user = User.objects.create_user(
            email="dual_cap@example.com",
            password="password123",
            is_tenant=True,
            is_owner=True,
        )
        self.admin_user = User.objects.create_superuser(
            email="admin_cap@example.com",
            password="password123",
        )
        self.anon_user = AnonymousUser()

    def _make_request(self, method="GET", user=None):
        request = getattr(self.factory, method.lower())("/")
        request.user = user or self.anon_user
        return request

    def test_is_tenant_permission(self):
        perm = IsTenant()

        self.assertTrue(perm.has_permission(self._make_request(user=self.tenant_user), None))
        self.assertTrue(perm.has_permission(self._make_request(user=self.dual_user), None))
        self.assertFalse(perm.has_permission(self._make_request(user=self.owner_user), None))
        self.assertFalse(perm.has_permission(self._make_request(user=self.anon_user), None))

    def test_is_owner_permission(self):
        perm = IsOwner()

        self.assertTrue(perm.has_permission(self._make_request(user=self.owner_user), None))
        self.assertTrue(perm.has_permission(self._make_request(user=self.dual_user), None))
        self.assertFalse(perm.has_permission(self._make_request(user=self.tenant_user), None))
        self.assertFalse(perm.has_permission(self._make_request(user=self.anon_user), None))

    def test_is_admin_permission(self):
        perm = IsAdmin()

        self.assertTrue(perm.has_permission(self._make_request(user=self.admin_user), None))
        self.assertFalse(perm.has_permission(self._make_request(user=self.owner_user), None))
        self.assertFalse(perm.has_permission(self._make_request(user=self.tenant_user), None))
        self.assertFalse(perm.has_permission(self._make_request(user=self.anon_user), None))

    def test_is_owner_or_read_only_permission(self):
        perm = IsOwnerOrReadOnly()
        own_obj = Mock(owner=self.owner_user)
        other_obj = Mock(owner=self.other_owner_user)

        # 1. Anonymous safe request
        self.assertTrue(perm.has_permission(self._make_request("GET", self.anon_user), None))
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.anon_user), None, own_obj))

        # 2. Tenant safe request
        self.assertTrue(perm.has_permission(self._make_request("GET", self.tenant_user), None))
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.tenant_user), None, own_obj))

        # 3. Tenant write request denied
        self.assertFalse(perm.has_permission(self._make_request("POST", self.tenant_user), None))
        self.assertFalse(perm.has_permission(self._make_request("PATCH", self.tenant_user), None))
        self.assertFalse(perm.has_object_permission(self._make_request("PATCH", self.tenant_user), None, own_obj))
        self.assertFalse(perm.has_permission(self._make_request("POST", self.anon_user), None))

        # 4. Owner safe request
        self.assertTrue(perm.has_permission(self._make_request("GET", self.owner_user), None))
        self.assertTrue(perm.has_object_permission(self._make_request("GET", self.owner_user), None, own_obj))

        # 5. Owner modifying own object allowed
        self.assertTrue(perm.has_permission(self._make_request("POST", self.owner_user), None))
        self.assertTrue(perm.has_permission(self._make_request("POST", self.dual_user), None))
        self.assertTrue(perm.has_object_permission(self._make_request("PATCH", self.owner_user), None, own_obj))
        self.assertTrue(perm.has_object_permission(self._make_request("DELETE", self.owner_user), None, own_obj))

        # 6. Owner modifying another owner's object denied
        self.assertFalse(perm.has_object_permission(self._make_request("PATCH", self.owner_user), None, other_obj))
        self.assertFalse(perm.has_object_permission(self._make_request("DELETE", self.owner_user), None, other_obj))

    def test_is_object_owner_permission(self):
        perm = IsObjectOwner()

        # 1. Correct direct owner
        obj_with_id = Mock(owner_id=self.owner_user.pk, spec=["owner_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, obj_with_id)
        )
        obj_with_instance = Mock(owner=self.owner_user, spec=["owner"])
        self.assertTrue(
            perm.has_object_permission(
                self._make_request(user=self.owner_user), None, obj_with_instance
            )
        )
        obj_with_str_id = Mock(owner_id=str(self.owner_user.pk), spec=["owner_id"])
        self.assertTrue(
            perm.has_object_permission(
                self._make_request(user=self.owner_user), None, obj_with_str_id
            )
        )

        # 2. Incorrect owner
        self.assertFalse(
            perm.has_object_permission(
                self._make_request(user=self.other_owner_user), None, obj_with_instance
            )
        )
        self.assertFalse(
            perm.has_object_permission(
                self._make_request(user=self.tenant_user), None, obj_with_instance
            )
        )

        # 3. Tenant relationship
        tenant_obj = Mock(tenant=self.tenant_user, spec=["tenant"])
        tenant_id_obj = Mock(tenant_id=self.tenant_user.pk, spec=["tenant_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.tenant_user), None, tenant_obj)
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.tenant_user), None, tenant_id_obj)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, tenant_obj)
        )

        # 4. Applicant relationship
        applicant_obj = Mock(applicant=self.tenant_user, spec=["applicant"])
        applicant_id_obj = Mock(applicant_id=self.tenant_user.pk, spec=["applicant_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.tenant_user), None, applicant_obj)
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.tenant_user), None, applicant_id_obj)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, applicant_obj)
        )

        # 5. User relationship
        user_obj = Mock(user=self.tenant_user, spec=["user"])
        user_id_obj = Mock(user_id=self.tenant_user.pk, spec=["user_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.tenant_user), None, user_obj)
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.tenant_user), None, user_id_obj)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, user_obj)
        )

        # 6. Nested property owner
        nested_prop = Mock(property=Mock(owner=self.owner_user, spec=["owner"]), spec=["property"])
        nested_prop_id = Mock(property=Mock(owner_id=self.owner_user.pk, spec=["owner_id"]), spec=["property"])
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, nested_prop)
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, nested_prop_id)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.other_owner_user), None, nested_prop)
        )

        # Secondary nested
        nested_listing = Mock(
            listing=Mock(property=Mock(owner=self.owner_user, spec=["owner"]), spec=["property"]),
            spec=["listing"],
        )
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, nested_listing)
        )

        # 7. Missing ownership attribute
        unrelated_obj = Mock(title="Apartment 4B", spec=["title"])
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, unrelated_obj)
        )

        # 8. Unauthenticated request
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.anon_user), None, obj_with_instance)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.anon_user), None, nested_prop)
        )
