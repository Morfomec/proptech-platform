import uuid
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models.base import BaseModel


class AmenityCategory(models.TextChoices):
    BUILDING = "building", "Building"
    SAFETY = "safety", "Safety"
    HVAC = "hvac", "HVAC"
    POWER_BACKUP = "power_backup", "Power Backup"
    CONNECTIVITY = "connectivity", "Connectivity"
    RECREATION = "recreation", "Recreation"
    APPLIANCE = "appliance", "Appliance"
    ACCESSIBILITY = "accessibility", "Accessibility"


class Amenity(BaseModel):
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=50, choices=AmenityCategory.choices)
    description = models.CharField(max_length=255, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "amenities"
        ordering = ["category", "name"]
        indexes = [
            models.Index(fields=["category", "is_active"], name="idx_amenity_cat_active"),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"

    def clean(self):
        super().clean()
        if self.category not in AmenityCategory.values:
            raise ValidationError(
                {"category": f"'{self.category}' is not an approved amenity category."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class PropertyAmenity(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="property_amenities",
        db_column="property_id",
    )
    amenity = models.ForeignKey(
        "properties.Amenity",
        on_delete=models.CASCADE,
        related_name="property_amenities",
        db_column="amenity_id",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "property_amenities"
        indexes = [
            models.Index(fields=["amenity"], name="idx_prop_amenity_amenity"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["property", "amenity"],
                name="uq_property_amenity",
            )
        ]

    def __str__(self):
        return f"PropertyAmenity({self.property_id} -> {self.amenity_id})"

