from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.schemas import (
    ApiErrorResponseSerializer,
    paginated_envelope,
    success_envelope,
)
from apps.listings.models import SavedProperty
from apps.listings.serializers import (
    SavedPropertyCreateSerializer,
    SavedPropertySerializer,
)
from apps.listings.services import (
    get_saved_properties,
    remove_saved_property,
    save_property,
)
from apps.listings.services.exceptions import PropertyNotDiscoverableError
from apps.properties.models import Property


@extend_schema_view(
    list=extend_schema(
        tags=["Saved Properties"],
        summary="List saved properties for authenticated user",
        responses={
            200: SavedPropertySerializer(many=True),
            401: ApiErrorResponseSerializer,
        },
    ),
    create=extend_schema(
        tags=["Saved Properties"],
        summary="Save/bookmark a property",
        request=SavedPropertyCreateSerializer,
        responses={
            201: success_envelope("SavedPropertyCreateResponse", SavedPropertySerializer),
            200: success_envelope("SavedPropertyAlreadySavedResponse", SavedPropertySerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
        },
    ),
    destroy=extend_schema(
        tags=["Saved Properties"],
        summary="Remove a saved property bookmark",
        responses={
            200: success_envelope("SavedPropertyDeleteResponse"),
            401: ApiErrorResponseSerializer,
        },
    ),
)
class SavedPropertyViewSet(viewsets.GenericViewSet):
    """
    ViewSet for managing user-saved property bookmarks.
    - Requires authentication (available to Tenants, Owners, Admins).
    - Scoped strictly to the requesting user: users can only view and remove their own bookmarks.
    """

    permission_classes = [IsAuthenticated]
    lookup_field = "property_id"
    lookup_url_kwarg = "property_id"
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return SavedProperty.objects.none()
        return get_saved_properties(user=user)

    def get_serializer_class(self):
        if self.action == "create":
            return SavedPropertyCreateSerializer
        return SavedPropertySerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "success": True,
                "message": "Saved properties retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        property_id = serializer.validated_data["property_id"]
        try:
            property_instance = Property.objects.get(pk=property_id)
        except (Property.DoesNotExist, ValueError):
            raise ValidationError({"property_id": "Specified property does not exist."})

        try:
            saved_prop, created = save_property(
                user=request.user,
                property_instance=property_instance,
            )
        except PropertyNotDiscoverableError as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            raise ValidationError(msg)

        response_serializer = SavedPropertySerializer(
            saved_prop,
            context=self.get_serializer_context(),
        )
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        message = "Property saved successfully." if created else "Property is already in your saved list."

        return Response(
            {
                "success": True,
                "message": message,
                "data": response_serializer.data,
            },
            status=status_code,
        )

    def destroy(self, request, property_id=None, *args, **kwargs):
        deleted = remove_saved_property(
            user=request.user,
            property_id=property_id,
        )
        return Response(
            {
                "success": True,
                "message": "Property removed from saved properties." if deleted else "Property was not in saved properties.",
                "data": None,
            },
            status=status.HTTP_200_OK,
        )

