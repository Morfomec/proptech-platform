from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsAdmin, IsObjectOwner, IsOwner
from apps.properties.models import Property
from apps.properties.serializers import (
    PropertyCreateSerializer,
    PropertyDetailSerializer,
    PropertyImageSerializer,
    PropertyListSerializer,
    PropertyUpdateSerializer,
)
from apps.properties.services import (
    add_property_image,
    create_property,
    delete_property,
    remove_property_image,
    set_primary_image,
    update_property,
)


@extend_schema_view(
    list=extend_schema(tags=["Properties"], summary="List owner properties"),
    retrieve=extend_schema(tags=["Properties"], summary="Get property details"),
    create=extend_schema(tags=["Properties"], summary="Create a new property"),
    update=extend_schema(tags=["Properties"], summary="Update property"),
    partial_update=extend_schema(tags=["Properties"], summary="Partially update property"),
    destroy=extend_schema(tags=["Properties"], summary="Delete property"),
)
class PropertyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing property assets.
    - Any authenticated user can create their first property (activating is_owner=True).
    - Owner management actions (list, retrieve, update, delete, image management)
      are strictly restricted to authenticated users with owner capability.
    - Querysets are scoped to the requesting owner.
    """

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        return [IsAuthenticated(), (IsOwner | IsAdmin)(), IsObjectOwner()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Property.objects.none()

        base_qs = (
            Property.objects.select_related("owner")
            .prefetch_related("images", "amenities")
            .order_by("-created_at")
        )

        if getattr(user, "is_platform_admin", False):
            return base_qs

        return base_qs.filter(owner=user)

    def get_serializer_class(self):
        if self.action == "create":
            return PropertyCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return PropertyUpdateSerializer
        elif self.action == "list":
            return PropertyListSerializer
        return PropertyDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amenity_ids = serializer.validated_data.pop("amenity_ids", None)
        property_instance = create_property(
            owner=request.user,
            validated_data=serializer.validated_data,
            amenity_ids=amenity_ids,
        )

        response_serializer = PropertyDetailSerializer(property_instance)
        return Response(
            {
                "success": True,
                "message": "Property created successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

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
                "message": "Properties retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="me")
    def my_properties(self, request, *args, **kwargs):
        """
        Convenience endpoint to retrieve the authenticated owner's properties.
        """
        return self.list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(
            {
                "success": True,
                "message": "Property details retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        amenity_ids = serializer.validated_data.pop("amenity_ids", None)
        updated_property = update_property(
            property_instance=instance,
            validated_data=serializer.validated_data,
            amenity_ids=amenity_ids,
        )

        response_serializer = PropertyDetailSerializer(updated_property)
        return Response(
            {
                "success": True,
                "message": "Property updated successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        delete_property(property_instance=instance)
        return Response(
            {
                "success": True,
                "message": "Property deleted successfully.",
            },
            status=status.HTTP_200_OK,
        )

    # ============================================================
    # Image Management Endpoints
    # ============================================================
    @action(detail=True, methods=["get", "post"], url_path="images")
    def images(self, request, pk=None):
        """
        GET: List all images for the property.
        POST: Add a new image to the property gallery.
        """
        prop = self.get_object()

        if request.method == "GET":
            images = prop.images.all().order_by("display_order", "-created_at")
            serializer = PropertyImageSerializer(images, many=True)
            return Response(
                {
                    "success": True,
                    "message": "Property images retrieved successfully.",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        serializer = PropertyImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image = add_property_image(
            property_instance=prop,
            image_url=serializer.validated_data["image_url"],
            caption=serializer.validated_data.get("caption"),
            display_order=serializer.validated_data.get("display_order"),
            is_primary=serializer.validated_data.get("is_primary", False),
        )

        return Response(
            {
                "success": True,
                "message": "Property image added successfully.",
                "data": PropertyImageSerializer(image).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path="images/(?P<image_id>[0-9a-f-]+)")
    def delete_image(self, request, pk=None, image_id=None):
        """
        Delete a specific image from the property gallery.
        """
        prop = self.get_object()
        image = prop.images.filter(id=image_id).first()

        if not image:
            return Response(
                {
                    "success": False,
                    "message": "Property image not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        remove_property_image(image_instance=image)
        return Response(
            {
                "success": True,
                "message": "Property image deleted successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post", "patch"], url_path="images/(?P<image_id>[0-9a-f-]+)/primary")
    def set_primary_image(self, request, pk=None, image_id=None):
        """
        Designate a specific image as the primary photo for the property.
        """
        prop = self.get_object()
        image = prop.images.filter(id=image_id).first()

        if not image:
            return Response(
                {
                    "success": False,
                    "message": "Property image not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        updated_image = set_primary_image(property_instance=prop, image_instance=image)
        return Response(
            {
                "success": True,
                "message": "Primary image set successfully.",
                "data": PropertyImageSerializer(updated_image).data,
            },
            status=status.HTTP_200_OK,
        )

