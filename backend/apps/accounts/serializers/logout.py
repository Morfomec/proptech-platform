from rest_framework import serializers


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        error_messages={
            "required": "This field is required.",
            "blank": "This field cannot be blank.",
        },
    )

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError({
                "non_field_errors": ["Invalid data. Expected a dictionary."]
            })

        allowed_fields = set(self.fields.keys())
        unexpected_fields = set(data.keys()) - allowed_fields

        if unexpected_fields:
            raise serializers.ValidationError({
                "non_field_errors": [
                    "Unexpected fields: "
                    + ", ".join(sorted(unexpected_fields))
                ]
            })

        return super().to_internal_value(data)
