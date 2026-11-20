from rest_framework import serializers


class RentSummarySerializer(serializers.Serializer):
    """Serializer for portfolio-level financial summary metrics."""

    total_billed = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_collected = serializers.DecimalField(max_digits=14, decimal_places=2)
    rent_collected_this_month = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")
    outstanding_rent = serializers.DecimalField(max_digits=14, decimal_places=2)
    rent_pending = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")
    overdue_rent = serializers.DecimalField(max_digits=14, decimal_places=2)
    upcoming_rent = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")
    total_active_rent_charges = serializers.IntegerField()
    currency = serializers.CharField(default="INR")

    # Security deposit aggregates
    security_deposits_held = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")
    pending_deposit_collection = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")
    total_deposits_agreed = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")
    total_deposits_received = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")
    total_deposits_outstanding = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")
    total_deposits_refunded = serializers.DecimalField(max_digits=14, decimal_places=2, default="0.00")


class SecurityDepositItemSerializer(serializers.Serializer):
    """Serializer for per-tenancy security deposit breakdown."""

    tenancy_id = serializers.UUIDField()
    property_id = serializers.UUIDField()
    property_title = serializers.CharField()
    tenant_id = serializers.UUIDField()
    tenant_name = serializers.CharField()
    tenant_email = serializers.EmailField()
    agreed_deposit = serializers.DecimalField(max_digits=12, decimal_places=2)
    deposit_received = serializers.DecimalField(max_digits=12, decimal_places=2)
    outstanding_deposit = serializers.DecimalField(max_digits=12, decimal_places=2)
    adjustments = serializers.DecimalField(max_digits=12, decimal_places=2)
    refunds = serializers.DecimalField(max_digits=12, decimal_places=2)
    deposit_held = serializers.DecimalField(max_digits=12, decimal_places=2)
    status = serializers.CharField()
    status_display = serializers.CharField()
    due_date = serializers.DateField(allow_null=True)
    charge_id = serializers.UUIDField(allow_null=True)


class FinancialTransactionSerializer(serializers.Serializer):
    """Serializer for unified chronological financial transactions (payments and refunds)."""

    id = serializers.UUIDField()
    transaction_type = serializers.CharField()
    transaction_type_display = serializers.CharField()
    tenancy_id = serializers.UUIDField()
    property_id = serializers.UUIDField()
    property_title = serializers.CharField()
    tenant_id = serializers.UUIDField()
    tenant_name = serializers.CharField()
    tenant_email = serializers.EmailField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(default="INR")
    payment_method = serializers.CharField()
    payment_method_display = serializers.CharField()
    transaction_reference = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    date = serializers.DateTimeField()
    status = serializers.CharField()
    status_display = serializers.CharField()
    notes = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    payment_id = serializers.UUIDField(allow_null=True, required=False)



