from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        error_messages={
            "required": "This field is required.",
            "blank": "This field cannot be blank.",
            "invalid": "Enter a valid email address.",
        },
    )

    def validate_email(self, value):
        return value.strip().lower()

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


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.UUIDField(
        required=True,
        error_messages={
            "required": "This field is required.",
            "invalid": "Must be a valid UUID.",
        },
    )
    token = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        error_messages={
            "required": "This field is required.",
            "blank": "This field cannot be blank.",
        },
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        min_length=8,
        trim_whitespace=False,
        error_messages={
            "required": "This field is required.",
            "blank": "This field cannot be blank.",
        },
    )
    confirm_password = serializers.CharField(
        required=True,
        write_only=True,
        trim_whitespace=False,
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

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({
                "confirm_password": ["Passwords do not match."]
            })

        User = get_user_model()
        user = User.objects.filter(pk=attrs.get("uid")).first()

        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({
                "new_password": list(exc.messages)
            })

        return attrs
