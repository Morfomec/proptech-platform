from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwner(BasePermission):
    """
    Allow access only to authenticated users with owner capability.
    """

    message = "Only property owners can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_owner", False)
        )


class IsTenant(BasePermission):
    """
    Allow access only to authenticated users with tenant capability.
    """

    message = "Only tenants can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_tenant", False)
        )


class IsAdmin(BasePermission):
    """
    Allow access only to authenticated users with platform admin capability.
    """

    message = "Only platform administrators can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_platform_admin", False)
        )


class IsOwnerOrReadOnly(BasePermission):
    """
    Allow read-only access to everyone permitted by authentication
    settings, but write access only to owners.
    """

    message = "Only property owners can modify this resource."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_owner", False)
        )


class IsObjectOwner(BasePermission):
    """
    Check whether the authenticated user owns the requested object.

    The object must expose an `owner_id` or `owner` attribute.
    """

    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        owner_id = getattr(obj, "owner_id", None)
        if owner_id is not None:
            return owner_id == request.user.pk

        owner = getattr(obj, "owner", None)
        if owner is not None:
            return getattr(owner, "pk", None) == request.user.pk

        return False