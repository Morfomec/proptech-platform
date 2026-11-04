from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


def refresh_token(*, refresh):
    """
    Validate raw refresh token, verify user is active and email verified,
    rotate the refresh token, blacklist the old token, and return new tokens.
    """
    try:
        token = RefreshToken(refresh)
    except TokenError:
        raise AuthenticationFailed("Token is invalid or expired.")

    user_id = token.payload.get(api_settings.USER_ID_CLAIM)
    if not user_id:
        raise AuthenticationFailed("Token is invalid or expired.")

    try:
        user = User.objects.get(**{api_settings.USER_ID_FIELD: user_id})
    except (User.DoesNotExist, ValueError, TypeError):
        raise AuthenticationFailed("User not found.")

    if not user.is_active:
        raise AuthenticationFailed("User account is inactive.")

    if not user.email_verified_at:
        raise AuthenticationFailed("User account is not verified.")

    # Blacklist the current refresh token prior to rotation
    if api_settings.BLACKLIST_AFTER_ROTATION:
        try:
            token.blacklist()
        except AttributeError:
            pass

    # Rotate the refresh token by setting new JTI, expiration, issued-at, and outstanding record
    if api_settings.ROTATE_REFRESH_TOKENS:
        token.set_jti()
        token.set_exp()
        token.set_iat()
        token.outstand()

    return {
        "access": str(token.access_token),
        "refresh": str(token),
    }


# Convenient alias
refresh_access_token = refresh_token
