from django.core.exceptions import ValidationError


class ApplicationServiceError(Exception):
    """Base exception for application service operations."""
    pass


class ApplicationNotFoundError(ApplicationServiceError):
    """Raised when an application cannot be found."""
    pass


class ApplicationOwnershipError(ApplicationServiceError, ValidationError):
    """Raised when a user attempts an unauthorized application operation."""
    pass


class ApplicationStateError(ApplicationServiceError, ValidationError):
    """Raised when an invalid application state transition is attempted."""
    pass


class ListingUnavailableError(ApplicationServiceError, ValidationError):
    """Raised when a listing is not available for applications."""
    pass


class DuplicateApplicationError(ApplicationServiceError, ValidationError):
    """Raised when an applicant has already applied to a listing."""
    pass


class TenancyServiceError(Exception):
    """Base exception for tenancy services."""


class TenancyNotFoundError(TenancyServiceError):
    """Raised when a tenancy does not exist."""


class TenancyOwnershipError(
    TenancyServiceError,
    ValidationError,
):
    """Raised when a user does not own the property."""


class TenancyStateError(
    TenancyServiceError,
    ValidationError,
):
    """Raised when a tenancy transition is invalid."""


class TenancyOverlapError(
    TenancyServiceError,
    ValidationError,
):
    """Raised when a property has an overlapping tenancy."""


class TenancyApplicationError(
    TenancyServiceError,
    ValidationError,
):
    """Raised when an application cannot be converted into a tenancy."""