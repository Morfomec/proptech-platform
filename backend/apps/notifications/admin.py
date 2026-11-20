from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin
from unfold.decorators import display

from apps.core.admin import SerialNumberAdminMixin
from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    # 1. S.No. dynamically generated as the first column, full UUID removed from changelist
    # 6. Preserved User, Notification Type, Title, Read Status, Created At columns
    list_display = (
        "serial_number",
        "user",
        "notification_type",
        "title",
        "show_read_status",
        "created_at",
    )

    list_display_links = (
        "serial_number",
        "title",
    )

    list_select_related = ("user",)

    list_filter = (
        "notification_type",
        "is_read",
        "created_at",
    )

    search_fields = (
        "user__email",
        "title",
        "message",
    )

    # 5. Preserved UUID as a read-only field on detail page
    readonly_fields = (
        "id",
        "user",
        "notification_type",
        "title",
        "message",
        "related_object_type",
        "related_object_id",
        "is_read",
        "read_at",
        "created_at",
    )

    fieldsets = (
        (
            _("Notification Identification & Content"),
            {
                "fields": (
                    "id",
                    "user",
                    "notification_type",
                    "title",
                    "message",
                )
            },
        ),
        (
            _("Related Object Reference"),
            {
                "fields": (
                    "related_object_type",
                    "related_object_id",
                )
            },
        ),
        (
            _("Read State & Timestamps"),
            {
                "fields": (
                    "is_read",
                    "read_at",
                    "created_at",
                )
            },
        ),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @display(
        boolean=True,
        description=_("Read"),
        ordering="is_read",
    )
    def show_read_status(self, obj):
        return obj.is_read
