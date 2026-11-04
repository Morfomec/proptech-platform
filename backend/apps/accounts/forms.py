from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import User


class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = (
            "email",
            "is_tenant",
            "is_owner",
            "is_platform_admin",
        )


class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"