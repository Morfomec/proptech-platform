from drf_spectacular.utils import inline_serializer
from rest_framework import serializers


class ApiErrorResponseSerializer(serializers.Serializer):
    """Standard error response envelope emitted across all API endpoints."""

    success = serializers.BooleanField(default=False)
    message = serializers.CharField()
    errors = serializers.JSONField(allow_null=True)


def success_envelope(name: str, data_serializer=None, many: bool = False):
    """Build an OpenAPI inline serializer matching the standard success envelope."""
    if data_serializer is None:
        data_field = serializers.JSONField(allow_null=True)
    elif isinstance(data_serializer, serializers.BaseSerializer) or isinstance(
        data_serializer, serializers.Field
    ):
        data_field = data_serializer
    else:
        data_field = data_serializer(many=many)

    return inline_serializer(
        name=name,
        fields={
            "success": serializers.BooleanField(default=True),
            "message": serializers.CharField(),
            "data": data_field,
        },
    )


def paginated_envelope(name: str, item_serializer):
    """Build an OpenAPI inline serializer matching StandardResultsSetPagination."""
    if isinstance(item_serializer, serializers.BaseSerializer):
        raise TypeError("paginated_envelope expects a serializer class so 'results' and 'data' get distinct instances.")

    return inline_serializer(
        name=name,
        fields={
            "success": serializers.BooleanField(default=True),
            "message": serializers.CharField(),
            "count": serializers.IntegerField(),
            "next": serializers.CharField(allow_null=True),
            "previous": serializers.CharField(allow_null=True),
            "results": item_serializer(many=True),
            "data": item_serializer(many=True),
        },
    )

