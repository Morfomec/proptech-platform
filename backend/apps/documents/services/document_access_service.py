
from django.db.models import Q


def can_upload_document(
    user,
    *,
    property_instance=None,
    application_instance=None,
    tenancy_instance=None,
):
    """Check whether a user can upload against the selected parent."""

    if not user or not user.is_authenticated:
        return False

    # Platform administrators have read-only document access.
    if getattr(user, "is_platform_admin", False):
        return False

    parents = [
        property_instance,
        application_instance,
        tenancy_instance,
    ]

    if sum(parent is not None for parent in parents) > 1:
        return False

    if property_instance is not None:
        return property_instance.owner_id == user.id

    if application_instance is not None:
        return application_instance.applicant_id == user.id

    if tenancy_instance is not None:
        return (
            tenancy_instance.tenant_id == user.id
            or tenancy_instance.property.owner_id == user.id
        )

    # Unattached document: authenticated uploader only.
    return True


def can_access_document(user, document):
    """Check whether a user can view or download a document."""

    if not user or not user.is_authenticated:
        return False

    # Platform administrators have read-only access to all documents.
    if getattr(user, "is_platform_admin", False):
        return True

    if document.property_id is not None:
        return document.property.owner_id == user.id

    if document.application_id is not None:
        application = document.application

        return (
            application.applicant_id == user.id
            or application.listing.property.owner_id == user.id
        )

    if document.tenancy_id is not None:
        tenancy = document.tenancy

        return (
            tenancy.tenant_id == user.id
            or tenancy.property.owner_id == user.id
        )

    return document.uploaded_by_id == user.id


def can_modify_document(user, document):
    """
    Check whether a user can edit a document's metadata or replace its file.
    - Platform administrators are read-only.
    - Only the original uploader who retains access to the document may modify it.
    """
    if not user or not user.is_authenticated:
        return False

    if getattr(user, "is_platform_admin", False):
        return False

    return (
        document.uploaded_by_id == user.id
        and can_access_document(user, document)
    )


def get_accessible_documents(user):
    """
    Return a Q object representing documents the user may access.
    """

    if not user or not user.is_authenticated:
        return Q(pk__in=[])

    # Platform administrators can read all documents.
    if getattr(user, "is_platform_admin", False):
        return Q()

    return (
        Q(property__owner=user)
        | Q(application__applicant=user)
        | Q(application__listing__property__owner=user)
        | Q(tenancy__tenant=user)
        | Q(tenancy__property__owner=user)
        | Q(
            uploaded_by=user,
            property__isnull=True,
            application__isnull=True,
            tenancy__isnull=True,
        )
    )
