from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from apps.leasing.models import Tenancy, TenancyStatus
from apps.leasing.services.tenancy_service import accept_tenancy_proposal, activate_tenancy, create_tenancy
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType
from apps.rent.models import RentCharge, RentChargeStatus, RentChargeType
from apps.rent.services import (
    backfill_missing_initial_charges,
    compute_billing_period_and_amount,
    generate_due_rent_charges_batch,
    generate_initial_rent_charge,
    generate_rent_charge_for_cycle,
    generate_security_deposit_charge,
)
from apps.rent.services.exceptions import TenancyNotActiveError

User = get_user_model()


class RentChargesServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="rent_owner@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        self.tenant = User.objects.create_user(
            email="rent_tenant@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        self.tenant.is_tenant = True
        self.tenant.save(update_fields=["is_tenant"])

        self.property = Property.objects.create(
            owner=self.owner,
            title="Rent Test Apartment",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            bedrooms=2,
            bathrooms=2,
            address_line_1="Marine Drive",
            locality="Kochi Central",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682001",
            status=PropertyStatus.AVAILABLE,
        )

    def _create_tenancy(self, **kwargs):
        defaults = {
            "property": self.property,
            "tenant": self.tenant,
            "start_date": date(2026, 6, 1),
            "end_date": date(2027, 5, 31),
            "monthly_rent": Decimal("30000.00"),
            "security_deposit": Decimal("60000.00"),
            "rent_due_day": 5,
            "status": TenancyStatus.ACTIVE,
        }
        defaults.update(kwargs)
        return Tenancy.objects.create(**defaults)

    def test_full_calendar_month_rent_calculation(self):
        tenancy = self._create_tenancy(start_date=date(2026, 6, 1), end_date=date(2027, 5, 31))
        p_start, p_end, due_date, amount = compute_billing_period_and_amount(
            tenancy=tenancy,
            cycle_year=2026,
            cycle_month=6,
        )
        self.assertEqual(p_start, date(2026, 6, 1))
        self.assertEqual(p_end, date(2026, 6, 30))
        self.assertEqual(due_date, date(2026, 6, 5))
        self.assertEqual(amount, Decimal("30000.00"))

    def test_mid_month_move_in_proration(self):
        # Move-in on June 16 in a 30-day month (active days = 16 to 30 = 15 days)
        # 30,000 * 15 / 30 = 15,000.00
        # For mid-month move-in where start_date (June 16) > rent_due_day (June 5),
        # the initial prorated charge is due on move-in (June 16), not backdated into the past.
        tenancy = self._create_tenancy(start_date=date(2026, 6, 16), end_date=date(2027, 5, 31))
        p_start, p_end, due_date, amount = compute_billing_period_and_amount(
            tenancy=tenancy,
            cycle_year=2026,
            cycle_month=6,
        )
        self.assertEqual(p_start, date(2026, 6, 16))
        self.assertEqual(p_end, date(2026, 6, 30))
        self.assertEqual(due_date, date(2026, 6, 16))
        self.assertEqual(amount, Decimal("15000.00"))

    def test_mid_month_move_out_proration(self):
        # Move-out on July 10 in a 31-day month (active days = 1 to 10 = 10 days)
        # 31,000 * 10 / 31 = 10,000.00
        tenancy = self._create_tenancy(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 7, 10),
            monthly_rent=Decimal("31000.00"),
        )
        p_start, p_end, due_date, amount = compute_billing_period_and_amount(
            tenancy=tenancy,
            cycle_year=2026,
            cycle_month=7,
        )
        self.assertEqual(p_start, date(2026, 7, 1))
        self.assertEqual(p_end, date(2026, 7, 10))
        self.assertEqual(amount, Decimal("10000.00"))

    def test_due_date_calculation_and_clamping(self):
        # Rent due day = 31 in a 30-day month (April) clamps to 30
        tenancy = self._create_tenancy(
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            rent_due_day=28,
        )
        p_start, p_end, due_date, amount = compute_billing_period_and_amount(
            tenancy=tenancy,
            cycle_year=2026,
            cycle_month=4,
        )
        self.assertEqual(due_date, date(2026, 4, 28))

    def test_separate_security_deposit_generation(self):
        tenancy = self._create_tenancy(
            start_date=date(2026, 6, 1),
            security_deposit=Decimal("75000.00"),
        )
        deposit_charge = generate_security_deposit_charge(tenancy=tenancy)
        self.assertIsNotNone(deposit_charge)
        self.assertEqual(deposit_charge.charge_type, RentChargeType.SECURITY_DEPOSIT)
        self.assertEqual(deposit_charge.amount, Decimal("75000.00"))
        self.assertEqual(deposit_charge.due_date, date(2026, 6, 1))
        self.assertEqual(deposit_charge.status, RentChargeStatus.UNPAID)

        # Idempotency: calling again returns the same record without duplicate creation
        deposit_charge2 = generate_security_deposit_charge(tenancy=tenancy)
        self.assertEqual(deposit_charge.id, deposit_charge2.id)
        self.assertEqual(
            RentCharge.objects.filter(
                tenancy=tenancy,
                charge_type=RentChargeType.SECURITY_DEPOSIT,
            ).count(),
            1,
        )

    def test_zero_security_deposit_handling(self):
        tenancy = self._create_tenancy(security_deposit=Decimal("0.00"))
        deposit_charge = generate_security_deposit_charge(tenancy=tenancy)
        self.assertIsNone(deposit_charge)
        self.assertEqual(
            RentCharge.objects.filter(
                tenancy=tenancy,
                charge_type=RentChargeType.SECURITY_DEPOSIT,
            ).count(),
            0,
        )

    def test_duplicate_generation_prevention(self):
        tenancy = self._create_tenancy(start_date=date(2026, 6, 1))
        rent_charge1, dep_charge1 = generate_initial_rent_charge(tenancy=tenancy)
        rent_charge2, dep_charge2 = generate_initial_rent_charge(tenancy=tenancy)

        self.assertEqual(rent_charge1.id, rent_charge2.id)
        self.assertEqual(dep_charge1.id, dep_charge2.id)
        self.assertEqual(
            RentCharge.objects.filter(
                tenancy=tenancy,
                charge_type=RentChargeType.RENT,
            ).count(),
            1,
        )

    def test_tenancy_start_and_end_boundaries_for_recurring_charges(self):
        tenancy = self._create_tenancy(
            start_date=date(2026, 6, 1),
            end_date=date(2026, 8, 31),
        )
        # Cycle before start date -> returns None
        charge_may = generate_rent_charge_for_cycle(tenancy=tenancy, cycle_year=2026, cycle_month=5)
        self.assertIsNone(charge_may)

        # Cycle within period -> returns RentCharge
        charge_july = generate_rent_charge_for_cycle(tenancy=tenancy, cycle_year=2026, cycle_month=7)
        self.assertIsNotNone(charge_july)
        self.assertEqual(charge_july.amount, Decimal("30000.00"))

        # Cycle after end date -> returns None
        charge_sept = generate_rent_charge_for_cycle(tenancy=tenancy, cycle_year=2026, cycle_month=9)
        self.assertIsNone(charge_sept)

    def test_dynamic_overdue_calculation(self):
        past_date = timezone.localdate() - timedelta(days=5)
        future_date = timezone.localdate() + timedelta(days=5)

        tenancy = self._create_tenancy()

        # Unpaid and past due_date -> overdue
        charge = RentCharge(
            tenancy=tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=past_date - timedelta(days=20),
            billing_period_end=past_date,
            due_date=past_date,
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )
        self.assertTrue(charge.is_overdue)

        # Partially paid and past due_date -> overdue
        charge.status = RentChargeStatus.PARTIALLY_PAID
        self.assertTrue(charge.is_overdue)

        # Unpaid but future due_date -> not overdue
        charge.due_date = future_date
        self.assertFalse(charge.is_overdue)

        # Paid -> never overdue even if past due_date
        charge.due_date = past_date
        charge.status = RentChargeStatus.PAID
        self.assertFalse(charge.is_overdue)

        # Waived -> never overdue even if past due_date
        charge.status = RentChargeStatus.WAIVED
        self.assertFalse(charge.is_overdue)

        # Cancelled -> never overdue even if past due_date
        charge.status = RentChargeStatus.CANCELLED
        self.assertFalse(charge.is_overdue)


class TenancyActivationRentIntegrationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_act@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        self.tenant = User.objects.create_user(
            email="tenant_act@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        self.tenant.is_tenant = True
        self.tenant.save(update_fields=["is_tenant"])

        self.property = Property.objects.create(
            owner=self.owner,
            title="Activation Property",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            bedrooms=2,
            bathrooms=2,
            address_line_1="MG Road",
            locality="Kochi Central",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682001",
            status=PropertyStatus.AVAILABLE,
        )

    def test_activate_tenancy_automatically_generates_rent_and_deposit_charges(self):
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 7, 1),
            end_date=date(2027, 6, 30),
            monthly_rent=Decimal("25000.00"),
            security_deposit=Decimal("50000.00"),
            rent_due_day=1,
        )
        self.assertEqual(tenancy.status, TenancyStatus.PENDING)
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 0)

        # Tenant accepts proposal
        accept_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id)
        tenancy.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.CONFIRMED)

        # Activating tenancy
        activated = activate_tenancy(
            owner=self.owner,
            tenancy_id=tenancy.id,
            move_in_date=date(2026, 7, 1),
        )
        self.assertEqual(activated.status, TenancyStatus.ACTIVE)

        # Asserts both rent and deposit charges exist
        charges = RentCharge.objects.filter(tenancy=tenancy).order_by("charge_type")
        self.assertEqual(charges.count(), 2)

        rent_charge = charges.filter(charge_type=RentChargeType.RENT).first()
        self.assertIsNotNone(rent_charge)
        self.assertEqual(rent_charge.amount, Decimal("25000.00"))
        self.assertEqual(rent_charge.billing_period_start, date(2026, 7, 1))
        self.assertEqual(rent_charge.billing_period_end, date(2026, 7, 31))

        dep_charge = charges.filter(charge_type=RentChargeType.SECURITY_DEPOSIT).first()
        self.assertIsNotNone(dep_charge)
        self.assertEqual(dep_charge.amount, Decimal("50000.00"))

    def test_transaction_rollback_when_rent_generation_fails(self):
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 8, 1),
            end_date=date(2027, 7, 31),
            monthly_rent=Decimal("20000.00"),
            security_deposit=Decimal("40000.00"),
        )
        accept_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id)
        tenancy.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.CONFIRMED)

        # Simulate exception inside generate_initial_rent_charge
        with patch("apps.rent.services.generate_initial_rent_charge", side_effect=RuntimeError("Billing engine failure")):
            with self.assertRaises(RuntimeError):
                activate_tenancy(
                    owner=self.owner,
                    tenancy_id=tenancy.id,
                    move_in_date=date(2026, 8, 1),
                )

        # Verify rollback: tenancy remains CONFIRMED and property remains AVAILABLE
        tenancy.refresh_from_db()
        self.property.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.CONFIRMED)
        self.assertEqual(self.property.status, PropertyStatus.AVAILABLE)
        self.assertIsNone(tenancy.actual_move_in_date)
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 0)

    def test_backfill_missing_initial_charges_for_existing_active_tenancy(self):
        # Tenancy that was activated before charge generation was implemented (e.g. status=ACTIVE without charges)
        tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 11, 15),
            monthly_rent=Decimal("30000.00"),
            security_deposit=Decimal("60000.00"),
            rent_due_day=1,
            status=TenancyStatus.ACTIVE,
            actual_move_in_date=date(2026, 11, 15),
        )
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 0)

        # First run: generates initial charges
        charges = backfill_missing_initial_charges(tenancy_id=str(tenancy.id))
        self.assertEqual(len(charges), 2)
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 2)

        rent_charge = RentCharge.objects.get(tenancy=tenancy, charge_type=RentChargeType.RENT)
        # Nov 15 to Nov 30 is 16 days out of 30: 30000 * 16 / 30 = 16000.00
        self.assertEqual(rent_charge.amount, Decimal("16000.00"))
        self.assertEqual(rent_charge.billing_period_start, date(2026, 11, 15))
        self.assertEqual(rent_charge.billing_period_end, date(2026, 11, 30))

        deposit_charge = RentCharge.objects.get(tenancy=tenancy, charge_type=RentChargeType.SECURITY_DEPOSIT)
        self.assertEqual(deposit_charge.amount, Decimal("60000.00"))

        # Second run: idempotent, returns no new charges and does not duplicate
        second_run = backfill_missing_initial_charges(tenancy_id=str(tenancy.id))
        self.assertEqual(len(second_run), 0)
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 2)

    def test_backfill_ignores_non_active_tenancies(self):
        confirmed = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 12, 1),
            monthly_rent=Decimal("20000.00"),
            security_deposit=Decimal("40000.00"),
            status=TenancyStatus.CONFIRMED,
        )
        cancelled = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 10, 1),
            monthly_rent=Decimal("20000.00"),
            security_deposit=Decimal("40000.00"),
            status=TenancyStatus.CANCELLED,
        )

        charges = backfill_missing_initial_charges()
        self.assertEqual(len(charges), 0)
        self.assertEqual(RentCharge.objects.filter(tenancy=confirmed).count(), 0)
        self.assertEqual(RentCharge.objects.filter(tenancy=cancelled).count(), 0)

    def test_backfill_management_command(self):
        tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 11, 1),
            monthly_rent=Decimal("40000.00"),
            security_deposit=Decimal("80000.00"),
            status=TenancyStatus.ACTIVE,
            actual_move_in_date=date(2026, 11, 1),
        )
        call_command("backfill_initial_rent_charges", tenancy=str(tenancy.id))
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 2)


