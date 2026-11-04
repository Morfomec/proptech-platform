from django.db import transaction

from apps.accounts.models import User
from apps.accounts.services.email_verification import (
    generate_verification_token,
    send_verification_email,
)


@transaction.atomic
def resend_email_verification(email):
    """
    Resend verification email for an eligible account.

    Returns without revealing whether the account exists.
    """

    user = (
        User.objects
        .select_for_update()
        .filter(
            email__iexact=email,
            is_active=False,
            email_verified_at__isnull=True,
        )
        .first()
    )

    if not user:
        return

    raw_token = generate_verification_token(user)

    transaction.on_commit(
        lambda: send_verification_email(user, raw_token)
    )