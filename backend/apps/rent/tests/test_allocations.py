from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.leasing.models import Tenancy, TenancyStatus
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType
from apps.rent.models import (
    Payment,
    PaymentAllocation,
    PaymentMethod,
    PaymentStatus,
    RentCharge,
    RentChargeStatus,
    RentChargeType,
)
from apps.rent.services import (
    allocate_payment_fifo,
    get_charge_allocated_total,
    get_payment_allocated_total,
    record_payment,
)

User = get_user_model()


class PaymentAllocationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_alloc@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        self.tenant = User.objects.create_user(
            email="tenant_alloc@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        self.tenant.is_tenant = True
        self.tenant.save(update_fields=["is_tenant"])

        self.property = Property.objects.create(
            owner=self.owner,
            title="Allocation Test House",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.INDEPENDENT_HOUSE,
            bedrooms=3,
            bathrooms=3,
            address_line_1="Aluva Riverside",
            locality="Aluva",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="683101",
            status=PropertyStatus.OCCUPIED,
        )

        self.tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            monthly_rent=Decimal("20000.00"),
            security_deposit=Decimal("40000.00"),
            rent_due_day=5,
            status=TenancyStatus.ACTIVE,
        )

    def _create_charge(self, due_date, amount, billing_period_start, charge_type=RentChargeType.RENT, status=RentChargeStatus.UNPAID):
        return RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=charge_type,
            billing_period_start=billing_period_start,
            billing_period_end=billing_period_start + timedelta(days=29),
            due_date=due_date,
            amount=amount,
            status=status,
            description=f"{charge_type} charge",
        )

    def test_completed_payment_automatically_allocated_to_oldest_charge(self):
        c1 = self._create_charge(due_date=date(2026, 1, 5), amount=Decimal("20000.00"), billing_period_start=date(2026, 1, 1))
        c2 = self._create_charge(due_date=date(2026, 2, 5), amount=Decimal("20000.00"), billing_period_start=date(2026, 2, 1))

        # Payment of 20,000 completed
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("20000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )

        # Oldest charge (c1) is fully paid; c2 remains unpaid
        c1.refresh_from_db()
        c2.refresh_from_db()
        self.assertEqual(c1.status, RentChargeStatus.PAID)
        self.assertEqual(c2.status, RentChargeStatus.UNPAID)
        self.assertEqual(get_charge_allocated_total(rent_charge=c1), Decimal("20000.00"))
        self.assertEqual(get_charge_allocated_total(rent_charge=c2), Decimal("0.00"))
        self.assertEqual(get_payment_allocated_total(payment=payment), Decimal("20000.00"))

    def test_one_payment_allocated_across_multiple_charges(self):
        c1 = self._create_charge(due_date=date(2026, 1, 5), amount=Decimal("15000.00"), billing_period_start=date(2026, 1, 1))
        c2 = self._create_charge(due_date=date(2026, 2, 5), amount=Decimal("20000.00"), billing_period_start=date(2026, 2, 1))

        # Payment of 25,000 settles c1 (15k) and partially settles c2 (10k)
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("25000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.COMPLETED,
        )

        c1.refresh_from_db()
        c2.refresh_from_db()
        self.assertEqual(c1.status, RentChargeStatus.PAID)
        self.assertEqual(c2.status, RentChargeStatus.PARTIALLY_PAID)
        self.assertEqual(get_charge_allocated_total(rent_charge=c1), Decimal("15000.00"))
        self.assertEqual(get_charge_allocated_total(rent_charge=c2), Decimal("10000.00"))
        self.assertEqual(get_payment_allocated_total(payment=payment), Decimal("25000.00"))

    def test_partial_allocation_and_multiple_payments_contributing_to_same_charge(self):
        c1 = self._create_charge(due_date=date(2026, 1, 5), amount=Decimal("20000.00"), billing_period_start=date(2026, 1, 1))

        # First partial payment: 8,000
        p1 = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("8000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )
        c1.refresh_from_db()
        self.assertEqual(c1.status, RentChargeStatus.PARTIALLY_PAID)
        self.assertEqual(get_charge_allocated_total(rent_charge=c1), Decimal("8000.00"))

        # Second payment: 12,000 fully settles c1
        p2 = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("12000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )
        c1.refresh_from_db()
        self.assertEqual(c1.status, RentChargeStatus.PAID)
        self.assertEqual(get_charge_allocated_total(rent_charge=c1), Decimal("20000.00"))

    def test_excess_payment_remains_unallocated(self):
        c1 = self._create_charge(due_date=date(2026, 1, 5), amount=Decimal("10000.00"), billing_period_start=date(2026, 1, 1))

        # Payment of 15,000 when only 10,000 is due
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("15000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.COMPLETED,
        )

        c1.refresh_from_db()
        self.assertEqual(c1.status, RentChargeStatus.PAID)
        self.assertEqual(get_payment_allocated_total(payment=payment), Decimal("10000.00"))
        # Unallocated balance is 5,000
        unallocated = payment.amount - get_payment_allocated_total(payment=payment)
        self.assertEqual(unallocated, Decimal("5000.00"))

    def test_pending_and_failed_payments_never_allocated(self):
        c1 = self._create_charge(due_date=date(2026, 1, 5), amount=Decimal("20000.00"), billing_period_start=date(2026, 1, 1))

        p_pending = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("20000.00"),
            payment_method=PaymentMethod.CHEQUE,
            status=PaymentStatus.PENDING,
        )
        p_failed = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("20000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.FAILED,
        )

        c1.refresh_from_db()
        self.assertEqual(c1.status, RentChargeStatus.UNPAID)
        self.assertEqual(get_charge_allocated_total(rent_charge=c1), Decimal("0.00"))
        self.assertEqual(get_payment_allocated_total(payment=p_pending), Decimal("0.00"))
        self.assertEqual(get_payment_allocated_total(payment=p_failed), Decimal("0.00"))

    def test_reprocessing_payment_does_not_create_duplicate_allocations(self):
        c1 = self._create_charge(due_date=date(2026, 1, 5), amount=Decimal("20000.00"), billing_period_start=date(2026, 1, 1))

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("20000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )
        self.assertEqual(PaymentAllocation.objects.filter(payment=payment).count(), 1)

        # Reprocess payment explicitly
        second_run = allocate_payment_fifo(payment_id=payment.id)
        self.assertEqual(second_run, [])
        self.assertEqual(PaymentAllocation.objects.filter(payment=payment).count(), 1)

    def test_fully_paid_waived_and_cancelled_charges_excluded(self):
        c_waived = self._create_charge(due_date=date(2026, 1, 1), amount=Decimal("5000.00"), billing_period_start=date(2026, 1, 1), status=RentChargeStatus.WAIVED)
        c_cancelled = self._create_charge(due_date=date(2026, 1, 2), amount=Decimal("5000.00"), billing_period_start=date(2026, 1, 2), status=RentChargeStatus.CANCELLED)
        c_unpaid = self._create_charge(due_date=date(2026, 1, 5), amount=Decimal("10000.00"), billing_period_start=date(2026, 1, 3))

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.COMPLETED,
        )

        c_waived.refresh_from_db()
        c_cancelled.refresh_from_db()
        c_unpaid.refresh_from_db()

        # Waived and cancelled unchanged
        self.assertEqual(c_waived.status, RentChargeStatus.WAIVED)
        self.assertEqual(c_cancelled.status, RentChargeStatus.CANCELLED)
        # Unpaid charge gets allocated
        self.assertEqual(c_unpaid.status, RentChargeStatus.PAID)
        self.assertEqual(PaymentAllocation.objects.filter(rent_charge=c_waived).count(), 0)
        self.assertEqual(PaymentAllocation.objects.filter(rent_charge=c_cancelled).count(), 0)

    def test_transaction_rollback_when_allocation_fails(self):
        c1 = self._create_charge(due_date=date(2026, 1, 5), amount=Decimal("20000.00"), billing_period_start=date(2026, 1, 1))

        with patch("apps.rent.services.allocation_service.PaymentAllocation.objects.create", side_effect=RuntimeError("DB allocation fail")):
            with self.assertRaises(RuntimeError):
                record_payment(
                    user=self.owner,
                    tenancy_id=self.tenancy.id,
                    amount=Decimal("20000.00"),
                    payment_method=PaymentMethod.UPI,
                    status=PaymentStatus.COMPLETED,
                )

        # Whole transaction rolled back: no payment and charge remains unpaid
        self.assertEqual(Payment.objects.filter(tenancy=self.tenancy).count(), 0)
        c1.refresh_from_db()
        self.assertEqual(c1.status, RentChargeStatus.UNPAID)


class PaymentAllocationIntegrityTests(TransactionTestCase):
    def test_composite_foreign_keys_reject_mismatched_tenancies(self):
        owner = User.objects.create_user(email="comp_owner@example.com", password="StrongPassword123!", is_active=True)
        tenant1 = User.objects.create_user(email="comp_tenant1@example.com", password="StrongPassword123!", is_active=True)
        tenant2 = User.objects.create_user(email="comp_tenant2@example.com", password="StrongPassword123!", is_active=True)

        prop1 = Property.objects.create(
            owner=owner, title="P1", category=PropertyCategory.RESIDENTIAL, property_type=PropertyType.APARTMENT,
            bedrooms=1, bathrooms=1, address_line_1="A1", locality="L1", city="C1", district="D1", state="S1", pin_code="682001",
        )
        prop2 = Property.objects.create(
            owner=owner, title="P2", category=PropertyCategory.RESIDENTIAL, property_type=PropertyType.APARTMENT,
            bedrooms=1, bathrooms=1, address_line_1="A2", locality="L2", city="C2", district="D2", state="S2", pin_code="682002",
        )

        t1 = Tenancy.objects.create(property=prop1, tenant=tenant1, start_date=date(2026, 1, 1), monthly_rent=Decimal("10000.00"), status=TenancyStatus.ACTIVE)
        t2 = Tenancy.objects.create(property=prop2, tenant=tenant2, start_date=date(2026, 1, 1), monthly_rent=Decimal("15000.00"), status=TenancyStatus.ACTIVE)

        charge_t1 = RentCharge.objects.create(
            tenancy=t1, charge_type=RentChargeType.RENT, billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 30), due_date=date(2026, 1, 5), amount=Decimal("10000.00"),
        )
        payment_t2 = Payment.objects.create(
            tenancy=t2, amount=Decimal("10000.00"), payment_method=PaymentMethod.UPI, status=PaymentStatus.COMPLETED,
        )

        # Cross-tenancy allocation is rejected by Python model validation and DB composite foreign keys
        with self.assertRaises((ValidationError, IntegrityError)):
            alloc = PaymentAllocation(
                payment=payment_t2,
                rent_charge=charge_t1,
                tenancy=t1,
                allocated_amount=Decimal("5000.00"),
            )
            alloc.full_clean()
            alloc.save()

