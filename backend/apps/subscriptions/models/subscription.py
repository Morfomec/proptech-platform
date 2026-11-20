from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models.base import BaseModel
from apps.subscriptions.models.plan import SubscriptionPlan


class SubscriptionStatus(models.TextChoices):
    TRIALING = "trialing", "Trialing"
    ACTIVE = "active", "Active"
    PAST_DUE = "past_due", "Past Due"
    CANCELLED = "cancelled", "Cancelled"
    EXPIRED = "expired", "Expired"


class Subscription(BaseModel):
    """
    Owner subscription representing active SaaS billing tier and quota entitlement.
    Enforces strictly 1 subscription per owner account.
    """

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="subscription",
        db_column="owner_id",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="subscriptions",
        db_column="plan_id",
    )

    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIALING,
    )

    trial_started_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)

    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "subscriptions"
        indexes = [
            models.Index(fields=["plan_id", "status"], name="idx_sub_plan_status"),
            models.Index(
                fields=["status", "current_period_end"],
                name="idx_sub_status_period_end",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(trial_started_at__isnull=True)
                    | models.Q(trial_ends_at__isnull=True)
                    | models.Q(trial_ends_at__gt=models.F("trial_started_at"))
                ),
                name="chk_sub_trial_end_after_start",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(current_period_start__isnull=True)
                    | models.Q(current_period_end__isnull=True)
                    | models.Q(current_period_end__gt=models.F("current_period_start"))
                ),
                name="chk_sub_period_end_after_start",
            ),
        ]

    def __str__(self):
        return f"Subscription({self.owner.email} - {self.plan.code} [{self.status}])"

    def clean(self):
        super().clean()
        if (
            self.trial_started_at
            and self.trial_ends_at
            and self.trial_ends_at <= self.trial_started_at
        ):
            raise ValidationError(
                {"trial_ends_at": "Trial end date must be strictly after trial start date."}
            )

        if (
            self.current_period_start
            and self.current_period_end
            and self.current_period_end <= self.current_period_start
        ):
            raise ValidationError(
                {
                    "current_period_end": (
                        "Current billing period end must be strictly after period start."
                    )
                }
            )

    @property
    def is_entitled_to_quota(self) -> bool:
        """
        Returns True if the subscription is in a state that allows property management.
        Trialing and Active subscriptions are entitled.
        Past due, cancelled, or expired subscriptions reject quota.
        """
        now = timezone.now()
        if self.status == SubscriptionStatus.TRIALING:
            if self.trial_ends_at and self.trial_ends_at < now:
                return False
            return True
        if self.status == SubscriptionStatus.ACTIVE:
            if self.current_period_end and self.current_period_end < now:
                return False
            return True
        return False

