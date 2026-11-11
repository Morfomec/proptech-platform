from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.schemas import ApiErrorResponseSerializer, success_envelope
from apps.accounts.serializers.change_password import ChangePasswordSerializer
from apps.accounts.serializers.registration import RegistrationSerializer
from apps.accounts.services.email_verification import verify_email_token
from apps.accounts.serializers.resend_email_verification import ResendEmailVerificationSerializer
from apps.accounts.services.resend_email_verification import resend_email_verification
from apps.accounts.serializers.login import LoginSerializer
from apps.accounts.serializers.google_auth import GoogleAuthSerializer
from apps.accounts.serializers.refresh_token import RefreshTokenSerializer
from apps.accounts.serializers.logout import LogoutSerializer
from apps.accounts.serializers.password_reset import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)
from apps.accounts.services.authentication import authenticate_user
from apps.accounts.services.google_auth import authenticate_google_user
from apps.accounts.services.change_password import change_password
from apps.accounts.services.refresh_token import refresh_token
from apps.accounts.services.logout import logout_user
from apps.accounts.services.password_reset import (
    confirm_password_reset,
    request_password_reset,
)




class RegistrationView(APIView):
    """
    Register a new user account and dispatch verification email.
    """

    permission_classes = [AllowAny]
    serializer_class = RegistrationSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "registration"

    @extend_schema(
        tags=["Authentication"],
        summary="Register a new user account",
        request=RegistrationSerializer,
        responses={
            201: inline_serializer(
                name="RegistrationResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": inline_serializer(
                        name="RegistrationData",
                        fields={
                            "id": serializers.UUIDField(),
                            "email": serializers.EmailField(),
                        },
                    ),
                },
            ),
            400: ApiErrorResponseSerializer,
            429: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        return Response(
            {
                "success": True,
                "message": (
                    "User registered successfully. "
                    "Please check your email to verify your account."
                ),
                "data": {
                    "id": str(user.id),
                    "email": user.email,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    """
    Verify user email using the verification token and activate account.

    Frontend Contract:
    The user arrives at the frontend landing page via the email link:
    `{FRONTEND_URL}/verify-email?uid=<UUID>&token=<TOKEN>`.
    The frontend page extracts `uid` and `token` and performs an HTTP POST
    to this endpoint with `{"user_id": uid, "token": token}`.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_verification"

    @extend_schema(
        tags=["Authentication"],
        summary="Verify user email address",
        request=inline_serializer(
            name="VerifyEmailRequest",
            fields={
                "user_id": serializers.UUIDField(),
                "token": serializers.CharField(),
            },
        ),
        responses={
            200: inline_serializer(
                name="VerifyEmailResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": inline_serializer(
                        name="VerifyEmailData",
                        fields={
                            "id": serializers.UUIDField(),
                            "email": serializers.EmailField(),
                            "is_active": serializers.BooleanField(),
                        },
                    ),
                },
            ),
            400: ApiErrorResponseSerializer,
            429: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        user_id = request.data.get("user_id") or request.query_params.get("uid")
        token = request.data.get("token") or request.query_params.get("token")

        if not user_id or not token:
            return Response(
                {
                    "success": False,
                    "message": "Both user_id and token are required.",
                    "errors": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = verify_email_token(user_id=user_id, raw_token=token)

        if not user:
            return Response(
                {
                    "success": False,
                    "message": "Invalid or expired verification token.",
                    "errors": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": "Email verified successfully.",
                "data": {
                    "id": str(user.id),
                    "email": user.email,
                    "is_active": user.is_active,
                },
            },
            status=status.HTTP_200_OK,
        )

class ResendEmailVerificationView(APIView):

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resend_email_verification"

    @extend_schema(
        tags=["Authentication"],
        summary="Resend email verification link",
        request=ResendEmailVerificationSerializer,
        responses={
            200: success_envelope("ResendVerificationResponse"),
            400: ApiErrorResponseSerializer,
            429: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = ResendEmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resend_email_verification(
            email=serializer.validated_data["email"]
        )

        return Response(
            {
                "success": True,
                "message": (
                    "If an eligible account exists, "
                    "a verification email will be sent."
                ),
                "data": None,
            },
            status=status.HTTP_200_OK,
        )



class LoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(
        tags=["Authentication"],
        summary="Authenticate with email and password",
        request=LoginSerializer,
        responses={
            200: inline_serializer(
                name="LoginResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": inline_serializer(
                        name="LoginData",
                        fields={
                            "access": serializers.CharField(),
                            "refresh": serializers.CharField(),
                            "user": inline_serializer(
                                name="LoginUserData",
                                fields={
                                    "id": serializers.UUIDField(),
                                    "email": serializers.EmailField(),
                                    "first_name": serializers.CharField(),
                                    "last_name": serializers.CharField(),
                                    "is_tenant": serializers.BooleanField(),
                                    "is_owner": serializers.BooleanField(),
                                    "is_platform_admin": serializers.BooleanField(),
                                },
                            ),
                        },
                    ),
                },
            ),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            429: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = authenticate_user(**serializer.validated_data)
        user = result["user"]

        return Response(
            {
                "success": True,
                "message": "Login successful.",
                "data": {
                    "access": result["access"],
                    "refresh": result["refresh"],
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "is_tenant": user.is_tenant,
                        "is_owner": user.is_owner,
                        "is_platform_admin": user.is_platform_admin,
                    },
                },
            },
            status=status.HTTP_200_OK,
        )


class GoogleAuthView(APIView):
    """
    Authenticate or register a user using Google Identity Services ID token.
    Public endpoint: POST /api/v1/auth/google/
    """

    permission_classes = [AllowAny]
    serializer_class = GoogleAuthSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "google_auth"

    @extend_schema(
        tags=["Authentication"],
        summary="Authenticate with Google ID token",
        request=GoogleAuthSerializer,
        responses={
            200: inline_serializer(
                name="GoogleAuthResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": inline_serializer(
                        name="GoogleAuthData",
                        fields={
                            "access": serializers.CharField(),
                            "refresh": serializers.CharField(),
                            "user": inline_serializer(
                                name="GoogleAuthUserData",
                                fields={
                                    "id": serializers.UUIDField(),
                                    "email": serializers.EmailField(),
                                    "first_name": serializers.CharField(),
                                    "last_name": serializers.CharField(),
                                    "is_tenant": serializers.BooleanField(),
                                    "is_owner": serializers.BooleanField(),
                                    "is_platform_admin": serializers.BooleanField(),
                                },
                            ),
                        },
                    ),
                },
            ),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            429: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = authenticate_google_user(credential=serializer.validated_data["credential"])
        user = result["user"]

        return Response(
            {
                "success": True,
                "message": "Google authentication successful.",
                "data": {
                    "access": result["access"],
                    "refresh": result["refresh"],
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "is_tenant": user.is_tenant,
                        "is_owner": user.is_owner,
                        "is_platform_admin": user.is_platform_admin,
                    },
                },
            },
            status=status.HTTP_200_OK,
        )


class RefreshTokenView(APIView):
    """
    Refresh JWT access and refresh tokens with token rotation.
    """

    permission_classes = [AllowAny]
    serializer_class = RefreshTokenSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "token_refresh"

    @extend_schema(
        tags=["Authentication"],
        summary="Refresh JWT access and refresh tokens",
        request=RefreshTokenSerializer,
        responses={
            200: inline_serializer(
                name="RefreshTokenResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": inline_serializer(
                        name="RefreshTokenData",
                        fields={
                            "access": serializers.CharField(),
                            "refresh": serializers.CharField(),
                        },
                    ),
                },
            ),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            429: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        tokens = refresh_token(refresh=serializer.validated_data["refresh"])

        return Response(
            {
                "success": True,
                "message": "Token refreshed successfully.",
                "data": {
                    "access": tokens["access"],
                    "refresh": tokens["refresh"],
                },
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """
    Logout the authenticated user and blacklist the provided refresh token.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = LogoutSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Logout and blacklist refresh token",
        request=LogoutSerializer,
        responses={
            200: success_envelope("LogoutResponse"),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        logout_user(
            user=request.user,
            refresh=serializer.validated_data["refresh"],
        )

        return Response(
            {
                "success": True,
                "message": "Logged out successfully.",
                "data": None,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestView(APIView):
    """
    Request a password reset link.

    Generates a secure, temporary password reset token and dispatches a reset
    email if the account exists, is active, and is verified. Always returns a
    generic success message to prevent user enumeration.
    """

    permission_classes = [AllowAny]
    serializer_class = PasswordResetRequestSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_request"

    @extend_schema(
        tags=["Authentication"],
        summary="Request a password reset link",
        request=PasswordResetRequestSerializer,
        responses={
            200: success_envelope("PasswordResetRequestResponse"),
            400: ApiErrorResponseSerializer,
            429: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        request_password_reset(email=serializer.validated_data["email"])

        return Response(
            {
                "success": True,
                "message": (
                    "If an account exists with this email, "
                    "a password reset link will be sent."
                ),
                "data": None,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    Confirm password reset with user UUID and reset token.

    Validates token, updates user password, deletes the reset token,
    and invalidates all existing refresh tokens.
    """

    permission_classes = [AllowAny]
    serializer_class = PasswordResetConfirmSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"

    @extend_schema(
        tags=["Authentication"],
        summary="Confirm password reset",
        request=PasswordResetConfirmSerializer,
        responses={
            200: success_envelope("PasswordResetConfirmResponse"),
            400: ApiErrorResponseSerializer,
            429: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = confirm_password_reset(
            user_id=serializer.validated_data["uid"],
            raw_token=serializer.validated_data["token"],
            new_password=serializer.validated_data["new_password"],
        )

        if not user:
            return Response(
                {
                    "success": False,
                    "message": "Invalid or expired password reset token.",
                    "errors": None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": "Password has been reset successfully.",
                "data": None,
            },
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(APIView):
    """
    Change password for the authenticated user.

    Verifies the current password, validates the new password against configured
    validators, updates the password, blacklists all outstanding refresh tokens,
    and invalidates any outstanding password reset tokens.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Change authenticated user password",
        request=ChangePasswordSerializer,
        responses={
            200: success_envelope("ChangePasswordResponse"),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
        },
    )
    def post(self, request):
        serializer = self.serializer_class(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        change_password(
            user=request.user,
            current_password=serializer.validated_data["current_password"],
            new_password=serializer.validated_data["new_password"],
        )

        return Response(
            {
                "success": True,
                "message": "Password changed successfully.",
                "data": None,
            },
            status=status.HTTP_200_OK,
        )