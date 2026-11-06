import re
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.properties.models import (
    COMMERCIAL_TYPES,
    RESIDENTIAL_TYPES,
    FurnishingStatus,
    Property,
    PropertyCategory,
    PropertyStatus,
    PropertyType,
)
from apps.properties.serializers.amenity import PropertyAmenitySummarySerializer
from apps.properties.serializers.image import PropertyImageSerializer

User = get_user_model()

FORBIDDEN_CLIENT_FIELDS = {
    "owner",
    "owner_id",
    "is_owner",
    "is_tenant",
    "is_platform_admin",
}


class PropertyOwnerSummarySerializer(serializers.ModelSerializer):
    """
    Compact read-only owner information embedded in property responses.
    """
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
        ]
        read_only_fields = fields


class BasePropertyValidatorMixin:
    """
    Shared cross-field validation rules enforcing DBML lifecycle and consistency specifications.
    """

    def validate_category_and_type(self, category, property_type):
        if category == PropertyCategory.RESIDENTIAL and property_type not in RESIDENTIAL_TYPES:
            raise serializers.ValidationError(
                {"property_type": f"'{property_type}' is not a valid residential property type."}
            )
        if category == PropertyCategory.COMMERCIAL and property_type not in COMMERCIAL_TYPES:
            raise serializers.ValidationError(
                {"property_type": f"'{property_type}' is not a valid commercial property type."}
            )

    def validate_coordinates(self, latitude, longitude, status):
        has_lat = latitude is not None
        has_lng = longitude is not None

        if has_lat != has_lng:
            raise serializers.ValidationError(
                {"coordinates": "Both latitude and longitude must be provided, or both left blank."}
            )

        if has_lat:
            try:
                lat = Decimal(str(latitude))
                if not (Decimal("-90.0") <= lat <= Decimal("90.0")):
                    raise serializers.ValidationError(
                        {"latitude": "Latitude must be between -90 and 90 degrees."}
                    )
            except Exception:
                raise serializers.ValidationError({"latitude": "Invalid latitude value."})

        if has_lng:
            try:
                lng = Decimal(str(longitude))
                if not (Decimal("-180.0") <= lng <= Decimal("180.0")):
                    raise serializers.ValidationError(
                        {"longitude": "Longitude must be between -180 and 180 degrees."}
                    )
            except Exception:
                raise serializers.ValidationError({"longitude": "Invalid longitude value."})

        if status != PropertyStatus.DRAFT and (not has_lat or not has_lng):
            raise serializers.ValidationError(
                {"coordinates": "Coordinates are required when property is not in draft status."}
            )

    def validate_built_up_area_val(self, built_up_area):
        if built_up_area is not None:
            try:
                area = Decimal(str(built_up_area))
                if area <= Decimal("0"):
                    raise serializers.ValidationError(
                        {"built_up_area": "Built-up area must be greater than zero."}
                    )
            except Exception:
                raise serializers.ValidationError({"built_up_area": "Invalid built-up area."})

    def validate_parking_spaces_val(self, parking_spaces):
        if parking_spaces is not None and parking_spaces < 0:
            raise serializers.ValidationError(
                {"parking_spaces": "Parking spaces cannot be negative."}
            )

    def validate_pin_code_val(self, pin_code, country_code):
        if country_code == "IN" and pin_code:
            clean_pin = str(pin_code).strip()
            if not re.fullmatch(r"^\d{6}$", clean_pin):
                raise serializers.ValidationError(
                    {"pin_code": "Indian PIN code must be a 6-digit number."}
                )

    def validate_physical_specs(self, category, status, bedrooms, bathrooms):
        if category == PropertyCategory.RESIDENTIAL:
            if status != PropertyStatus.DRAFT:
                if bedrooms is None or bedrooms < 0:
                    raise serializers.ValidationError(
                        {"bedrooms": "Bedrooms count is required for residential properties before publishing."}
                    )
                if bathrooms is None or Decimal(str(bathrooms)) < Decimal("0"):
                    raise serializers.ValidationError(
                        {"bathrooms": "Bathrooms count is required for residential properties before publishing."}
                    )
            else:
                if bedrooms is not None and bedrooms < 0:
                    raise serializers.ValidationError(
                        {"bedrooms": "Bedrooms count must be greater than or equal to 0."}
                    )
                if bathrooms is not None and Decimal(str(bathrooms)) < Decimal("0"):
                    raise serializers.ValidationError(
                        {"bathrooms": "Bathrooms count must be greater than or equal to 0."}
                    )


class PropertyCreateSerializer(serializers.ModelSerializer, BasePropertyValidatorMixin):
    """
    Serializer for creating a new property.
    Strictly derives owner from the authenticated user; rejects attempts to specify owner or capability flags.
    Supports draft creation with incomplete specs, but enforces complete specs before publishing.
    """
    amenity_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )

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
            "amenity_ids",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_internal_value(self, data):
        # Reject attempts to submit owner IDs or writable capability flags
        prohibited = set(data.keys()) & FORBIDDEN_CLIENT_FIELDS
        if prohibited:
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Attempts to submit owner IDs or capability flags are prohibited: {', '.join(sorted(prohibited))}"
                ]
            })

        return super().to_internal_value(data)

    def validate(self, attrs):
        category = attrs.get("category")
        property_type = attrs.get("property_type")
        status = attrs.get("status", PropertyStatus.DRAFT)
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")
        built_up_area = attrs.get("built_up_area")
        parking_spaces = attrs.get("parking_spaces")
        pin_code = attrs.get("pin_code")
        country_code = attrs.get("country_code", "IN")
        bedrooms = attrs.get("bedrooms")
        bathrooms = attrs.get("bathrooms")

        self.validate_category_and_type(category, property_type)
        self.validate_coordinates(latitude, longitude, status)
        self.validate_built_up_area_val(built_up_area)
        self.validate_parking_spaces_val(parking_spaces)
        self.validate_pin_code_val(pin_code, country_code)
        self.validate_physical_specs(category, status, bedrooms, bathrooms)

        return attrs


class PropertyUpdateSerializer(serializers.ModelSerializer, BasePropertyValidatorMixin):
    """
    Serializer for updating an existing property.
    Enforces that property ownership cannot be modified.
    """
    amenity_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Property
        fields = [
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
            "amenity_ids",
        ]
        extra_kwargs = {field: {"required": False} for field in fields}

    def to_internal_value(self, data):
        prohibited = set(data.keys()) & FORBIDDEN_CLIENT_FIELDS
        if prohibited:
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Attempts to submit owner IDs or capability flags are prohibited: {', '.join(sorted(prohibited))}"
                ]
            })

        return super().to_internal_value(data)

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        category = attrs.get("category", getattr(instance, "category", None))
        property_type = attrs.get("property_type", getattr(instance, "property_type", None))
        status = attrs.get("status", getattr(instance, "status", PropertyStatus.DRAFT))
        latitude = attrs.get("latitude", getattr(instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(instance, "longitude", None))
        built_up_area = attrs.get("built_up_area", getattr(instance, "built_up_area", None))
        parking_spaces = attrs.get("parking_spaces", getattr(instance, "parking_spaces", None))
        pin_code = attrs.get("pin_code", getattr(instance, "pin_code", None))
        country_code = attrs.get("country_code", getattr(instance, "country_code", "IN"))
        bedrooms = attrs.get("bedrooms", getattr(instance, "bedrooms", None))
        bathrooms = attrs.get("bathrooms", getattr(instance, "bathrooms", None))

        if category and property_type:
            self.validate_category_and_type(category, property_type)

        self.validate_coordinates(latitude, longitude, status)
        self.validate_built_up_area_val(built_up_area)
        self.validate_parking_spaces_val(parking_spaces)
        self.validate_pin_code_val(pin_code, country_code)
        self.validate_physical_specs(category, status, bedrooms, bathrooms)

        return attrs


class PropertyDetailSerializer(serializers.ModelSerializer):
    """
    Detailed representation of a property for management views, including
    nested owner summary, image gallery, and assigned amenities.
    """
    owner = PropertyOwnerSummarySerializer(read_only=True)
    images = PropertyImageSerializer(many=True, read_only=True)
    amenities = PropertyAmenitySummarySerializer(many=True, read_only=True)

    class Meta:
        model = Property
        fields = [
            "id",
            "owner",
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
            "images",
            "amenities",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PropertyListSerializer(serializers.ModelSerializer):
    """
    Compact property representation optimized for owner dashboard cards and portfolio tables.
    """
    primary_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            "id",
            "title",
            "category",
            "property_type",
            "city",
            "locality",
            "status",
            "primary_image_url",
            "created_at",
        ]
        read_only_fields = fields

    def get_primary_image_url(self, obj):
        primary_image = obj.images.filter(is_primary=True).first()
        if primary_image:
            return primary_image.image_url
        first_image = obj.images.first()
        return first_image.image_url if first_image else None

