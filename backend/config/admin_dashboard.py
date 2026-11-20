from decimal import Decimal
from typing import Any, Dict, List

from django.db.models import (
    Case,
    DecimalField,
    F,
    OuterRef,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from django.http import HttpRequest
from django.urls import reverse


def get_financial_metrics(user) -> Dict[str, Any]:
    """
    Calculate financial metrics with ledger integrity.

    Rules:
    - Completed payments: Sum of amount where Payment.status == 'completed'.
    - Completed refunds: Sum of amount where PaymentRefund.status == 'completed'.
    - Net collections = completed payments minus completed refunds (never clamped to 0).
    - Outstanding rent: Calculated strictly per eligible rent charge using effective
      allocations after completed reversals, then summed across all non-waived/non-cancelled charges.
    """
    from apps.rent.models import (
        Payment,
        PaymentAllocation,
        PaymentAllocationReversal,
        PaymentRefund,
        PaymentRefundStatus,
        PaymentStatus,
        RentCharge,
        RentChargeStatus,
    )

    # 1. Total completed payments
    completed_payments_qs = Payment.objects.filter(status=PaymentStatus.COMPLETED)
    total_completed_payments = (
        completed_payments_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    )
    completed_payments_count = completed_payments_qs.count()

    # 2. Completed refunds
    completed_refunds_qs = PaymentRefund.objects.filter(
        status=PaymentRefundStatus.COMPLETED
    )
    completed_refunds_amt = (
        completed_refunds_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    )
    completed_refunds_count = completed_refunds_qs.count()

    # 3. Pending refunds
    pending_refunds_qs = PaymentRefund.objects.filter(
        status=PaymentRefundStatus.PENDING
    )
    pending_refunds_amt = (
        pending_refunds_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    )
    pending_refunds_count = pending_refunds_qs.count()

    # 4. Net collections: completed payments minus completed refunds (not clamped to zero)
    net_collections = total_completed_payments - completed_refunds_amt

    # 5. Outstanding rent calculated per eligible rent charge:
    alloc_subquery = (
        PaymentAllocation.objects.filter(rent_charge=OuterRef("pk"))
        .values("rent_charge")
        .annotate(total=Sum("allocated_amount"))
        .values("total")
    )

    rev_subquery = (
        PaymentAllocationReversal.objects.filter(
            rent_charge=OuterRef("pk"),
            refund__status=PaymentRefundStatus.COMPLETED,
        )
        .values("rent_charge")
        .annotate(total=Sum("reversed_amount"))
        .values("total")
    )

    eligible_charges = (
        RentCharge.objects.exclude(
            status__in=[RentChargeStatus.WAIVED, RentChargeStatus.CANCELLED]
        )
        .annotate(
            alloc_sum=Coalesce(
                Subquery(alloc_subquery),
                Value(Decimal("0.00")),
                output_field=DecimalField(),
            ),
            rev_sum=Coalesce(
                Subquery(rev_subquery),
                Value(Decimal("0.00")),
                output_field=DecimalField(),
            ),
        )
        .annotate(
            eff_alloc=Case(
                When(alloc_sum__gt=F("rev_sum"), then=F("alloc_sum") - F("rev_sum")),
                default=Value(Decimal("0.00")),
                output_field=DecimalField(),
            )
        )
        .annotate(
            charge_outstanding=Case(
                When(amount__gt=F("eff_alloc"), then=F("amount") - F("eff_alloc")),
                default=Value(Decimal("0.00")),
                output_field=DecimalField(),
            )
        )
    )

    aggregations = eligible_charges.aggregate(
        total_charges=Sum("amount"),
        total_effective=Sum("eff_alloc"),
        total_outstanding=Sum("charge_outstanding"),
    )

    total_charges_amt = aggregations["total_charges"] or Decimal("0.00")
    effective_allocated = aggregations["total_effective"] or Decimal("0.00")
    outstanding_rent = aggregations["total_outstanding"] or Decimal("0.00")

    return {
        "total_completed_payments": total_completed_payments,
        "completed_payments_count": completed_payments_count,
        "completed_refunds_amt": completed_refunds_amt,
        "completed_refunds_count": completed_refunds_count,
        "pending_refunds_amt": pending_refunds_amt,
        "pending_refunds_count": pending_refunds_count,
        "net_collections": net_collections,
        "outstanding_rent": outstanding_rent,
        "total_charges_amt": total_charges_amt,
        "effective_allocated": effective_allocated,
    }


def get_needs_attention(user) -> List[Dict[str, Any]]:
    """
    Collect operational items requiring attention.
    Only includes items with count > 0 for which the user has view permissions.
    """
    items = []

    # 1. Listings pending review
    if user.is_superuser or user.has_perm("listings.view_listing"):
        from apps.listings.models import Listing, ReviewStatus

        pending_listings = Listing.objects.filter(
            review_status=ReviewStatus.PENDING
        ).count()
        if pending_listings > 0:
            items.append(
                {
                    "label": "Listings pending review",
                    "count": pending_listings,
                    "url": reverse("admin:listings_listing_changelist")
                    + "?review_status__exact=pending",
                    "icon": "rate_review",
                }
            )

    # 2. Applications awaiting review
    if user.is_superuser or user.has_perm("leasing.view_application"):
        from apps.leasing.models import Application, ApplicationStatus

        pending_apps = Application.objects.filter(
            status__in=[ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW]
        ).count()
        if pending_apps > 0:
            items.append(
                {
                    "label": "Applications awaiting review",
                    "count": pending_apps,
                    "url": reverse("admin:leasing_application_changelist")
                    + "?status__exact=submitted",
                    "icon": "assignment_late",
                }
            )

    # 3. Pending refunds (finance permissions)
    if (
        user.is_superuser
        or user.has_perm("rent.view_paymentrefund")
        or user.has_perm("rent.view_payment")
    ):
        from apps.rent.models import PaymentRefund, PaymentRefundStatus

        pending_refunds = PaymentRefund.objects.filter(
            status=PaymentRefundStatus.PENDING
        ).count()
        if pending_refunds > 0:
            items.append(
                {
                    "label": "Refund requests pending",
                    "count": pending_refunds,
                    "url": reverse("admin:rent_paymentrefund_changelist")
                    + "?status__exact=pending",
                    "icon": "hourglass_top",
                }
            )

    return items


def get_recent_activity(user) -> List[Dict[str, Any]]:
    """
    Retrieve unified stream of recent activity across domain entities,
    respecting user permissions. Returns maximum 5 items sorted by timestamp desc.
    """
    activities: List[Dict[str, Any]] = []

    # 1. Payments & Refunds (Finance)
    if user.is_superuser or user.has_perm("rent.view_payment"):
        from apps.rent.models import Payment

        for p in Payment.objects.select_related("tenancy").order_by("-created_at")[:5]:
            ref = p.transaction_reference or str(p.id)[:8]
            activities.append(
                {
                    "description": "Rent Payment Received",
                    "record": f"₹{p.amount:,.2f} • Ref: {ref}",
                    "url": reverse("admin:rent_payment_change", args=[p.id]),
                    "timestamp": p.created_at,
                    "status": p.status,
                    "icon": "payments",
                    "icon_color": "text-primary-600",
                }
            )

    if user.is_superuser or user.has_perm("rent.view_paymentrefund"):
        from apps.rent.models import PaymentRefund

        for r in PaymentRefund.objects.order_by("-created_at")[:5]:
            desc = "Refund Processed" if r.status == "completed" else "Refund Requested"
            activities.append(
                {
                    "description": desc,
                    "record": f"₹{r.amount:,.2f} • {r.reason}",
                    "url": reverse("admin:rent_paymentrefund_change", args=[r.id]),
                    "timestamp": r.created_at,
                    "status": r.status,
                    "icon": "replay",
                    "icon_color": "text-blue-600",
                }
            )

    # 2. Listings
    if user.is_superuser or user.has_perm("listings.view_listing"):
        from apps.listings.models import Listing

        for l in Listing.objects.order_by("-created_at")[:5]:
            activities.append(
                {
                    "description": "Listing Created",
                    "record": l.title,
                    "url": reverse("admin:listings_listing_change", args=[l.id]),
                    "timestamp": l.created_at,
                    "status": l.status,
                    "icon": "sell",
                    "icon_color": "text-amber-600",
                }
            )

    # 3. Tenancies & Applications (Leasing)
    if user.is_superuser or user.has_perm("leasing.view_tenancy"):
        from apps.leasing.models import Tenancy

        for t in Tenancy.objects.select_related("property", "tenant").order_by(
            "-created_at"
        )[:5]:
            activities.append(
                {
                    "description": "Tenancy Agreement",
                    "record": f"{t.property.title} • {t.tenant.email}",
                    "url": reverse("admin:leasing_tenancy_change", args=[t.id]),
                    "timestamp": t.created_at,
                    "status": t.status,
                    "icon": "key",
                    "icon_color": "text-teal-600",
                }
            )

    if user.is_superuser or user.has_perm("leasing.view_application"):
        from apps.leasing.models import Application

        for a in Application.objects.select_related("listing", "applicant").order_by(
            "-created_at"
        )[:5]:
            activities.append(
                {
                    "description": "Rental Application",
                    "record": f"{a.applicant.email} • {a.listing.title}",
                    "url": reverse("admin:leasing_application_change", args=[a.id]),
                    "timestamp": a.created_at,
                    "status": a.status,
                    "icon": "assignment",
                    "icon_color": "text-indigo-600",
                }
            )

    # 4. Properties (if user has property permissions)
    if user.is_superuser or user.has_perm("properties.view_property"):
        from apps.properties.models import Property

        for prop in Property.objects.order_by("-created_at")[:5]:
            activities.append(
                {
                    "description": "Property Added",
                    "record": prop.title,
                    "url": reverse("admin:properties_property_change", args=[prop.id]),
                    "timestamp": prop.created_at,
                    "status": prop.status,
                    "icon": "apartment",
                    "icon_color": "text-primary-600",
                }
            )

    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    return activities[:5]


def dashboard_callback(
    request: HttpRequest, context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Django Unfold dashboard callback function.
    Populates template context with permissions, 4 primary KPI metrics,
    needs attention operational items, and compact unified recent activity.
    """
    user = request.user
    if not user or not user.is_authenticated:
        return context

    perms = {
        "can_view_properties": (
            user.is_superuser or user.has_perm("properties.view_property")
        ),
        "can_view_listings": (
            user.is_superuser or user.has_perm("listings.view_listing")
        ),
        "can_view_leasing": (
            user.is_superuser or user.has_perm("leasing.view_tenancy")
        ),
        "can_view_applications": (
            user.is_superuser or user.has_perm("leasing.view_application")
        ),
        "can_view_finance": (
            user.is_superuser
            or user.has_perm("rent.view_payment")
            or user.has_perm("rent.view_rentcharge")
        ),
        "can_view_refunds": (
            user.is_superuser or user.has_perm("rent.view_paymentrefund")
        ),
    }

    # 1. Four Primary KPI metrics
    kpi_data: Dict[str, Any] = {}
    if perms["can_view_properties"]:
        from apps.properties.models import Property

        kpi_data["total_properties"] = Property.objects.count()

    if perms["can_view_leasing"]:
        from apps.leasing.models import Tenancy, TenancyStatus

        kpi_data["active_tenancies"] = Tenancy.objects.filter(
            status=TenancyStatus.ACTIVE
        ).count()

    if perms["can_view_listings"]:
        from apps.listings.models import Listing, ReviewStatus

        kpi_data["pending_listing_reviews"] = Listing.objects.filter(
            review_status=ReviewStatus.PENDING
        ).count()

    if perms["can_view_finance"]:
        financial_metrics = get_financial_metrics(user)
        kpi_data["outstanding_rent"] = financial_metrics["outstanding_rent"]
        kpi_data["net_collections"] = financial_metrics["net_collections"]
    else:
        financial_metrics = {}

    # 2. Needs Attention section
    needs_attention = get_needs_attention(user)

    # 3. Compact Recent Activity (max 5 items)
    recent_activity = get_recent_activity(user)

    context.update(
        {
            "perms_dashboard": perms,
            "kpi_data": kpi_data,
            # Backwards compatibility keys
            "platform_data": {"total_properties": kpi_data.get("total_properties", 0)},
            "listing_data": {
                "pending_listings": kpi_data.get("pending_listing_reviews", 0)
            },
            "leasing_data": {"active_tenancies": kpi_data.get("active_tenancies", 0)},
            "financial_data": financial_metrics,
            "needs_attention": needs_attention,
            "recent_activity": recent_activity,
        }
    )

    return context
