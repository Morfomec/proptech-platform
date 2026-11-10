import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class SavedProperty(models.Model):
    """
    SavedProperty represents a bookmark/favorite relationship between a User and a Property.
    Enables users to track properties of interest for current or future rental listings.
    Directly references Property rather than a specific Listing.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_properties",
        db_column="user_id",
    )

    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="saved_by_users",
        db_column="property_id",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "saved_properties"
        ordering = ["-created_at"]
        verbose_name = "Saved Property"
        verbose_name_plural = "Saved Properties"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "property"],
                name="uq_saved_prop_user_property",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "created_at"],
                name="idx_saved_prop_user_created",
            ),
            models.Index(
                fields=["property"],
                name="idx_saved_prop_property",
            ),
        ]

    def __str__(self):
        user_label = getattr(self.user, "email", str(self.user_id))
        prop_label = getattr(self.property, "title", str(self.property_id))
        return f"{user_label} saved {prop_label}"

    def clean(self):
        super().clean()
        if (
            hasattr(self, "user")
            and hasattr(self, "property")
            and self.user_id
            and self.property_id
        ):
            existing = (
                SavedProperty.objects.filter(
                    user_id=self.user_id,
                    property_id=self.property_id,
                )
                .exclude(pk=self.pk)
                .exists()
            )
            if existing:
                raise ValidationError(
                    {"property": "You have already saved this property."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
