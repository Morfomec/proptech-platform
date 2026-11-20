from decimal import Decimal
from rest_framework import serializers

from apps.rent.models import Payment, PaymentAllocation, PaymentMethod, PaymentStatus


class PaymentAllocationSerializer(serializers.ModelSerializer):
    """Serializer for PaymentAllocation details linked to a payment."""

    rent_charge_id = serializers.UUIDField(source="rent_charge.id", read_only=True)
    charge_type = serializers.CharField(source="rent_charge.charge_type", read_only=True)
    billing_period_start = serializers.DateField(source="rent_charge.billing_period_start", read_only=True)
    billing_period_end = serializers.DateField(source="rent_charge.billing_period_end", read_only=True)
    allocated_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    allocated_at = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = PaymentAllocation
        fields = [
            "id",
            "rent_charge",
            "rent_charge_id",
            "charge_type",
            "billing_period_start",
            "billing_period_end",
            "allocated_amount",
            "allocated_at",
            "created_at",
        ]
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for Payment retrieval."""

    property_title = serializers.CharField(source="tenancy.property.title", read_only=True)
    tenant_name = serializers.SerializerMethodField()
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    payment_type = serializers.SerializerMethodField()
    payment_type_display = serializers.SerializerMethodField()
    allocations = PaymentAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "tenancy",
            "property_title",
            "tenant_name",
            "amount",
            "currency",
            "payment_type",
            "payment_type_display",
            "payment_method",
            "payment_method_display",
            "transaction_reference",
            "status",
            "paid_at",
            "notes",
            "allocations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_tenant_name(self, obj) -> str:
        tenant = obj.tenancy.tenant
        name = f"{tenant.first_name} {tenant.last_name}".strip()
        return name or tenant.email

    def get_payment_type(self, obj) -> str:
        if (obj.notes and "[Security Deposit]" in obj.notes) or obj.allocations.filter(
            rent_charge__charge_type="security_deposit"
        ).exists():
            return "security_deposit"
        return "rent"

    def get_payment_type_display(self, obj) -> str:
        return "Security Deposit" if self.get_payment_type(obj) == "security_deposit" else "Rent"


class RecordPaymentRequestSerializer(serializers.Serializer):
    """Serializer for manual payment creation payload."""

    tenancy_id = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.CharField(max_length=3, default="INR", required=False)
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    transaction_reference = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    status = serializers.ChoiceField(choices=PaymentStatus.choices, default=PaymentStatus.COMPLETED, required=False)
    paid_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    target_charge_type = serializers.ChoiceField(
        choices=["rent", "security_deposit"],
        default="rent",
        required=False,
    )
    rent_charge_id = serializers.UUIDField(required=False, allow_null=True)
