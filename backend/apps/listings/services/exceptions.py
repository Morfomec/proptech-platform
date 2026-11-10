from django.core.exceptions import ValidationError


class ListingServiceError(Exception):
    """Base exception for listing service operations."""
    pass


class ListingNotFoundError(ListingServiceError):
    """Raised when a requested listing cannot be found."""
    pass


class ListingOwnershipError(ListingServiceError, ValidationError):
    """Raised when an operation is attempted by a user who does not own the property/listing."""
    pass


class ListingStateError(ListingServiceError, ValidationError):
    """Raised when an invalid state transition or operation is attempted on a listing."""
    pass


class PropertyImageRequiredError(ListingStateError):
    """Raised when attempting to publish a listing for a property without any uploaded images."""
    pass


class DuplicateOpenListingError(ListingStateError):
    """Raised when an open listing already exists for the physical property."""
    pass


class PropertyNotDiscoverableError(ListingServiceError, ValidationError):
    """Raised when a user attempts to bookmark a property that has no active published listing."""
    pass


class SavedPropertyNotFoundError(ListingServiceError):
    """Raised when a requested saved property bookmark cannot be found."""
    pass

