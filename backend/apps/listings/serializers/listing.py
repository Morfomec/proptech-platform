from decimal import Decimal
from typing import Optional

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.listings.models import Listing, ListingStatus
from apps.properties.models import Property
from apps.properties.serializers import (
    PropertyAmenitySummarySerializer,
    PropertyImageSerializer,
)

FORBIDDEN_CREATION_FIELDS = {
    "owner",
    "owner_id",
    "reviewed_by",
    "reviewed_by_id",
    "review_status",
    "reviewed_at",
    "rejection_reason",
    "published_at",
    "id",
    "created_at",
    "updated_at",
}

FORBIDDEN_UPDATE_FIELDS = {
    "property",
    "property_id",
    "owner",
    "owner_id",
    "status",
    "review_status",
    "reviewed_by",
    "reviewed_by_id",
    "reviewed_at",
    "rejection_reason",
    "published_at",
    "id",
    "created_at",
    "updated_at",
}


class ListingPropertyListSerializer(serializers.ModelSerializer):
    """
    Compact property snapshot embedded in listing summary and browse feeds.
    Excludes private owner information.
    """
    primary_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            "id",
            "title",
            "category",
            "property_type",
            "address_line_1",
            "locality",
            "city",
            "district",
            "state",
            "pin_code",
            "built_up_area",
            "bedrooms",
            "bathrooms",
            "furnishing_status",
            "parking_spaces",
            "primary_image_url",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_primary_image_url(self, obj) -> Optional[str]:
        primary_image = obj.images.filter(is_primary=True).first()
        if primary_image:
            image_url = primary_image.image_url
        else:
            first_image = obj.images.first()
            image_url = first_image.image_url if first_image else None

        if not image_url:
            return None

        request = self.context.get("request")
        if request and image_url.startswith("/"):
            return request.build_absolute_uri(image_url)
        return image_url


class ListingPropertyDetailSerializer(serializers.ModelSerializer):
    """
    Full property representation embedded in public listing detail and owner detail views.
    Includes gallery and amenities while strictly excluding private owner contact details.
    """
    images = PropertyImageSerializer(many=True, read_only=True)
    amenities = PropertyAmenitySummarySerializer(many=True, read_only=True)
    primary_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            "id",
            "title",
            "description",
            "category",
            "property_type",
            "address_line_1",
            "address_line_2",
            "landmark",
            "locality",
            "city",
            "district",
            "state",
            "pin_code",
            "country_code",
            "latitude",
            "longitude",
            "built_up_area",
            "bedrooms",
            "bathrooms",
            "furnishing_status",
            "parking_spaces",
            "parking_details",
            "status",
            "primary_image_url",
            "images",
            "amenities",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_primary_image_url(self, obj) -> Optional[str]:
        primary_image = obj.images.filter(is_primary=True).first()
        if primary_image:
            image_url = primary_image.image_url
        else:
            first_image = obj.images.first()
            image_url = first_image.image_url if first_image else None

        if not image_url:
            return None

        request = self.context.get("request")
        if request and image_url.startswith("/"):
            return request.build_absolute_uri(image_url)
        return image_url


class ListingListSerializer(serializers.ModelSerializer):
    """
    Compact representation for public browse feed and owner listings feed.
    """
    property_id = serializers.UUIDField(source="property.id", read_only=True)
    property = ListingPropertyListSerializer(read_only=True)

    class Meta:
        model = Listing
        fields = [
            "id",
            "property_id",
            "property",
            "title",
            "monthly_rent",
            "security_deposit",
            "available_from",
            "status",
            "published_at",
            "created_at",
        ]
        read_only_fields = fields


class ListingDetailSerializer(serializers.ModelSerializer):
    """
    Comprehensive listing representation for public detail views and owner management.
    """
    property_id = serializers.UUIDField(source="property.id", read_only=True)
    property = ListingPropertyDetailSerializer(read_only=True)
    owner = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = [
            "id",
            "property_id",
            "property",
            "owner",
            "title",
            "description",
            "monthly_rent",
            "security_deposit",
            "available_from",
            "status",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.DictField())
    def get_owner(self, obj):
        user = getattr(obj.property, "owner", None)
        if not user:
            return None
        name = f"{user.first_name} {user.last_name}".strip()
        profile = getattr(user, "profile", None)
        avatar = None
        if profile and profile.profile_image:
            avatar = profile.profile_image
            request = self.context.get("request")
            if request and avatar.startswith("/"):
                avatar = request.build_absolute_uri(avatar)

        return {
            "id": str(user.id),
            "name": name if name else "Property Owner",
            "avatar_url": avatar,
            "role": "Property Owner",
        }


class ListingCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new property listing.
    Supports draft creation or immediate publication via `publish=True` or `status='published'`.
    Rejects client attempts to specify owner or moderation workflow fields.
    """
    property_id = serializers.UUIDField(required=True, write_only=True)
    publish = serializers.BooleanField(required=False, default=False, write_only=True)
    status = serializers.ChoiceField(
        choices=[ListingStatus.DRAFT, ListingStatus.PUBLISHED],
        required=False,
        write_only=True,
    )

    class Meta:
        model = Listing
        fields = [
            "property_id",
            "title",
            "description",
            "monthly_rent",
            "security_deposit",
            "available_from",
            "publish",
            "status",
        ]

    def to_internal_value(self, data):
        prohibited = set(data.keys()) & FORBIDDEN_CREATION_FIELDS
        if prohibited:
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Attempts to submit protected fields are prohibited: {', '.join(sorted(prohibited))}"
                ]
            })
        return super().to_internal_value(data)

    def validate(self, attrs):
        monthly_rent = attrs.get("monthly_rent")
        if monthly_rent is not None and monthly_rent < Decimal("0.00"):
            raise serializers.ValidationError(
                {"monthly_rent": "Monthly rent must be greater than or equal to zero."}
            )

        security_deposit = attrs.get("security_deposit")
        if security_deposit is not None and security_deposit < Decimal("0.00"):
            raise serializers.ValidationError(
                {"security_deposit": "Security deposit must be greater than or equal to zero."}
            )

        status_val = attrs.get("status")
        if status_val == ListingStatus.PUBLISHED:
            attrs["publish"] = True

        return attrs


class ListingUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating an existing listing.
    Restricts mutations strictly to editable attributes (title, description,
    monthly_rent, security_deposit, available_from). Rejects attempts to alter parent
    property or ownership.
    """

    class Meta:
        model = Listing
        fields = [
            "title",
            "description",
            "monthly_rent",
            "security_deposit",
            "available_from",
        ]
        extra_kwargs = {field: {"required": False} for field in fields}

    def to_internal_value(self, data):
        prohibited = set(data.keys()) & FORBIDDEN_UPDATE_FIELDS
        if prohibited:
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Forbidden fields cannot be updated: {', '.join(sorted(prohibited))}"
                ]
            })
        return super().to_internal_value(data)

    def validate(self, attrs):
        monthly_rent = attrs.get("monthly_rent")
        if monthly_rent is not None and monthly_rent < Decimal("0.00"):
            raise serializers.ValidationError(
                {"monthly_rent": "Monthly rent must be greater than or equal to zero."}
            )

        security_deposit = attrs.get("security_deposit")
        if security_deposit is not None and security_deposit < Decimal("0.00"):
            raise serializers.ValidationError(
                {"security_deposit": "Security deposit must be greater than or equal to zero."}
            )

        return attrs
