import builtins
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateRangeField, RangeOperators
from django.db.models import F, Func, Value, Q, DateField
from django.db.models.expressions import RawSQL
from django.db.models.functions import Coalesce

from apps.core.models import BaseModel
from apps.leasing.models.application import ApplicationStatus


class TenancyStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    ACTIVE = "active", "Active"
    ENDED = "ended", "Ended"
    CANCELLED = "cancelled", "Cancelled"


class Tenancy(BaseModel):

    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.PROTECT,
        related_name="tenancies",
        db_column="property_id",
    )

    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="tenancies",
        db_column="tenant_id",
    )

    application = models.OneToOneField(
        "leasing.Application",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenancy",
        db_column="application_id",
    )

    start_date = models.DateField()

    end_date = models.DateField(
        null=True,
        blank=True,
    )

    monthly_rent = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    security_deposit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    rent_due_day = models.PositiveSmallIntegerField(default=1)

    status = models.CharField(
        max_length=20,
        choices=TenancyStatus.choices,
        default=TenancyStatus.PENDING,
    )

    actual_move_in_date = models.DateField(
        null=True,
        blank=True,
    )

    actual_move_out_date = models.DateField(
        null=True,
        blank=True,
    )

    notes = models.TextField(
        null=True,
        blank=True,
    )


    def clean(self):
        super().clean()

        errors = {}

        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                errors["end_date"] = "End date cannot be before start date."

        if self.monthly_rent is not None and self.monthly_rent < 0:
            errors["monthly_rent"] = "Monthly rent cannot be negative."

        if self.security_deposit is not None and self.security_deposit < 0:
            errors["security_deposit"] = "Security deposit cannot be negative."

        if self.rent_due_day is not None:
            if not 1 <= self.rent_due_day <= 28:
                errors["rent_due_day"] = "Rent due day must be between 1 and 28."

        if self.actual_move_in_date and self.actual_move_out_date:
            if self.actual_move_out_date < self.actual_move_in_date:
                errors["actual_move_out_date"] = (
                    "Move-out date cannot be before move-in date."
                )

        if self.actual_move_out_date and self.start_date:
            if self.actual_move_out_date < self.start_date:
                errors["actual_move_out_date"] = (
                    "Move-out date cannot be before tenancy start date."
                )

        if self.property_id and self.tenant_id:
            if self.property.owner_id == self.tenant_id:
                errors["tenant"] = "Property owner cannot be their own tenant."

        if self.application_id:
            application = self.application

            if application.applicant_id != self.tenant_id:
                errors["application"] = (
                    "Application applicant must match the tenancy tenant."
                )

            if application.listing.property_id != self.property_id:
                errors["application"] = (
                    "Application property must match the tenancy property."
                )

            if application.status != ApplicationStatus.APPROVED:
                errors["application"] = (
                    "Only approved applications can be linked to a tenancy."
                )

        if errors:
            raise ValidationError(errors)

    @builtins.property
    def owner(self):
        """Resolve the property owner through the associated property."""
        return self.property.owner if self.property_id else None

    class Meta:
        db_table = "tenancies"
        ordering = ["-created_at"]

        indexes = [
            models.Index(
                fields=["property", "status"],
                name="idx_tenancy_property_status",
            ),
            models.Index(
                fields=["tenant", "status"],
                name="idx_tenancy_tenant_status",
            ),
            models.Index(
                fields=["start_date", "end_date"],
                name="idx_tenancy_start_end_date",
            ),
        ]

        constraints = [
            # End date must be on or after start date.
            models.CheckConstraint(
                condition=(
                    Q(end_date__isnull=True)
                    | Q(end_date__gte=F("start_date"))
                ),
                name="chk_tenancy_end_after_start",
            ),

            # Monthly rent cannot be negative.
            models.CheckConstraint(
                condition=Q(monthly_rent__gte=0),
                name="chk_tenancy_rent_non_negative",
            ),

            # Security deposit cannot be negative.
            models.CheckConstraint(
                condition=Q(security_deposit__gte=0),
                name="chk_tenancy_deposit_non_negative",
            ),

            # Rent due day must be between 1 and 28.
            models.CheckConstraint(
                condition=Q(rent_due_day__gte=1)
                & Q(rent_due_day__lte=28),
                name="chk_tenancy_rent_due_day",
            ),

            # Prevent overlapping confirmed/active tenancies.
            ExclusionConstraint(
                name="excl_tenancy_property_no_overlap",
                expressions=[
                    (
                        F("property"),
                        RangeOperators.EQUAL,
                    ),
                    (
                        Func(
                            F("start_date"),
                            Coalesce(
                                F("end_date"),
                                RawSQL(
                                    "'infinity'::date",
                                    [],
                                    output_field=DateField(),
                                ),
                                output_field=DateField(),
                            ),
                            Value("[]"),
                            function="daterange",
                            output_field=DateRangeField(),
                        ),
                        RangeOperators.OVERLAPS,
                    ),
                ],
                condition=Q(
                    status__in=[
                        TenancyStatus.CONFIRMED,
                        TenancyStatus.ACTIVE,
                    ]
                ),
                index_type="GIST",
            ),
        ]