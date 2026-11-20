class RentError(Exception):
    """Base exception for rent & billing errors."""

    def __init__(self, message=None):
        self.message = message or "A rent billing error occurred."
        super().__init__(self.message)


class RentChargeStateError(RentError):
    """Raised when a rent charge status transition is invalid."""


class TenancyNotActiveError(RentError):
    """Raised when attempting to generate rent charges for an inactive tenancy."""


class PaymentPermissionError(RentError):
    """Raised when a user attempts to record or access payments for an unauthorized tenancy."""


class RefundError(RentError):
    """Base exception for refund operations."""


class RefundValidationError(RefundError):
    """Raised when a refund request violates business rules (e.g. exceeds refundable balance)."""


class RefundPermissionError(RefundError):
    """Raised when an unauthorized user attempts to create or manage refunds."""


class TenancyNotFoundError(RentError):
    """Raised when the specified tenancy does not exist."""


