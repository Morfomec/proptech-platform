import uuid
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase

from .models import SocialAccount, UserProfile

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
        self.assertTrue(user.is_active)
        self.assertIsInstance(user.id, uuid.UUID)

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
