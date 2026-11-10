from typing import Any, Dict, Optional

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.listings.models import Listing, ListingStatus, SavedProperty
from apps.listings.serializers.listing import ListingPropertyListSerializer


class SavedPropertyActiveListingSerializer(serializers.ModelSerializer):
    """
    Compact public rental terms embedded in saved property views.
    """
    class Meta:
        model = Listing
        fields = [
            "id",
            "title",
            "monthly_rent",
            "security_deposit",
            "available_from",
            "status",
        ]
        read_only_fields = fields


class SavedPropertyCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a saved property bookmark.
    User identity is strictly derived from request.user; user_id in payload is rejected.
    """
    property_id = serializers.UUIDField(required=True)

    def to_internal_value(self, data):
        prohibited = {"user", "user_id", "id", "created_at"} & set(data.keys())
        if prohibited:
            raise serializers.ValidationError({
                "non_field_errors": [
                    f"Attempts to specify user identity or protected fields are prohibited: {', '.join(sorted(prohibited))}"
                ]
            })
        return super().to_internal_value(data)


class SavedPropertySerializer(serializers.ModelSerializer):
    """
    Representation of a saved property bookmark.
    If the property currently has an active published listing, embeds public property
    and listing details. If the listing was paused, closed, or unpublished, returns a safe
    response with is_available=False without exposing private or unpublished property specs.
    """
    property_id = serializers.UUIDField(source="property.id", read_only=True)
    is_available = serializers.SerializerMethodField()
    property = serializers.SerializerMethodField()
    listing = serializers.SerializerMethodField()

    class Meta:
        model = SavedProperty
        fields = [
            "id",
            "property_id",
            "created_at",
            "is_available",
            "property",
            "listing",
        ]
        read_only_fields = fields

    def _get_active_listing(self, obj):
        # Prefer prefetched active_published_listings to avoid N+1 queries
        if hasattr(obj.property, "active_published_listings"):
            active_list = obj.property.active_published_listings
            return active_list[0] if active_list else None
        return obj.property.listings.filter(status=ListingStatus.PUBLISHED).first()

    @extend_schema_field(serializers.BooleanField())
    def get_is_available(self, obj) -> bool:
        return self._get_active_listing(obj) is not None

    @extend_schema_field(serializers.DictField())
    def get_property(self, obj) -> Dict[str, Any]:
        active_listing = self._get_active_listing(obj)
        if active_listing is not None:
            return ListingPropertyListSerializer(obj.property).data

        return {
            "id": str(obj.property.id),
            "title": obj.property.title,
            "status": "unavailable",
            "is_available": False,
            "message": "This property is currently unavailable.",
        }

    @extend_schema_field(SavedPropertyActiveListingSerializer(allow_null=True))
    def get_listing(self, obj) -> Optional[Dict[str, Any]]:
        active_listing = self._get_active_listing(obj)
        if active_listing is not None:
            return SavedPropertyActiveListingSerializer(active_listing).data
        return None
