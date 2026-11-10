from rest_framework import serializers

from apps.properties.models import Amenity, AmenityCategory


class AmenitySerializer(serializers.ModelSerializer):
    """
    Serializer for the global Amenities catalogue.
    """
    id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Amenity
        fields = [
            "id",
            "name",
            "category",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]


class PropertyAmenitySummarySerializer(serializers.ModelSerializer):
    """
    Lightweight amenity representation embedded in property detail views.
    """
    class Meta:
        model = Amenity
        fields = [
            "id",
            "name",
            "category",
            "description",
        ]

