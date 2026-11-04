from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .forms import CustomUserChangeForm, CustomUserCreationForm
from .models import User, UserProfile, SocialAccount


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    model = User

    ordering = ("email",)

    list_display = (
        "email",
        "first_name",
        "last_name",
        "is_tenant",
        "is_owner",
        "is_platform_admin",
        "is_active",
        "is_staff",
    )

    list_filter = (
        "is_tenant",
        "is_owner",
        "is_platform_admin",
        "is_active",
        "is_staff",
        "is_superuser",
    )

    search_fields = ("email", "first_name", "last_name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Personal information",
            {"fields": ("first_name", "last_name", "email_verified_at")},
        ),
        (
            "Capabilities",
            {
                "fields": (
                    "is_tenant",
                    "is_owner",
                    "is_platform_admin",
                ),
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Important dates",
            {"fields": ("last_login", "created_at", "updated_at")},
        ),
    )

    readonly_fields = ("created_at", "updated_at", "last_login")

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "is_tenant",
                    "is_owner",
                    "is_platform_admin",
                ),
            },
        ),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone_number", "created_at")
    search_fields = ("user__email", "phone_number")


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "provider", "provider_user_id", "created_at")
    list_filter = ("provider",)
    search_fields = ("user__email", "provider_user_id")