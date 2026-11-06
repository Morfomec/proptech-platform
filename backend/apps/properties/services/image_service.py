from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.properties.models import PropertyImage


@transaction.atomic
def add_property_image(
    *,
    property_instance,
    image_url,
    caption=None,
    display_order=None,
    is_primary=False,
):
    """
    Add a new image to a property gallery.
    Safely unsets existing primary images if is_primary is True.
    Calculates next display_order if omitted.
    """
    if not image_url or not str(image_url).strip():
        raise ValidationError({"image_url": "Image URL cannot be blank."})

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

