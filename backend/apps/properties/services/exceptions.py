from django.core.exceptions import ValidationError


class PropertyServiceError(Exception):
    """Base exception for property service operations."""
    pass


class PropertyNotFoundError(PropertyServiceError):
    """Raised when a requested property cannot be found."""
    pass


class InvalidAmenityError(ValidationError):
    """Raised when one or more amenity IDs are invalid, nonexistent, or inactive."""
    pass


class PropertyOwnershipError(ValidationError):
    """Raised when an attempt is made to alter property ownership improperly."""
    pass


class PropertyProtectedError(ValidationError):
    """Raised when attempting to delete a property with protected relationships."""
    pass

