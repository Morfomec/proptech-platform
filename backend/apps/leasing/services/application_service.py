from typing import Optional

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core.permissions import _matches_user
from apps.leasing.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
)
from apps.listings.models import Listing, ListingStatus
from apps.properties.models import PropertyStatus

from apps.leasing.services.exceptions import (
    ApplicationNotFoundError,
    ApplicationOwnershipError,
    ApplicationStateError,
    DuplicateApplicationError,
    ListingUnavailableError,
)

from apps.notifications.models import (
    NotificationType,
    RelatedObjectType,
)

from apps.notifications.services import create_notification


def _verify_tenant(applicant) -> None:
    if not applicant or not getattr(applicant, "is_authenticated", False):
        raise ApplicationOwnershipError(
            {"applicant": "An authenticated user is required."}
        )

    if not getattr(applicant, "is_tenant", False):
        raise ApplicationOwnershipError(
            {"applicant": "Only tenants can submit applications."}
        )


def _verify_owner(owner, application: Application) -> None:
    if not owner or not getattr(owner, "is_authenticated", False):
        raise ApplicationOwnershipError(
            {"owner": "An authenticated user is required."}
        )

    if not getattr(owner, "is_owner", False):
        raise ApplicationOwnershipError(
            {"owner": "Only property owners can review applications."}
        )

    if not _matches_user(application.owner, owner):
        raise ApplicationOwnershipError(
            {"application": "You do not own the property associated with this application."}
        )


def _record_status_change(
    *,
    application: Application,
    previous_status: Optional[str],
    new_status: str,
    changed_by,
    change_reason: Optional[str] = None,
) -> None:
    ApplicationStatusHistory.objects.create(
        application=application,
        previous_status=previous_status,
        new_status=new_status,
        changed_by=changed_by,
        change_reason=change_reason,
    )


@transaction.atomic
def submit_application(
    *,
    applicant,
    listing_id,
    message: Optional[str] = None,
) -> Application:
    """
    Submit an application against a currently published listing.
    """

    _verify_tenant(applicant)

    try:
        listing = (
            Listing.objects
            .select_for_update()
            .select_related("property", "property__owner")
            .get(pk=listing_id)
        )
    except Listing.DoesNotExist:
        raise ApplicationNotFoundError(
            f"Listing with id '{listing_id}' does not exist."
        )

    if listing.status != ListingStatus.PUBLISHED:
        raise ListingUnavailableError(
            {"listing": "Applications can only be submitted to published listings."}
        )

    if listing.property.status != PropertyStatus.AVAILABLE:
        raise ListingUnavailableError(
            {
                "property": (
                    f"Cannot submit application while property is in "
                    f"'{listing.property.status}' status."
                )
            }
        )

    if _matches_user(listing.owner, applicant):
        raise ApplicationOwnershipError(
            {"applicant": "You cannot apply to your own property listing."}
        )

    if Application.objects.filter(
        listing=listing,
        applicant=applicant,
    ).exists():
        raise DuplicateApplicationError(
            {"application": "You have already applied to this listing."}
        )

    try:
        application = Application.objects.create(
            listing=listing,
            applicant=applicant,
            message=message,
            status=ApplicationStatus.SUBMITTED,
        )
    except IntegrityError:
        # The database unique constraint remains the final protection
        # against concurrent duplicate submissions.
        raise DuplicateApplicationError(
            {"application": "You have already applied to this listing."}
        )

    _record_status_change(
        application=application,
        previous_status=None,
        new_status=ApplicationStatus.SUBMITTED,
        changed_by=applicant,
        change_reason="Application submitted.",
    )

    create_notification(
        user=listing.owner,
        notification_type=NotificationType.APPLICATION_SUBMITTED,
        title="New application received",
        message="A tenant has submitted an application for your property.",
        related_object_type=RelatedObjectType.APPLICATION,
        related_object_id=application.id,
    )

    return application


def get_applicant_applications(*, applicant):
    """Return applications belonging to the authenticated tenant."""

    _verify_tenant(applicant)

    return (
        Application.objects
        .filter(applicant=applicant)
        .select_related(
            "listing",
            "listing__property",
            "listing__property__owner",
            "applicant",
            "reviewed_by",
        )
        .prefetch_related("status_history")
        .order_by("-created_at")
    )


def get_received_applications(*, owner):
    """Return applications received for the authenticated owner's listings."""

    if not owner or not getattr(owner, "is_authenticated", False):
        raise ApplicationOwnershipError(
            {"owner": "An authenticated user is required."}
        )

    if not getattr(owner, "is_owner", False):
        raise ApplicationOwnershipError(
            {"owner": "Only property owners can retrieve received applications."}
        )

    return (
        Application.objects
        .filter(listing__property__owner=owner)
        .select_related(
            "listing",
            "listing__property",
            "applicant",
            "reviewed_by",
        )
        .prefetch_related("status_history")
        .order_by("-created_at")
    )


def get_application_by_id(*, application_id) -> Application:
    """Retrieve an application by UUID."""

    try:
        return (
            Application.objects
            .select_related(
                "listing",
                "listing__property",
                "listing__property__owner",
                "applicant",
                "reviewed_by",
            )
            .get(pk=application_id)
        )
    except Application.DoesNotExist:
        raise ApplicationNotFoundError(
            f"Application with id '{application_id}' does not exist."
        )


@transaction.atomic
def review_application(
    *,
    owner,
    application_id,
    new_status: str,
    change_reason: Optional[str] = None,
) -> Application:
    """
    Allow the listing owner to move an application to under_review,
    approved, or rejected.
    """

    try:
        application = (
            Application.objects
            .select_for_update()
            .select_related("listing__property")
            .get(pk=application_id)
        )
    except Application.DoesNotExist:
        raise ApplicationNotFoundError(
            f"Application with id '{application_id}' does not exist."
        )

    _verify_owner(owner, application)

    allowed_statuses = {
        ApplicationStatus.UNDER_REVIEW,
        ApplicationStatus.APPROVED,
        ApplicationStatus.REJECTED,
    }

    if new_status not in allowed_statuses:
        raise ApplicationStateError(
            {"status": "The requested application status is not a valid owner review action."}
        )

    allowed_previous_statuses = {
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
    }

    if application.status not in allowed_previous_statuses:
        raise ApplicationStateError(
            {"status": f"An application in '{application.status}' status cannot be reviewed again."}
        )

    if application.status == new_status:
        raise ApplicationStateError(
            {"status": f"Application is already in '{new_status}' status."}
        )

    previous_status = application.status

    application.status = new_status
    application.reviewed_by = owner
    application.reviewed_at = timezone.now()

    application.full_clean()
    application.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "updated_at",
        ]
    )

    _record_status_change(
        application=application,
        previous_status=previous_status,
        new_status=new_status,
        changed_by=owner,
        change_reason=change_reason,
    )

    notification_type_map = {
        ApplicationStatus.UNDER_REVIEW: NotificationType.APPLICATION_UNDER_REVIEW,
        ApplicationStatus.APPROVED: NotificationType.APPLICATION_APPROVED,
        ApplicationStatus.REJECTED: NotificationType.APPLICATION_REJECTED,
    }

    notification_details = {
        ApplicationStatus.UNDER_REVIEW: (
            "Application under review",
            "Your rental application is now under review.",
        ),
        ApplicationStatus.APPROVED: (
            "Application approved",
            "Your rental application has been approved.",
        ),
        ApplicationStatus.REJECTED: (
            "Application rejected",
            "Your rental application has been rejected.",
        ),
    }

    notification_type = notification_type_map[new_status]
    title, message = notification_details[new_status]

    create_notification(
        user=application.applicant,
        notification_type=notification_type,
        title=title,
        message=message,
        related_object_type=RelatedObjectType.APPLICATION,
        related_object_id=application.id,
    )

    return application


@transaction.atomic
def withdraw_application(
    *,
    applicant,
    application_id,
    change_reason: Optional[str] = None,
) -> Application:
    """Allow an applicant to withdraw their own pending application."""

    _verify_tenant(applicant)

    try:
        application = (
            Application.objects
            .select_for_update()
            .select_related("listing__property")
            .get(pk=application_id)
        )
    except Application.DoesNotExist:
        raise ApplicationNotFoundError(
            f"Application with id '{application_id}' does not exist."
        )

    if not _matches_user(application.applicant, applicant):
        raise ApplicationOwnershipError(
            {"application": "You can only withdraw your own applications."}
        )

    allowed_previous_statuses = {
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
    }

    if application.status not in allowed_previous_statuses:
        raise ApplicationStateError(
            {"status": f"An application in '{application.status}' status cannot be withdrawn."}
        )

    previous_status = application.status
    application.status = ApplicationStatus.WITHDRAWN

    application.full_clean()
    application.save(update_fields=["status", "updated_at"])

    _record_status_change(
        application=application,
        previous_status=previous_status,
        new_status=ApplicationStatus.WITHDRAWN,
        changed_by=applicant,
        change_reason=change_reason,
    )

    create_notification(
        user=application.owner,
        notification_type=NotificationType.APPLICATION_WITHDRAWN,
        title="Application withdrawn",
        message="An applicant has withdrawn their application for your property.",
        related_object_type=RelatedObjectType.APPLICATION,
        related_object_id=application.id,
    )

    return application