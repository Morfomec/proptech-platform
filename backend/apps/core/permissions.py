from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwner(BasePermission):
    """
    Allow access only to authenticated users with the Owner role.
    """

    message = "Only property owners can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "OWNER"
        )


class IsTenant(BasePermission):
    """
    Allow access only to authenticated users with the Tenant role.
    """

    message = "Only tenants can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "TENANT"
        )


class IsOwnerOrReadOnly(BasePermission):
    """
    Allow read-only access to everyone permitted by authentication
    settings, but write access only to Owners.
    """

    message = "Only property owners can modify this resource."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "OWNER"
        )


class IsObjectOwner(BasePermission):
    """
    Check whether the authenticated user owns the requested object.

    The object must expose an `owner` attribute.
    """

    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(obj, "owner_id", None) == request.user.pk
        )