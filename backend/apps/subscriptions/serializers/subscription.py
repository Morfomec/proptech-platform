from rest_framework import serializers

from apps.subscriptions.models import (
    Subscription,
    SubscriptionPayment,
    SubscriptionPlan,
)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Serializer for public and owner viewing of available subscription plan tiers."""

    is_custom_pricing = serializers.BooleanField(read_only=True)
    is_unlimited_properties = serializers.BooleanField(read_only=True)

    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "name",
            "code",
            "min_properties",
            "max_properties",
            "monthly_price",
            "currency",
            "trial_duration_months",
            "is_active",
            "is_custom_pricing",
            "is_unlimited_properties",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    """Serializer for subscription payment history."""

    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_code = serializers.CharField(source="plan.code", read_only=True)

    class Meta:
        model = SubscriptionPayment
        fields = [
            "id",
            "subscription",
            "plan",
            "plan_name",
            "plan_code",
            "amount",
            "currency",
            "payment_method",
            "transaction_reference",
            "status",
            "billing_period_start",
            "billing_period_end",
            "paid_at",
            "created_at",
        ]
        read_only_fields = fields


class SubscriptionDetailSerializer(serializers.ModelSerializer):
    """Serializer for owner subscription status, dates, and nested plan details."""

    plan = SubscriptionPlanSerializer(read_only=True)
    owner_id = serializers.UUIDField(source="owner.id", read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    is_entitled_to_quota = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "owner_id",
            "owner_email",
            "plan",
            "status",
            "trial_started_at",
            "trial_ends_at",
            "current_period_start",
            "current_period_end",
            "started_at",
            "cancelled_at",
            "is_entitled_to_quota",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class QuotaUtilizationSerializer(serializers.Serializer):
    """Serializer for property quota usage and subscription limits."""

    properties_count = serializers.IntegerField()
    max_properties = serializers.IntegerField(allow_null=True)
    min_properties = serializers.IntegerField()
    remaining_quota = serializers.IntegerField(allow_null=True)
    is_quota_exceeded = serializers.BooleanField()
    is_entitled = serializers.BooleanField()
    plan = SubscriptionPlanSerializer()


class UpgradeSubscriptionRequestSerializer(serializers.Serializer):
    """Payload for upgrading/changing subscription plan tier."""

    plan_code = serializers.CharField(max_length=30)

