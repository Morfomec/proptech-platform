import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import PasswordResetToken
from apps.accounts.services.token_blacklist import blacklist_user_refresh_tokens
from apps.core.email import EmailService


logger = logging.getLogger(__name__)
User = get_user_model()

TOKEN_EXPIRY_MINUTES = 30


def hash_token(token):
    """Return the SHA-256 hash of a raw password reset token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_password_reset_token(user):
    """
    Generate a cryptographically secure password reset token for the user.

    Replaces any previously issued token for this user, invalidating prior links.
    Returns the raw token string (which must never be persisted in plain text).
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    expires_at = timezone.now() + timedelta(minutes=TOKEN_EXPIRY_MINUTES)

    PasswordResetToken.objects.update_or_create(
        user=user,
        defaults={
            "token_hash": token_hash,
            "expires_at": expires_at,
        },
    )

    return raw_token


def send_password_reset_email(user, raw_token):
    """
    Dispatch a password reset email using the core EmailService.

    Reset URL format:
    {FRONTEND_URL}/reset-password?uid={user_id}&token={raw_token}
    """
    frontend_url = getattr(settings, "FRONTEND_URL", "").strip().rstrip("/")
    if not frontend_url:
        if not getattr(settings, "DEBUG", False):
            raise ImproperlyConfigured(
                "FRONTEND_URL must be explicitly configured in production to send password reset emails."
            )
        frontend_url = "http://localhost:5173"

    reset_url = f"{frontend_url}/reset-password?uid={user.pk}&token={raw_token}"

    context = {
        "first_name": user.first_name,
        "reset_url": reset_url,
    }

    return EmailService.send_email(
        subject="Reset your PropTech Platform password",
        recipients=user.email,
        text_template="emails/password_reset.txt",
        html_template="emails/password_reset.html",
        context=context,
    )


def _safe_send_email(user, raw_token):
    try:
        send_password_reset_email(user, raw_token)
    except Exception:
        logger.exception("Error executing password reset email dispatch for user ID %s", user.id)


def request_password_reset(*, email):
    """
    Process a password reset request.

    Normalizes email, checks account eligibility, creates a reset token record,
    and queues email dispatch after commit. Returns None regardless of whether
    an account exists to prevent email enumeration.
    """
    normalized_email = (email or "").strip().lower()

    user = User.objects.filter(email__iexact=normalized_email).first()

    # Only send reset email if user exists, is active, and has verified email
    if not user or not user.is_active or not user.email_verified_at:
        return None

    with transaction.atomic():
        raw_token = generate_password_reset_token(user)
        transaction.on_commit(lambda: _safe_send_email(user, raw_token))

    return None


@transaction.atomic
def confirm_password_reset(*, user_id, raw_token, new_password):
    """
    Validate the password reset token for the specified user, update password,
    delete the reset token, and blacklist all outstanding refresh tokens.

    Returns the updated user instance on success, or None on failure.
    """
    try:
        token_record = (
            PasswordResetToken.objects
            .select_for_update()
            .select_related("user")
            .get(user_id=user_id)
        )
    except (PasswordResetToken.DoesNotExist, ValueError, TypeError):
        return None

    user = token_record.user

    # Reject if token expired
    if token_record.expires_at <= timezone.now():
        token_record.delete()
        return None

    # Verify token using SHA-256 and constant-time comparison
    supplied_hash = hash_token(raw_token)
    if not hmac.compare_digest(token_record.token_hash, supplied_hash):
        return None

    # Check user eligibility
    if not user or not user.is_active:
        token_record.delete()
        return None

    # Update user password
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])

    # Delete the reset token so it cannot be reused
    token_record.delete()

    # Blacklist all outstanding, unblacklisted refresh tokens for this user
    blacklist_user_refresh_tokens(user)

    return user


