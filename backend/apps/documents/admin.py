from django.contrib import admin

from apps.documents.models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "original_filename",
        "document_type",
        "uploaded_by",
        "status",
        "created_at",
    )

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

    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
