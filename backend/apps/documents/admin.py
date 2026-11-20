from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin
from unfold.decorators import display

from apps.core.admin import SerialNumberAdminMixin
from apps.documents.models import Document


@admin.register(Document)
class DocumentAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "serial_number",
        "title",
        "original_filename",
        "show_document_type",
        "uploaded_by",
        "show_status",
        "created_at",
    )
    list_display_links = ("serial_number", "title")

    list_select_related = ("uploaded_by",)

    list_filter = (
        "document_type",
        "status",
        "created_at",
    )

    search_fields = (
        "title",
        "original_filename",
        "uploaded_by__email",
    )

    readonly_fields = (
        "id",
        "uploaded_by",
        "property",
        "application",
        "tenancy",
        "file_url",
        "original_filename",
        "mime_type",
        "file_size_bytes",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            _("Document Details"),
            {
                "fields": (
                    "title",
                    "document_type",
                    "status",
                    "file_url",
                    "original_filename",
                    "mime_type",
                    "file_size_bytes",
                )
            },
        ),
        (
            _("Associations"),
            {
                "fields": (
                    "uploaded_by",
                    "property",
                    "application",
                    "tenancy",
                )
            },
        ),
        (
            _("Timestamps"),
            {"fields": ("id", "created_at", "updated_at")},
        ),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @display(
        description=_("Status"),
        ordering="status",
        label={
            "active": "success",
            "archived": "default",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None

    @display(
        description=_("Document Type"),
        ordering="document_type",
        label={
            "rental_agreement": "primary",
            "id_proof": "info",
            "income_proof": "warning",
            "property_document": "success",
            "other": "default",
        },
    )
    def show_document_type(self, obj):
        return (obj.document_type, obj.get_document_type_display()) if obj.document_type else None

