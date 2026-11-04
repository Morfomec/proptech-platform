import hashlib
import secrets
import hmac

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import EmailVerificationToken


TOKEN_EXPIRY_HOURS = 24


def hash_token(token):
    """Return the SHA-256 hash of a verification token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_verification_token(user):
    """
    Generate a new verification token.

    Replaces any previously issued token for this user.
    Returns the raw token for inclusion in the verification email.
    """

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)

    expires_at = timezone.now() + timedelta(
        hours=TOKEN_EXPIRY_HOURS
    )

    EmailVerificationToken.objects.update_or_create(
        user=user,
        defaults={
            "token_hash": token_hash,
            "expires_at": expires_at,
        },
    )

    return raw_token


@transaction.atomic
def verify_email_token(user_id, raw_token):
    """
    Validate a verification token and activate the account.

    Returns the verified user on success, otherwise None.
    """

    try:
        verification = (
            EmailVerificationToken.objects
            .select_for_update()
            .select_related("user")
            .get(user_id=user_id)
        )
    except EmailVerificationToken.DoesNotExist:
        return None

    user = verification.user

    if user.email_verified_at is not None:
        verification.delete()
        return None

    if verification.expires_at <= timezone.now():
        verification.delete()
        return None

    supplied_hash = hash_token(raw_token)

    if not hmac.compare_digest(
        verification.token_hash,
        supplied_hash,
    ):
        return None

    user.email_verified_at = timezone.now()
    user.is_active = True

    user.save(
        update_fields=[
            "email_verified_at",
            "is_active",
            "updated_at",
        ]
    )

    # Delete the token to make it single-use.
    verification.delete()

    return user


def send_verification_email(user, raw_token):
    """
    Dispatch a verification email to the user using the core EmailService.

    Verification Workflow & Architectural Contract:
    -----------------------------------------------
    1. The verification link points to the frontend client landing page:
       `{FRONTEND_URL}/verify-email?uid={uid}&token={token}`
    2. In production (DEBUG=False), FRONTEND_URL must be explicitly configured.
       If unconfigured in production, an ImproperlyConfigured error is raised.
    3. The frontend verification page extracts `uid` and `token` from query params
       and makes an HTTP request to the backend:
       `POST /api/v1/auth/verify-email/` with body `{"user_id": uid, "token": token}`.
    4. Upon validation, the backend activates the user (`is_active=True`),
       sets `email_verified_at`, and invalidates the single-use token.
    """
    from django.conf import settings
    from django.core.exceptions import ImproperlyConfigured
    from apps.core.email import EmailService

    frontend_url = getattr(settings, "FRONTEND_URL", "").strip().rstrip("/")
    if not frontend_url:
        if not getattr(settings, "DEBUG", False):
            raise ImproperlyConfigured(
                "FRONTEND_URL must be explicitly configured in production to send verification emails."
            )
        frontend_url = "http://localhost:5173"

    verification_url = f"{frontend_url}/verify-email?uid={user.pk}&token={raw_token}"

    context = {
        "first_name": user.first_name,
        "verification_url": verification_url,
    }

    return EmailService.send_email(
        subject="Verify your PropTech Platform email",
        recipients=user.email,
        text_template="emails/email_verification.txt",
        html_template="emails/email_verification.html",
        context=context,
    )