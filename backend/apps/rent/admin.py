from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display

from apps.core.admin import SerialNumberAdminMixin
from apps.rent.models import (
    Payment,
    PaymentAllocation,
    PaymentAllocationReversal,
    PaymentRefund,
    RentCharge,
)


class PaymentAllocationInline(TabularInline):
    model = PaymentAllocation
    extra = 0
    can_delete = False
    fields = ("rent_charge", "allocated_amount", "created_at")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class PaymentRefundInline(TabularInline):
    model = PaymentRefund
    extra = 0
    can_delete = False
    fields = (
        "amount",
        "currency",
        "reason",
        "status",
        "refund_reference",
        "processed_at",
        "created_at",
    )
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RentCharge)
class RentChargeAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "due_date"
    ordering = ("-due_date", "-created_at")

    list_display = (
        "serial_number",
        "show_tenancy",
        "charge_type",
        "billing_period_start",
        "billing_period_end",
        "due_date",
        "amount",
        "show_status",
        "created_at",
    )
    list_display_links = ("serial_number", "show_tenancy")
    list_filter = ("charge_type", "status", "due_date", "created_at")
    search_fields = (
        "id",
        "tenancy__id",
        "tenancy__property__title",
        "tenancy__tenant__email",
        "description",
    )
    list_select_related = ("tenancy", "tenancy__property", "tenancy__tenant")
    autocomplete_fields = ("tenancy",)
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (
            _("Tenancy & Obligation"),
            {
                "fields": (
                    "tenancy",
                    "charge_type",
                    "amount",
                    "status",
                    "description",
                )
            },
        ),
        (
            _("Schedule & Due Dates"),
            {
                "fields": (
                    "billing_period_start",
                    "billing_period_end",
                    "due_date",
                )
            },
        ),
        (
            _("Metadata"),
            {"fields": ("id", "created_at", "updated_at")},
        ),
    )

    @display(description=_("Tenancy (Property — Tenant)"), ordering="tenancy__property__title")
    def show_tenancy(self, obj):
        return str(obj.tenancy)

    @display(
        description=_("Status"),
        ordering="status",
        label={
            "paid": "success",
            "partially_paid": "warning",
            "unpaid": "danger",
            "waived": "info",
            "cancelled": "default",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None


@admin.register(Payment)
class PaymentAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "serial_number",
        "show_tenancy",
        "amount",
        "currency",
        "payment_method",
        "show_status",
        "paid_at",
        "transaction_reference",
        "created_at",
    )
    list_display_links = ("serial_number", "show_tenancy")
    list_filter = ("status", "payment_method", "currency", "created_at")
    search_fields = (
        "id",
        "transaction_reference",
        "tenancy__id",
        "tenancy__tenant__email",
        "notes",
    )
    list_select_related = ("tenancy", "tenancy__property", "tenancy__tenant")
    autocomplete_fields = ("tenancy",)
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [PaymentAllocationInline, PaymentRefundInline]

    fieldsets = (
        (
            _("Payment Details"),
            {
                "fields": (
                    "tenancy",
                    "amount",
                    "currency",
                    "payment_method",
                    "status",
                    "transaction_reference",
                    "paid_at",
                    "notes",
                )
            },
        ),
        (
            _("Metadata"),
            {"fields": ("id", "created_at", "updated_at")},
        ),
    )

    @display(description=_("Tenancy (Property — Tenant)"), ordering="tenancy__property__title")
    def show_tenancy(self, obj):
        return str(obj.tenancy)

    @display(
        description=_("Status"),
        ordering="status",
        label={
            "completed": "success",
            "pending": "warning",
            "failed": "danger",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None


@admin.register(PaymentAllocation)
class PaymentAllocationAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "serial_number",
        "payment",
        "rent_charge",
        "show_tenancy",
        "allocated_amount",
        "created_at",
    )
    list_display_links = ("serial_number", "payment")
    list_filter = ("created_at",)
    search_fields = (
        "id",
        "payment__id",
        "rent_charge__id",
        "tenancy__id",
    )
    list_select_related = ("payment", "rent_charge", "tenancy", "tenancy__property", "tenancy__tenant")
    readonly_fields = (
        "id",
        "payment",
        "rent_charge",
        "tenancy",
        "allocated_amount",
        "created_at",
    )

    fieldsets = (
        (
            _("Allocation Details"),
            {
                "fields": (
                    "payment",
                    "rent_charge",
                    "tenancy",
                    "allocated_amount",
                )
            },
        ),
        (
            _("Audit Timestamp"),
            {"fields": ("id", "created_at")},
        ),
    )

    @display(description=_("Tenancy (Property — Tenant)"), ordering="tenancy__property__title")
    def show_tenancy(self, obj):
        return str(obj.tenancy)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PaymentRefund)
class PaymentRefundAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "serial_number",
        "payment",
        "amount",
        "currency",
        "show_status",
        "refund_reference",
        "created_by",
        "processed_at",
        "created_at",
    )
    list_display_links = ("serial_number", "payment")
    list_filter = ("status", "currency", "created_at")
    search_fields = (
        "id",
        "payment__id",
        "refund_reference",
        "reason",
        "created_by__email",
        "payment__tenancy__id",
    )
    list_select_related = ("payment", "created_by")
    readonly_fields = (
        "id",
        "payment",
        "amount",
        "currency",
        "reason",
        "status",
        "refund_reference",
        "processed_at",
        "created_by",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            _("Refund Details"),
            {
                "fields": (
                    "payment",
                    "amount",
                    "currency",
                    "reason",
                    "status",
                    "refund_reference",
                    "processed_at",
                    "created_by",
                )
            },
        ),
        (
            _("Metadata"),
            {"fields": ("id", "created_at", "updated_at")},
        ),
    )

    @display(description=_("Tenancy (Property — Tenant)"), ordering="tenancy__property__title")
    def show_tenancy(self, obj):
        return str(obj.tenancy)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @display(description=_("Tenancy (Property — Tenant)"), ordering="tenancy__property__title")
    def show_tenancy(self, obj):
        return str(obj.tenancy)

    @display(
        description=_("Status"),
        ordering="status",
        label={
            "completed": "success",
            "pending": "warning",
            "failed": "danger",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None


@admin.register(PaymentAllocationReversal)
class PaymentAllocationReversalAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "serial_number",
        "refund",
        "allocation",
        "rent_charge",
        "tenancy",
        "reversed_amount",
        "created_at",
    )
    list_display_links = ("serial_number", "refund")
    list_filter = ("created_at",)
    search_fields = (
        "id",
        "refund__id",
        "allocation__id",
        "rent_charge__id",
        "tenancy__id",
    )
    list_select_related = ("refund", "allocation", "rent_charge", "tenancy")
    readonly_fields = (
        "id",
        "refund",
        "allocation",
        "rent_charge",
        "tenancy",
        "reversed_amount",
        "created_at",
    )

    fieldsets = (
        (
            _("Reversal Details"),
            {
                "fields": (
                    "refund",
                    "allocation",
                    "rent_charge",
                    "tenancy",
                    "reversed_amount",
                )
            },
        ),
        (
            _("Audit Timestamp"),
            {"fields": ("id", "created_at")},
        ),
    )

    @display(description=_("Tenancy (Property — Tenant)"), ordering="tenancy__property__title")
    def show_tenancy(self, obj):
        return str(obj.tenancy)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False



