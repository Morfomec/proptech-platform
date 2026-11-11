from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsAdmin, IsNotAdmin, IsObjectOwner, IsOwner
from apps.core.schemas import (
    ApiErrorResponseSerializer,
    paginated_envelope,
    success_envelope,
)
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
    list=extend_schema(
        tags=["Properties"],
        summary="List owner properties",
        responses={
            200: PropertyListSerializer(many=True),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    ),
    retrieve=extend_schema(
        tags=["Properties"],
        summary="Get property details",
        responses={
            200: success_envelope("PropertyDetailResponse", PropertyDetailSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
    create=extend_schema(
        tags=["Properties"],
        summary="Create a new property",
        request=PropertyCreateSerializer,
        responses={
            201: success_envelope("PropertyCreateResponse", PropertyDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
    ),
    update=extend_schema(
        tags=["Properties"],
        summary="Update property",
        request=PropertyUpdateSerializer,
        responses={
            200: success_envelope("PropertyUpdateResponse", PropertyDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
    partial_update=extend_schema(
        tags=["Properties"],
        summary="Partially update property",
        request=PropertyUpdateSerializer,
        responses={
            200: success_envelope("PropertyPartialUpdateResponse", PropertyDetailSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
    destroy=extend_schema(
        tags=["Properties"],
        summary="Delete property",
        responses={
            200: success_envelope("PropertyDeleteResponse"),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
)
class PropertyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing property assets.
    - Any authenticated user can create their first property (activating is_owner=True).
    - Owner management actions (list, retrieve, update, delete, image management)
      are strictly restricted to authenticated users with owner capability.
    - Querysets are scoped to the requesting owner.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsNotAdmin()]

        is_read_action = (
            self.action in ["list", "my_properties", "retrieve"]
            or (self.action == "images" and self.request.method in SAFE_METHODS)
        )
        if is_read_action:
            return [IsAuthenticated(), (IsOwner | IsAdmin)(), IsObjectOwner()]

        return [IsAuthenticated(), IsOwner(), IsNotAdmin(), IsObjectOwner()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Property.objects.none()

        base_qs = (
            Property.objects.select_related("owner")
            .prefetch_related("images", "amenities")
            .order_by("-created_at")
        )

        is_read_action = (
            self.action in ["list", "my_properties", "retrieve"]
            or (self.action == "images" and self.request.method in SAFE_METHODS)
        )
        if is_read_action and getattr(user, "is_platform_admin", False):
            return base_qs

        return base_qs.filter(owner=user)

    def get_serializer_class(self):
        if self.action == "create":
            return PropertyCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return PropertyUpdateSerializer
        elif self.action in ["list", "my_properties"]:
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

        response_serializer = PropertyDetailSerializer(
            property_instance,
            context=self.get_serializer_context(),
        )
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

    @extend_schema(
        tags=["Properties"],
        summary="List authenticated owner's properties",
        responses={
            200: paginated_envelope("PropertyMeListResponse", PropertyListSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
        },
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
            actor=request.user,
        )

        response_serializer = PropertyDetailSerializer(
            updated_property,
            context=self.get_serializer_context(),
        )
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
        delete_property(property_instance=instance, actor=request.user)
        return Response(
            {
                "success": True,
                "message": "Property deleted successfully.",
                "data": None,
            },
            status=status.HTTP_200_OK,
        )

    # ============================================================
    # Image Management Endpoints
    # ============================================================
    @extend_schema(
        methods=["GET"],
        tags=["Properties"],
        summary="List property images",
        responses={
            200: success_envelope("PropertyImageListResponse", PropertyImageSerializer(many=True)),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @extend_schema(
        methods=["POST"],
        tags=["Properties"],
        summary="Add a property image",
        request=PropertyImageSerializer,
        responses={
            201: success_envelope("PropertyImageCreateResponse", PropertyImageSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(
        detail=True,
        methods=["get", "post"],
        url_path="images",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def images(self, request, pk=None):
        """
        GET: List all images for the property.
        POST: Add a new image to the property gallery (accepts binary file or image_url).
        """
        prop = self.get_object()

        if request.method == "GET":
            images = prop.images.all().order_by("display_order", "-created_at")
            serializer = PropertyImageSerializer(
                images,
                many=True,
                context=self.get_serializer_context(),
            )
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
            image_url=serializer.validated_data.get("image_url"),
            file=serializer.validated_data.get("file"),
            caption=serializer.validated_data.get("caption"),
            display_order=serializer.validated_data.get("display_order"),
            is_primary=serializer.validated_data.get("is_primary", False),
        )

        return Response(
            {
                "success": True,
                "message": "Property image added successfully.",
                "data": PropertyImageSerializer(
                    image,
                    context=self.get_serializer_context(),
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["Properties"],
        summary="Delete a property image",
        responses={
            200: success_envelope("PropertyImageDeleteResponse"),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
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
                    "errors": None,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        remove_property_image(image_instance=image)
        return Response(
            {
                "success": True,
                "message": "Property image deleted successfully.",
                "data": None,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Properties"],
        summary="Set primary property image",
        request=None,
        responses={
            200: success_envelope("PropertyPrimaryImageResponse", PropertyImageSerializer),
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
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
                    "errors": None,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        updated_image = set_primary_image(property_instance=prop, image_instance=image)
        return Response(
            {
                "success": True,
                "message": "Primary image set successfully.",
                "data": PropertyImageSerializer(
                    updated_image,
                    context=self.get_serializer_context(),
                ).data,
            },
            status=status.HTTP_200_OK,
        )

