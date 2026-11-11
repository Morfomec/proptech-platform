
from decimal import Decimal

from rest_framework import serializers

from apps.leasing.models import Tenancy


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
            "tenant_id",
            "tenant_name",
            "application_id",
            "start_date",
            "end_date",
            "monthly_rent",
            "security_deposit",
            "status",
            "created_at",
        ]

    def get_property_address(self, obj) -> str:
        return _format_property_address(obj.property)

    def get_tenant_name(self, obj) -> str:
        return _format_user_name(obj.tenant)


class TenancyDetailSerializer(TenancyListSerializer):
    tenant_email = serializers.EmailField(source="tenant.email", read_only=True)

    class Meta(TenancyListSerializer.Meta):
        fields = TenancyListSerializer.Meta.fields + [
            "tenant_email",
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


class TenancyEndSerializer(serializers.Serializer):
    move_out_date = serializers.DateField(required=False)
