import logging
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import SocialAccount, User, UserProfile

logger = logging.getLogger(__name__)


def verify_google_id_token(credential: str) -> dict:
    """
    Verifies the Google ID token against Google's public certificates and audience.
    Validates token signature, issuer, audience, and expiration.
    Returns the decoded token claims dictionary.
    """
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
    if not client_id:
        logger.error("GOOGLE_CLIENT_ID is not configured in Django settings.")
        raise AuthenticationFailed("Google authentication is currently unavailable.")

    try:
        request_adapter = google_requests.Request()
        idinfo = id_token.verify_oauth2_token(
            credential,
            request_adapter,
            client_id,
        )
    except ValueError as val_err:
        logger.warning("Invalid Google credential received: %s", val_err)
        raise AuthenticationFailed("Invalid or expired Google credential.") from val_err
    except (GoogleAuthError, Exception) as auth_err:
        logger.error("Error connecting to Google token verification service: %s", auth_err)
        raise AuthenticationFailed("Unable to verify Google credentials. Please try again.") from auth_err

    # Explicitly check Google issuer domain
    issuer = idinfo.get("iss", "")
    if issuer not in ["accounts.google.com", "https://accounts.google.com"]:
        logger.warning("Untrusted Google token issuer: %s", issuer)
        raise AuthenticationFailed("Invalid Google credential issuer.")

    # Confirm email_verified is true
    email_verified = idinfo.get("email_verified")
    if email_verified is not True and str(email_verified).lower() != "true":
        raise AuthenticationFailed("Google account email is not verified.")

    return idinfo


def authenticate_google_user(*, credential: str) -> dict:
    """
    Authenticates or registers a user via Google Identity Services ID token.

    Handles:
    - Scenario A: New user registration with default tenant capability and unusable password.
    - Scenario B: Existing linked Google user authentication.
    - Scenario C: Existing verified local account automatic linking.
    - Scenario D: Existing unverified local account linking protection and conflicting identity rejection.
    """
    idinfo = verify_google_id_token(credential)

    google_sub = str(idinfo.get("sub", "")).strip()
    raw_email = str(idinfo.get("email", "")).strip()
    if not google_sub or not raw_email:
        raise AuthenticationFailed("Google credential payload is missing required identity claims.")

    email = User.objects.normalize_email(raw_email)
    first_name = str(idinfo.get("given_name") or idinfo.get("name") or "").strip()
    last_name = str(idinfo.get("family_name") or "").strip()
    picture = str(idinfo.get("picture") or "").strip()

    # Scenario B: Check if Google provider identity is already linked to a user
    social_account = (
        SocialAccount.objects.filter(
            provider=SocialAccount.Provider.GOOGLE,
            provider_user_id=google_sub,
        )
        .select_related("user")
        .first()
    )

    if social_account:
        user = social_account.user

        # Scenario D: If this Google identity is linked to an account with a different email
        if user.email != email:
            raise AuthenticationFailed("This Google account is already linked to another user.")

        if not user.is_active:
            raise AuthenticationFailed("User account is inactive. Please contact support.")

        refresh = RefreshToken.for_user(user)
        return {
            "user": user,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "is_new_user": False,
        }

    # If no social account is linked with this google_sub, check if an account exists with the verified email
    existing_user = User.objects.filter(email=email).first()

    if existing_user:
        # Scenario C: Existing local account with matching email
        # If the local account is not verified, do not link automatically
        if not existing_user.email_verified_at:
            raise AuthenticationFailed(
                "An account with this email already exists but is not verified. "
                "Please verify your email before signing in with Google."
            )

        # Scenario D: Check if this local account is already linked to a different Google account
        if SocialAccount.objects.filter(
            user=existing_user,
            provider=SocialAccount.Provider.GOOGLE,
        ).exists():
            raise AuthenticationFailed(
                "This account is already linked to a different Google account."
            )

        # Link the Google account to the existing verified local user
        try:
            with transaction.atomic():
                SocialAccount.objects.create(
                    user=existing_user,
                    provider=SocialAccount.Provider.GOOGLE,
                    provider_user_id=google_sub,
                )

                # Enrich missing name or profile image if not already set
                if not existing_user.first_name and first_name:
                    existing_user.first_name = first_name
                    existing_user.save(update_fields=["first_name"])
                if not existing_user.last_name and last_name:
                    existing_user.last_name = last_name
                    existing_user.save(update_fields=["last_name"])

                if hasattr(existing_user, "profile") and existing_user.profile:
                    if not existing_user.profile.profile_image and picture:
                        existing_user.profile.profile_image = picture
                        existing_user.profile.save(update_fields=["profile_image"])
                else:
                    UserProfile.objects.create(
                        user=existing_user,
                        profile_image=picture or None,
                    )
        except IntegrityError:
            # Handle potential race condition if concurrent request linked it
            social_account = SocialAccount.objects.filter(
                provider=SocialAccount.Provider.GOOGLE,
                provider_user_id=google_sub,
            ).first()
            if not social_account or social_account.user_id != existing_user.id:
                raise AuthenticationFailed("This Google account is already linked to another user.")

        if not existing_user.is_active:
            raise AuthenticationFailed("User account is inactive. Please contact support.")

        refresh = RefreshToken.for_user(existing_user)
        return {
            "user": existing_user,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "is_new_user": False,
        }

    # Scenario A: New Google user registration
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=None,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_tenant=True,
                is_owner=False,
                is_platform_admin=False,
                email_verified_at=timezone.now(),
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])

            UserProfile.objects.create(
                user=user,
                profile_image=picture or None,
            )

            SocialAccount.objects.create(
                user=user,
                provider=SocialAccount.Provider.GOOGLE,
                provider_user_id=google_sub,
            )
    except IntegrityError as exc:
        # Handle concurrent registration attempt
        user = User.objects.filter(email=email).first()
        if user:
            social_account = SocialAccount.objects.filter(
                provider=SocialAccount.Provider.GOOGLE,
                provider_user_id=google_sub,
            ).first()
            if social_account and social_account.user_id == user.id:
                refresh = RefreshToken.for_user(user)
                return {
                    "user": user,
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "is_new_user": False,
                }
        logger.error("Failed to register new Google user due to IntegrityError: %s", exc)
        raise AuthenticationFailed("Failed to create user account. Please try again.") from exc

    refresh = RefreshToken.for_user(user)
    return {
        "user": user,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "is_new_user": True,
    }
