
from decimal import Decimal

from rest_framework import serializers

from apps.leasing.models import Tenancy, TenancyTermsHistory


def _format_property_address(prop) -> str:
    parts = [prop.address_line_1, prop.locality, prop.city, prop.state]
    return ", ".join(part for part in parts if part)


def _format_user_name(user) -> str:
    full_name = f"{user.first_name} {user.last_name}".strip()
    return full_name or user.email


class TenancyListSerializer(serializers.ModelSerializer):
    property_id = serializers.UUIDField(read_only=True)
    property_title = serializers.CharField(source="property.title", read_only=True)
    property_address = serializers.SerializerMethodField()
    property_image_url = serializers.SerializerMethodField()
    tenant_id = serializers.UUIDField(read_only=True)
    tenant_name = serializers.SerializerMethodField()
    application_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Tenancy
        fields = [
            "id",
            "property_id",
            "property_title",
            "property_address",
            "property_image_url",
            "tenant_id",
            "tenant_name",
            "application_id",
            "start_date",
            "end_date",
            "monthly_rent",
            "security_deposit",
            "status",
            "proposed_at",
            "tenant_responded_at",
            "rejection_reason",
            "created_at",
        ]

    def get_property_address(self, obj) -> str:
        return _format_property_address(obj.property)

    def get_property_image_url(self, obj) -> str | None:
        images = list(obj.property.images.all())
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

    def get_tenant_name(self, obj) -> str:
        return _format_user_name(obj.tenant)


class TenancyTermsHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TenancyTermsHistory
        fields = [
            "id",
            "version",
            "status",
            "responded_at",
            "rejection_reason",
            "proposed_by_id",
            "monthly_rent",
            "security_deposit",
            "start_date",
            "end_date",
            "rent_due_day",
            "notes",
            "created_at",
        ]
        read_only_fields = fields


class TenancyDetailSerializer(TenancyListSerializer):
    tenant_email = serializers.EmailField(source="tenant.email", read_only=True)
    proposed_by_id = serializers.UUIDField(read_only=True)
    terms_history = TenancyTermsHistorySerializer(many=True, read_only=True)

    class Meta(TenancyListSerializer.Meta):
        fields = TenancyListSerializer.Meta.fields + [
            "tenant_email",
            "proposed_by_id",
            "terms_history",
            "rent_due_day",
            "actual_move_in_date",
            "actual_move_out_date",
            "notes",
            "updated_at",
        ]


class TenancyCreateSerializer(serializers.Serializer):
    property_id = serializers.UUIDField()
    tenant_id = serializers.UUIDField()
    application_id = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    start_date = serializers.DateField()
    end_date = serializers.DateField(
        required=False,
        allow_null=True,
    )

    monthly_rent = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
    )

    security_deposit = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        required=False,
        default=Decimal("0.00"),
    )

    rent_due_day = serializers.IntegerField(
        min_value=1,
        max_value=28,
        required=False,
        default=1,
    )

    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate(self, attrs):
        start_date = attrs["start_date"]
        end_date = attrs.get("end_date")

        if end_date and end_date < start_date:
            raise serializers.ValidationError({
                "end_date": "End date cannot be before start date."
            })

        return attrs


class TenancyActivateSerializer(serializers.Serializer):
    move_in_date = serializers.DateField(required=False)


class TenancyDeductionItemSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))


class TenancyEndSerializer(serializers.Serializer):
    move_out_date = serializers.DateField(required=False)
    settle_deposit = serializers.BooleanField(default=False, required=False)
    deductions = TenancyDeductionItemSerializer(many=True, required=False, default=list)
    refund_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    refund_reference = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)


class TenancySettlementPreviewSerializer(serializers.Serializer):
    tenancy_id = serializers.UUIDField()
    agreed_deposit = serializers.DecimalField(max_digits=12, decimal_places=2)
    deposit_received = serializers.DecimalField(max_digits=12, decimal_places=2)
    prior_refunds = serializers.DecimalField(max_digits=12, decimal_places=2)
    deposit_held = serializers.DecimalField(max_digits=12, decimal_places=2)
    max_refundable_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    status = serializers.CharField()


class TenancyProposalResponseSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=1000,
    )


class TenancyUpdateTermsSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False, allow_null=True)
    monthly_rent = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        required=False,
    )
    security_deposit = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        required=False,
    )
    rent_due_day = serializers.IntegerField(
        min_value=1,
        max_value=28,
        required=False,
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                "end_date": "End date cannot be before start date."
            })
        return attrs
