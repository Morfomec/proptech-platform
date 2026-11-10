from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import SocialAccount, UserProfile

User = get_user_model()


class GoogleAuthAPITests(APITestCase):
    def setUp(self):
        self.google_auth_url = reverse("accounts:google-auth")
        self.login_url = reverse("accounts:login")

        self.mock_client_id = "test-proptech-client-id.apps.googleusercontent.com"
        self.valid_credential = "valid-google-id-token"

        self.valid_google_payload = {
            "iss": "https://accounts.google.com",
            "sub": "google-user-sub-123456",
            "email": "google_user@example.com",
            "email_verified": True,
            "given_name": "Google",
            "family_name": "User",
            "picture": "https://example.com/photo.jpg",
            "aud": self.mock_client_id,
        }

    # 1. Valid Google token registration
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_new_google_user_registration_success(self, mock_verify):
        mock_verify.return_value = self.valid_google_payload

        response = self.client.post(self.google_auth_url, {"credential": self.valid_credential})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])

        user_data = response.data["data"]["user"]
        self.assertEqual(user_data["email"], "google_user@example.com")
        self.assertEqual(user_data["first_name"], "Google")
        self.assertEqual(user_data["last_name"], "User")
        self.assertTrue(user_data["is_tenant"])
        self.assertFalse(user_data["is_owner"])
        self.assertFalse(user_data["is_platform_admin"])

        # Verify DB state
        user = User.objects.get(email="google_user@example.com")
        self.assertTrue(user.is_active)
        self.assertIsNotNone(user.email_verified_at)
        self.assertFalse(user.has_usable_password())
        self.assertTrue(user.is_tenant)
        self.assertFalse(user.is_owner)
        self.assertFalse(user.is_platform_admin)

        # Verify social account was created
        social_acc = SocialAccount.objects.get(user=user, provider=SocialAccount.Provider.GOOGLE)
        self.assertEqual(social_acc.provider_user_id, "google-user-sub-123456")

        # Verify UserProfile was created with profile image
        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.profile_image, "https://example.com/photo.jpg")

    # 2. Invalid Google token rejected
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_invalid_google_token_rejected(self, mock_verify):
        mock_verify.side_effect = ValueError("Invalid token signature")

        response = self.client.post(self.google_auth_url, {"credential": "invalid-token"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])
        self.assertIn("Invalid or expired Google credential", response.data["message"])

    # 3. Expired Google token rejected
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_expired_google_token_rejected(self, mock_verify):
        mock_verify.side_effect = ValueError("Token has expired")

        response = self.client.post(self.google_auth_url, {"credential": "expired-token"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])
        self.assertIn("Invalid or expired Google credential", response.data["message"])

    # 4. Wrong audience / client ID rejected
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_wrong_audience_rejected(self, mock_verify):
        mock_verify.side_effect = ValueError("Wrong recipient, audience mismatch")

        response = self.client.post(self.google_auth_url, {"credential": "wrong-aud-token"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])

    # 5. Unverified email rejected
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_unverified_email_rejected(self, mock_verify):
        payload = self.valid_google_payload.copy()
        payload["email_verified"] = False
        mock_verify.return_value = payload

        response = self.client.post(self.google_auth_url, {"credential": self.valid_credential})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])
        self.assertIn("Google account email is not verified", response.data["message"])

    # 6. Existing Google user login
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_existing_google_user_login(self, mock_verify):
        mock_verify.return_value = self.valid_google_payload

        # Create user and social account beforehand
        user = User.objects.create_user(
            email="google_user@example.com",
            first_name="ExistingGoogle",
            last_name="User",
            is_active=True,
            is_tenant=True,
            is_owner=True,  # Existing owner
            email_verified_at=timezone.now(),
        )
        SocialAccount.objects.create(
            user=user,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id="google-user-sub-123456",
        )

        response = self.client.post(self.google_auth_url, {"credential": self.valid_credential})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        # Should not create duplicate user
        self.assertEqual(User.objects.filter(email="google_user@example.com").count(), 1)
        # Owner capability is preserved
        self.assertTrue(response.data["data"]["user"]["is_owner"])

    # 7. Existing verified local account automatic linking
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_existing_verified_local_account_linking_success(self, mock_verify):
        mock_verify.return_value = self.valid_google_payload

        # Local user registered with password and verified email
        local_user = User.objects.create_user(
            email="google_user@example.com",
            password="LocalPassword123!",
            first_name="Local",
            last_name="User",
            is_active=True,
            is_tenant=True,
            email_verified_at=timezone.now(),
        )
        UserProfile.objects.create(user=local_user)

        response = self.client.post(self.google_auth_url, {"credential": self.valid_credential})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        # Confirms linked
        social_acc = SocialAccount.objects.get(user=local_user, provider=SocialAccount.Provider.GOOGLE)
        self.assertEqual(social_acc.provider_user_id, "google-user-sub-123456")

        # Local password still works for local login
        login_res = self.client.post(
            self.login_url,
            {"email": "google_user@example.com", "password": "LocalPassword123!"},
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)

    # 8. Existing unverified local account linking rejected
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_existing_unverified_local_account_not_linked(self, mock_verify):
        mock_verify.return_value = self.valid_google_payload

        # Local user registered but has NOT verified email
        User.objects.create_user(
            email="google_user@example.com",
            password="LocalPassword123!",
            is_active=False,
            email_verified_at=None,
        )

        response = self.client.post(self.google_auth_url, {"credential": self.valid_credential})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])
        self.assertIn("not verified", response.data["message"])

        # Verify no social account was created
        self.assertFalse(
            SocialAccount.objects.filter(provider=SocialAccount.Provider.GOOGLE).exists()
        )

    # 9. Duplicate account / Social identity already associated with another user
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_conflicting_social_identity_rejected(self, mock_verify):
        mock_verify.return_value = self.valid_google_payload

        # User A has sub-123456
        user_a = User.objects.create_user(
            email="user_a@example.com",
            is_active=True,
            email_verified_at=timezone.now(),
        )
        SocialAccount.objects.create(
            user=user_a,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id="google-user-sub-123456",
        )

        # User B has different sub linked
        user_b = User.objects.create_user(
            email="google_user@example.com",
            is_active=True,
            email_verified_at=timezone.now(),
        )
        SocialAccount.objects.create(
            user=user_b,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id="different-sub-999999",
        )

        response = self.client.post(self.google_auth_url, {"credential": self.valid_credential})

        # Conflict: User B tries to link a Google identity already tied to User A
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED])
        self.assertFalse(response.data["success"])

    # 10. Inactive user authentication rejected
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_inactive_google_user_rejected(self, mock_verify):
        mock_verify.return_value = self.valid_google_payload

        user = User.objects.create_user(
            email="google_user@example.com",
            is_active=False,
            email_verified_at=timezone.now(),
        )
        SocialAccount.objects.create(
            user=user,
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id="google-user-sub-123456",
        )

        response = self.client.post(self.google_auth_url, {"credential": self.valid_credential})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["success"])
        self.assertIn("inactive", response.data["message"].lower())

    # 11. Empty or missing credential rejected
    def test_missing_credential_rejected(self):
        response = self.client.post(self.google_auth_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response2 = self.client.post(self.google_auth_url, {"credential": ""})
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)

    # 12. JWT validation on protected API endpoint
    @patch("apps.accounts.services.google_auth.id_token.verify_oauth2_token")
    def test_google_jwt_accesses_protected_endpoint(self, mock_verify):
        mock_verify.return_value = self.valid_google_payload

        auth_res = self.client.post(self.google_auth_url, {"credential": self.valid_credential})
        self.assertEqual(auth_res.status_code, status.HTTP_200_OK)

        access_token = auth_res.data["data"]["access"]

        # Validate that token belongs to created user
        decoded = AccessToken(access_token)
        user = User.objects.get(email="google_user@example.com")
        self.assertEqual(str(decoded["user_id"]), str(user.id))

        # Access protected profile endpoint
        profile_url = reverse("accounts:profile")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        profile_res = self.client.get(profile_url)

        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        self.assertTrue(profile_res.data["success"])
        self.assertEqual(profile_res.data["data"]["email"], "google_user@example.com")

