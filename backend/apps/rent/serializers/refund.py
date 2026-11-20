from decimal import Decimal
from rest_framework import serializers

from apps.rent.models import (
    PaymentAllocationReversal,
    PaymentRefund,
    PaymentRefundStatus,
)


class PaymentAllocationReversalSerializer(serializers.ModelSerializer):
    """Serializer for reversal audit records."""

    class Meta:
        model = PaymentAllocationReversal
        fields = [
            "id",
            "allocation",
            "rent_charge",
            "reversed_amount",
            "created_at",
        ]
        read_only_fields = fields


class PaymentRefundSerializer(serializers.ModelSerializer):
    """Serializer for PaymentRefund retrieval."""

    allocation_reversals = PaymentAllocationReversalSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentRefund
        fields = [
            "id",
            "payment",
            "amount",
            "currency",
            "reason",
            "status",
            "refund_reference",
            "processed_at",
            "created_by",
            "created_by_name",
            "allocation_reversals",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj) -> str:
        creator = obj.created_by
        name = f"{creator.first_name} {creator.last_name}".strip()
        return name or creator.email


class CreateRefundRequestSerializer(serializers.Serializer):
    """Payload serializer for initiating a partial or full refund."""

    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    reason = serializers.CharField(max_length=255)
    currency = serializers.CharField(max_length=3, default="INR", required=False)
    refund_reference = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
    status = serializers.ChoiceField(
        choices=PaymentRefundStatus.choices,
        default=PaymentRefundStatus.COMPLETED,
        required=False,
    )


class ProcessRefundRequestSerializer(serializers.Serializer):
    """Payload serializer for processing a pending refund."""

    refund_reference = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)

