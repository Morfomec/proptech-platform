from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db.models import Case, IntegerField, Value, When
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin
from unfold.decorators import action, display

from apps.listings.models import Listing, ReviewStatus, SavedProperty
from apps.listings.services import approve_listing, reject_listing


def _format_error_message(exc: Exception) -> str:
    if hasattr(exc, "message_dict"):
        msgs = []
        for errors in exc.message_dict.values():
            msgs.extend(errors if isinstance(errors, list) else [errors])
        return " ".join(str(m) for m in msgs)
    if hasattr(exc, "messages"):
        return " ".join(str(m) for m in exc.messages)
    if getattr(exc, "args", None) and isinstance(exc.args[0], dict):
        msgs = []
        for errors in exc.args[0].values():
            msgs.extend(errors if isinstance(errors, list) else [errors])
        return " ".join(str(m) for m in msgs)
    return str(exc)


class ModerationStageFilter(admin.SimpleListFilter):
    title = _("Moderation Stage")
    parameter_name = "moderation_stage"

    def lookups(self, request, model_admin):
        return [
            ("pending_new", _("Pending (New Submissions)")),
            ("resubmitted", _("Resubmitted (After Rejection)")),
            ("approved", _("Approved")),
            ("rejected", _("Rejected")),
            ("draft", _("Draft")),
        ]

    def queryset(self, request, queryset):
        if self.value() == "pending_new":
            return queryset.filter(review_status=ReviewStatus.PENDING, reviewed_at__isnull=True)
        if self.value() == "resubmitted":
            return queryset.filter(review_status=ReviewStatus.PENDING, reviewed_at__isnull=False)
        if self.value() == "approved":
            return queryset.filter(review_status=ReviewStatus.APPROVED)
        if self.value() == "rejected":
            return queryset.filter(review_status=ReviewStatus.REJECTED)
        if self.value() == "draft":
            return queryset.filter(review_status=ReviewStatus.DRAFT)
        return queryset


@admin.register(Listing)
class ListingAdmin(ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    actions = ["approve_selected_listings", "reject_selected_listings"]
    actions_detail = ["approve_listing_action", "reject_listing_action"]

    list_display = (
        "title",
        "property",
        "property_images_preview",
        "monthly_rent",
        "security_deposit",
        "show_status",
        "show_review_status",
        "reviewed_by",
        "reviewed_at",
        "published_at",
        "created_at",
    )
    list_filter = (
        ModerationStageFilter,
        "review_status",
        "status",
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
    list_select_related = ("property", "property__owner", "reviewed_by")
    autocomplete_fields = ("property", "reviewed_by")
    readonly_fields = (
        "id",
        "moderation_action_bar",
        "property_photos_gallery",
        "property_summary_card",
        "created_at",
        "updated_at",
        "published_at",
        "reviewed_by",
        "reviewed_at",
    )

    fieldsets = (
        (
            _("Moderation Decision & Actions"),
            {
                "fields": (
                    "moderation_action_bar",
                    "review_status",
                    "rejection_reason",
                    "reviewed_by",
                    "reviewed_at",
                )
            },
        ),
        (
            _("Property Photos & Visual Assets"),
            {
                "fields": (
                    "property_photos_gallery",
                )
            },
        ),
        (
            _("Property Physical Information"),
            {
                "fields": (
                    "property_summary_card",
                )
            },
        ),
        (
            _("Listing Offer Details"),
            {
                "fields": (
                    "property",
                    "title",
                    "description",
                    "monthly_rent",
                    "security_deposit",
                    "available_from",
                )
            },
        ),
        (
            _("Publication Status"),
            {
                "fields": (
                    "status",
                    "published_at",
                )
            },
        ),
        (
            _("Metadata"),
            {"fields": ("id", "created_at", "updated_at")},
        ),
    )

    def get_queryset(self, request: HttpRequest):
        qs = self.model._default_manager.get_queryset()
        qs = qs.annotate(
            moderation_priority=Case(
                When(review_status=ReviewStatus.PENDING, then=Value(0)),
                When(review_status=ReviewStatus.REJECTED, then=Value(1)),
                When(review_status=ReviewStatus.DRAFT, then=Value(2)),
                When(review_status=ReviewStatus.APPROVED, then=Value(3)),
                default=Value(4),
                output_field=IntegerField(),
            )
        )
        ordering = self.get_ordering(request)
        if ordering:
            qs = qs.order_by(*ordering)
        return qs

    def get_ordering(self, request: HttpRequest):
        if request.GET.get("o"):
            return super().get_ordering(request)
        return ["moderation_priority", "-updated_at", "-created_at"]

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<path:object_id>/approve-listing/",
                self.admin_site.admin_view(self.approve_single_listing_view),
                name="listings_listing_approve",
            ),
            path(
                "<path:object_id>/reject-listing/",
                self.admin_site.admin_view(self.reject_single_listing_view),
                name="listings_listing_reject",
            ),
        ]
        return custom_urls + urls

    def get_actions_detail(self, request: HttpRequest, object_id: int | str):
        actions = super().get_actions_detail(request, object_id)
        if object_id:
            try:
                listing = self.get_object(request, object_id)
                if listing and listing.review_status == ReviewStatus.REJECTED:
                    actions = [
                        a for a in actions if getattr(a, "action_name", "") != "reject_listing_action"
                    ]
            except Exception:
                pass
        return actions

    @action(description=_("Approve & Publish"), url_path="approve-listing")
    def approve_listing_action(self, request: HttpRequest, object_id: str) -> HttpResponse:
        return self.approve_single_listing_view(request, object_id)

    @action(description=_("Reject Listing"), url_path="reject-listing")
    def reject_listing_action(self, request: HttpRequest, object_id: str) -> HttpResponse:
        return self.reject_single_listing_view(request, object_id)

    def approve_single_listing_view(self, request: HttpRequest, object_id: str) -> HttpResponse:
        listing = self.get_object(request, object_id)
        if not listing:
            raise Http404("Listing not found")
        try:
            approve_listing(admin_user=request.user, listing_instance=listing)
            self.message_user(
                request,
                f"Successfully approved and published listing '{listing.title}'.",
                level=messages.SUCCESS,
            )
        except Exception as e:
            self.message_user(
                request,
                f"Failed to approve listing: {_format_error_message(e)}",
                level=messages.ERROR,
            )
        return redirect(reverse("admin:listings_listing_change", args=[object_id]))

    def reject_single_listing_view(self, request: HttpRequest, object_id: str) -> HttpResponse:
        listing = self.get_object(request, object_id)
        if not listing:
            raise Http404("Listing not found")

        if listing.review_status == ReviewStatus.REJECTED:
            self.message_user(
                request,
                f"Listing '{listing.title}' is already rejected. No further rejection action is needed until the owner resubmits.",
                level=messages.WARNING,
            )
            return redirect(reverse("admin:listings_listing_change", args=[object_id]))

        if request.method == "POST":
            rejection_reason = request.POST.get("rejection_reason", "").strip()
            if not rejection_reason:
                self.message_user(
                    request,
                    "A non-empty rejection reason is required when rejecting a listing.",
                    level=messages.ERROR,
                )
            else:
                try:
                    reject_listing(
                        admin_user=request.user,
                        listing_instance=listing,
                        rejection_reason=rejection_reason,
                    )
                    self.message_user(
                        request,
                        f"Successfully rejected listing '{listing.title}'.",
                        level=messages.SUCCESS,
                    )
                    return redirect(reverse("admin:listings_listing_change", args=[object_id]))
                except Exception as e:
                    self.message_user(
                        request,
                        f"Failed to reject listing: {e}",
                        level=messages.ERROR,
                    )

        initial_reason = (
            request.POST.get("rejection_reason", "").strip()
            or request.GET.get("reason", "").strip()
            or (listing.rejection_reason or "")
        )

        return render(
            request,
            "admin/listings/reject_single_listing.html",
            context={
                **self.admin_site.each_context(request),
                "title": _("Reject Listing: %s") % listing.title,
                "listing": listing,
                "initial_reason": initial_reason,
                "opts": self.model._meta,
            },
        )

    @display(description=_("Moderation Decision & Action Bar"))
    def moderation_action_bar(self, obj):
        if not obj or not obj.pk:
            return mark_safe('<span style="color:#6B7280; font-size:12px;">Save listing first to enable moderation actions.</span>')

        approve_url = reverse("admin:listings_listing_approve", args=[obj.pk])
        reject_url = reverse("admin:listings_listing_reject", args=[obj.pk])

        status_styles = {
            ReviewStatus.PENDING: {
                "badge": "background-color: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;",
                "title": "⏳ Awaiting Review",
                "desc": "The owner has submitted this listing for publication. Please inspect the property photos and details below before approving.",
            },
            ReviewStatus.APPROVED: {
                "badge": "background-color: #D1FAE5; color: #065F46; border: 1px solid #6EE7B7;",
                "title": "✓ Approved & Published",
                "desc": "This listing is approved and currently active on the public marketplace.",
            },
            ReviewStatus.REJECTED: {
                "badge": "background-color: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;",
                "title": "✕ Rejected",
                "desc": "This listing was rejected and is not visible to tenants.",
            },
            ReviewStatus.DRAFT: {
                "badge": "background-color: #F3F4F6; color: #374151; border: 1px solid #E5E7EB;",
                "title": "📄 Draft",
                "desc": "This listing is in draft. The owner has not yet submitted it for review.",
            },
        }

        is_resubmitted = obj.review_status == ReviewStatus.PENDING and obj.reviewed_at is not None
        if is_resubmitted:
            style_info = {
                "badge": "background-color: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE;",
                "title": "🔄 Resubmitted for Review",
                "desc": "The owner has updated and resubmitted this listing after previous moderation feedback. Please inspect the updated details and property photos.",
            }
        else:
            style_info = status_styles.get(
                obj.review_status,
                {"badge": "background-color: #F3F4F6; color: #374151;", "title": str(obj.get_review_status_display()), "desc": ""},
            )

        reviewer_html = ""
        if obj.reviewed_by:
            name = f"{obj.reviewed_by.first_name} {obj.reviewed_by.last_name}".strip() or obj.reviewed_by.email
            reviewed_time = obj.reviewed_at.strftime("%b %d, %Y, %I:%M %p") if obj.reviewed_at else ""
            reviewer_html = f'<div style="font-size: 11px; color: #6B7280; margin-top: 4px;">Last reviewed by <strong>{name}</strong> on {reviewed_time}</div>'

        rejection_box = ""
        if obj.review_status == ReviewStatus.REJECTED and obj.rejection_reason:
            rejection_box = f'''
            <div style="margin-top: 8px; padding: 8px 12px; border-radius: 6px; background-color: #FEF2F2; border: 1px solid #FECACA; font-size: 12px; color: #991B1B;">
                <strong>Reason given to owner:</strong> {obj.rejection_reason}
            </div>
            '''

        property_status_warning = ""
        if obj.property and obj.property.status in ["occupied", "maintenance", "inactive"]:
            prop_status_display = obj.property.get_status_display()
            property_status_warning = f'''
            <div style="margin-top: 8px; padding: 8px 12px; border-radius: 6px; background-color: #FEF3C7; border: 1px solid #FCD34D; font-size: 12px; color: #92400E;">
                <strong>⚠️ {prop_status_display} Property:</strong> This property is currently marked as <em>{prop_status_display}</em> (e.g. an active tenancy). It cannot be published on the public marketplace until the property becomes <em>Available</em>.
            </div>
            '''

        approve_btn = f'''
        <a href="{approve_url}" onclick="return confirm('Approve and publish this listing now?');"
           style="background-color: #059669; color: white; padding: 7px 14px; border-radius: 6px; font-weight: 500; font-size: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <span>✓</span> Approve & Publish
        </a>
        '''

        reject_btn = ""
        if obj.review_status != ReviewStatus.REJECTED:
            reject_btn = f'''
            <a href="{reject_url}"
               style="background-color: #DC2626; color: white; padding: 7px 14px; border-radius: 6px; font-weight: 500; font-size: 12px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <span>✕</span> Reject Listing
            </a>
            '''

        html = f'''
        <div style="border-radius: 8px; border: 1px solid #E5E7EB; background: #FFFFFF; padding: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; {style_info['badge']}">
                            {style_info['title']}
                        </span>
                        <span style="font-size: 12px; color: #4B5563;">Current status: <strong>{obj.get_status_display()}</strong></span>
                    </div>
                    <div style="font-size: 12px; color: #4B5563; margin-top: 6px;">{style_info['desc']}</div>
                    {reviewer_html}
                    {rejection_box}
                    {property_status_warning}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    {approve_btn}
                    {reject_btn}
                </div>
            </div>
        </div>
        <script>
        (function() {{
            function attachRejectReasonListeners() {{
                var links = document.querySelectorAll('a[href*="reject-listing"]');
                links.forEach(function(el) {{
                    if (el.dataset.reasonAttached) return;
                    el.dataset.reasonAttached = 'true';
                    el.addEventListener('click', function(e) {{
                        var input = document.getElementById('id_rejection_reason');
                        if (input && input.value && input.value.trim()) {{
                            var url = new URL(el.href, window.location.origin);
                            url.searchParams.set('reason', input.value.trim());
                            el.href = url.toString();
                        }}
                    }});
                }});
            }}
            if (document.readyState === 'loading') {{
                document.addEventListener('DOMContentLoaded', attachRejectReasonListeners);
            }} else {{
                attachRejectReasonListeners();
            }}
            setTimeout(attachRejectReasonListeners, 400);
            setTimeout(attachRejectReasonListeners, 1200);
        }})();
        </script>
        '''
        return mark_safe(html)

    @display(description=_("Property Photos & Gallery"))
    def property_photos_gallery(self, obj):
        if not obj or not obj.property_id:
            return mark_safe('<span style="color:#6B7280; font-size:12px;">No property linked to this listing.</span>')

        images = obj.property.images.all()
        if not images.exists():
            return mark_safe('''
                <div style="padding: 14px; border-radius: 8px; border: 1px solid #FCA5A5; background-color: #FEF2F2; color: #991B1B;">
                    <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                        <span>⚠️</span> No Property Photos Uploaded
                    </div>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #B91C1C;">
                        This property has no uploaded images. A listing <strong>cannot be approved or published</strong> without at least one property photo.
                    </p>
                </div>
            ''')

        total_count = images.count()
        photo_cards = []
        for img in images:
            primary_badge = (
                '<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background-color: #D1FAE5; color: #065F46;">Primary</span>'
                if img.is_primary
                else f'<span style="font-size: 10px; color: #9CA3AF;">Order #{img.display_order}</span>'
            )
            caption_html = (
                f'<div style="font-size: 11px; color: #4B5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 3px;" title="{img.caption}">{img.caption}</div>'
                if img.caption
                else '<div style="font-size: 11px; color: #9CA3AF; font-style: italic; margin-top: 3px;">No caption</div>'
            )

            photo_cards.append(f'''
                <div style="border-radius: 8px; border: 1px solid #E5E7EB; background: #FFFFFF; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
                    <div style="width: 100%; height: 150px; background-color: #F3F4F6; position: relative; overflow: hidden;">
                        <a href="{img.image_url}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; height: 100%;">
                            <img src="{img.image_url}"
                                 alt="{img.caption or 'Property photo'}"
                                 style="width: 100%; height: 100%; object-fit: cover; display: block;"
                                 loading="lazy"
                                 onerror="this.onerror=null; this.src='https://placehold.co/400x300?text=Image+Unavailable';" />
                        </a>
                    </div>
                    <div style="padding: 8px 10px; background: white; border-top: 1px solid #F3F4F6;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            {primary_badge}
                            <a href="{img.image_url}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #2563EB; text-decoration: none;">
                                View Full ↗
                            </a>
                        </div>
                        {caption_html}
                    </div>
                </div>
            ''')

        grid_html = "".join(photo_cards)
        return mark_safe(f'''
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #6B7280;">
                    <span>Total <strong>{total_count}</strong> photo(s) uploaded</span>
                    <span style="font-style: italic;">Click any photo to view full size</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">
                    {grid_html}
                </div>
            </div>
        ''')

    @display(description=_("Property Summary & Details"))
    def property_summary_card(self, obj):
        try:
            if not obj or not obj.property_id:
                return mark_safe('<span style="color:#6B7280; font-size:12px;">No property linked.</span>')

            prop = obj.property
            owner_name = f"{prop.owner.first_name} {prop.owner.last_name}".strip() or prop.owner.email
            address = ", ".join(
                part for part in [prop.address_line_1, prop.locality, prop.city, prop.district, prop.state, prop.pin_code] if part
            )
            specs = []
            if prop.bedrooms is not None:
                specs.append(f"{prop.bedrooms} Bed{'s' if prop.bedrooms != 1 else ''}")
            if prop.bathrooms is not None:
                specs.append(f"{prop.bathrooms} Bath{'s' if prop.bathrooms != 1 else ''}")
            if prop.built_up_area is not None:
                specs.append(f"{prop.built_up_area} sq.ft")
            if prop.furnishing_status:
                specs.append(prop.get_furnishing_status_display())
            specs_str = " • ".join(specs) if specs else "Not specified"

            prop_admin_url = reverse("admin:properties_property_change", args=[prop.pk])

            return mark_safe(f'''
                <div style="padding: 12px 14px; border-radius: 8px; border: 1px solid #E5E7EB; background: #F9FAFB; font-size: 12px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 13px; font-weight: 600; color: #111827;">
                            {prop.title}
                        </span>
                        <a href="{prop_admin_url}" target="_blank" style="color: #059669; font-weight: 500; text-decoration: none;">
                            Open Property Record ↗
                        </a>
                    </div>
                    <div style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); display: grid; gap: 10px; padding-top: 4px;">
                        <div>
                            <span style="color: #6B7280; font-size: 11px; display: block;">Owner</span>
                            <strong style="color: #1F2937;">{owner_name}</strong>
                        </div>
                        <div>
                            <span style="color: #6B7280; font-size: 11px; display: block;">Type</span>
                            <strong style="color: #1F2937;">{prop.get_category_display()} &bull; {prop.get_property_type_display()}</strong>
                        </div>
                        <div>
                            <span style="color: #6B7280; font-size: 11px; display: block;">Specs</span>
                            <strong style="color: #1F2937;">{specs_str}</strong>
                        </div>
                        <div>
                            <span style="color: #6B7280; font-size: 11px; display: block;">Property Status</span>
                            <strong style="color: #1F2937;">{prop.get_status_display()}</strong>
                        </div>
                    </div>
                    <div style="color: #4B5563; font-size: 11px; border-top: 1px solid #E5E7EB; padding-top: 6px;">
                        <span style="color: #9CA3AF;">Address:</span> {address}
                    </div>
                </div>
            ''')
        except Exception as exc:
            return mark_safe(f'<span style="color:#6B7280; font-size:12px;">Unable to load property summary: {exc}</span>')

    @display(description=_("Photo"))
    def property_images_preview(self, obj):
        images = obj.property.images.all()
        primary_img = images.filter(is_primary=True).first() or images.first()
        if not primary_img:
            return mark_safe('<span style="color:#9CA3AF; font-size:11px;">No photo</span>')

        total = images.count()
        badge_html = (
            f'<span style="position: absolute; bottom: 2px; right: 2px; background: rgba(0, 0, 0, 0.72); color: #FFFFFF; font-size: 9px; font-weight: 600; padding: 1px 3px; border-radius: 2px; line-height: 1;">+{total - 1}</span>'
            if total > 1
            else ""
        )

        html = f'''
        <div style="position: relative; width: 48px; height: 36px; border-radius: 4px; overflow: hidden; border: 1px solid #E5E7EB; background: #F3F4F6; display: inline-block; vertical-align: middle;">
            <img src="{primary_img.image_url}"
                 alt="Property photo"
                 style="width: 100%; height: 100%; object-fit: cover; display: block;"
                 onerror="this.onerror=null; this.src='https://placehold.co/400x300?text=Img';" />
            {badge_html}
        </div>
        '''
        return mark_safe(html)

    @display(
        description=_("Status"),
        ordering="status",
        label={
            "published": "success",
            "paused": "warning",
            "draft": "info",
            "closed": "danger",
        },
    )
    def show_status(self, obj):
        return (obj.status, obj.get_status_display()) if obj.status else None

    @display(
        description=_("Review Status"),
        ordering="review_status",
        label={
            "draft": "info",
            "pending": "warning",
            "resubmitted": "info",
            "approved": "success",
            "rejected": "danger",
        },
    )
    def show_review_status(self, obj):
        if not obj or not obj.review_status:
            return None
        if obj.review_status == ReviewStatus.PENDING and obj.reviewed_at is not None:
            return ("resubmitted", "Resubmitted")
        return (obj.review_status, obj.get_review_status_display())

    @admin.action(description=_("Approve selected listings"))
    def approve_selected_listings(self, request, queryset):
        success_count = 0
        for listing in queryset:
            try:
                approve_listing(admin_user=request.user, listing_instance=listing)
                success_count += 1
            except Exception as e:
                self.message_user(
                    request,
                    f"Failed to approve '{listing.title}': {e}",
                    level=messages.ERROR,
                )
        if success_count:
            self.message_user(
                request,
                f"Successfully approved and published {success_count} listing(s).",
                level=messages.SUCCESS,
            )

    @admin.action(description=_("Reject selected listings with reason"))
    def reject_selected_listings(self, request, queryset):
        if "post" in request.POST:
            rejection_reason = request.POST.get("rejection_reason", "").strip()
            if not rejection_reason:
                self.message_user(request, "A non-empty rejection reason is required.", level=messages.ERROR)
                return None
            success_count = 0
            for listing in queryset:
                try:
                    reject_listing(
                        admin_user=request.user,
                        listing_instance=listing,
                        rejection_reason=rejection_reason,
                    )
                    success_count += 1
                except Exception as e:
                    self.message_user(
                        request,
                        f"Failed to reject '{listing.title}': {e}",
                        level=messages.ERROR,
                    )
            if success_count:
                self.message_user(
                    request,
                    f"Successfully rejected {success_count} listing(s).",
                    level=messages.SUCCESS,
                )
            return None

        return render(
            request,
            "admin/listings/reject_listings.html",
            context={
                **self.admin_site.each_context(request),
                "title": _("Reject Listings"),
                "queryset": queryset,
                "action_checkbox_name": admin.helpers.ACTION_CHECKBOX_NAME,
            },
        )

    def save_model(self, request, obj, form, change):
        if change:
            orig = Listing.objects.get(pk=obj.pk)
            if obj.review_status == ReviewStatus.APPROVED and orig.review_status != ReviewStatus.APPROVED:
                approve_listing(admin_user=request.user, listing_instance=obj)
                return
            if obj.review_status == ReviewStatus.REJECTED and orig.review_status != ReviewStatus.REJECTED:
                if not obj.rejection_reason or not obj.rejection_reason.strip():
                    raise ValidationError(
                        {"rejection_reason": "A non-empty rejection reason is required when rejecting a listing."}
                    )
                reject_listing(
                    admin_user=request.user,
                    listing_instance=obj,
                    rejection_reason=obj.rejection_reason,
                )
                return
        super().save_model(request, obj, form, change)


@admin.register(SavedProperty)
class SavedPropertyAdmin(ModelAdmin):
    list_per_page = 25
    date_hierarchy = "created_at"
    ordering = ("-created_at",)

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
    list_select_related = ("user", "property")
    autocomplete_fields = ("user", "property")
    readonly_fields = (
        "id",
        "created_at",
    )

    fieldsets = (
        (None, {"fields": ("user", "property")}),
        (_("Timestamps"), {"fields": ("id", "created_at")}),
    )

