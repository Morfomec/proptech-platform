from rest_framework.permissions import BasePermission, SAFE_METHODS

OWNERSHIP_ATTRIBUTES = (
    "owner_id",
    "owner",
    "tenant_id",
    "tenant",
    "applicant_id",
    "applicant",
    "user_id",
    "user",
)

NESTED_PARENT_ATTRIBUTES = (
    "property",
    "listing",
    "tenancy",
    "application",
)


def _matches_user(target, request_user):
    """
    Determine whether a target (User instance, UUID, string, int) matches request_user.
    Fails securely if target or request_user is None.
    """
    if target is None or request_user is None:
        return False

    if target == request_user:
        return True

    user_pk = getattr(request_user, "pk", getattr(request_user, "id", None))
    if user_pk is None:
        return False

    target_pk = getattr(target, "pk", getattr(target, "id", target))
    if target_pk is None:
        return False

    if target_pk == user_pk:
        return True

    try:
        return str(target_pk) == str(user_pk)
    except Exception:
        return False


def _check_object_ownership(request_user, obj):
    """
    Verify whether the authenticated request_user owns or is a party to obj
    (either directly via owner, tenant, applicant, or user fields, or via
    nested parent relationships such as property.owner or listing.property.owner).
    """
    if not request_user or not getattr(request_user, "is_authenticated", False):
        return False

    # 1. Direct ownership attributes on obj
    for attr in OWNERSHIP_ATTRIBUTES:
        try:
            val = getattr(obj, attr, None)
        except Exception:
            val = None

        if val is not None and _matches_user(val, request_user):
            return True

    # 2. Nested relationships on obj
    for parent_attr in NESTED_PARENT_ATTRIBUTES:
        try:
            parent = getattr(obj, parent_attr, None)
        except Exception:
            parent = None

        if parent is not None:
            # Check direct attributes on parent (e.g. obj.property.owner)
            for attr in OWNERSHIP_ATTRIBUTES:
                try:
                    val = getattr(parent, attr, None)
                except Exception:
                    val = None

                if val is not None and _matches_user(val, request_user):
                    return True

            # Check secondary nested property (e.g. obj.listing.property.owner)
            try:
                grandparent = getattr(parent, "property", None)
            except Exception:
                grandparent = None

            if grandparent is not None:
                for attr in OWNERSHIP_ATTRIBUTES:
                    try:
                        val = getattr(grandparent, attr, None)
                    except Exception:
                        val = None

                    if val is not None and _matches_user(val, request_user):
                        return True

    return False


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
    settings, but write access only to the authenticated property owner.

    View-level (has_permission):
    - SAFE_METHODS (GET, HEAD, OPTIONS) are allowed for any requester.
    - Write methods (POST, PUT, PATCH, DELETE) require an authenticated user
      with is_owner=True.

    Object-level (has_object_permission):
    - SAFE_METHODS (GET, HEAD, OPTIONS) are allowed for any requester.
    - Write methods require an authenticated user with is_owner=True AND
      verify that the target object belongs to the requesting owner.
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

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        if not (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_owner", False)
        ):
            return False

        return _check_object_ownership(request.user, obj)


class IsObjectOwner(BasePermission):
    """
    Check whether the authenticated user owns or is the party to the requested object.

    Resolves ownership by inspecting:
    - Direct attributes: `owner_id`, `owner`, `tenant_id`, `tenant`,
      `applicant_id`, `applicant`, `user_id`, `user`.
    - Nested attributes: `property.owner_id`, `property.owner`,
      `listing.property.owner_id`, etc.

    Fails securely if the requester is unauthenticated or if ownership
    cannot be established.
    """

    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        return _check_object_ownership(request.user, obj)
