from django.contrib import admin
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display

from apps.core.admin import SerialNumberAdminMixin
from .models import Amenity, Property, PropertyAmenity, PropertyImage


def is_machine_generated_caption(caption: str | None) -> bool:
    """
    Detect machine-generated image captions, file slugs, or UUIDs
    to avoid exposing raw technical filenames in admin changelists.
    """
    if not caption or not caption.strip():
        return True
    c = caption.strip().lower()
    # Unsplash patterns like photo-1484154218962-a197022b5858 or *-unsplash
    if c.startswith("photo-") and any(ch.isdigit() for ch in c):
        return True
    if "-unsplash" in c or "_unsplash" in c:
        return True
    # UUID patterns or 32/36 hex characters
    if len(c) in (32, 36) and all(ch in "0123456789abcdef-" for ch in c):
        return True
    # Common file extensions
    if any(c.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg")):
        return True
    return False


class PropertyImageInline(TabularInline):
    model = PropertyImage
    extra = 0
    fields = ("image_preview", "image_url", "caption", "display_order", "is_primary", "created_at")
    readonly_fields = ("image_preview", "created_at")

    @display(description=_("Preview"))
    def image_preview(self, obj):
        if not obj or not obj.image_url:
            return "-"
        return format_html(
            '<a href="{url}" target="_blank" rel="noopener noreferrer" class="proptech-image-preview" style="width:48px;height:48px;min-width:48px;max-width:48px;min-height:48px;max-height:48px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;border-radius:6px;border:1px solid #E8EEEB;background:#F9FAFB;">'
            '<img src="{url}" alt="" style="width:48px;height:48px;min-width:48px;max-width:48px;min-height:48px;max-height:48px;object-fit:cover;object-position:center;display:block;" onerror="this.onerror=null;this.parentElement.innerHTML=\'<span style=\\\'font-size:10px;color:#64748B;\\\'>-</span>\';">'
            '</a>',
            url=obj.image_url,
        )


class PropertyAmenityInline(TabularInline):
    model = PropertyAmenity
    extra = 0
    fields = ("amenity", "created_at")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("amenity",)


@admin.register(Property)
class PropertyAdmin(ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = (
        "title",
        "owner",
        "category",
        "property_type",
        "city",
        "show_status",
        "created_at",
    )
    list_filter = (
        "status",
        "category",
        "property_type",
        "furnishing_status",
        "city",
        "state",
        "created_at",
    )
    search_fields = (
        "title",
        "owner__email",
        "address_line_1",
        "locality",
        "city",
        "pin_code",
    )
    list_select_related = ("owner",)
    autocomplete_fields = ("owner",)
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [PropertyImageInline, PropertyAmenityInline]

    fieldsets = (
        (
            _("Basic Information"),
            {
                "fields": (
                    "owner",
                    "title",
                    "description",
                    "category",
                    "property_type",
                    "status",
                )
            },
        ),
        (
            _("Location"),
            {
                "fields": (
                    "address_line_1",
                    "address_line_2",
                    "landmark",
                    "locality",
                    "city",
                    "district",
                    "state",
                    "pin_code",
                    "country_code",
                    "latitude",
                    "longitude",
                )
            },
        ),
        (
            _("Physical Specifications"),
            {
                "fields": (
                    "built_up_area",
                    "bedrooms",
                    "bathrooms",
                    "furnishing_status",
                    "parking_spaces",
                    "parking_details",
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
            "available": "success",
            "occupied": "info",
            "maintenance": "warning",
            "draft": "default",
            "inactive": "danger",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None


@admin.register(PropertyImage)
class PropertyImageAdmin(SerialNumberAdminMixin, ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("property", "display_order")

    list_display = (
        "serial_number",
        "image_preview",
        "property",
        "clean_caption",
        "display_order",
        "show_primary_badge",
        "created_at",
    )
    list_display_links = ("serial_number", "property")
    list_filter = ("is_primary", "created_at")
    search_fields = ("property__title", "caption", "image_url")
    list_select_related = ("property",)
    autocomplete_fields = ("property",)
    readonly_fields = ("id", "image_detail_preview", "created_at")

    fieldsets = (
        (
            _("Image Information"),
            {
                "fields": (
                    "image_detail_preview",
                    "property",
                    "caption",
                    "display_order",
                    "is_primary",
                )
            },
        ),
        (
            _("Storage & Technical Details"),
            {
                "classes": ("collapse",),
                "fields": (
                    "image_url",
                    "id",
                    "created_at",
                ),
            },
        ),
    )

    @display(description=_("Preview"))
    def image_preview(self, obj):
        if not obj.image_url:
            return format_html(
                '<div class="proptech-image-preview" style="width:52px;height:52px;min-width:52px;max-width:52px;min-height:52px;max-height:52px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid #E8EEEB;background:#F9FAFB;color:#64748B;font-size:11px;font-weight:500;">{}</div>',
                _("No image"),
            )
        return format_html(
            '<a href="{url}" target="_blank" rel="noopener noreferrer" class="proptech-image-preview" style="width:52px;height:52px;min-width:52px;max-width:52px;min-height:52px;max-height:52px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;border-radius:8px;border:1px solid #E8EEEB;background:#F9FAFB;box-sizing:border-box;" title="{title}">'
            '<img src="{url}" alt="{alt}" style="width:52px;height:52px;min-width:52px;max-width:52px;min-height:52px;max-height:52px;object-fit:cover;object-position:center;display:block;border-radius:7px;" onerror="this.onerror=null;this.parentElement.innerHTML=\'<span style=\\\'font-size:10px;color:#64748B;display:flex;align-items:center;justify-content:center;width:100%;height:100%;\\\'>Error</span>\';">'
            '</a>',
            url=obj.image_url,
            title=obj.property.title if obj.property else _("Property Image"),
            alt=obj.caption or (obj.property.title if obj.property else _("Property Image")),
        )

    @display(description=_("Preview"))
    def image_detail_preview(self, obj):
        if not obj or not obj.image_url:
            return _("No image uploaded")
        return format_html(
            '<div class="max-w-md rounded-xl overflow-hidden border border-[#E8EEEB] bg-[#F9FAFB] shadow-xs">'
            '<img src="{url}" alt="{alt}" class="w-full max-h-72 object-cover" onerror="this.onerror=null;this.parentElement.innerHTML=\'<span class=\\\'text-xs text-[#64748B] p-4 block\\\'>Image failed to load</span>\';">'
            '</div>',
            url=obj.image_url,
            alt=obj.caption or (obj.property.title if obj.property else _("Property Image")),
        )

    @display(description=_("Caption"), ordering="caption")
    def clean_caption(self, obj):
        if is_machine_generated_caption(obj.caption):
            return format_html(
                '<span class="text-xs text-[#94A3B8] italic">{}</span>',
                _("No caption"),
            )
        return obj.caption

    @display(
        description=_("Primary"),
        ordering="is_primary",
        label={
            "primary": "success",
            "gallery": "default",
        },
    )
    def show_primary_badge(self, obj):
        return ("primary", _("Primary")) if obj.is_primary else ("gallery", _("Gallery"))


@admin.register(Amenity)
class AmenityAdmin(ModelAdmin):
    list_per_page = 25
    ordering = ("category", "name")

    list_display = ("name", "category", "is_active", "created_at")
    list_filter = ("category", "is_active")
    search_fields = ("name", "description")
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (None, {"fields": ("name", "category", "description", "is_active")}),
        (_("Timestamps"), {"fields": ("id", "created_at", "updated_at")}),
    )


@admin.register(PropertyAmenity)
class PropertyAmenityAdmin(ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

    list_display = ("property", "amenity", "created_at")
    list_filter = ("amenity__category", "created_at")
    search_fields = ("property__title", "amenity__name")
    list_select_related = ("property", "amenity")
    autocomplete_fields = ("property", "amenity")
    readonly_fields = ("id", "created_at")

    fieldsets = (
        (None, {"fields": ("property", "amenity")}),
        (_("Timestamps"), {"fields": ("id", "created_at")}),
    )


