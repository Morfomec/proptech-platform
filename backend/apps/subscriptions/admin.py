from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin
from unfold.decorators import display

from apps.core.admin import SerialNumberAdminMixin
from apps.subscriptions.models import (
    Subscription,
    SubscriptionPayment,
    SubscriptionPlan,
)


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(ModelAdmin):
    list_per_page = 25
    ordering = ("min_properties", "monthly_price")

    list_display = (
        "name",
        "code",
        "min_properties",
        "max_properties",
        "monthly_price",
        "currency",
        "trial_duration_months",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "currency")
    search_fields = ("name", "code")
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (
            _("Plan Details"),
            {
                "fields": (
                    "name",
                    "code",
                    "is_active",
                )
            },
        ),
        (
            _("Property Limits"),
            {
                "fields": (
                    "min_properties",
                    "max_properties",
                )
            },
        ),
        (
            _("Pricing & Trial"),
            {
                "fields": (
                    "monthly_price",
                    "currency",
                    "trial_duration_months",
                )
            },
        ),
        (
            _("Metadata"),
            {"fields": ("id", "created_at", "updated_at")},
        ),
    )


@admin.register(Subscription)
class SubscriptionAdmin(ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "owner",
        "plan",
        "show_status",
        "trial_ends_at",
        "current_period_end",
        "created_at",
    )
    list_filter = ("status", "plan", "created_at")
    search_fields = ("owner__email", "owner__first_name", "owner__last_name")
    list_select_related = ("owner", "plan")
    autocomplete_fields = ("owner", "plan")
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (
            _("Subscription Assignment"),
            {
                "fields": (
                    "owner",
                    "plan",
                    "status",
                )
            },
        ),
        (
            _("Trial Period"),
            {
                "fields": (
                    "trial_started_at",
                    "trial_ends_at",
                )
            },
        ),
        (
            _("Billing Period"),
            {
                "fields": (
                    "current_period_start",
                    "current_period_end",
                    "started_at",
                    "cancelled_at",
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
            "trialing": "info",
            "past_due": "warning",
            "cancelled": "danger",
            "expired": "default",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None


@admin.register(SubscriptionPayment)
class SubscriptionPaymentAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "serial_number",
        "subscription",
        "plan",
        "amount",
        "currency",
        "payment_method",
        "show_status",
        "paid_at",
        "created_at",
    )
    list_display_links = ("serial_number", "subscription")
    list_filter = ("status", "payment_method", "currency", "created_at")
    search_fields = (
        "id",
        "transaction_reference",
        "subscription__owner__email",
    )
    list_select_related = ("subscription", "subscription__owner", "plan")
    autocomplete_fields = ("subscription", "plan")
    readonly_fields = ("id", "created_at")

    fieldsets = (
        (
            _("Payment Details"),
            {
                "fields": (
                    "subscription",
                    "plan",
                    "amount",
                    "currency",
                    "payment_method",
                    "transaction_reference",
                    "status",
                    "paid_at",
                )
            },
        ),
        (
            _("Billing Period"),
            {
                "fields": (
                    "billing_period_start",
                    "billing_period_end",
                )
            },
        ),
        (
            _("Metadata"),
            {"fields": ("id", "created_at")},
        ),
    )

    @display(
        description=_("Status"),
        ordering="status",
        label={
            "successful": "success",
            "pending": "warning",
            "failed": "danger",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None


