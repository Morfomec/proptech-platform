import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.leasing.models.tenancy import Tenancy


class TermsProposalStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    SUPERSEDED = "superseded", "Superseded"


class TenancyTermsHistory(models.Model):
    """
    Append-only record of proposed tenancy agreement terms.
    Preserves historical versions and tenant decisions when owners create or revise proposals.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    tenancy = models.ForeignKey(
        Tenancy,
        on_delete=models.PROTECT,
        related_name="terms_history",
        db_column="tenancy_id",
    )

    version = models.PositiveIntegerField(
        help_text="Sequential version number of the proposal for this tenancy.",
    )

    status = models.CharField(
        max_length=20,
        choices=TermsProposalStatus.choices,
        default=TermsProposalStatus.PENDING,
        help_text="Current decision status of this proposal terms version.",
    )

    responded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the tenant accepted, rejected, or proposal was superseded.",
    )

    rejection_reason = models.TextField(
        null=True,
        blank=True,
        help_text="Tenant rejection reason for this specific proposal terms version.",
    )

    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenancy_terms_proposals",
        db_column="proposed_by_id",
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

    start_date = models.DateField()

    end_date = models.DateField(
        null=True,
        blank=True,
    )

    rent_due_day = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(28)],
    )

    notes = models.TextField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenancy_terms_history"
        ordering = ["version"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenancy", "version"],
                name="uq_tenancy_terms_history_tenancy_version",
            ),
        ]

    def clean(self):
        super().clean()
        if self.pk:
            current = (
                TenancyTermsHistory.objects.filter(pk=self.pk)
                .values("status")
                .first()
            )
            if (
                current
                and current["status"] != TermsProposalStatus.PENDING
                and current["status"] != self.status
            ):
                raise ValidationError(
                    {"status": f"Historical terms status cannot be modified once in '{current['status']}'."}
                )

    def transition_status(self, new_status, *, responded_at=None, rejection_reason=None):
        if self.status != TermsProposalStatus.PENDING:
            raise ValidationError(
                {"status": f"Terms history v{self.version} cannot transition from '{self.status}'."}
            )
        self.status = new_status
        self.responded_at = responded_at
        if rejection_reason is not None:
            self.rejection_reason = rejection_reason
        self.full_clean()
        self.save(update_fields=["status", "responded_at", "rejection_reason"])

    def __str__(self):
        return f"Tenancy {self.tenancy_id} Terms v{self.version} ({self.status})"

