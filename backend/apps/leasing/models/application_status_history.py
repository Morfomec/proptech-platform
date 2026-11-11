import uuid

from django.conf import settings
from django.db import models

from apps.leasing.models.application import Application


class ApplicationStatusHistory(models.Model):
    """
    Append-only record of application status transitions.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="status_history",
        db_column="application_id",
    )

    previous_status = models.CharField(
        max_length=20,
        null=True,
        blank=True,
    )

    new_status = models.CharField(max_length=20)

    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="application_status_changes",
        db_column="changed_by_id",
    )

    change_reason = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "application_status_history"
        ordering = ["created_at"]
        indexes = [
            models.Index(
                fields=["application", "created_at"],
                name="idx_app_hist_app_created",
            ),
        ]

    def __str__(self):
        return (
            f"{self.application_id}: "
            f"{self.previous_status} → {self.new_status}"
        )