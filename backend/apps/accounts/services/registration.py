from django.db import IntegrityError, transaction

from apps.accounts.models import User, UserProfile
from apps.accounts.services.email_verification import (
    generate_verification_token,
    send_verification_email,
)


class DuplicateEmailError(Exception):
    """Raised when registering an account with an already registered email."""
    pass


@transaction.atomic
def register_user(
    *,
    email,
    password,
    first_name="",
    last_name="",
    is_tenant=True,
    is_owner=False,
):
    """
    Register a new user account in an inactive state, create a linked profile,
    generate an email verification token, and dispatch a verification email.
    """
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_active=False,
                is_tenant=is_tenant,
                is_owner=is_owner,
                is_platform_admin=False,
                email_verified_at=None,
            )
    except IntegrityError as exc:
        raise DuplicateEmailError(
            "An account with this email already exists."
        ) from exc

    UserProfile.objects.create(user=user)

    raw_token = generate_verification_token(user)

    transaction.on_commit(lambda: send_verification_email(user, raw_token))

    return user
