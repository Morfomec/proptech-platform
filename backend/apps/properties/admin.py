from django.contrib import admin

from .models import Amenity, Property, PropertyAmenity, PropertyImage


class PropertyImageInline(admin.TabularInline):
    model = PropertyImage
    extra = 1
    fields = ("image_url", "caption", "display_order", "is_primary", "created_at")
    readonly_fields = ("created_at",)


class PropertyAmenityInline(admin.TabularInline):
    model = PropertyAmenity
    extra = 1
    fields = ("amenity", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "owner",
        "category",
        "property_type",
        "city",
        "status",
        "created_at",
    )
    list_filter = (
        "category",
        "property_type",
        "status",
        "city",
        "state",
    )
    search_fields = (
        "title",
        "owner__email",
        "address_line_1",
        "locality",
        "city",
        "pin_code",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [PropertyImageInline, PropertyAmenityInline]


@admin.register(PropertyImage)
class PropertyImageAdmin(admin.ModelAdmin):
    list_display = ("property", "image_url", "display_order", "is_primary", "created_at")
    list_filter = ("is_primary", "created_at")
    search_fields = ("property__title", "caption", "image_url")
    readonly_fields = ("id", "created_at")


@admin.register(Amenity)
class AmenityAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_active", "created_at")
    list_filter = ("category", "is_active")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(PropertyAmenity)
class PropertyAmenityAdmin(admin.ModelAdmin):
    list_display = ("property", "amenity", "created_at")
    list_filter = ("amenity__category", "created_at")
    search_fields = ("property__title", "amenity__name")
    readonly_fields = ("id", "created_at")

