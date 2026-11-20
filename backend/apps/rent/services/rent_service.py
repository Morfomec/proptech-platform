import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.leasing.models import Tenancy, TenancyStatus
from apps.rent.models import RentCharge, RentChargeStatus, RentChargeType
from apps.rent.services.exceptions import TenancyNotActiveError


def _calculate_next_month(year: int, month: int) -> tuple[int, int]:
    """Return (next_year, next_month)."""
    if month == 12:
        return year + 1, 1
    return year, month + 1


def _days_in_month(year: int, month: int) -> int:
    """Return total number of days in the given year and month."""
    return calendar.monthrange(year, month)[1]


def compute_billing_period_and_amount(
    *,
    tenancy: Tenancy,
    cycle_year: int,
    cycle_month: int,
) -> tuple[date, date, date, Decimal]:
    """
    Computes (period_start, period_end, due_date, charge_amount) for a given tenancy cycle.
    
    Billing period spans full calendar month or tenancy start/end bounds:
    - period_start = max(tenancy.start_date, date(cycle_year, cycle_month, 1))
    - month_last_day = date(cycle_year, cycle_month, days_in_month)
    - period_end = min(tenancy.end_date, month_last_day) if tenancy.end_date else month_last_day
    
    Proration rule:
    If period_start != date(cycle_year, cycle_month, 1) or period_end != month_last_day:
        active_days = (period_end - period_start).days + 1
        total_days = days_in_month
        amount = round(tenancy.monthly_rent * active_days / total_days, 2)
    Else:
        amount = tenancy.monthly_rent
        
    Due date calculation:
    Clamped to tenancy.rent_due_day within cycle_month (or 28 per tenancy constraint).
    due_date = date(cycle_year, cycle_month, min(tenancy.rent_due_day, days_in_month))
    """
    total_month_days = _days_in_month(cycle_year, cycle_month)
    month_first_day = date(cycle_year, cycle_month, 1)
    month_last_day = date(cycle_year, cycle_month, total_month_days)

    period_start = max(tenancy.start_date, month_first_day)
    period_end = min(tenancy.end_date, month_last_day) if tenancy.end_date else month_last_day

    if period_start > period_end:
        raise ValidationError("Calculated period start exceeds period end.")

    active_days = (period_end - period_start).days + 1
    if active_days == total_month_days:
        amount = tenancy.monthly_rent
    else:
        # Prorated rent based on actual days in this calendar month
        daily_rate = tenancy.monthly_rent / Decimal(total_month_days)
        amount = (daily_rate * Decimal(active_days)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    # Ensure amount is strictly positive
    amount = max(amount, Decimal("0.01"))

    # Clamp rent_due_day to valid day in this month (1..28 guaranteed by tenancy)
    due_day = min(tenancy.rent_due_day, total_month_days)
    due_date = date(cycle_year, cycle_month, due_day)

    # If the billing period starts after the standard monthly due date
    # (e.g. tenancy starts mid-month on Nov 13, but recurring due day is Day 1 of month),
    # the initial prorated charge is due on the tenancy start date (move-in),
    # never backdated to a past date before the tenancy began.
    if due_date < period_start:
        due_date = period_start

    return period_start, period_end, due_date, amount


@transaction.atomic
def generate_security_deposit_charge(*, tenancy: Tenancy) -> Optional[RentCharge]:
    """
    Generates a separate security deposit charge when a tenancy becomes active,
    only when tenancy.security_deposit > 0.
    Ensures the deposit charge is generated at most once per tenancy.
    """
    if tenancy.status != TenancyStatus.ACTIVE:
        raise TenancyNotActiveError(
            f"Cannot generate security deposit charge: Tenancy is in '{tenancy.status}' status, expected 'active'."
        )

    if not tenancy.security_deposit or tenancy.security_deposit <= Decimal("0.00"):
        return None

    # Check if a security deposit charge already exists for this tenancy
    existing = RentCharge.objects.filter(
        tenancy=tenancy,
        charge_type=RentChargeType.SECURITY_DEPOSIT,
    ).first()
    if existing:
        return existing

    # Billing period start/end for deposit matches the tenancy start date
    deposit_period_start = tenancy.start_date
    deposit_period_end = tenancy.end_date if tenancy.end_date else tenancy.start_date
    due_date = tenancy.start_date

    charge = RentCharge.objects.create(
        tenancy=tenancy,
        charge_type=RentChargeType.SECURITY_DEPOSIT,
        billing_period_start=deposit_period_start,
        billing_period_end=deposit_period_end,
        due_date=due_date,
        amount=tenancy.security_deposit,
        status=RentChargeStatus.UNPAID,
        description="Security Deposit",
    )
    return charge


@transaction.atomic
def generate_initial_rent_charge(*, tenancy: Tenancy) -> tuple[Optional[RentCharge], Optional[RentCharge]]:
    """
    Generates the initial rent charge and security deposit charge (if > 0)
    when a tenancy becomes active.
    Returns (rent_charge, security_deposit_charge).
    Idempotent and transaction-safe.
    """
    if tenancy.status != TenancyStatus.ACTIVE:
        raise TenancyNotActiveError(
            f"Cannot generate rent charge: Tenancy is in '{tenancy.status}' status, expected 'active'."
        )

    # 1. Generate security deposit charge if security_deposit > 0
    deposit_charge = generate_security_deposit_charge(tenancy=tenancy)

    # 2. Generate initial rent charge
    cycle_year = tenancy.start_date.year
    cycle_month = tenancy.start_date.month

    period_start, period_end, due_date, amount = compute_billing_period_and_amount(
        tenancy=tenancy,
        cycle_year=cycle_year,
        cycle_month=cycle_month,
    )

    # Idempotency check: see if rent charge already exists
    rent_charge = RentCharge.objects.filter(
        tenancy=tenancy,
        charge_type=RentChargeType.RENT,
        billing_period_start=period_start,
    ).first()
    if not rent_charge:
        description = f"Rent for {period_start.strftime('%B %Y')}"
        if (period_end - period_start).days + 1 < _days_in_month(cycle_year, cycle_month):
            description += " (Prorated)"

        rent_charge = RentCharge.objects.create(
            tenancy=tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=period_start,
            billing_period_end=period_end,
            due_date=due_date,
            amount=amount,
            status=RentChargeStatus.UNPAID,
            description=description,
        )

    return rent_charge, deposit_charge


@transaction.atomic
def generate_rent_charge_for_cycle(
    *,
    tenancy: Tenancy,
    cycle_year: int,
    cycle_month: int,
) -> Optional[RentCharge]:
    """
    Generates recurring monthly rent charge for a specific cycle year and month.
    Idempotent: if charge already exists for that cycle, returns existing charge.
    Returns None if tenancy end date has already passed prior to this cycle.
    """
    if tenancy.status != TenancyStatus.ACTIVE:
        return None

    month_first_day = date(cycle_year, cycle_month, 1)
    if tenancy.end_date and tenancy.end_date < month_first_day:
        return None

    total_month_days = _days_in_month(cycle_year, cycle_month)
    month_last_day = date(cycle_year, cycle_month, total_month_days)
    if tenancy.start_date > month_last_day:
        return None

    period_start, period_end, due_date, amount = compute_billing_period_and_amount(
        tenancy=tenancy,
        cycle_year=cycle_year,
        cycle_month=cycle_month,
    )

    existing = RentCharge.objects.filter(
        tenancy=tenancy,
        charge_type=RentChargeType.RENT,
        billing_period_start=period_start,
    ).first()
    if existing:
        return existing

    description = f"Rent for {period_start.strftime('%B %Y')}"
    if (period_end - period_start).days + 1 < total_month_days:
        description += " (Prorated)"

    charge = RentCharge.objects.create(
        tenancy=tenancy,
        charge_type=RentChargeType.RENT,
        billing_period_start=period_start,
        billing_period_end=period_end,
        due_date=due_date,
        amount=amount,
        status=RentChargeStatus.UNPAID,
        description=description,
    )
    return charge


def generate_due_rent_charges_batch(*, target_date: Optional[date] = None) -> List[RentCharge]:
    """
    Batch generator called by management command/scheduler.
    Finds all active tenancies and generates charges for the target month if not already created.
    """
    if target_date is None:
        target_date = timezone.localdate()

    target_year = target_date.year
    target_month = target_date.month

    active_tenancies = Tenancy.objects.filter(status=TenancyStatus.ACTIVE)
    created_charges = []

    for tenancy in active_tenancies:
        charge = generate_rent_charge_for_cycle(
            tenancy=tenancy,
            cycle_year=target_year,
            cycle_month=target_month,
        )
        if charge:
            created_charges.append(charge)

    return created_charges


@transaction.atomic
def backfill_missing_initial_charges(
    *,
    tenancy_id: Optional[str] = None,
) -> List[RentCharge]:
    """
    Safely and idempotently backfills missing initial rent and security deposit
    charges for active tenancies that do not yet have them recorded.

    Adheres strictly to financial domain rules:
    - Only processes tenancies in ACTIVE status.
    - Uses existing `generate_initial_rent_charge` to preserve proration, due dates,
      billing periods, and deposit rules.
    - Idempotent: Does not create duplicate charges.
    """
    qs = Tenancy.objects.filter(status=TenancyStatus.ACTIVE).select_related(
        "property", "tenant"
    )
    if tenancy_id:
        qs = qs.filter(pk=tenancy_id)

    generated_charges: List[RentCharge] = []

    for tenancy in qs:
        # Check if tenancy already has initial rent charge and security deposit charge
        has_rent_charge = RentCharge.objects.filter(
            tenancy=tenancy,
            charge_type=RentChargeType.RENT,
        ).exists()
        has_deposit_charge = (
            RentCharge.objects.filter(
                tenancy=tenancy,
                charge_type=RentChargeType.SECURITY_DEPOSIT,
            ).exists()
            if tenancy.security_deposit and tenancy.security_deposit > Decimal("0.00")
            else True
        )

        if not has_rent_charge or not has_deposit_charge:
            rent_chg, dep_chg = generate_initial_rent_charge(tenancy=tenancy)
            if rent_chg and rent_chg not in generated_charges:
                generated_charges.append(rent_chg)
            if dep_chg and dep_chg not in generated_charges:
                generated_charges.append(dep_chg)

    return generated_charges


def list_user_rent_charges(*, user, role: Optional[str] = None) -> QuerySet[RentCharge]:
    """
    Return all rent charges accessible to the user across their portfolio,
    annotated with effective paid amount and outstanding amount.
    - role='owner': Charges for properties they own.
    - role='tenant': Charges for tenancies they are renting.
    - Admins: All charges.
    """
    from apps.rent.models import (
        PaymentAllocation,
        PaymentAllocationReversal,
        PaymentRefundStatus,
    )
    from django.db.models import (
        Case,
        DecimalField,
        F,
        OuterRef,
        Q,
        Subquery,
        Sum,
        Value,
        When,
    )
    from django.db.models.functions import Coalesce

    if getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False):
        base_qs = RentCharge.objects.all()
    elif role == "owner":
        if not (getattr(user, "is_owner", False) or getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)):
            from apps.rent.services.exceptions import PaymentPermissionError
            raise PaymentPermissionError("You do not have permission to access owner workspace resources.")
        base_qs = RentCharge.objects.filter(tenancy__property__owner=user)
    elif role == "tenant":
        if not (getattr(user, "is_tenant", False) or getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False)):
            from apps.rent.services.exceptions import PaymentPermissionError
            raise PaymentPermissionError("You do not have permission to access tenant workspace resources.")
        base_qs = RentCharge.objects.filter(tenancy__tenant=user)
    else:
        base_qs = RentCharge.objects.filter(
            Q(tenancy__property__owner=user) | Q(tenancy__tenant=user)
        ).distinct()

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

    return (
        base_qs.select_related("tenancy", "tenancy__property", "tenancy__tenant")
        .annotate(
            alloc_sum=Coalesce(
                Subquery(alloc_subquery),
                Value(Decimal("0.00")),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
            rev_sum=Coalesce(
                Subquery(rev_subquery),
                Value(Decimal("0.00")),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
        )
        .annotate(
            eff_alloc=Case(
                When(alloc_sum__gt=F("rev_sum"), then=F("alloc_sum") - F("rev_sum")),
                default=Value(Decimal("0.00")),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
        .annotate(
            charge_outstanding=Case(
                When(
                    status__in=[RentChargeStatus.WAIVED, RentChargeStatus.CANCELLED],
                    then=Value(Decimal("0.00")),
                ),
                When(amount__gt=F("eff_alloc"), then=F("amount") - F("eff_alloc")),
                default=Value(Decimal("0.00")),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )
        .order_by("due_date", "created_at")
    )


def get_owner_rent_summary(*, user, tenancy_id=None, property_id=None) -> dict:
    """
    Calculate portfolio-level financial metrics for the authenticated owner:
    - total_billed: sum of amount for non-waived, non-cancelled RENT charges.
    - total_collected: net successful payments allocated strictly to RENT charges.
    - outstanding_rent: sum of outstanding balance for unpaid/partially_paid RENT charges.
    - overdue_rent: sum of outstanding balance for overdue unpaid/partially_paid RENT charges.
    - total_active_rent_charges: count of active unpaid/partially_paid RENT charges.
    - security_deposits_held: net deposit received minus refunds and adjustments.
    - total_deposits_agreed, total_deposits_received, total_deposits_outstanding, total_deposits_refunded.
    """
    from apps.rent.models import (
        Payment,
        PaymentAllocation,
        PaymentAllocationReversal,
        PaymentRefundStatus,
        PaymentStatus,
    )
    from apps.rent.services.exceptions import PaymentPermissionError
    from django.db.models import Sum

    if not (getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False) or getattr(user, "is_owner", False)):
        raise PaymentPermissionError("You do not have permission to access owner workspace resources.")

    charges_qs = list_user_rent_charges(user=user, role="owner")
    if tenancy_id:
        charges_qs = charges_qs.filter(tenancy_id=tenancy_id)
    if property_id:
        charges_qs = charges_qs.filter(tenancy__property_id=property_id)

    # Exclude waived and cancelled for active billing calculations
    active_charges = charges_qs.exclude(
        status__in=[RentChargeStatus.WAIVED, RentChargeStatus.CANCELLED]
    )

    # 1. RENT ONLY CALCULATIONS
    rent_charges = active_charges.filter(charge_type=RentChargeType.RENT)
    total_billed = rent_charges.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    unpaid_or_partial_rent = rent_charges.filter(
        status__in=[RentChargeStatus.UNPAID, RentChargeStatus.PARTIALLY_PAID]
    )
    outstanding_rent = unpaid_or_partial_rent.aggregate(
        total=Sum("charge_outstanding")
    )["total"] or Decimal("0.00")

    today = timezone.localdate()
    overdue_rent = unpaid_or_partial_rent.filter(due_date__lt=today).aggregate(
        total=Sum("charge_outstanding")
    )["total"] or Decimal("0.00")

    rent_pending = unpaid_or_partial_rent.filter(
        due_date__gte=today, billing_period_start__lte=today
    ).aggregate(total=Sum("charge_outstanding"))["total"] or Decimal("0.00")

    upcoming_rent = unpaid_or_partial_rent.filter(
        billing_period_start__gt=today
    ).aggregate(total=Sum("charge_outstanding"))["total"] or Decimal("0.00")

    total_active_rent_charges = unpaid_or_partial_rent.count()

    # Rent collections: sum of completed payments allocated to rent minus reversals on rent charges
    rent_allocations = PaymentAllocation.objects.filter(
        rent_charge__in=rent_charges,
        payment__status=PaymentStatus.COMPLETED,
    )
    if tenancy_id:
        rent_allocations = rent_allocations.filter(tenancy_id=tenancy_id)
    if property_id:
        rent_allocations = rent_allocations.filter(rent_charge__tenancy__property_id=property_id)
    total_rent_allocated = rent_allocations.aggregate(total=Sum("allocated_amount"))["total"] or Decimal("0.00")

    rent_reversals = PaymentAllocationReversal.objects.filter(
        rent_charge__in=rent_charges,
        refund__status=PaymentRefundStatus.COMPLETED,
    )
    if tenancy_id:
        rent_reversals = rent_reversals.filter(tenancy_id=tenancy_id)
    if property_id:
        rent_reversals = rent_reversals.filter(rent_charge__tenancy__property_id=property_id)
    total_rent_reversed = rent_reversals.aggregate(total=Sum("reversed_amount"))["total"] or Decimal("0.00")

    total_collected = max(Decimal("0.00"), total_rent_allocated - total_rent_reversed)

    # Rent collected this current calendar month
    from django.db.models import Q
    rent_allocations_this_month = rent_allocations.filter(
        Q(payment__paid_at__year=today.year, payment__paid_at__month=today.month)
        | Q(payment__paid_at__isnull=True, payment__created_at__year=today.year, payment__created_at__month=today.month)
    )
    total_rent_allocated_this_month = rent_allocations_this_month.aggregate(total=Sum("allocated_amount"))["total"] or Decimal("0.00")
    rent_reversals_this_month = rent_reversals.filter(
        Q(refund__processed_at__year=today.year, refund__processed_at__month=today.month)
        | Q(refund__processed_at__isnull=True, refund__created_at__year=today.year, refund__created_at__month=today.month)
    )
    total_rent_reversed_this_month = rent_reversals_this_month.aggregate(total=Sum("reversed_amount"))["total"] or Decimal("0.00")
    rent_collected_this_month = max(Decimal("0.00"), total_rent_allocated_this_month - total_rent_reversed_this_month)

    # 2. SECURITY DEPOSIT CALCULATIONS
    deposit_charges = active_charges.filter(charge_type=RentChargeType.SECURITY_DEPOSIT)
    total_deposits_agreed = deposit_charges.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    deposit_allocations = PaymentAllocation.objects.filter(
        rent_charge__in=deposit_charges,
        payment__status=PaymentStatus.COMPLETED,
    )
    if tenancy_id:
        deposit_allocations = deposit_allocations.filter(tenancy_id=tenancy_id)
    if property_id:
        deposit_allocations = deposit_allocations.filter(rent_charge__tenancy__property_id=property_id)
    total_deposits_received = deposit_allocations.aggregate(total=Sum("allocated_amount"))["total"] or Decimal("0.00")

    deposit_reversals = PaymentAllocationReversal.objects.filter(
        rent_charge__in=deposit_charges,
        refund__status=PaymentRefundStatus.COMPLETED,
    )
    if tenancy_id:
        deposit_reversals = deposit_reversals.filter(tenancy_id=tenancy_id)
    if property_id:
        deposit_reversals = deposit_reversals.filter(rent_charge__tenancy__property_id=property_id)
    total_deposits_refunded = deposit_reversals.aggregate(total=Sum("reversed_amount"))["total"] or Decimal("0.00")

    unpaid_or_partial_deposits = deposit_charges.filter(
        status__in=[RentChargeStatus.UNPAID, RentChargeStatus.PARTIALLY_PAID]
    )
    total_deposits_outstanding = unpaid_or_partial_deposits.aggregate(
        total=Sum("charge_outstanding")
    )["total"] or Decimal("0.00")

    security_deposits_held = max(Decimal("0.00"), total_deposits_received - total_deposits_refunded)

    return {
        "total_billed": str(total_billed.quantize(Decimal("0.01"))),
        "total_collected": str(total_collected.quantize(Decimal("0.01"))),
        "rent_collected_this_month": str(rent_collected_this_month.quantize(Decimal("0.01"))),
        "outstanding_rent": str(outstanding_rent.quantize(Decimal("0.01"))),
        "rent_pending": str(rent_pending.quantize(Decimal("0.01"))),
        "overdue_rent": str(overdue_rent.quantize(Decimal("0.01"))),
        "upcoming_rent": str(upcoming_rent.quantize(Decimal("0.01"))),
        "total_active_rent_charges": total_active_rent_charges,
        "currency": "INR",
        # Security Deposit Aggregates
        "security_deposits_held": str(security_deposits_held.quantize(Decimal("0.01"))),
        "pending_deposit_collection": str(total_deposits_outstanding.quantize(Decimal("0.01"))),
        "total_deposits_agreed": str(total_deposits_agreed.quantize(Decimal("0.01"))),
        "total_deposits_received": str(total_deposits_received.quantize(Decimal("0.01"))),
        "total_deposits_outstanding": str(total_deposits_outstanding.quantize(Decimal("0.01"))),
        "total_deposits_refunded": str(total_deposits_refunded.quantize(Decimal("0.01"))),
    }


def list_security_deposits(*, user, tenancy_id=None, property_id=None, role: str = "owner") -> list:
    """
    List security deposit records per tenancy for the authorized user.
    Each item contains:
    - Property
    - Tenant
    - Agreed deposit
    - Deposit received
    - Outstanding deposit
    - Adjustments/deductions
    - Refunds
    - Current deposit held
    - Status
    """
    deposit_charges = list_user_rent_charges(user=user, role=role).filter(
        charge_type=RentChargeType.SECURITY_DEPOSIT
    )

    if tenancy_id:
        deposit_charges = deposit_charges.filter(tenancy_id=tenancy_id)
    if property_id:
        deposit_charges = deposit_charges.filter(tenancy__property_id=property_id)

    records = []
    seen_tenancy_ids = set()

    for chg in deposit_charges:
        tenancy = chg.tenancy
        seen_tenancy_ids.add(tenancy.id)
        tenant = tenancy.tenant
        tenant_name = f"{tenant.first_name} {tenant.last_name}".strip() or tenant.email

        agreed = chg.amount
        received = chg.eff_alloc
        outstanding = chg.charge_outstanding
        refunds = chg.rev_sum
        adjustments = Decimal("0.00")
        if chg.status == RentChargeStatus.WAIVED:
            adjustments = max(Decimal("0.00"), agreed - received)

        deposit_held = max(Decimal("0.00"), received - refunds - adjustments)

        records.append({
            "tenancy_id": tenancy.id,
            "property_id": tenancy.property.id,
            "property_title": tenancy.property.title,
            "tenant_id": tenant.id,
            "tenant_name": tenant_name,
            "tenant_email": tenant.email,
            "agreed_deposit": str(agreed.quantize(Decimal("0.01"))),
            "deposit_received": str(received.quantize(Decimal("0.01"))),
            "outstanding_deposit": str(outstanding.quantize(Decimal("0.01"))),
            "adjustments": str(adjustments.quantize(Decimal("0.01"))),
            "refunds": str(refunds.quantize(Decimal("0.01"))),
            "deposit_held": str(deposit_held.quantize(Decimal("0.01"))),
            "status": chg.status,
            "status_display": chg.get_status_display(),
            "due_date": chg.due_date,
            "charge_id": chg.id,
        })

    # Also check if any active tenancies with security_deposit > 0 are missing a charge record
    from apps.leasing.models import Tenancy, TenancyStatus
    if role == "owner":
        base_tenancies = Tenancy.objects.filter(
            property__owner=user,
            status__in=[TenancyStatus.ACTIVE, TenancyStatus.CONFIRMED],
            security_deposit__gt=Decimal("0.00"),
        )
    elif role == "tenant":
        base_tenancies = Tenancy.objects.filter(
            tenant=user,
            status__in=[TenancyStatus.ACTIVE, TenancyStatus.CONFIRMED],
            security_deposit__gt=Decimal("0.00"),
        )
    else:
        from django.db.models import Q
        base_tenancies = Tenancy.objects.filter(
            Q(property__owner=user) | Q(tenant=user),
            status__in=[TenancyStatus.ACTIVE, TenancyStatus.CONFIRMED],
            security_deposit__gt=Decimal("0.00"),
        ).distinct()

    if tenancy_id:
        base_tenancies = base_tenancies.filter(id=tenancy_id)
    if property_id:
        base_tenancies = base_tenancies.filter(property_id=property_id)

    for t in base_tenancies.exclude(id__in=seen_tenancy_ids).select_related("property", "tenant"):
        tenant_name = f"{t.tenant.first_name} {t.tenant.last_name}".strip() or t.tenant.email
        records.append({
            "tenancy_id": t.id,
            "property_id": t.property.id,
            "property_title": t.property.title,
            "tenant_id": t.tenant.id,
            "tenant_name": tenant_name,
            "tenant_email": t.tenant.email,
            "agreed_deposit": str(t.security_deposit.quantize(Decimal("0.01"))),
            "deposit_received": "0.00",
            "outstanding_deposit": str(t.security_deposit.quantize(Decimal("0.01"))),
            "adjustments": "0.00",
            "refunds": "0.00",
            "deposit_held": "0.00",
            "status": "unpaid",
            "status_display": "Unpaid",
            "due_date": t.start_date,
            "charge_id": None,
        })

    return records


def list_user_transactions(
    *,
    user,
    role: str = "owner",
    tenancy_id=None,
    property_id=None,
    transaction_type=None,
) -> list:
    """
    Returns a unified chronological list of financial transactions (rent payments,
    deposit payments, and refunds) for properties owned by the authenticated owner.
    """
    from apps.rent.models import (
        Payment,
        PaymentRefund,
        RentChargeType,
    )
    from apps.rent.services.exceptions import PaymentPermissionError

    if not (getattr(user, "is_platform_admin", False) or getattr(user, "is_staff", False) or getattr(user, "is_owner", False)):
        raise PaymentPermissionError("You do not have permission to access owner workspace resources.")

    pmt_qs = Payment.objects.filter(
        tenancy__property__owner=user
    ).select_related("tenancy", "tenancy__property", "tenancy__tenant").prefetch_related("allocations__rent_charge")

    if tenancy_id:
        pmt_qs = pmt_qs.filter(tenancy_id=tenancy_id)
    if property_id:
        pmt_qs = pmt_qs.filter(tenancy__property_id=property_id)

    ref_qs = PaymentRefund.objects.filter(
        payment__tenancy__property__owner=user
    ).select_related("payment", "payment__tenancy", "payment__tenancy__property", "payment__tenancy__tenant")

    if tenancy_id:
        ref_qs = ref_qs.filter(payment__tenancy_id=tenancy_id)
    if property_id:
        ref_qs = ref_qs.filter(payment__tenancy__property_id=property_id)

    transactions = []

    for p in pmt_qs:
        alloc_types = {
            a.rent_charge.charge_type
            for a in p.allocations.all()
            if a.rent_charge
        }
        if RentChargeType.SECURITY_DEPOSIT in alloc_types or (p.notes and "[Security Deposit]" in p.notes):
            tx_type = "deposit_payment"
            tx_type_display = "Security Deposit"
        else:
            tx_type = "rent_payment"
            tx_type_display = "Rent Payment"

        if transaction_type and transaction_type != "all" and tx_type != transaction_type:
            continue

        tenant = p.tenancy.tenant
        tenant_name = f"{tenant.first_name} {tenant.last_name}".strip() or tenant.email

        transactions.append({
            "id": p.id,
            "transaction_type": tx_type,
            "transaction_type_display": tx_type_display,
            "tenancy_id": p.tenancy.id,
            "property_id": p.tenancy.property.id,
            "property_title": p.tenancy.property.title,
            "tenant_id": tenant.id,
            "tenant_name": tenant_name,
            "tenant_email": tenant.email,
            "amount": str(p.amount.quantize(Decimal("0.01"))),
            "currency": p.currency,
            "payment_method": p.payment_method,
            "payment_method_display": p.get_payment_method_display(),
            "transaction_reference": p.transaction_reference,
            "date": p.paid_at or p.created_at,
            "status": p.status,
            "status_display": p.get_status_display(),
            "notes": p.notes,
            "payment_id": p.id,
        })

    for r in ref_qs:
        if transaction_type and transaction_type != "all" and transaction_type != "refund":
            continue

        p = r.payment
        tenant = p.tenancy.tenant
        tenant_name = f"{tenant.first_name} {tenant.last_name}".strip() or tenant.email

        transactions.append({
            "id": r.id,
            "transaction_type": "refund",
            "transaction_type_display": "Refund",
            "tenancy_id": p.tenancy.id,
            "property_id": p.tenancy.property.id,
            "property_title": p.tenancy.property.title,
            "tenant_id": tenant.id,
            "tenant_name": tenant_name,
            "tenant_email": tenant.email,
            "amount": str(r.amount.quantize(Decimal("0.01"))),
            "currency": r.currency,
            "payment_method": p.payment_method,
            "payment_method_display": p.get_payment_method_display(),
            "transaction_reference": r.refund_reference or p.transaction_reference,
            "date": r.processed_at or r.created_at,
            "status": r.status,
            "status_display": r.get_status_display(),
            "notes": r.reason,
            "payment_id": p.id,
        })

    transactions.sort(key=lambda x: x["date"], reverse=True)
    return transactions


