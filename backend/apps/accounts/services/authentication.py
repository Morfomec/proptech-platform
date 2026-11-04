from django.contrib.auth import authenticate
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken


def authenticate_user(*, email, password):
    user = authenticate(
        username=email,
        password=password,
    )

    if not user:
        raise AuthenticationFailed("Invalid email or password.")

    if not user.is_active or not user.email_verified_at:
        raise AuthenticationFailed("Please verify your email before logging in.")

    refresh = RefreshToken.for_user(user)

    return {
        "user": user,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }