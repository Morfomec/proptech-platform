from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.services.registration import register_user


class RegistrationSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )
    password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def to_internal_value(self, data):
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

    def validate_email(self, value):
        email = value.strip().lower()

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return email

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        prospective_user = User(
            email=attrs["email"],
            first_name=attrs["first_name"],
            last_name=attrs["last_name"],
        )

        try:
            validate_password(attrs["password"], user=prospective_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({
                "password": list(exc.messages)
            })

        return attrs

    def create(self, validated_data):
        from django.db import IntegrityError
        from apps.accounts.services.registration import DuplicateEmailError

        data = validated_data.copy()
        data.pop("password_confirm", None)
        try:
            return register_user(**data)
        except (IntegrityError, DuplicateEmailError):
            raise serializers.ValidationError({
                "email": ["An account with this email already exists."]
            })
