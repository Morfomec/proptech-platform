import re
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models.base import BaseModel


class PropertyCategory(models.TextChoices):
    RESIDENTIAL = "residential", "Residential"
    COMMERCIAL = "commercial", "Commercial"


class PropertyType(models.TextChoices):
    # Residential types
    INDEPENDENT_HOUSE = "independent_house", "Independent House"
    VILLA = "villa", "Villa"
    APARTMENT = "apartment", "Apartment"
    STUDIO_APARTMENT = "studio_apartment", "Studio Apartment"

    # Commercial types
    OFFICE = "office", "Office"
    SHOP = "shop", "Shop"
    SHOWROOM = "showroom", "Showroom"
    WAREHOUSE = "warehouse", "Warehouse"

    # General / Other
    OTHER = "other", "Other"


RESIDENTIAL_TYPES = {
    PropertyType.INDEPENDENT_HOUSE,
    PropertyType.VILLA,
    PropertyType.APARTMENT,
    PropertyType.STUDIO_APARTMENT,
    PropertyType.OTHER,
}

COMMERCIAL_TYPES = {
    PropertyType.OFFICE,
    PropertyType.SHOP,
    PropertyType.SHOWROOM,
    PropertyType.WAREHOUSE,
    PropertyType.OTHER,
}


class FurnishingStatus(models.TextChoices):
    UNFURNISHED = "unfurnished", "Unfurnished"
    SEMI_FURNISHED = "semi_furnished", "Semi-Furnished"
    FULLY_FURNISHED = "fully_furnished", "Fully Furnished"


class PropertyStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    AVAILABLE = "available", "Available"
    OCCUPIED = "occupied", "Occupied"
    MAINTENANCE = "maintenance", "Maintenance"
    INACTIVE = "inactive", "Inactive"


class Property(BaseModel):
    """
    Property represents an independently rentable physical real estate asset.
    Serves as the central entity for photos, physical specifications, amenities,
    and addresses.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="properties",
        db_column="owner_id",
    )

    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)

    category = models.CharField(
        max_length=20,
        choices=PropertyCategory.choices,
    )
    property_type = models.CharField(
        max_length=30,
        choices=PropertyType.choices,
    )

    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, null=True, blank=True)

    landmark = models.CharField(max_length=255, null=True, blank=True)
    locality = models.CharField(max_length=120)

    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    state = models.CharField(max_length=100)

    pin_code = models.CharField(max_length=10)
    country_code = models.CharField(max_length=2, default="IN")

    # Map-based coordinates
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
    )

    built_up_area = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    # Physical specifications (residential fields nullable for commercial)
    bedrooms = models.SmallIntegerField(null=True, blank=True)
    bathrooms = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
    )
    furnishing_status = models.CharField(
        max_length=20,
        choices=FurnishingStatus.choices,
        null=True,
        blank=True,
    )

    parking_spaces = models.IntegerField(default=0)
    parking_details = models.CharField(max_length=100, null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=PropertyStatus.choices,
        default=PropertyStatus.DRAFT,
    )

    amenities = models.ManyToManyField(
        "properties.Amenity",
        through="properties.PropertyAmenity",
        related_name="properties",
        blank=True,
    )

    class Meta:
        db_table = "properties"
        ordering = ["-created_at"]
        verbose_name_plural = "Properties"
        indexes = [
            models.Index(fields=["owner", "status"], name="idx_property_owner_status"),
            models.Index(fields=["category", "property_type"], name="idx_property_cat_type"),
            models.Index(fields=["city", "locality"], name="idx_property_city_locality"),
            models.Index(fields=["status", "created_at"], name="idx_property_status_created"),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_category_display()} - {self.city})"

    def clean(self):
        super().clean()
        errors = {}

        # 1. Category and property type consistency
        if self.category == PropertyCategory.RESIDENTIAL and self.property_type not in RESIDENTIAL_TYPES:
            errors["property_type"] = (
                f"'{self.property_type}' is not a valid residential property type."
            )
        elif self.category == PropertyCategory.COMMERCIAL and self.property_type not in COMMERCIAL_TYPES:
            errors["property_type"] = (
                f"'{self.property_type}' is not a valid commercial property type."
            )

        # 2. Coordinates validation
        has_lat = self.latitude is not None
        has_lng = self.longitude is not None

        if has_lat != has_lng:
            errors["coordinates"] = (
                "Both latitude and longitude must be provided, or both left blank."
            )

        if has_lat:
            try:
                lat = Decimal(str(self.latitude))
                if not (Decimal("-90.0") <= lat <= Decimal("90.0")):
                    errors["latitude"] = "Latitude must be between -90 and 90 degrees."
            except Exception:
                errors["latitude"] = "Invalid latitude value."

        if has_lng:
            try:
                lng = Decimal(str(self.longitude))
                if not (Decimal("-180.0") <= lng <= Decimal("180.0")):
                    errors["longitude"] = "Longitude must be between -180 and 180 degrees."
            except Exception:
                errors["longitude"] = "Invalid longitude value."

        # Coordinates required before publishing (non-draft)
        if self.status != PropertyStatus.DRAFT and (not has_lat or not has_lng):
            errors["coordinates"] = (
                "Coordinates are required when property is not in draft status."
            )

        # 3. Built-up area validation (> 0 when supplied)
        if self.built_up_area is not None:
            try:
                area = Decimal(str(self.built_up_area))
                if area <= Decimal("0"):
                    errors["built_up_area"] = "Built-up area must be greater than zero."
            except Exception:
                errors["built_up_area"] = "Invalid built-up area value."

        # Parking spaces validation (cannot be negative)
        if self.parking_spaces is not None and self.parking_spaces < 0:
            errors["parking_spaces"] = "Parking spaces cannot be negative."

        # 4. Physical specifications
        if self.category == PropertyCategory.RESIDENTIAL:
            if self.status != PropertyStatus.DRAFT:
                if self.bedrooms is None or self.bedrooms < 0:
                    errors["bedrooms"] = (
                        "Bedrooms count is required for residential properties before publishing."
                    )
                if self.bathrooms is None or Decimal(str(self.bathrooms)) < Decimal("0"):
                    errors["bathrooms"] = (
                        "Bathrooms count is required for residential properties before publishing."
                    )
            else:
                if self.bedrooms is not None and self.bedrooms < 0:
                    errors["bedrooms"] = "Bedrooms count must be greater than or equal to 0."
                if self.bathrooms is not None and Decimal(str(self.bathrooms)) < Decimal("0"):
                    errors["bathrooms"] = "Bathrooms count must be greater than or equal to 0."

        # 5. Indian PIN code format
        if self.country_code == "IN" and self.pin_code:
            clean_pin = str(self.pin_code).strip()
            if not re.fullmatch(r"^\d{6}$", clean_pin):
                errors["pin_code"] = "Indian PIN code must be a 6-digit number."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

