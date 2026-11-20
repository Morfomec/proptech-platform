
from rest_framework import serializers

from apps.notifications.models import Notification, RelatedObjectType


class NotificationSerializer(serializers.ModelSerializer):
    property_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "related_object_type",
            "related_object_id",
            "property_id",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_property_id(self, obj) -> str | None:
        if obj.related_object_type == RelatedObjectType.LISTING and obj.related_object_id:
            from apps.listings.models import Listing

            try:
                prop_id = (
                    Listing.objects.values_list("property_id", flat=True)
                    .filter(pk=obj.related_object_id)
                    .first()
                )
                return str(prop_id) if prop_id else None
            except Exception:
                return None
        return None


class NotificationFilterSerializer(serializers.Serializer):
    is_read = serializers.BooleanField(required=False, allow_null=True)
