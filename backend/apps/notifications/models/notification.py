
import uuid

from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    APPLICATION_SUBMITTED = "application_submitted", "Application Submitted"
    APPLICATION_UNDER_REVIEW = "application_under_review", "Application Under Review"
    APPLICATION_APPROVED = "application_approved", "Application Approved"
    APPLICATION_REJECTED = "application_rejected", "Application Rejected"
    APPLICATION_WITHDRAWN = "application_withdrawn", "Application Withdrawn"

    TENANCY_CREATED = "tenancy_created", "Tenancy Created"
    TENANCY_CONFIRMED = "tenancy_confirmed", "Tenancy Confirmed"
    TENANCY_ACTIVATED = "tenancy_activated", "Tenancy Activated"
    TENANCY_CANCELLED = "tenancy_cancelled", "Tenancy Cancelled"
    TENANCY_ENDED = "tenancy_ended", "Tenancy Ended"

    DOCUMENT_UPLOADED = "document_uploaded", "Document Uploaded"


class RelatedObjectType(models.TextChoices):
    APPLICATION = "application", "Application"
    TENANCY = "tenancy", "Tenancy"
    DOCUMENT = "document", "Document"


class Notification(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_column="user_id",
    )

    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
    )

    title = models.CharField(max_length=200)

    message = models.TextField()

    related_object_type = models.CharField(
        max_length=50,
        choices=RelatedObjectType.choices,
        null=True,
        blank=True,
    )

    related_object_id = models.UUIDField(
        null=True,
        blank=True,
    )

    is_read = models.BooleanField(default=False)

    read_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"

        ordering = ["-created_at"]

        indexes = [
            models.Index(
                fields=["user", "is_read", "created_at"],
                name="idx_notif_user_read_created",
            ),
            models.Index(
                fields=["user", "created_at"],
                name="idx_notif_user_created",
            ),
        ]

    def __str__(self):
        return f"{self.notification_type} - {self.user}"
