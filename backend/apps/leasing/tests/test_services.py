from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.leasing.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    TenancyStatus,
)
from apps.leasing.services import (
    activate_tenancy,
    cancel_tenancy,
    confirm_tenancy,
    create_tenancy,
    end_tenancy,
    get_applicant_applications,
    get_application_by_id,
    get_received_applications,
    review_application,
    submit_application,
    withdraw_application,
)
from apps.leasing.services.exceptions import (
    ApplicationNotFoundError,
    ApplicationOwnershipError,
    ApplicationStateError,
    DuplicateApplicationError,
    ListingUnavailableError,
    TenancyApplicationError,
    TenancyNotFoundError,
    TenancyOverlapError,
    TenancyOwnershipError,
    TenancyStateError,
)
from apps.listings.models import Listing, ListingStatus
from apps.notifications.models import (
    Notification,
    NotificationType,
    RelatedObjectType,
)
from apps.properties.models import (
    Property,
    PropertyCategory,
    PropertyImage,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class LeasingServiceTestMixin:
    """Shared factory helpers for Leasing service tests."""

    def create_user(
        self,
        email,
        *,
        is_tenant=True,
        is_owner=False,
        is_active=True,
    ):
        return User.objects.create_user(
            email=email,
            password="securepassword123",
            first_name="Test",
            last_name="User",
            is_active=is_active,
            is_tenant=is_tenant,
            is_owner=is_owner,
        )

    def create_property(
        self,
        owner,
        *,
        title="Horizon Villa",
        status=PropertyStatus.AVAILABLE,
        with_image=True,
    ):
        prop = Property.objects.create(
            owner=owner,
            title=title,
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="12 Lake View Road",
            locality="Koramangala",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560034",
            latitude=Decimal("12.9352273"),
            longitude=Decimal("77.6244807"),
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=status,
        )
        if with_image:
            PropertyImage.objects.create(
                property=prop,
                image_url="properties/sample/front.jpg",
                is_primary=True,
            )
        return prop

    def create_listing(
        self,
        property_instance,
        *,
        title="Horizon Villa Listing",
        status=ListingStatus.PUBLISHED,
    ):
        return Listing.objects.create(
            property=property_instance,
            title=title,
            monthly_rent=Decimal("28000.00"),
            security_deposit=Decimal("100000.00"),
            status=status,
        )


class ApplicationServiceTests(LeasingServiceTestMixin, TestCase):
    def setUp(self):
        self.owner = self.create_user(
            "app_svc_owner@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.other_owner = self.create_user(
            "app_svc_owner2@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = self.create_user("app_svc_tenant@example.com")
        self.other_tenant = self.create_user("app_svc_tenant2@example.com")
        self.property = self.create_property(self.owner)
        self.published_listing = self.create_listing(self.property)
        self.draft_property = self.create_property(
            self.owner,
            title="Draft Loft",
        )
        self.draft_listing = self.create_listing(
            self.draft_property,
            title="Draft Loft Listing",
            status=ListingStatus.DRAFT,
        )

    def test_submit_application_creates_history_and_owner_notification(self):
        application = submit_application(
            applicant=self.tenant,
            listing_id=self.published_listing.id,
            message="Interested in moving in next month.",
        )

        self.assertEqual(application.status, ApplicationStatus.SUBMITTED)
        self.assertEqual(application.applicant, self.tenant)
        self.assertEqual(application.listing, self.published_listing)

        history = ApplicationStatusHistory.objects.get(application=application)
        self.assertIsNone(history.previous_status)
        self.assertEqual(history.new_status, ApplicationStatus.SUBMITTED)
        self.assertEqual(history.changed_by, self.tenant)

        notification = Notification.objects.get(
            user=self.owner,
            notification_type=NotificationType.APPLICATION_SUBMITTED,
        )
        self.assertEqual(
            notification.related_object_type,
            RelatedObjectType.APPLICATION,
        )
        self.assertEqual(notification.related_object_id, application.id)

    def test_submit_application_validation_and_duplicate_guards(self):
        with self.assertRaises(ApplicationOwnershipError):
            submit_application(
                applicant=self.owner,
                listing_id=self.published_listing.id,
            )

        with self.assertRaises(ApplicationNotFoundError):
            submit_application(
                applicant=self.tenant,
                listing_id="00000000-0000-0000-0000-000000000000",
            )

        with self.assertRaises(ListingUnavailableError):
            submit_application(
                applicant=self.tenant,
                listing_id=self.draft_listing.id,
            )

        own_prop = self.create_property(
            self.tenant,
            title="Dual Role Own Property",
        )
        # Activate owner flag for dual-role check.
        self.tenant.is_owner = True
        self.tenant.save(update_fields=["is_owner", "updated_at"])
        own_listing = self.create_listing(own_prop, title="Own Listing")
        with self.assertRaises(ApplicationOwnershipError):
            submit_application(
                applicant=self.tenant,
                listing_id=own_listing.id,
            )

        submit_application(
            applicant=self.tenant,
            listing_id=self.published_listing.id,
        )
        with self.assertRaises(DuplicateApplicationError):
            submit_application(
                applicant=self.tenant,
                listing_id=self.published_listing.id,
            )

    def test_submit_application_rolls_back_when_notification_fails(self):
        with patch(
            "apps.leasing.services.application_service.create_notification",
            side_effect=RuntimeError("Notification write failed"),
        ):
            with self.assertRaises(RuntimeError):
                submit_application(
                    applicant=self.tenant,
                    listing_id=self.published_listing.id,
                )

        self.assertEqual(Application.objects.count(), 0)
        self.assertEqual(ApplicationStatusHistory.objects.count(), 0)
        self.assertEqual(Notification.objects.count(), 0)

    def test_review_application_transitions_history_and_notifications(self):
        app = submit_application(
            applicant=self.tenant,
            listing_id=self.published_listing.id,
        )
        Notification.objects.all().delete()

        reviewed = review_application(
            owner=self.owner,
            application_id=app.id,
            new_status=ApplicationStatus.UNDER_REVIEW,
            change_reason="Verifying employment documents.",
        )
        self.assertEqual(reviewed.status, ApplicationStatus.UNDER_REVIEW)
        self.assertEqual(reviewed.reviewed_by, self.owner)
        self.assertIsNotNone(reviewed.reviewed_at)

        under_review_notif = Notification.objects.get(
            user=self.tenant,
            notification_type=NotificationType.APPLICATION_UNDER_REVIEW,
        )
        self.assertEqual(under_review_notif.related_object_id, app.id)

        approved = review_application(
            owner=self.owner,
            application_id=app.id,
            new_status=ApplicationStatus.APPROVED,
            change_reason="Approved for move-in.",
        )
        self.assertEqual(approved.status, ApplicationStatus.APPROVED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.APPLICATION_APPROVED,
                related_object_id=app.id,
            ).exists()
        )
        self.assertEqual(
            ApplicationStatusHistory.objects.filter(application=app).count(),
            3,
        )

        # Terminal state cannot be reviewed again.
        with self.assertRaises(ApplicationStateError):
            review_application(
                owner=self.owner,
                application_id=app.id,
                new_status=ApplicationStatus.REJECTED,
            )

    def test_review_application_reject_same_status_and_non_owner_guards(self):
        app = submit_application(
            applicant=self.tenant,
            listing_id=self.published_listing.id,
        )

        with self.assertRaises(ApplicationOwnershipError):
            review_application(
                owner=self.other_owner,
                application_id=app.id,
                new_status=ApplicationStatus.APPROVED,
            )

        with self.assertRaises(ApplicationStateError):
            review_application(
                owner=self.owner,
                application_id=app.id,
                new_status=ApplicationStatus.WITHDRAWN,
            )

        review_application(
            owner=self.owner,
            application_id=app.id,
            new_status=ApplicationStatus.UNDER_REVIEW,
        )
        with self.assertRaises(ApplicationStateError):
            review_application(
                owner=self.owner,
                application_id=app.id,
                new_status=ApplicationStatus.UNDER_REVIEW,
            )

        app2 = submit_application(
            applicant=self.other_tenant,
            listing_id=self.published_listing.id,
        )
        rejected = review_application(
            owner=self.owner,
            application_id=app2.id,
            new_status=ApplicationStatus.REJECTED,
            change_reason="Another applicant selected.",
        )
        self.assertEqual(rejected.status, ApplicationStatus.REJECTED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.other_tenant,
                notification_type=NotificationType.APPLICATION_REJECTED,
                related_object_id=app2.id,
            ).exists()
        )

    def test_withdraw_application_success_and_guards(self):
        app = submit_application(
            applicant=self.tenant,
            listing_id=self.published_listing.id,
        )
        Notification.objects.all().delete()

        with self.assertRaises(ApplicationOwnershipError):
            withdraw_application(
                applicant=self.other_tenant,
                application_id=app.id,
            )

        withdrawn = withdraw_application(
            applicant=self.tenant,
            application_id=app.id,
            change_reason="Found another property.",
        )
        self.assertEqual(withdrawn.status, ApplicationStatus.WITHDRAWN)

        notif = Notification.objects.get(
            user=self.owner,
            notification_type=NotificationType.APPLICATION_WITHDRAWN,
        )
        self.assertEqual(notif.related_object_type, RelatedObjectType.APPLICATION)
        self.assertEqual(notif.related_object_id, app.id)

        with self.assertRaises(ApplicationStateError):
            withdraw_application(
                applicant=self.tenant,
                application_id=app.id,
            )

    def test_submit_application_rejects_non_available_property_status(self):
        for non_available_status in (
            PropertyStatus.DRAFT,
            PropertyStatus.MAINTENANCE,
            PropertyStatus.INACTIVE,
            PropertyStatus.OCCUPIED,
        ):
            with self.subTest(property_status=non_available_status):
                Property.objects.filter(pk=self.property.pk).update(
                    status=non_available_status
                )
                with self.assertRaises(ListingUnavailableError):
                    submit_application(
                        applicant=self.tenant,
                        listing_id=self.published_listing.id,
                    )
        Property.objects.filter(pk=self.property.pk).update(
            status=PropertyStatus.AVAILABLE
        )

    def test_query_helpers_scope_to_applicant_and_owner(self):
        app = submit_application(
            applicant=self.tenant,
            listing_id=self.published_listing.id,
        )

        self.assertEqual(
            list(get_applicant_applications(applicant=self.tenant)),
            [app],
        )
        self.assertEqual(
            list(get_applicant_applications(applicant=self.other_tenant)),
            [],
        )
        self.assertEqual(
            list(get_received_applications(owner=self.owner)),
            [app],
        )
        self.assertEqual(
            list(get_received_applications(owner=self.other_owner)),
            [],
        )
        self.assertEqual(get_application_by_id(application_id=app.id), app)


class TenancyServiceTests(LeasingServiceTestMixin, TestCase):
    def setUp(self):
        self.owner = self.create_user(
            "ten_svc_owner@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.other_owner = self.create_user(
            "ten_svc_owner2@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = self.create_user("ten_svc_tenant@example.com")
        self.other_tenant = self.create_user("ten_svc_tenant2@example.com")
        self.inactive_tenant = self.create_user(
            "ten_svc_inactive@example.com",
            is_active=False,
        )
        self.property = self.create_property(self.owner)
        self.listing = self.create_listing(self.property)
        self.approved_application = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
            status=ApplicationStatus.APPROVED,
        )

    def test_create_tenancy_linked_and_validation_guards(self):
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.approved_application.id,
            start_date=date(2026, 8, 1),
            end_date=date(2027, 7, 31),
            monthly_rent=Decimal("28000.00"),
            security_deposit=Decimal("100000.00"),
        )

        self.assertEqual(tenancy.status, TenancyStatus.PENDING)
        self.assertEqual(tenancy.application, self.approved_application)
        notif = Notification.objects.get(
            user=self.tenant,
            notification_type=NotificationType.TENANCY_CREATED,
        )
        self.assertEqual(notif.related_object_type, RelatedObjectType.TENANCY)
        self.assertEqual(notif.related_object_id, tenancy.id)

        # Duplicate application linkage rejected.
        with self.assertRaises(TenancyApplicationError):
            create_tenancy(
                owner=self.owner,
                property_id=self.property.id,
                tenant=self.tenant,
                application_id=self.approved_application.id,
                start_date=date(2027, 8, 1),
                monthly_rent=Decimal("28000.00"),
            )

        # Non-owner rejected.
        with self.assertRaises(TenancyOwnershipError):
            create_tenancy(
                owner=self.other_owner,
                property_id=self.property.id,
                tenant=self.other_tenant,
                start_date=date(2026, 8, 1),
                monthly_rent=Decimal("28000.00"),
            )

        # Inactive tenant and self-rental rejected.
        with self.assertRaises(ValidationError):
            create_tenancy(
                owner=self.owner,
                property_id=self.property.id,
                tenant=self.inactive_tenant,
                start_date=date(2026, 8, 1),
                monthly_rent=Decimal("28000.00"),
            )
        with self.assertRaises(ValidationError):
            create_tenancy(
                owner=self.owner,
                property_id=self.property.id,
                tenant=self.owner,
                start_date=date(2026, 8, 1),
                monthly_rent=Decimal("28000.00"),
            )

    def test_confirm_tenancy_pauses_listing_and_notifies_tenant(self):
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 8, 1),
            end_date=date(2027, 7, 31),
            monthly_rent=Decimal("28000.00"),
        )
        Notification.objects.all().delete()

        confirmed = confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)

        self.assertEqual(confirmed.status, TenancyStatus.CONFIRMED)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, ListingStatus.PAUSED)

        notif = Notification.objects.get(
            user=self.tenant,
            notification_type=NotificationType.TENANCY_CONFIRMED,
        )
        self.assertEqual(notif.related_object_id, tenancy.id)

        # Re-confirming fails.
        with self.assertRaises(TenancyStateError):
            confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)

        # Overlapping pending tenancy cannot be confirmed.
        overlapping = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.other_tenant,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("29000.00"),
        )
        with self.assertRaises(TenancyOverlapError):
            confirm_tenancy(owner=self.owner, tenancy_id=overlapping.id)

    def test_activate_and_end_tenancy_update_property_status_and_notify(self):
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 8, 1),
            end_date=date(2027, 7, 31),
            monthly_rent=Decimal("28000.00"),
        )
        confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        Notification.objects.all().delete()

        activated = activate_tenancy(
            owner=self.owner,
            tenancy_id=tenancy.id,
            move_in_date=date(2026, 8, 2),
        )
        self.assertEqual(activated.status, TenancyStatus.ACTIVE)
        self.assertEqual(activated.actual_move_in_date, date(2026, 8, 2))
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.OCCUPIED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.TENANCY_ACTIVATED,
                related_object_id=tenancy.id,
            ).exists()
        )

        # Cannot cancel an active tenancy.
        with self.assertRaises(TenancyStateError):
            cancel_tenancy(owner=self.owner, tenancy_id=tenancy.id)

        ended = end_tenancy(
            owner=self.owner,
            tenancy_id=tenancy.id,
            move_out_date=date(2027, 7, 31),
        )
        self.assertEqual(ended.status, TenancyStatus.ENDED)
        self.assertEqual(ended.actual_move_out_date, date(2027, 7, 31))
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.AVAILABLE)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, ListingStatus.PAUSED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.TENANCY_ENDED,
                related_object_id=tenancy.id,
            ).exists()
        )

    def test_end_tenancy_preserves_maintenance_or_inactive_property_status(self):
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 8, 1),
            end_date=date(2027, 7, 31),
            monthly_rent=Decimal("28000.00"),
        )
        confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        activate_tenancy(owner=self.owner, tenancy_id=tenancy.id)

        self.property.status = PropertyStatus.MAINTENANCE
        self.property.save(update_fields=["status", "updated_at"])

        end_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.MAINTENANCE)

    def test_cancel_tenancy_and_rollback_on_notification_failure(self):
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 8, 1),
            end_date=date(2027, 7, 31),
            monthly_rent=Decimal("28000.00"),
        )
        confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        Notification.objects.all().delete()

        # Verify rollback of activate_tenancy (tenancy + property status) on error.
        with patch(
            "apps.leasing.services.tenancy_service.create_notification",
            side_effect=RuntimeError("Notification error"),
        ):
            with self.assertRaises(RuntimeError):
                activate_tenancy(owner=self.owner, tenancy_id=tenancy.id)

        tenancy.refresh_from_db()
        self.property.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.CONFIRMED)
        self.assertEqual(self.property.status, PropertyStatus.AVAILABLE)

        cancelled = cancel_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        self.assertEqual(cancelled.status, TenancyStatus.CANCELLED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.TENANCY_CANCELLED,
                related_object_id=tenancy.id,
            ).exists()
        )
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, ListingStatus.PAUSED)

    def test_confirm_fails_when_property_in_maintenance_or_missing(self):
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 8, 1),
            monthly_rent=Decimal("28000.00"),
        )
        self.property.status = PropertyStatus.MAINTENANCE
        self.property.save(update_fields=["status", "updated_at"])

        with self.assertRaises(TenancyStateError):
            confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)

        with self.assertRaises(TenancyNotFoundError):
            confirm_tenancy(
                owner=self.owner,
                tenancy_id="00000000-0000-0000-0000-000000000000",
            )

    def test_confirm_and_activate_reject_unavailable_property_statuses(self):
        for disallowed_status in (
            PropertyStatus.DRAFT,
            PropertyStatus.OCCUPIED,
            PropertyStatus.MAINTENANCE,
            PropertyStatus.INACTIVE,
        ):
            with self.subTest(phase="confirm", property_status=disallowed_status):
                tenancy = create_tenancy(
                    owner=self.owner,
                    property_id=self.property.id,
                    tenant=self.tenant,
                    start_date=date(2026, 8, 1),
                    monthly_rent=Decimal("28000.00"),
                )
                Property.objects.filter(pk=self.property.pk).update(status=disallowed_status)

                with self.assertRaises(TenancyStateError):
                    confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)

                tenancy.refresh_from_db()
                self.assertEqual(tenancy.status, TenancyStatus.PENDING)
                Property.objects.filter(pk=self.property.pk).update(status=PropertyStatus.AVAILABLE)

        for disallowed_status in (
            PropertyStatus.DRAFT,
            PropertyStatus.OCCUPIED,
            PropertyStatus.MAINTENANCE,
            PropertyStatus.INACTIVE,
        ):
            with self.subTest(phase="activate", property_status=disallowed_status):
                Property.objects.filter(pk=self.property.pk).update(status=PropertyStatus.AVAILABLE)
                tenancy = create_tenancy(
                    owner=self.owner,
                    property_id=self.property.id,
                    tenant=self.other_tenant,
                    start_date=date(2028, 1, 1),
                    end_date=date(2028, 12, 31),
                    monthly_rent=Decimal("30000.00"),
                )
                confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)

                Property.objects.filter(pk=self.property.pk).update(status=disallowed_status)
                with self.assertRaises(TenancyStateError):
                    activate_tenancy(owner=self.owner, tenancy_id=tenancy.id)

                tenancy.refresh_from_db()
                self.assertEqual(tenancy.status, TenancyStatus.CONFIRMED)
                cancel_tenancy(owner=self.owner, tenancy_id=tenancy.id)
