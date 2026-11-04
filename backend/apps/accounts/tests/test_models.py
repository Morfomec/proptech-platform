import uuid
from unittest.mock import Mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError
from django.test import RequestFactory, TestCase
from django.utils import timezone

from apps.accounts.models import EmailVerificationToken, SocialAccount, UserProfile
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

        # SAFE_METHODS (GET, HEAD, OPTIONS)
        self.assertTrue(perm.has_permission(self._make_request("GET", self.tenant_user), None))
        self.assertTrue(perm.has_permission(self._make_request("GET", self.owner_user), None))

        # Unsafe methods (POST, PUT, DELETE)
        self.assertTrue(perm.has_permission(self._make_request("POST", self.owner_user), None))
        self.assertTrue(perm.has_permission(self._make_request("POST", self.dual_user), None))
        self.assertFalse(perm.has_permission(self._make_request("POST", self.tenant_user), None))
        self.assertFalse(perm.has_permission(self._make_request("POST", self.anon_user), None))

    def test_is_object_owner_permission(self):
        perm = IsObjectOwner()

        # Target object exposing owner_id
        obj_with_id = Mock(owner_id=self.owner_user.pk, spec=["owner_id"])
        self.assertTrue(
            perm.has_object_permission(self._make_request(user=self.owner_user), None, obj_with_id)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.tenant_user), None, obj_with_id)
        )
        self.assertFalse(
            perm.has_object_permission(self._make_request(user=self.anon_user), None, obj_with_id)
        )

        # Target object exposing owner instance
        obj_with_instance = Mock(owner=self.owner_user, spec=["owner"])
        self.assertTrue(
            perm.has_object_permission(
                self._make_request(user=self.owner_user), None, obj_with_instance
            )
        )
        self.assertFalse(
            perm.has_object_permission(
                self._make_request(user=self.tenant_user), None, obj_with_instance
            )
        )
