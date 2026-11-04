from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.accounts.models import PasswordResetToken
from apps.accounts.services.token_blacklist import blacklist_user_refresh_tokens


class InvalidCurrentPasswordError(ValidationError):
    """Raised when the current password does not match the user's password."""

    def __init__(self, detail="Incorrect current password."):
        super().__init__({"current_password": [detail]})


@transaction.atomic
def change_password(*, user, current_password, new_password):
    """
    Verify current password, update to new password, blacklist all outstanding
    refresh tokens, and delete any outstanding password reset tokens for the user.

    Returns the updated user instance on success.
    """
    if not user.check_password(current_password):
        raise InvalidCurrentPasswordError()

    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])

    # Invalidate all outstanding password reset tokens for this user
    PasswordResetToken.objects.filter(user=user).delete()

    # Blacklist all outstanding refresh tokens for this user
    blacklist_user_refresh_tokens(user)

    return user
