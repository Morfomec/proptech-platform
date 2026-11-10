from rest_framework import serializers


class GoogleAuthSerializer(serializers.Serializer):
    """
    Serializer validating incoming Google Identity Services credential payload.
    """

    credential = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

