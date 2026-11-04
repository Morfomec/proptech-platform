import re
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError


def validate_file_size(max_size_mb=10):
    """
    Return a validator enforcing a maximum uploaded file size.
    """

    max_size_bytes = max_size_mb * 1024 * 1024

    def validator(file):
        if file.size > max_size_bytes:
            raise ValidationError(
                f"File size cannot exceed {max_size_mb} MB."
            )

    return validator


def validate_image_file(file):
    """
    Validate actual image content, not just the file extension.
    Supports JPEG, PNG and WebP.
    """

    allowed_formats = {"JPEG", "PNG", "WEBP"}

    try:
        file.seek(0)

        with Image.open(file) as image:
            if image.format not in allowed_formats:
                raise ValidationError(
                    "Only JPEG, PNG and WebP images are allowed."
                )

            image.verify()

        file.seek(0)

    except (UnidentifiedImageError, OSError, ValueError):
        raise ValidationError("Invalid or corrupted image file.")

    finally:
        file.seek(0)


def validate_phone_number(value):
    """
    Validate a general international phone number format.
    """

    if not re.fullmatch(r"\+?[0-9\s\-()]{7,20}", value):
        raise ValidationError("Enter a valid phone number.")

    digit_count = len(re.sub(r"\D", "", value))

    if not 7 <= digit_count <= 15:
        raise ValidationError("Phone number must contain 7–15 digits.")


def validate_positive_amount(value):
    """
    Ensure monetary amounts are positive and finite.
    """

    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("Enter a valid monetary amount.")

    if not amount.is_finite() or amount <= 0:
        raise ValidationError("Amount must be greater than zero.")