from decimal import Decimal
from rest_framework import serializers

from apps.rent.models import RentCharge, RentChargeStatus, RentChargeType
from apps.rent.services.allocation_service import get_charge_effective_allocated_total


class RentChargeSerializer(serializers.ModelSerializer):
    """
    Serializer for RentCharge retrieval.
    Exposes charge amounts, effective payments, outstanding balances,
    and associated property/tenant identifiers.
    """

    property_id = serializers.UUIDField(source="tenancy.property.id", read_only=True)
    property_title = serializers.CharField(source="tenancy.property.title", read_only=True)
    tenant_id = serializers.UUIDField(source="tenancy.tenant.id", read_only=True)
    tenant_name = serializers.SerializerMethodField()
    charge_type_display = serializers.CharField(source="get_charge_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    paid_amount = serializers.SerializerMethodField()
    outstanding_amount = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = RentCharge
        fields = [
            "id",
            "tenancy",
            "property_id",
            "property_title",
            "tenant_id",
            "tenant_name",
            "charge_type",
            "charge_type_display",
            "billing_period_start",
            "billing_period_end",
            "due_date",
            "amount",
            "paid_amount",
            "outstanding_amount",
            "status",
            "status_display",
            "is_overdue",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_tenant_name(self, obj) -> str:
        tenant = obj.tenancy.tenant
        name = f"{tenant.first_name} {tenant.last_name}".strip()
        return name or tenant.email

    def get_paid_amount(self, obj) -> str:
        if hasattr(obj, "eff_alloc") and obj.eff_alloc is not None:
            val = obj.eff_alloc
        else:
            val = get_charge_effective_allocated_total(rent_charge=obj)
        return str(Decimal(val).quantize(Decimal("0.01")))

    def get_outstanding_amount(self, obj) -> str:
        if obj.status in (RentChargeStatus.WAIVED, RentChargeStatus.CANCELLED):
            return "0.00"
        if hasattr(obj, "charge_outstanding") and obj.charge_outstanding is not None:
            val = obj.charge_outstanding
        else:
            paid = Decimal(self.get_paid_amount(obj))
            val = max(Decimal("0.00"), obj.amount - paid)
        return str(Decimal(val).quantize(Decimal("0.01")))

