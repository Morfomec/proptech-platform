class SubscriptionError(Exception):
    """Base exception for subscription domain errors."""

    def __init__(self, message=None):
        self.message = message or "A subscription error occurred."
        super().__init__(self.message)


class SubscriptionPlanNotFoundError(SubscriptionError):
    """Raised when a requested subscription plan does not exist or is inactive."""


class SubscriptionNotFoundError(SubscriptionError):
    """Raised when an owner has no subscription."""


class SubscriptionStateError(SubscriptionError):
    """Raised when a subscription state transition is invalid or expired/cancelled."""


class PropertyQuotaExceededError(SubscriptionError):
    """Raised when property creation would exceed the owner's active plan quota."""

    def __init__(self, message=None, *, current_count=None, max_limit=None):
        self.current_count = current_count
        self.max_limit = max_limit
        super().__init__(
            message
            or f"Property quota exceeded. Current count: {current_count}, Max allowed: {max_limit}."
        )


class SubscriptionOwnershipError(SubscriptionError):
    """Raised when a user attempts to access or mutate another owner's subscription."""

