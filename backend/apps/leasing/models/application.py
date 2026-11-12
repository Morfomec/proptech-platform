from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class ApplicationStatus(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    UNDER_REVIEW = "under_review", "Under Review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    WITHDRAWN = "withdrawn", "Withdrawn"
    TENANCY_CANCELLED = "tenancy_cancelled", "Tenancy Cancelled"


ACTIVE_APPLICATION_STATUSES = (
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.APPROVED,
)


class Application(BaseModel):
    """
    Represents a tenant's application for a published property listing.
    """

    listing = models.ForeignKey(
        "listings.Listing",
        on_delete=models.CASCADE,
        related_name="applications",
        db_column="listing_id",
    )

    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="rental_applications",
        db_column="applicant_id",
    )

    status = models.CharField(
        max_length=20,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.SUBMITTED,
    )

    message = models.TextField(null=True, blank=True)

    reviewed_at = models.DateTimeField(null=True, blank=True)

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_applications",
        db_column="reviewed_by_id",
    )

    class Meta:
        db_table = "applications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["listing", "status"],
                name="idx_application_listing_status",
            ),
            models.Index(
                fields=["applicant", "created_at"],
                name="idx_app_applicant_created",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "applicant"],
                condition=models.Q(
                    status__in=[
                        ApplicationStatus.SUBMITTED,
                        ApplicationStatus.UNDER_REVIEW,
                        ApplicationStatus.APPROVED,
                    ]
                ),
                name="uq_active_application_listing_applicant",
            ),
        ]

    def __str__(self):
        return f"Application by {self.applicant} for {self.listing}"

    @property
    def owner(self):
        """Resolve the property owner through the listing."""
        return self.listing.owner

    @property
    def property(self):
        """Resolve the physical property through the listing."""
        return self.listing.property