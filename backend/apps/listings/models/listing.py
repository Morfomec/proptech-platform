import builtins
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models.base import BaseModel


class ListingStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    PAUSED = "paused", "Paused"
    CLOSED = "closed", "Closed"


class ReviewStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


OPEN_LISTING_STATUSES = [
    ListingStatus.DRAFT,
    ListingStatus.PUBLISHED,
    ListingStatus.PAUSED,
]


class Listing(BaseModel):
    """
    Listing represents a commercial offer to rent a physical Property.
    Manages lease terms, rental amounts, availability dates, and publication status.
    Ownership is strictly resolved through the associated physical Property.
    """

    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="listings",
        db_column="property_id",
    )

    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)

    monthly_rent = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    security_deposit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    available_from = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=ListingStatus.choices,
        default=ListingStatus.DRAFT,
    )

    published_at = models.DateTimeField(null=True, blank=True)

    review_status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PENDING,
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_listings",
        db_column="reviewed_by_id",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "listings"
        ordering = ["-created_at"]
        verbose_name = "Listing"
        verbose_name_plural = "Listings"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(monthly_rent__gte=0),
                name="chk_listing_monthly_rent_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(security_deposit__isnull=True)
                | models.Q(security_deposit__gte=0),
                name="chk_listing_security_deposit_non_negative",
            ),
            models.UniqueConstraint(
                fields=["property"],
                condition=models.Q(status__in=["draft", "published", "paused"]),
                name="uq_property_single_open_listing",
            ),
        ]
        indexes = [
            models.Index(
                fields=["status", "published_at"],
                name="idx_listing_status_published",
            ),
            models.Index(
                fields=["property", "status"],
                name="idx_listing_property_status",
            ),
            models.Index(
                fields=["review_status", "status"],
                name="idx_listing_review_status",
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    @builtins.property
    def owner(self):
        """
        Derive owner through the associated physical property.
        """
        return self.property.owner if self.property else None

    def clean(self):
        super().clean()
        errors = {}

        if self.monthly_rent is not None and self.monthly_rent < Decimal("0.00"):
            errors["monthly_rent"] = "Monthly rent must be greater than or equal to zero."

        if self.security_deposit is not None and self.security_deposit < Decimal("0.00"):
            errors["security_deposit"] = "Security deposit must be greater than or equal to zero."

        if (
            hasattr(self, "property")
            and self.property_id
            and self.status in OPEN_LISTING_STATUSES
        ):
            existing_open = (
                Listing.objects.filter(
                    property_id=self.property_id,
                    status__in=OPEN_LISTING_STATUSES,
                )
                .exclude(pk=self.pk)
                .exists()
            )
            if existing_open:
                errors["property"] = (
                    "Property already has an active open listing in draft, published, or paused status."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # Set published_at timestamp on initial publication without overwriting on republish
        if self.status == ListingStatus.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()

        self.full_clean()
        super().save(*args, **kwargs)
