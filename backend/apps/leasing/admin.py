from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display

from apps.core.admin import SerialNumberAdminMixin
from apps.leasing.models import (
    Application,
    ApplicationStatusHistory,
    Tenancy,
    TenancyTermsHistory,
)
from apps.leasing.models.application import ApplicationStatus

STATUS_DISPLAY_MAP = dict(ApplicationStatus.choices)


class ApplicationStatusHistoryInline(TabularInline):
    model = ApplicationStatusHistory
    extra = 0
    can_delete = False
    fields = (
        "previous_status",
        "new_status",
        "changed_by",
        "change_reason",
        "created_at",
    )
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Application)
class ApplicationAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "serial_number",
        "listing",
        "applicant",
        "show_status",
        "reviewed_by",
        "reviewed_at",
        "created_at",
    )
    list_display_links = ("serial_number", "listing")
    list_filter = (
        "status",
        "created_at",
        "reviewed_at",
    )
    search_fields = (
        "id",
        "listing__title",
        "listing__property__title",
        "applicant__email",
        "reviewed_by__email",
    )
    list_select_related = (
        "listing",
        "listing__property",
        "applicant",
        "reviewed_by",
    )
    autocomplete_fields = ("listing", "applicant", "reviewed_by")
    readonly_fields = (
        "id",
        "reviewed_at",
        "created_at",
        "updated_at",
    )
    inlines = [ApplicationStatusHistoryInline]

    fieldsets = (
        (
            _("Application Details"),
            {
                "fields": (
                    "listing",
                    "applicant",
                    "message",
                )
            },
        ),
        (
            _("Review & Decision"),
            {
                "fields": (
                    "status",
                    "reviewed_by",
                    "reviewed_at",
                )
            },
        ),
        (
            _("Metadata"),
            {"fields": ("id", "created_at", "updated_at")},
        ),
    )

    @display(
        description=_("Status"),
        ordering="status",
        label={
            "approved": "success",
            "submitted": "info",
            "under_review": "warning",
            "rejected": "danger",
            "withdrawn": "default",
            "tenancy_cancelled": "danger",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "serial_number",
        "application",
        "show_previous_status",
        "show_new_status",
        "changed_by",
        "created_at",
    )
    list_display_links = ("serial_number", "application")
    list_filter = (
        "previous_status",
        "new_status",
        "created_at",
    )
    search_fields = (
        "application__id",
        "application__applicant__email",
        "changed_by__email",
        "change_reason",
    )
    list_select_related = (
        "application",
        "application__applicant",
        "changed_by",
    )
    readonly_fields = (
        "id",
        "application",
        "previous_status",
        "new_status",
        "changed_by",
        "change_reason",
        "created_at",
    )

    fieldsets = (
        (
            _("Transition Details"),
            {
                "fields": (
                    "application",
                    "previous_status",
                    "new_status",
                    "changed_by",
                    "change_reason",
                )
            },
        ),
        (
            _("Audit Timestamp"),
            {"fields": ("id", "created_at")},
        ),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @display(
        description=_("Previous Status"),
        ordering="previous_status",
        label={
            "approved": "success",
            "submitted": "info",
            "under_review": "warning",
            "rejected": "danger",
            "withdrawn": "default",
            "tenancy_cancelled": "danger",
        },
    )
    def show_previous_status(self, obj):
        if not obj.previous_status:
            return None
        display_val = STATUS_DISPLAY_MAP.get(obj.previous_status, obj.previous_status.replace("_", " ").title())
        return (obj.previous_status, display_val)

    @display(
        description=_("New Status"),
        ordering="new_status",
        label={
            "approved": "success",
            "submitted": "info",
            "under_review": "warning",
            "rejected": "danger",
            "withdrawn": "default",
            "tenancy_cancelled": "danger",
        },
    )
    def show_new_status(self, obj):
        if not obj.new_status:
            return None
        display_val = STATUS_DISPLAY_MAP.get(obj.new_status, obj.new_status.replace("_", " ").title())
        return (obj.new_status, display_val)


class TenancyTermsHistoryInline(TabularInline):
    model = TenancyTermsHistory
    extra = 0
    can_delete = False
    fields = (
        "version",
        "status",
        "monthly_rent",
        "security_deposit",
        "start_date",
        "end_date",
        "rent_due_day",
        "responded_at",
        "rejection_reason",
        "created_at",
    )
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Tenancy)
class TenancyAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    def has_delete_permission(self, request, obj=None):
        return False

    inlines = [TenancyTermsHistoryInline]

    list_display = (
        "serial_number",
        "property",
        "tenant",
        "application",
        "start_date",
        "end_date",
        "monthly_rent",
        "show_status",
        "created_at",
    )
    list_display_links = ("serial_number", "property")
    list_filter = (
        "status",
        "start_date",
        "end_date",
        "created_at",
    )
    search_fields = (
        "id",
        "property__title",
        "property__city",
        "tenant__email",
        "application__id",
    )
    list_select_related = (
        "property",
        "tenant",
        "application",
    )
    autocomplete_fields = ("property", "tenant", "application")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            _("Tenancy Parties"),
            {
                "fields": (
                    "property",
                    "tenant",
                    "application",
                )
            },
        ),
        (
            _("Terms & Schedule"),
            {
                "fields": (
                    "start_date",
                    "end_date",
                    "monthly_rent",
                    "security_deposit",
                    "rent_due_day",
                )
            },
        ),
        (
            _("Status & Fulfillment"),
            {
                "fields": (
                    "status",
                    "actual_move_in_date",
                    "actual_move_out_date",
                    "notes",
                )
            },
        ),
        (
            _("Metadata"),
            {"fields": ("id", "created_at", "updated_at")},
        ),
    )

    @display(
        description=_("Status"),
        ordering="status",
        label={
            "active": "success",
            "confirmed": "info",
            "pending": "warning",
            "ended": "default",
            "cancelled": "danger",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None

