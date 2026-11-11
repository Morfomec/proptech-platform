
class NotificationServiceError(Exception):
    """Base exception for notification service errors."""


class InvalidNotificationReferenceError(NotificationServiceError):
    """Raised when a related object reference is invalid."""


class NotificationNotFoundError(NotificationServiceError):
    """Raised when a notification does not exist or is inaccessible."""
