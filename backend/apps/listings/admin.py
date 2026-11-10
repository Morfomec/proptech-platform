from django.contrib import admin

from .models import Listing, SavedProperty


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "property",
        "monthly_rent",
        "security_deposit",
        "status",
        "review_status",
        "published_at",
        "created_at",
    )
    list_filter = (
        "status",
        "review_status",
        "available_from",
        "created_at",
    )
    search_fields = (
        "title",
        "description",
        "property__title",
        "property__city",
        "property__owner__email",
    )
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "published_at",
    )


@admin.register(SavedProperty)
class SavedPropertyAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "property",
        "created_at",
    )
    list_filter = (
        "created_at",
    )
    search_fields = (
        "user__email",
        "property__title",
        "property__city",
    )
    readonly_fields = (
        "id",
        "created_at",
    )
