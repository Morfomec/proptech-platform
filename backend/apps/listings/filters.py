from decimal import Decimal
from typing import Any, Dict

from django.db.models import F, Q, QuerySet
from rest_framework import serializers

from apps.properties.models import FurnishingStatus, PropertyCategory, PropertyType

SORT_CHOICES = [
    "newest",
    "rent_low_to_high",
    "rent_high_to_low",
]

SORT_ORDERING_MAP = {
    "newest": [F("published_at").desc(nulls_last=True), "-created_at", "-id"],
    "rent_low_to_high": ["monthly_rent", "-published_at", "-id"],
    "rent_high_to_low": ["-monthly_rent", "-published_at", "-id"],
}


class ListingFilterParamsSerializer(serializers.Serializer):
    """
    Serializer to validate and clean marketplace search, filter, and sort query parameters.
    """
    city = serializers.CharField(required=False, allow_blank=False, max_length=100)
    locality = serializers.CharField(required=False, allow_blank=False, max_length=100)
    category = serializers.ChoiceField(choices=PropertyCategory.choices, required=False)
    property_type = serializers.ChoiceField(choices=PropertyType.choices, required=False)
    min_rent = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
    )
    max_rent = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
    )
    bedrooms = serializers.IntegerField(min_value=0, required=False)
    furnishing_status = serializers.ChoiceField(choices=FurnishingStatus.choices, required=False)
    available_from = serializers.DateField(required=False)
    search = serializers.CharField(required=False, allow_blank=True, max_length=200)
    sort = serializers.ChoiceField(
        choices=SORT_CHOICES,
        required=False,
        default="newest",
    )

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        min_rent = attrs.get("min_rent")
        max_rent = attrs.get("max_rent")
        if min_rent is not None and max_rent is not None and min_rent > max_rent:
            raise serializers.ValidationError(
                {"min_rent": "Minimum rent cannot be greater than maximum rent."}
            )
        return attrs


def apply_listing_filters(queryset: QuerySet, validated_params: Dict[str, Any]) -> QuerySet:
    """
    Apply marketplace search, filtering, and sorting to a published listings queryset.

    - Text filters (city, locality, search) perform case-insensitive matches.
    - Search covers listing title, description, and property location attributes.
    - Sorting guarantees deterministic ordering via tertiary -id tie-breaker.
    """
    # 1. Location filters (case-insensitive)
    city = validated_params.get("city")
    if city:
        queryset = queryset.filter(property__city__icontains=city.strip())

    locality = validated_params.get("locality")
    if locality:
        queryset = queryset.filter(property__locality__icontains=locality.strip())

    # 2. Classification filters
    category = validated_params.get("category")
    if category:
        queryset = queryset.filter(property__category=category)

    property_type = validated_params.get("property_type")
    if property_type:
        queryset = queryset.filter(property__property_type=property_type)

    # 3. Rental budget filters
    min_rent = validated_params.get("min_rent")
    if min_rent is not None:
        queryset = queryset.filter(monthly_rent__gte=min_rent)

    max_rent = validated_params.get("max_rent")
    if max_rent is not None:
        queryset = queryset.filter(monthly_rent__lte=max_rent)

    # 4. Property specification filters
    bedrooms = validated_params.get("bedrooms")
    if bedrooms is not None:
        queryset = queryset.filter(property__bedrooms=bedrooms)

    furnishing_status = validated_params.get("furnishing_status")
    if furnishing_status:
        queryset = queryset.filter(property__furnishing_status=furnishing_status)

    # 5. Availability filter (available on or before the specified date)
    available_from = validated_params.get("available_from")
    if available_from:
        queryset = queryset.filter(available_from__lte=available_from)

    # 6. Text search across listing and property fields
    search = validated_params.get("search")
    if search:
        search_term = search.strip()
        queryset = queryset.filter(
            Q(title__icontains=search_term)
            | Q(description__icontains=search_term)
            | Q(property__title__icontains=search_term)
            | Q(property__description__icontains=search_term)
            | Q(property__city__icontains=search_term)
            | Q(property__locality__icontains=search_term)
            | Q(property__address_line_1__icontains=search_term)
            | Q(property__address_line_2__icontains=search_term)
            | Q(property__landmark__icontains=search_term)
        )

    # 7. Sorting
    sort_key = validated_params.get("sort", "newest")
    ordering = SORT_ORDERING_MAP.get(sort_key, SORT_ORDERING_MAP["newest"])
    queryset = queryset.order_by(*ordering)

    return queryset
