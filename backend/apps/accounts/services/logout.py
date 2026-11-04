from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken


def logout_user(*, user, refresh):
    """
    Validate the provided refresh token, verify that it belongs to the
    authenticated user, and blacklist it so it cannot be reused.
    """
    try:
        token = RefreshToken(refresh)
    except TokenError:
        raise AuthenticationFailed("Token is invalid or expired.")

    token_user_id = token.payload.get(api_settings.USER_ID_CLAIM)
    if not token_user_id or str(token_user_id) != str(user.id):
        raise AuthenticationFailed("Token does not belong to the authenticated user.")

    try:
        token.blacklist()
    except AttributeError:
        pass


# Convenient alias
logout = logout_user
