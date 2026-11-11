
from django.db import transaction
from django.utils import timezone

from apps.notifications.models import (
    Notification,
    NotificationType,
    RelatedObjectType,
)

from apps.notifications.services.exceptions import (
    InvalidNotificationReferenceError,
    NotificationNotFoundError,
)


RELATED_OBJECT_MODELS = {
    RelatedObjectType.APPLICATION: ("leasing", "Application"),
    RelatedObjectType.TENANCY: ("leasing", "Tenancy"),
    RelatedObjectType.DOCUMENT: ("documents", "Document"),
}


def _validate_related_object(
    *,
    related_object_type,
    related_object_id,
):
    if related_object_type is None and related_object_id is None:
        return

    if not related_object_type or not related_object_id:
        raise InvalidNotificationReferenceError(
            "Both related object type and ID must be provided."
        )

    model_path = RELATED_OBJECT_MODELS.get(related_object_type)

    if model_path is None:
        raise InvalidNotificationReferenceError(
            "Unsupported related object type."
        )

    from django.apps import apps

    app_label, model_name = model_path
    model = apps.get_model(app_label, model_name)

    if model is None or not model.objects.filter(
        pk=related_object_id
    ).exists():
        raise InvalidNotificationReferenceError(
            "Related object does not exist."
        )


@transaction.atomic
def create_notification(
    *,
    user,
    notification_type,
    title,
    message,
    related_object_type=None,
    related_object_id=None,
):
    if not user or not user.is_authenticated:
        raise ValueError("A valid authenticated recipient is required.")

    if notification_type not in NotificationType.values:
        raise ValueError("Invalid notification type.")

    _validate_related_object(
        related_object_type=related_object_type,
        related_object_id=related_object_id,
    )

    return Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
    )


def get_user_notifications(*, user, is_read=None):
    queryset = Notification.objects.filter(user=user)

    if is_read is not None:
        queryset = queryset.filter(is_read=is_read)

    return queryset


def get_notification_by_id(*, user, notification_id):
    notification = Notification.objects.filter(
        user=user,
        id=notification_id,
    ).first()

    if notification is None:
        raise NotificationNotFoundError(
            "Notification not found."
        )

    return notification


def get_unread_notification_count(*, user):
    return Notification.objects.filter(
        user=user,
        is_read=False,
    ).count()


@transaction.atomic
def mark_notification_as_read(*, user, notification_id):
    notification = (
        Notification.objects.select_for_update()
        .filter(user=user, id=notification_id)
        .first()
    )

    if notification is None:
        raise NotificationNotFoundError(
            "Notification not found."
        )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = timezone.now()

        notification.save(
            update_fields=["is_read", "read_at"]
        )

    return notification


@transaction.atomic
def mark_all_notifications_as_read(*, user):
    now = timezone.now()

    return Notification.objects.filter(
        user=user,
        is_read=False,
    ).update(
        is_read=True,
        read_at=now,
    )
