from rest_framework import serializers

from apps.properties.models import PropertyImage


class PropertyImageSerializer(serializers.ModelSerializer):
    """
    Serializer for Property photo gallery assets.
    """
    id = serializers.UUIDField(read_only=True)
    property_id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = PropertyImage
        fields = [
            "id",
            "property_id",
            "image_url",
            "caption",
            "display_order",
            "is_primary",
            "created_at",
        ]

    def validate_image_url(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Image URL cannot be blank.")
        return str(value).strip()

