from django.contrib import admin

from apps.leasing.models import Application, ApplicationStatusHistory, Tenancy


class ApplicationStatusHistoryInline(admin.TabularInline):
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
class ApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "listing",
        "applicant",
        "status",
        "reviewed_by",
        "reviewed_at",
        "created_at",
    )
    list_filter = (
        "status",
        "created_at",
        "reviewed_at",
    )
    search_fields = (
        "listing__title",
        "listing__property__title",
        "applicant__email",
        "reviewed_by__email",
    )
    readonly_fields = (
        "id",
        "reviewed_at",
        "created_at",
        "updated_at",
    )
    inlines = [ApplicationStatusHistoryInline]


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "application",
        "previous_status",
        "new_status",
        "changed_by",
        "created_at",
    )
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
    readonly_fields = (
        "id",
        "application",
        "previous_status",
        "new_status",
        "changed_by",
        "change_reason",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Tenancy)
class TenancyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "tenant",
        "application",
        "start_date",
        "end_date",
        "monthly_rent",
        "status",
        "created_at",
    )
    list_filter = (
        "status",
        "start_date",
        "end_date",
        "created_at",
    )
    search_fields = (
        "property__title",
        "property__city",
        "tenant__email",
        "application__id",
    )
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
