from django.core.exceptions import ObjectDoesNotExist
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.leasing.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
)


class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationStatusHistory
        fields = [
            "id",
            "previous_status",
            "new_status",
            "changed_by",
            "changed_by_name",
            "change_reason",
            "created_at",
        ]
        read_only_fields = fields

    def get_changed_by_name(self, obj) -> str | None:
        if not obj.changed_by:
            return None

        return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip()


class ApplicationListSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(
        source="listing.title",
        read_only=True,
    )
    property_id = serializers.UUIDField(
        source="listing.property_id",
        read_only=True,
    )
    property_title = serializers.CharField(
        source="listing.property.title",
        read_only=True,
    )
    property_image_url = serializers.SerializerMethodField()
    applicant_name = serializers.SerializerMethodField()
    tenancy_id = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id",
            "listing",
            "listing_title",
            "property_id",
            "property_title",
            "property_image_url",
            "applicant",
            "applicant_name",
            "status",
            "message",
            "tenancy_id",
            "reviewed_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_property_image_url(self, obj) -> str | None:
        images = list(obj.listing.property.images.all())
        if not images:
            return None
        primary = next((img for img in images if img.is_primary), images[0])
        image_url = primary.image_url
        if not image_url:
            return None
        request = self.context.get("request")
        if request and image_url.startswith("/"):
            return request.build_absolute_uri(image_url)
        return image_url

    def get_applicant_name(self, obj) -> str:
        full_name = f"{obj.applicant.first_name} {obj.applicant.last_name}".strip()
        return full_name or obj.applicant.email

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_tenancy_id(self, obj) -> str | None:
        try:
            return str(obj.tenancy.id)
        except ObjectDoesNotExist:
            return None


class ApplicationDetailSerializer(ApplicationListSerializer):
    status_history = ApplicationStatusHistorySerializer(
        many=True,
        read_only=True,
    )

    class Meta(ApplicationListSerializer.Meta):
        fields = ApplicationListSerializer.Meta.fields + [
            "reviewed_by",
            "updated_at",
            "status_history",
        ]


class ApplicationCreateSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    message = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class ApplicationReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            ApplicationStatus.UNDER_REVIEW,
            ApplicationStatus.APPROVED,
            ApplicationStatus.REJECTED,
        ]
    )
    change_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class ApplicationWithdrawSerializer(serializers.Serializer):
    change_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )