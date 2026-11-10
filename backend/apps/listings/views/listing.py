from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsAdmin, IsObjectOwner, IsOwner
from apps.listings.filters import (
    ListingFilterParamsSerializer,
    apply_listing_filters,
)
from apps.listings.models import Listing, ListingStatus
from apps.listings.serializers import (
    ListingCreateSerializer,
    ListingDetailSerializer,
    ListingListSerializer,
    ListingUpdateSerializer,
)
from apps.listings.services import (
    close_listing,
    create_listing,
    pause_listing,
    publish_listing,
    update_listing,
)
from apps.listings.services.exceptions import (
    DuplicateOpenListingError,
    ListingNotFoundError,
    ListingOwnershipError,
    ListingStateError,
    PropertyImageRequiredError,
)
from apps.properties.models import Property


@extend_schema_view(
    list=extend_schema(
        tags=["Listings"],
        summary="List published listings (Public)",
        parameters=[ListingFilterParamsSerializer],
    ),
    retrieve=extend_schema(tags=["Listings"], summary="Get published listing details"),
    create=extend_schema(tags=["Listings"], summary="Create a new listing (Owner)"),
    update=extend_schema(tags=["Listings"], summary="Update listing details (Owner)"),
    partial_update=extend_schema(tags=["Listings"], summary="Partially update listing details (Owner)"),
)
class ListingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing property listings.
    - Public: Browse published listings without authentication.
    - Owner: Create, view, update, publish, pause, and close listings for owned properties.
    - Platform admin: Full supervisory access following project admin conventions.
    """

    http_method_names = ["get", "post", "patch", "put", "head", "options"]
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        if self.action in ["create", "me"]:
            return [IsAuthenticated(), (IsOwner | IsAdmin)()]
        return [IsAuthenticated(), (IsOwner | IsAdmin)(), IsObjectOwner()]

    def get_base_queryset(self):
        return (
            Listing.objects.select_related("property", "property__owner")
            .prefetch_related(
                "property__images",
                "property__amenities",
            )
            .order_by("-created_at")
        )

    def get_queryset(self):
        user = self.request.user

        if self.action == "list":
            # Public feed strictly exposes published listings
            return self.get_base_queryset().filter(status=ListingStatus.PUBLISHED)

        if self.action == "me":
            # Owner feed lists all listings for the requesting owner's properties
            if not user or not user.is_authenticated:
                return Listing.objects.none()
            if getattr(user, "is_platform_admin", False):
                return self.get_base_queryset()
            return self.get_base_queryset().filter(property__owner=user)

        if self.action == "retrieve":
            # Public retrieval is restricted to published listings;
            # Authenticated owners can also retrieve their own non-published listings.
            if not user or not user.is_authenticated:
                return self.get_base_queryset().filter(status=ListingStatus.PUBLISHED)
            if getattr(user, "is_platform_admin", False):
                return self.get_base_queryset()
            return self.get_base_queryset().filter(
                Q(status=ListingStatus.PUBLISHED) | Q(property__owner=user)
            )

        # Mutation actions (update, publish, pause, close) scoped to owner's properties
        if not user or not user.is_authenticated:
            return Listing.objects.none()
        if getattr(user, "is_platform_admin", False):
            return self.get_base_queryset()
        return self.get_base_queryset().filter(property__owner=user)

    def get_serializer_class(self):
        if self.action == "create":
            return ListingCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return ListingUpdateSerializer
        elif self.action in ["list", "me"]:
            return ListingListSerializer
        return ListingDetailSerializer

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_val = self.kwargs[lookup_url_kwarg]

        # Support resolving either by Listing ID or associated Property ID
        obj = queryset.filter(Q(id=lookup_val) | Q(property_id=lookup_val)).first()
        if not obj:
            raise NotFound("Listing not found.")
        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request, *args, **kwargs):
        filter_serializer = ListingFilterParamsSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)

        base_queryset = self.get_base_queryset().filter(status=ListingStatus.PUBLISHED)
        queryset = apply_listing_filters(base_queryset, filter_serializer.validated_data)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "success": True,
                "message": "Listings retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(
            {
                "success": True,
                "message": "Listing details retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request, *args, **kwargs):
        """
        Retrieve all listings belonging to properties owned by the authenticated owner.
        """
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "success": True,
                "message": "Owner listings retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        property_id = serializer.validated_data.pop("property_id")
        publish = serializer.validated_data.pop("publish", False)

        try:
            property_instance = Property.objects.select_related("owner").get(
                pk=property_id,
            )
        except (Property.DoesNotExist, ValueError):
            raise ValidationError({"property_id": "Specified property does not exist."})

        # Strict ownership verification: tenant or cross-owner cannot create listings on this property
        if not (
            getattr(request.user, "is_platform_admin", False)
            or property_instance.owner_id == request.user.id
        ):
            raise PermissionDenied("You can only create listings for properties you own.")

        try:
            listing_instance = create_listing(
                owner=request.user,
                property_instance=property_instance,
                validated_data=serializer.validated_data,
                publish=publish,
            )
        except (PropertyImageRequiredError, DuplicateOpenListingError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            raise ValidationError(msg)
        except ListingOwnershipError as exc:
            raise PermissionDenied(str(exc))
        except (ListingStateError, DjangoValidationError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            raise ValidationError(msg)
        except IntegrityError:
            raise ValidationError(
                {"property": "An active open listing already exists for this property."}
            )

        response_serializer = ListingDetailSerializer(listing_instance)
        return Response(
            {
                "success": True,
                "message": "Listing created successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        try:
            updated_listing = update_listing(
                owner=request.user,
                listing_instance=instance,
                validated_data=serializer.validated_data,
            )
        except ListingOwnershipError as exc:
            raise PermissionDenied(str(exc))
        except (ListingStateError, DjangoValidationError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            raise ValidationError(msg)

        response_serializer = ListingDetailSerializer(updated_listing)
        return Response(
            {
                "success": True,
                "message": "Listing updated successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        """
        Publish a draft or paused listing directly without admin approval.
        """
        instance = self.get_object()
        try:
            listing = publish_listing(
                owner=request.user,
                listing_instance=instance,
            )
        except (PropertyImageRequiredError, DuplicateOpenListingError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            raise ValidationError(msg)
        except ListingOwnershipError as exc:
            raise PermissionDenied(str(exc))
        except (ListingStateError, DjangoValidationError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            raise ValidationError(msg)
        except IntegrityError:
            raise ValidationError(
                {"property": "Another active listing is already open for this property."}
            )

        serializer = ListingDetailSerializer(listing)
        return Response(
            {
                "success": True,
                "message": "Listing published successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        """
        Pause a published listing, removing it from active discovery.
        """
        instance = self.get_object()
        try:
            listing = pause_listing(
                owner=request.user,
                listing_instance=instance,
            )
        except ListingOwnershipError as exc:
            raise PermissionDenied(str(exc))
        except (ListingStateError, DjangoValidationError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            raise ValidationError(msg)

        serializer = ListingDetailSerializer(listing)
        return Response(
            {
                "success": True,
                "message": "Listing paused successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        """
        Close an open listing, releasing the physical property for future listings.
        """
        instance = self.get_object()
        try:
            listing = close_listing(
                owner=request.user,
                listing_instance=instance,
            )
        except ListingOwnershipError as exc:
            raise PermissionDenied(str(exc))
        except (ListingStateError, DjangoValidationError) as exc:
            msg = exc.message_dict if hasattr(exc, "message_dict") else str(exc)
            raise ValidationError(msg)

        serializer = ListingDetailSerializer(listing)
        return Response(
            {
                "success": True,
                "message": "Listing closed successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
