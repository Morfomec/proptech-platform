from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .forms import CustomUserChangeForm, CustomUserCreationForm
from .models import SocialAccount, User, UserProfile


@admin.register(User)
class CustomUserAdmin(ModelAdmin, UserAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    model = User

    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "email",
        "first_name",
        "last_name",
        "show_roles",
        "is_active",
        "is_staff",
        "is_superuser",
        "created_at",
    )

    list_filter = (
        "is_tenant",
        "is_owner",
        "is_platform_admin",
        "is_active",
        "is_staff",
        "is_superuser",
        "created_at",
    )

    search_fields = ("email", "first_name", "last_name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            _("Personal information"),
            {"fields": ("first_name", "last_name", "email_verified_at")},
        ),
        (
            _("Capabilities"),
            {
                "fields": (
                    "is_tenant",
                    "is_owner",
                    "is_platform_admin",
                ),
            },
        ),
        (
            _("Permissions"),
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
            _("Important dates"),
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

    @display(description=_("Capabilities"))
    def show_roles(self, obj):
        roles = []
        if obj.is_platform_admin:
            roles.append("Admin")
        if obj.is_owner:
            roles.append("Owner")
        if obj.is_tenant:
            roles.append("Tenant")
        return ", ".join(roles) if roles else "-"


@admin.register(UserProfile)
class UserProfileAdmin(ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = ("user", "phone_number", "created_at", "updated_at")
    list_filter = ("created_at",)
    search_fields = ("user__email", "user__first_name", "user__last_name", "phone_number")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (None, {"fields": ("user", "phone_number", "profile_image", "bio")}),
        (_("Timestamps"), {"fields": ("id", "created_at", "updated_at")}),
    )


@admin.register(SocialAccount)
class SocialAccountAdmin(ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = ("user", "provider", "provider_user_id", "created_at")
    list_filter = ("provider", "created_at")
    search_fields = ("user__email", "provider_user_id")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (None, {"fields": ("user", "provider", "provider_user_id")}),
        (_("Timestamps"), {"fields": ("id", "created_at", "updated_at")}),
    )
