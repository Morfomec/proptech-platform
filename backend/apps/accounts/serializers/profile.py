from rest_framework import serializers


class ProfileSerializer(serializers.Serializer):

    # User fields
    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)

    first_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )

    last_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )

    # UserProfile fields
    phone_number = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    bio = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    profile_image = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    # Read-only capability fields
    is_tenant = serializers.BooleanField(read_only=True)
    is_owner = serializers.BooleanField(read_only=True)
    is_platform_admin = serializers.BooleanField(read_only=True)

    email_verified_at = serializers.DateTimeField(read_only=True)

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

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "Provide at least one field to update."
            )

        return attrs

    def to_representation(self, instance):
        profile = getattr(instance, "profile", None)

        return {
            "id": str(instance.id),
            "email": instance.email,
            "first_name": instance.first_name,
            "last_name": instance.last_name,
            "phone_number": profile.phone_number if profile else None,
            "bio": profile.bio if profile else None,
            "profile_image": profile.profile_image if profile else None,
            "is_tenant": instance.is_tenant,
            "is_owner": instance.is_owner,
            "is_platform_admin": instance.is_platform_admin,
            "email_verified_at": self.fields[
                "email_verified_at"
            ].to_representation(instance.email_verified_at),
        }