import os
import uuid
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.db import models, transaction

from apps.properties.models import PropertyImage


def save_property_image_file(*, property_id, file) -> tuple[str, str]:
    """
    Save an uploaded image file into default_storage under properties/<property_id>/<uuid>.<ext>.
    Returns a tuple of (url, storage_path).
    """
    ext = os.path.splitext(getattr(file, "name", "") or "")[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    relative_path = f"properties/{property_id}/{unique_filename}"
    file.seek(0)
    saved_path = default_storage.save(relative_path, file)
    url = default_storage.url(saved_path)
    return url, saved_path


MAX_IMAGES_PER_PROPERTY = 15


@transaction.atomic
def add_property_image(
    *,
    property_instance,
    image_url=None,
    file=None,
    caption=None,
    display_order=None,
    is_primary=False,
):
    """
    Add a new image to a property gallery.
    Accepts either an uploaded binary file or an image_url string.
    Safely unsets existing primary images if is_primary is True.
    Calculates next display_order if omitted.
    Cleans up any newly uploaded file if database persistence fails.
    """
    if property_instance.images.count() >= MAX_IMAGES_PER_PROPERTY:
        raise ValidationError({"file": f"A maximum of {MAX_IMAGES_PER_PROPERTY} images is allowed per property."})

    if not file and (not image_url or not str(image_url).strip()):
        raise ValidationError({"image": "Either a file or an image_url must be provided."})

    saved_path = None
    if file:
        image_url, saved_path = save_property_image_file(
            property_id=property_instance.id,
            file=file,
        )

    try:
        if is_primary:
            # Unset existing primary image(s) for this property
            PropertyImage.objects.filter(
                property=property_instance,
                is_primary=True,
            ).update(is_primary=False)

        if display_order is None:
            max_order = property_instance.images.aggregate(
                models.Max("display_order")
            )["display_order__max"]
            display_order = 0 if max_order is None else max_order + 1

        image = PropertyImage(
            property=property_instance,
            image_url=image_url.strip(),
            caption=caption.strip() if caption else None,
            display_order=display_order,
            is_primary=is_primary,
        )
        image.full_clean()
        image.save()
        return image
    except Exception:
        if saved_path:
            try:
                default_storage.delete(saved_path)
            except Exception:
                pass
        raise



@transaction.atomic
def set_primary_image(*, property_instance, image_instance):
    """
    Designate a specific property image as the primary image.
    Unsets any other primary image on the property atomically.
    """
    if image_instance.property_id != property_instance.id:
        raise ValidationError(
            {"image": "The specified image does not belong to this property."}
        )

    # Unset other primary images on this property
    PropertyImage.objects.filter(
        property=property_instance,
        is_primary=True,
    ).exclude(id=image_instance.id).update(is_primary=False)

    image_instance.is_primary = True
    image_instance.save(update_fields=["is_primary"])

    return image_instance


@transaction.atomic
def remove_property_image(*, image_instance):
    """
    Delete a property image from the gallery.
    """
    image_instance.delete()
    return True

