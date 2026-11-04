from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import ProfileSerializer
from apps.accounts.services import update_user_profile


class ProfileView(APIView):
    """
    Retrieve and update profile information for the authenticated user.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ProfileSerializer

    @extend_schema(
        responses={
            200: inline_serializer(
                name="ProfileRetrieveResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": ProfileSerializer(),
                },
            ),
            401: inline_serializer(
                name="ProfileUnauthorizedResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "errors": serializers.JSONField(allow_null=True),
                },
            ),
        },
    )
    def get(self, request):
        serializer = ProfileSerializer(request.user)

        return Response(
            {
                "success": True,
                "message": "Profile retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        request=ProfileSerializer,
        responses={
            200: inline_serializer(
                name="ProfileUpdateResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "data": ProfileSerializer(),
                },
            ),
            400: inline_serializer(
                name="ProfileValidationErrorResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "errors": serializers.JSONField(allow_null=True),
                },
            ),
            401: inline_serializer(
                name="ProfileUpdateUnauthorizedResponse",
                fields={
                    "success": serializers.BooleanField(),
                    "message": serializers.CharField(),
                    "errors": serializers.JSONField(allow_null=True),
                },
            ),
        },
    )
    def patch(self, request):
        serializer = ProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)

        user = update_user_profile(
            user=request.user,
            validated_data=serializer.validated_data,
        )

        response_serializer = ProfileSerializer(user)

        return Response(
            {
                "success": True,
                "message": "Profile updated successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )