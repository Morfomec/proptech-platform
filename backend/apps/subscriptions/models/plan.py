from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models.base import BaseModel


class SubscriptionPlan(BaseModel):
    """
    Subscription plan tiers for property owners.
    Controls property quota and monthly pricing.
    """

    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=30, unique=True)

    min_properties = models.PositiveIntegerField()
    max_properties = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Null represents unlimited properties (Enterprise).",
    )

    monthly_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Null represents custom pricing (Enterprise).",
    )
    currency = models.CharField(max_length=3, default="INR")

    trial_duration_months = models.PositiveSmallIntegerField(default=3)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "subscription_plans"
        ordering = ["min_properties", "monthly_price"]
        indexes = [
            models.Index(fields=["is_active"], name="idx_sub_plan_is_active"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(min_properties__gte=1),
                name="chk_sub_plan_min_properties_gte_1",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(max_properties__isnull=True)
                    | models.Q(max_properties__gte=models.F("min_properties"))
                ),
                name="chk_sub_plan_max_properties_gte_min",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(monthly_price__isnull=True)
                    | models.Q(monthly_price__gte=Decimal("0.00"))
                ),
                name="chk_sub_plan_monthly_price_non_negative",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"

    def clean(self):
        super().clean()
        if self.min_properties is not None and self.min_properties < 1:
            raise ValidationError(
                {"min_properties": "Minimum properties must be at least 1."}
            )

        if (
            self.max_properties is not None
            and self.min_properties is not None
            and self.max_properties < self.min_properties
        ):
            raise ValidationError(
                {"max_properties": "Maximum properties cannot be less than minimum properties."}
            )

        if self.monthly_price is not None and self.monthly_price < Decimal("0.00"):
            raise ValidationError(
                {"monthly_price": "Monthly price cannot be negative."}
            )

        # Cross-plan property range validation among active plans
        if self.is_active and self.min_properties is not None:
            active_plans = SubscriptionPlan.objects.filter(is_active=True)
            if self.pk:
                active_plans = active_plans.exclude(pk=self.pk)

            self_min = self.min_properties
            self_max = self.max_properties if self.max_properties is not None else float("inf")

            for other in active_plans:
                if other.min_properties is None:
                    continue
                other_min = other.min_properties
                other_max = other.max_properties if other.max_properties is not None else float("inf")

                # If both have unlimited properties
                if self.max_properties is None and other.max_properties is None:
                    raise ValidationError(
                        {"max_properties": f"Only one active plan can have unlimited properties. '{other.name}' already has unlimited properties."}
                    )

                # Check if intervals [self_min, self_max] and [other_min, other_max] overlap
                if self_min <= other_max and other_min <= self_max:
                    if self_min < other_min:
                        raise ValidationError(
                            {
                                "max_properties": (
                                    f"Maximum properties ({self.max_properties}) cannot overlap with '{other.name}', "
                                    f"which starts at {other.min_properties} properties."
                                )
                            }
                        )
                    elif self_min > other_min:
                        other_limit_desc = (
                            f"up to {other.max_properties}"
                            if other.max_properties is not None
                            else "unlimited"
                        )
                        raise ValidationError(
                            {
                                "min_properties": (
                                    f"Minimum properties ({self.min_properties}) cannot overlap with '{other.name}', "
                                    f"which allows {other_limit_desc} properties."
                                )
                            }
                        )
                    else:
                        raise ValidationError(
                            {
                                "min_properties": (
                                    f"Minimum properties ({self.min_properties}) conflicts with '{other.name}' "
                                    f"which has the same minimum."
                                )
                            }
                        )

    @property
    def is_custom_pricing(self) -> bool:
        return self.monthly_price is None

    @property
    def is_unlimited_properties(self) -> bool:
        return self.max_properties is None

