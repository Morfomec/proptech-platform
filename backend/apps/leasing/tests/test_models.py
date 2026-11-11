import unittest
import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.db.models import ProtectedError
from django.test import TestCase
from django.utils import timezone

from apps.leasing.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Tenancy,
    TenancyStatus,
)
from apps.listings.models import Listing, ListingStatus
from apps.properties.models import (
    Property,
    PropertyCategory,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class LeasingModelTestMixin:
    """Shared factory helpers for Leasing model test cases."""

    def create_user(self, email, *, is_tenant=True, is_owner=False):
        return User.objects.create_user(
            email=email,
            password="securepassword123",
            first_name="Test",
            last_name="User",
            is_active=True,
            is_tenant=is_tenant,
            is_owner=is_owner,
        )

    def create_property(self, owner, *, title="Maple Residency 2A"):
        return Property.objects.create(
            owner=owner,
            title=title,
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="42 Park Street",
            locality="Indiranagar",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560038",
            latitude=Decimal("12.9715987"),
            longitude=Decimal("77.5945627"),
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )

    def create_listing(
        self,
        property_instance,
        *,
        title="Maple Residency Rental",
        status=ListingStatus.PUBLISHED,
    ):
        return Listing.objects.create(
            property=property_instance,
            title=title,
            monthly_rent=Decimal("25000.00"),
            security_deposit=Decimal("100000.00"),
            status=status,
        )


class ApplicationModelTests(LeasingModelTestMixin, TestCase):
    def setUp(self):
        self.owner = self.create_user(
            "app_owner@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.applicant = self.create_user("app_tenant@example.com")
        self.other_applicant = self.create_user("app_tenant2@example.com")
        self.reviewer = self.create_user(
            "app_reviewer@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.property = self.create_property(self.owner)
        self.other_property = self.create_property(
            self.owner,
            title="Cedar Heights 5B",
        )
        self.listing = self.create_listing(self.property)
        self.other_listing = self.create_listing(
            self.other_property,
            title="Cedar Heights Rental",
        )

    def test_application_creation_uuid_defaults_and_timestamps(self):
        application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
        )

        self.assertIsInstance(application.id, uuid.UUID)
        self.assertEqual(application.status, ApplicationStatus.SUBMITTED)
        self.assertIsNone(application.message)
        self.assertIsNone(application.reviewed_at)
        self.assertIsNone(application.reviewed_by)
        self.assertIsNotNone(application.created_at)
        self.assertIsNotNone(application.updated_at)

        previous_updated_at = application.updated_at
        application.message = "Looking to move in next month."
        application.save(update_fields=["message", "updated_at"])
        application.refresh_from_db()
        self.assertEqual(application.message, "Looking to move in next month.")
        self.assertGreaterEqual(application.updated_at, previous_updated_at)

    def test_required_fields_rejected_when_missing(self):
        missing_listing = Application(applicant=self.applicant)
        with self.assertRaises(ValidationError) as ctx:
            missing_listing.full_clean()
        self.assertIn("listing", ctx.exception.message_dict)

        missing_applicant = Application(listing=self.listing)
        with self.assertRaises(ValidationError) as ctx:
            missing_applicant.full_clean()
        self.assertIn("applicant", ctx.exception.message_dict)

    def test_listing_and_applicant_relationships(self):
        application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
            reviewed_by=self.reviewer,
            message="Interested in a 12-month lease.",
        )

        self.assertIn(application, self.listing.applications.all())
        self.assertIn(application, self.applicant.rental_applications.all())
        self.assertIn(application, self.reviewer.reviewed_applications.all())

    def test_owner_and_property_properties(self):
        application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
        )

        self.assertEqual(application.owner, self.owner)
        self.assertEqual(application.property, self.property)

    def test_string_representation(self):
        application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
        )

        self.assertEqual(
            str(application),
            f"Application by {self.applicant} for {self.listing}",
        )

    def test_deleting_listing_cascades_application(self):
        application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
        )
        app_id = application.id

        self.listing.delete()

        self.assertFalse(Application.objects.filter(pk=app_id).exists())

    def test_deleting_applicant_cascades_application(self):
        application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
        )
        app_id = application.id

        self.applicant.delete()

        self.assertFalse(Application.objects.filter(pk=app_id).exists())

    def test_deleting_reviewer_sets_reviewed_by_to_null(self):
        reviewed_time = timezone.now()
        application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
            status=ApplicationStatus.APPROVED,
            reviewed_by=self.reviewer,
            reviewed_at=reviewed_time,
        )

        self.reviewer.delete()
        application.refresh_from_db()

        self.assertIsNone(application.reviewed_by)
        self.assertEqual(application.reviewed_at, reviewed_time)

    def test_unique_constraint_prevents_duplicate_listing_applicant(self):
        Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
        )

        duplicate = Application(
            listing=self.listing,
            applicant=self.applicant,
        )
        with self.assertRaises(ValidationError):
            duplicate.full_clean()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                duplicate.save()

        # Different applicant on same listing and same applicant on another listing succeed.
        other_app = Application.objects.create(
            listing=self.listing,
            applicant=self.other_applicant,
        )
        second_listing_app = Application.objects.create(
            listing=self.other_listing,
            applicant=self.applicant,
        )
        self.assertIsNotNone(other_app.id)
        self.assertIsNotNone(second_listing_app.id)


class ApplicationStatusHistoryModelTests(LeasingModelTestMixin, TestCase):
    def setUp(self):
        self.owner = self.create_user(
            "hist_owner@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.applicant = self.create_user("hist_tenant@example.com")
        self.property = self.create_property(self.owner)
        self.listing = self.create_listing(self.property)
        self.application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
        )

    def test_history_creation_uuid_nullable_fields_and_timestamp(self):
        history = ApplicationStatusHistory.objects.create(
            application=self.application,
            previous_status=None,
            new_status=ApplicationStatus.SUBMITTED,
            changed_by=self.applicant,
            change_reason=None,
        )

        self.assertIsInstance(history.id, uuid.UUID)
        self.assertEqual(history.application, self.application)
        self.assertIsNone(history.previous_status)
        self.assertEqual(history.new_status, ApplicationStatus.SUBMITTED)
        self.assertIsNone(history.change_reason)
        self.assertIsNotNone(history.created_at)
        self.assertIn(history, self.application.status_history.all())

    def test_string_representation(self):
        history = ApplicationStatusHistory.objects.create(
            application=self.application,
            previous_status=ApplicationStatus.SUBMITTED,
            new_status=ApplicationStatus.APPROVED,
            changed_by=self.owner,
            change_reason="Verified documents.",
        )

        self.assertEqual(
            str(history),
            f"{self.application.id}: submitted → approved",
        )

    def test_default_ordering_is_chronological_by_created_at(self):
        first = ApplicationStatusHistory.objects.create(
            application=self.application,
            previous_status=None,
            new_status=ApplicationStatus.SUBMITTED,
            changed_by=self.applicant,
        )
        second = ApplicationStatusHistory.objects.create(
            application=self.application,
            previous_status=ApplicationStatus.SUBMITTED,
            new_status=ApplicationStatus.UNDER_REVIEW,
            changed_by=self.owner,
        )
        third = ApplicationStatusHistory.objects.create(
            application=self.application,
            previous_status=ApplicationStatus.UNDER_REVIEW,
            new_status=ApplicationStatus.APPROVED,
            changed_by=self.owner,
        )

        now = timezone.now()
        ApplicationStatusHistory.objects.filter(pk=first.pk).update(
            created_at=now - timedelta(minutes=10)
        )
        ApplicationStatusHistory.objects.filter(pk=second.pk).update(
            created_at=now - timedelta(minutes=5)
        )
        ApplicationStatusHistory.objects.filter(pk=third.pk).update(
            created_at=now
        )

        ordered_ids = list(
            self.application.status_history.values_list("id", flat=True)
        )
        self.assertEqual(ordered_ids, [first.id, second.id, third.id])

    def test_deleting_application_cascades_status_history(self):
        history = ApplicationStatusHistory.objects.create(
            application=self.application,
            previous_status=None,
            new_status=ApplicationStatus.SUBMITTED,
            changed_by=self.applicant,
        )
        history_id = history.id

        self.application.delete()

        self.assertFalse(
            ApplicationStatusHistory.objects.filter(pk=history_id).exists()
        )

    def test_deleting_changed_by_sets_field_to_null(self):
        reviewer = self.create_user(
            "hist_reviewer@example.com",
            is_tenant=False,
            is_owner=True,
        )
        history = ApplicationStatusHistory.objects.create(
            application=self.application,
            previous_status=ApplicationStatus.SUBMITTED,
            new_status=ApplicationStatus.UNDER_REVIEW,
            changed_by=reviewer,
            change_reason="Review started.",
        )

        reviewer.delete()
        history.refresh_from_db()

        self.assertIsNone(history.changed_by)
        self.assertEqual(history.new_status, ApplicationStatus.UNDER_REVIEW)


class TenancyModelTests(LeasingModelTestMixin, TestCase):
    def setUp(self):
        self.owner = self.create_user(
            "tenancy_owner@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = self.create_user("tenancy_tenant@example.com")
        self.other_tenant = self.create_user("tenancy_tenant2@example.com")
        self.property = self.create_property(self.owner)
        self.other_property = self.create_property(
            self.owner,
            title="Oakwood Suite 1C",
        )
        self.listing = self.create_listing(self.property)
        self.approved_application = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
            status=ApplicationStatus.APPROVED,
        )

    def _build_tenancy_data(self, **overrides):
        data = {
            "property": self.property,
            "tenant": self.tenant,
            "start_date": date(2026, 6, 1),
            "end_date": date(2027, 5, 31),
            "monthly_rent": Decimal("25000.00"),
        }
        data.update(overrides)
        return data

    def test_tenancy_creation_uuid_defaults_and_move_dates(self):
        tenancy = Tenancy.objects.create(**self._build_tenancy_data())

        self.assertIsInstance(tenancy.id, uuid.UUID)
        self.assertEqual(tenancy.status, TenancyStatus.PENDING)
        self.assertEqual(tenancy.security_deposit, Decimal("0.00"))
        self.assertEqual(tenancy.rent_due_day, 1)
        self.assertIsNone(tenancy.application)
        self.assertIsNone(tenancy.actual_move_in_date)
        self.assertIsNone(tenancy.actual_move_out_date)
        self.assertIsNone(tenancy.notes)
        self.assertIsNotNone(tenancy.created_at)
        self.assertIsNotNone(tenancy.updated_at)

        tenancy.actual_move_in_date = date(2026, 6, 2)
        tenancy.actual_move_out_date = date(2027, 5, 30)
        tenancy.status = TenancyStatus.ENDED
        tenancy.full_clean()
        tenancy.save()
        tenancy.refresh_from_db()

        self.assertEqual(tenancy.actual_move_in_date, date(2026, 6, 2))
        self.assertEqual(tenancy.actual_move_out_date, date(2027, 5, 30))

    def test_owner_property_and_string_representation(self):
        tenancy = Tenancy.objects.create(**self._build_tenancy_data())

        self.assertEqual(tenancy.owner, self.owner)
        self.assertIn(tenancy, self.property.tenancies.all())
        self.assertIn(tenancy, self.tenant.tenancies.all())
        self.assertEqual(str(tenancy), f"Tenancy object ({tenancy.id})")

        unsaved = Tenancy(tenant=self.tenant)
        self.assertIsNone(unsaved.owner)

    def test_property_and_tenant_protect_deletion(self):
        Tenancy.objects.create(**self._build_tenancy_data())

        with self.assertRaises(ProtectedError):
            self.property.delete()

        with self.assertRaises(ProtectedError):
            self.tenant.delete()

    def test_application_one_to_one_and_set_null_on_delete(self):
        tenancy = Tenancy.objects.create(
            **self._build_tenancy_data(application=self.approved_application)
        )
        self.assertEqual(self.approved_application.tenancy, tenancy)

        duplicate = Tenancy(
            **self._build_tenancy_data(application=self.approved_application)
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                duplicate.save()

        # Multiple unlinked tenancies (application=None) are permitted.
        unlinked = Tenancy.objects.create(**self._build_tenancy_data())
        self.assertIsNone(unlinked.application)

        self.approved_application.delete()
        tenancy.refresh_from_db()
        self.assertIsNone(tenancy.application)

    def test_db_check_constraint_end_date_after_start_date(self):
        invalid = Tenancy(
            **self._build_tenancy_data(
                start_date=date(2026, 6, 10),
                end_date=date(2026, 6, 9),
            )
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                invalid.save()

        same_day = Tenancy.objects.create(
            **self._build_tenancy_data(
                start_date=date(2026, 6, 10),
                end_date=date(2026, 6, 10),
            )
        )
        open_ended = Tenancy.objects.create(
            **self._build_tenancy_data(end_date=None)
        )
        self.assertIsNotNone(same_day.id)
        self.assertIsNone(open_ended.end_date)

    def test_db_check_constraint_monthly_rent_non_negative(self):
        invalid = Tenancy(
            **self._build_tenancy_data(monthly_rent=Decimal("-1.00"))
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                invalid.save()

        zero_rent = Tenancy.objects.create(
            **self._build_tenancy_data(monthly_rent=Decimal("0.00"))
        )
        self.assertEqual(zero_rent.monthly_rent, Decimal("0.00"))

    def test_db_check_constraint_security_deposit_non_negative(self):
        invalid = Tenancy(
            **self._build_tenancy_data(security_deposit=Decimal("-0.01"))
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                invalid.save()

        zero_deposit = Tenancy.objects.create(
            **self._build_tenancy_data(security_deposit=Decimal("0.00"))
        )
        self.assertEqual(zero_deposit.security_deposit, Decimal("0.00"))

    def test_db_check_constraint_rent_due_day_between_1_and_28(self):
        for invalid_day in (0, 29):
            invalid = Tenancy(
                **self._build_tenancy_data(rent_due_day=invalid_day)
            )
            with self.assertRaises(IntegrityError):
                with transaction.atomic():
                    invalid.save()

        day_1 = Tenancy.objects.create(**self._build_tenancy_data(rent_due_day=1))
        day_28 = Tenancy.objects.create(
            **self._build_tenancy_data(rent_due_day=28)
        )
        self.assertEqual(day_1.rent_due_day, 1)
        self.assertEqual(day_28.rent_due_day, 28)

    @unittest.skipUnless(
        connection.vendor == "postgresql",
        "PostgreSQL ExclusionConstraint requires PostgreSQL with btree_gist.",
    )
    def test_db_exclusion_constraint_prevents_overlapping_confirmed_or_active(self):
        Tenancy.objects.create(
            **self._build_tenancy_data(
                start_date=date(2026, 6, 1),
                end_date=date(2026, 6, 30),
                status=TenancyStatus.CONFIRMED,
            )
        )

        # Overlapping confirmed tenancy on same property -> IntegrityError.
        overlapping_confirmed = Tenancy(
            **self._build_tenancy_data(
                tenant=self.other_tenant,
                start_date=date(2026, 6, 15),
                end_date=date(2026, 7, 15),
                status=TenancyStatus.CONFIRMED,
            )
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                overlapping_confirmed.save()

        # Inclusive boundary [] on end_date == start_date -> IntegrityError.
        boundary_overlap = Tenancy(
            **self._build_tenancy_data(
                tenant=self.other_tenant,
                start_date=date(2026, 6, 30),
                end_date=date(2026, 7, 30),
                status=TenancyStatus.ACTIVE,
            )
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                boundary_overlap.save()

        # Adjacent day after end_date -> succeeds.
        next_day_active = Tenancy.objects.create(
            **self._build_tenancy_data(
                tenant=self.other_tenant,
                start_date=date(2026, 7, 1),
                end_date=None,
                status=TenancyStatus.ACTIVE,
            )
        )
        self.assertIsNotNone(next_day_active.id)

        # Open-ended (NULL end_date -> infinity) blocks later overlapping active tenancy.
        after_open_ended = Tenancy(
            **self._build_tenancy_data(
                start_date=date(2026, 9, 1),
                end_date=date(2026, 12, 31),
                status=TenancyStatus.CONFIRMED,
            )
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                after_open_ended.save()

        # Pending, cancelled, and ended tenancies do not reserve the property.
        for non_blocking_status in (
            TenancyStatus.PENDING,
            TenancyStatus.CANCELLED,
            TenancyStatus.ENDED,
        ):
            non_blocking = Tenancy.objects.create(
                **self._build_tenancy_data(
                    start_date=date(2026, 6, 10),
                    end_date=date(2026, 6, 20),
                    status=non_blocking_status,
                )
            )
            self.assertEqual(non_blocking.status, non_blocking_status)

        # Overlapping active tenancy on a different property -> succeeds.
        other_prop_tenancy = Tenancy.objects.create(
            **self._build_tenancy_data(
                property=self.other_property,
                start_date=date(2026, 6, 1),
                end_date=date(2026, 6, 30),
                status=TenancyStatus.ACTIVE,
            )
        )
        self.assertIsNotNone(other_prop_tenancy.id)

    def test_clean_validates_dates_amounts_due_day_and_move_dates(self):
        invalid_end = Tenancy(
            **self._build_tenancy_data(
                start_date=date(2026, 6, 10),
                end_date=date(2026, 6, 1),
            )
        )
        with self.assertRaises(ValidationError) as ctx:
            invalid_end.full_clean()
        self.assertIn("end_date", ctx.exception.message_dict)

        negative_rent = Tenancy(
            **self._build_tenancy_data(monthly_rent=Decimal("-50.00"))
        )
        with self.assertRaises(ValidationError) as ctx:
            negative_rent.full_clean()
        self.assertIn("monthly_rent", ctx.exception.message_dict)

        negative_deposit = Tenancy(
            **self._build_tenancy_data(security_deposit=Decimal("-50.00"))
        )
        with self.assertRaises(ValidationError) as ctx:
            negative_deposit.full_clean()
        self.assertIn("security_deposit", ctx.exception.message_dict)

        for invalid_day in (0, 29):
            invalid_due_day = Tenancy(
                **self._build_tenancy_data(rent_due_day=invalid_day)
            )
            with self.assertRaises(ValidationError) as ctx:
                invalid_due_day.full_clean()
            self.assertIn("rent_due_day", ctx.exception.message_dict)

        move_out_before_move_in = Tenancy(
            **self._build_tenancy_data(
                actual_move_in_date=date(2026, 6, 10),
                actual_move_out_date=date(2026, 6, 5),
            )
        )
        with self.assertRaises(ValidationError) as ctx:
            move_out_before_move_in.full_clean()
        self.assertIn("actual_move_out_date", ctx.exception.message_dict)

        move_out_before_start = Tenancy(
            **self._build_tenancy_data(
                start_date=date(2026, 6, 10),
                actual_move_out_date=date(2026, 6, 5),
            )
        )
        with self.assertRaises(ValidationError) as ctx:
            move_out_before_start.full_clean()
        self.assertIn("actual_move_out_date", ctx.exception.message_dict)

    def test_clean_rejects_self_rental(self):
        self_rental = Tenancy(
            **self._build_tenancy_data(tenant=self.owner)
        )
        with self.assertRaises(ValidationError) as ctx:
            self_rental.full_clean()
        self.assertIn("tenant", ctx.exception.message_dict)

    def test_clean_validates_linked_application_consistency(self):
        # 1. Applicant mismatch
        wrong_applicant_tenancy = Tenancy(
            **self._build_tenancy_data(
                tenant=self.other_tenant,
                application=self.approved_application,
            )
        )
        with self.assertRaises(ValidationError) as ctx:
            wrong_applicant_tenancy.full_clean()
        self.assertIn("application", ctx.exception.message_dict)

        # 2. Property mismatch
        wrong_property_tenancy = Tenancy(
            **self._build_tenancy_data(
                property=self.other_property,
                application=self.approved_application,
            )
        )
        with self.assertRaises(ValidationError) as ctx:
            wrong_property_tenancy.full_clean()
        self.assertIn("application", ctx.exception.message_dict)

        # 3. Unapproved application status
        other_listing = self.create_listing(
            self.other_property,
            title="Oakwood Rental",
        )
        submitted_app = Application.objects.create(
            listing=other_listing,
            applicant=self.tenant,
            status=ApplicationStatus.SUBMITTED,
        )
        unapproved_tenancy = Tenancy(
            **self._build_tenancy_data(
                property=self.other_property,
                application=submitted_app,
            )
        )
        with self.assertRaises(ValidationError) as ctx:
            unapproved_tenancy.full_clean()
        self.assertIn("application", ctx.exception.message_dict)

