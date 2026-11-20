from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.core.permissions import _matches_user
from apps.subscriptions.models import (
    Subscription,
    SubscriptionPayment,
    SubscriptionPaymentMethod,
    SubscriptionPaymentStatus,
    SubscriptionPlan,
    SubscriptionStatus,
)
from apps.subscriptions.services.exceptions import (
    PropertyQuotaExceededError,
    SubscriptionNotFoundError,
    SubscriptionOwnershipError,
    SubscriptionPlanNotFoundError,
    SubscriptionStateError,
)

User = get_user_model()


def list_active_plans() -> QuerySet[SubscriptionPlan]:
    """Return all active subscription plans ordered by min_properties, monthly_price."""
    return SubscriptionPlan.objects.filter(is_active=True).order_by(
        "min_properties", "monthly_price"
    )


def get_plan_by_code(*, code: str) -> SubscriptionPlan:
    """Retrieve an active plan by its unique code."""
    try:
        return SubscriptionPlan.objects.get(code=code, is_active=True)
    except SubscriptionPlan.DoesNotExist:
        raise SubscriptionPlanNotFoundError(f"Subscription plan '{code}' not found or inactive.")


def get_or_create_initial_subscription(*, owner) -> Subscription:
    """
    Retrieve or create the initial Starter trial subscription for an owner account.
    Safe to call concurrently and repeatedly.
    """
    if not owner or not getattr(owner, "is_authenticated", False):
        raise ValidationError("An authenticated user is required for subscription operations.")

    # Fast path: check existing
    existing = Subscription.objects.select_related("plan").filter(owner=owner).first()
    if existing:
        return existing

    with transaction.atomic():
        # Lock owner row
        User.objects.select_for_update().get(pk=owner.pk)

        subscription = Subscription.objects.select_related("plan").filter(owner=owner).first()
        if subscription:
            return subscription

        starter_plan = get_plan_by_code(code="starter")
        now = timezone.now()
        # Trial lasts starter_plan.trial_duration_months (standard 3 months approx 90 days)
        trial_days = starter_plan.trial_duration_months * 30
        trial_ends_at = now + timedelta(days=trial_days)

        subscription = Subscription.objects.create(
            owner=owner,
            plan=starter_plan,
            status=SubscriptionStatus.TRIALING,
            trial_started_at=now,
            trial_ends_at=trial_ends_at,
            current_period_start=now,
            current_period_end=trial_ends_at,
            started_at=now,
        )

        return subscription


def activate_owner_trial(*, user) -> Subscription:
    """
    Explicitly activate the Starter 90-day trial for a verified user and grant owner capability.
    - User must be authenticated and email verified.
    - Sets user.is_owner = True.
    - Idempotent: returns existing subscription without resetting dates if already provisioned.
    """
    if not user or not getattr(user, "is_authenticated", False):
        raise ValidationError("An authenticated user is required to activate an owner trial.")

    if not getattr(user, "email_verified_at", None):
        raise ValidationError("Email verification is required before activating an owner subscription.")

    with transaction.atomic():
        user_record = User.objects.select_for_update().get(pk=user.pk)
        if not user_record.is_owner:
            user_record.is_owner = True
            user_record.save(update_fields=["is_owner", "updated_at"])
            user.is_owner = True

        existing = Subscription.objects.select_related("plan").filter(owner=user_record).first()
        if existing:
            return existing

        return get_or_create_initial_subscription(owner=user_record)


def get_owner_subscription(*, owner) -> Subscription:
    """
    Retrieve the subscription for an owner.
    Only users with owner capability or an existing subscription may access it.
    """
    if not owner or not getattr(owner, "is_authenticated", False):
        raise ValidationError("An authenticated user is required for subscription operations.")

    existing = Subscription.objects.select_related("plan").filter(owner=owner).first()
    if existing:
        return existing

    if not getattr(owner, "is_owner", False):
        raise SubscriptionOwnershipError("Owner subscription access is restricted to property owners.")

    return get_or_create_initial_subscription(owner=owner)


def get_quota_utilization(*, owner) -> dict:
    """
    Calculate the quota utilization for an owner:
    - properties_count: total properties owned (regardless of listing status)
    - max_properties: plan maximum (None if unlimited)
    - min_properties: plan minimum
    - is_quota_exceeded: whether current count >= max limit
    - remaining_quota: remaining slots available before exceeding limit
    - subscription: Subscription instance
    """
    from apps.properties.models import Property

    subscription = get_owner_subscription(owner=owner)
    properties_count = Property.objects.filter(owner=owner).count()
    max_limit = subscription.plan.max_properties

    if max_limit is None:
        remaining_quota = None
        is_exceeded = False
    else:
        remaining_quota = max(0, max_limit - properties_count)
        is_exceeded = properties_count >= max_limit

    return {
        "subscription": subscription,
        "plan": subscription.plan,
        "properties_count": properties_count,
        "max_properties": max_limit,
        "min_properties": subscription.plan.min_properties,
        "remaining_quota": remaining_quota,
        "is_quota_exceeded": is_exceeded,
        "is_entitled": subscription.is_entitled_to_quota,
    }


def validate_and_reserve_property_quota(*, owner) -> Subscription:
    """
    Transaction-safe quota enforcement called during property creation.
    1. Locks the owner User record using select_for_update() inside atomic transaction.
    2. Retrieves or locks the owner's subscription.
    3. Validates subscription status entitlement (trialing or active).
    4. Counts all properties owned by this owner.
    5. Rejects creation if current count >= plan.max_properties.
    6. Returns the validated subscription.
    """
    if not owner or not getattr(owner, "is_authenticated", False):
        raise ValidationError("An authenticated user is required to validate property quota.")

    # 1. Lock owner row to prevent concurrent property creations exceeding quota
    User.objects.select_for_update().get(pk=owner.pk)

    # 2. Retrieve locked subscription
    subscription = Subscription.objects.select_for_update().select_related("plan").filter(owner=owner).first()
    if not subscription:
        subscription = get_or_create_initial_subscription(owner=owner)

    # 3. Check status entitlement
    if not subscription.is_entitled_to_quota:
        raise SubscriptionStateError(
            f"Your subscription is in '{subscription.status}' status and cannot create new properties. "
            "Please upgrade or renew your subscription."
        )

    # 4. Count all properties owned by owner
    from apps.properties.models import Property
    current_count = Property.objects.filter(owner=owner).count()
    max_limit = subscription.plan.max_properties

    # 5. Check boundary
    if max_limit is not None and current_count >= max_limit:
        raise PropertyQuotaExceededError(
            f"Property quota exceeded for the {subscription.plan.name} plan. "
            f"You have reached the maximum limit of {max_limit} properties. "
            "Please upgrade your subscription to add more properties.",
            current_count=current_count,
            max_limit=max_limit,
        )

    return subscription


@transaction.atomic
def upgrade_subscription(*, owner, target_plan_code: str) -> Subscription:
    """
    Upgrade or switch an owner's subscription to a new active plan tier.
    Preserves historical payment records.
    """
    target_plan = get_plan_by_code(code=target_plan_code)

    User.objects.select_for_update().get(pk=owner.pk)
    subscription = Subscription.objects.select_for_update().select_related("plan").filter(owner=owner).first()
    if not subscription:
        subscription = get_or_create_initial_subscription(owner=owner)

    if subscription.plan_id == target_plan.id:
        return subscription

    now = timezone.now()
    old_plan_name = subscription.plan.name
    subscription.plan = target_plan
    # Reset/extend period for 30 days upon upgrade/switch
    subscription.current_period_start = now
    subscription.current_period_end = now + timedelta(days=30)
    if subscription.status in (SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED):
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.cancelled_at = None

    subscription.save(
        update_fields=[
            "plan",
            "current_period_start",
            "current_period_end",
            "status",
            "cancelled_at",
            "updated_at",
        ]
    )

    return subscription


@transaction.atomic
def cancel_subscription(*, owner) -> Subscription:
    """
    Cancel an owner's active subscription.
    """
    User.objects.select_for_update().get(pk=owner.pk)
    subscription = Subscription.objects.select_for_update().select_related("plan").filter(owner=owner).first()
    if not subscription:
        subscription = get_or_create_initial_subscription(owner=owner)

    if subscription.status == SubscriptionStatus.CANCELLED:
        return subscription

    subscription.status = SubscriptionStatus.CANCELLED
    subscription.cancelled_at = timezone.now()
    subscription.save(update_fields=["status", "cancelled_at", "updated_at"])

    return subscription


@transaction.atomic
def record_subscription_payment(
    *,
    subscription_id,
    amount: Decimal,
    currency: str = "INR",
    payment_method: str = SubscriptionPaymentMethod.MANUAL_ADMIN,
    transaction_reference: str = None,
    status: str = SubscriptionPaymentStatus.SUCCESSFUL,
    billing_period_start=None,
    billing_period_end=None,
    paid_at=None,
) -> SubscriptionPayment:
    """
    Record an immutable subscription payment entry and update subscription billing period if successful.
    """
    try:
        subscription = Subscription.objects.select_for_update().select_related("plan").get(pk=subscription_id)
    except Subscription.DoesNotExist:
        raise SubscriptionNotFoundError("Subscription does not exist.")

    now = timezone.now()
    if status == SubscriptionPaymentStatus.SUCCESSFUL and not paid_at:
        paid_at = now

    if not billing_period_start:
        billing_period_start = subscription.current_period_end or now
    if not billing_period_end:
        billing_period_end = billing_period_start + timedelta(days=30)

    payment = SubscriptionPayment(
        subscription=subscription,
        plan=subscription.plan,
        amount=amount,
        currency=currency,
        payment_method=payment_method,
        transaction_reference=transaction_reference,
        status=status,
        billing_period_start=billing_period_start,
        billing_period_end=billing_period_end,
        paid_at=paid_at,
    )
    payment.full_clean()
    payment.save()

    # If payment was successful, update subscription to active and extend period
    if status == SubscriptionPaymentStatus.SUCCESSFUL:
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.current_period_start = billing_period_start
        subscription.current_period_end = billing_period_end
        subscription.cancelled_at = None
        subscription.save(
            update_fields=[
                "status",
                "current_period_start",
                "current_period_end",
                "cancelled_at",
                "updated_at",
            ]
        )

    return payment
