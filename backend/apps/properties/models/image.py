import uuid
from django.db import models


class PropertyImage(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="images",
        db_column="property_id",
    )
    image_url = models.CharField(max_length=1000)
    caption = models.CharField(max_length=255, null=True, blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "property_images"
        ordering = ["display_order", "-created_at"]
        indexes = [
            models.Index(fields=["property", "display_order"], name="idx_prop_image_order"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["property"],
                condition=models.Q(is_primary=True),
                name="uq_property_single_primary_image",
            )
        ]

    def __str__(self):
        return f"Image for {self.property_id} (order={self.display_order}, primary={self.is_primary})"

