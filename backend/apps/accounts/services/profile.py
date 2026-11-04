from django.db import transaction

from apps.accounts.models import UserProfile


@transaction.atomic
def update_user_profile(*, user, validated_data):
    """
    Update the authenticated user's account and profile information.
    """

    user_fields = {
        "first_name",
        "last_name",
    }

    profile_fields = {
        "phone_number",
        "bio",
        "profile_image",
    }

    user_data = {
        key: value
        for key, value in validated_data.items()
        if key in user_fields
    }

    profile_data = {
        key: value
        for key, value in validated_data.items()
        if key in profile_fields
    }

    # Update User model
    if user_data:
        for field, value in user_data.items():
            setattr(user, field, value)

        user.save(update_fields=[
            *user_data.keys(),
            "updated_at",
        ])

    # Update UserProfile model
    if profile_data:
        profile, _ = UserProfile.objects.get_or_create(user=user)

        for field, value in profile_data.items():
            setattr(profile, field, value)

        profile.save(update_fields=[
            *profile_data.keys(),
            "updated_at",
        ])

    return user