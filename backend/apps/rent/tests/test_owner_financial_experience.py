from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.leasing.models import Tenancy, TenancyStatus
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType
from apps.rent.models import (
    Payment,
    PaymentAllocation,
    PaymentRefund,
    PaymentRefundStatus,
    PaymentStatus,
    RentCharge,
    RentChargeStatus,
    RentChargeType,
)
from apps.rent.services import (
    allocate_payment_fifo,
    create_refund,
    get_owner_rent_summary,
    list_user_transactions,
    record_payment,
)
from apps.leasing.services import end_tenancy, get_tenancy_settlement_preview

User = get_user_model()


class OwnerFinancialExperienceTests(APITestCase):
    """
    Focused test suite verifying:
    1. Dashboard calculations: Rent Collected This Month, Rent Pending, Overdue Rent, Upcoming Rent.
    2. Security Deposit Position: Security Deposits Held, Pending Deposit Collection.
    3. Unified transactions feed (rent payments, deposit payments, and refunds).
    4. Guided checkout settlement with itemised deductions and refund.
    5. Invariant check: deductions + refund <= deposit held.
    6. Double checkout protection and cross-owner isolation.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_fin_exp@example.com",
            password="Password123!",
            is_active=True,
            is_owner=True,
            is_tenant=False,
            first_name="Alice",
            last_name="Owner",
        )
        self.other_owner = User.objects.create_user(
            email="other_owner_fin_exp@example.com",
            password="Password123!",
            is_active=True,
            is_owner=True,
            is_tenant=False,
            first_name="Bob",
            last_name="Owner",
        )
        self.tenant = User.objects.create_user(
            email="tenant_fin_exp@example.com",
            password="Password123!",
            is_active=True,
            is_owner=False,
            is_tenant=True,
            first_name="Charlie",
            last_name="Tenant",
        )

        self.property = Property.objects.create(
            owner=self.owner,
            title="Sunny Residence",
            description="Beautiful apartment",
            property_type=PropertyType.APARTMENT,
            category=PropertyCategory.RESIDENTIAL,
            status=PropertyStatus.OCCUPIED,
            address_line_1="123 Park Ave",
            locality="Central Park",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            country_code="IN",
            pin_code="682001",
            bedrooms=2,
            bathrooms=Decimal("2.0"),
        )

        today = timezone.localdate()
        self.start_date = today.replace(day=1)
        self.tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            monthly_rent=Decimal("30000.00"),
            security_deposit=Decimal("60000.00"),
            rent_due_day=5,
            start_date=self.start_date,
            actual_move_in_date=self.start_date,
            status=TenancyStatus.ACTIVE,
        )

        # 1. Deposit charge (60,000)
        self.deposit_charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.SECURITY_DEPOSIT,
            billing_period_start=self.start_date,
            billing_period_end=self.start_date,
            due_date=self.start_date,
            amount=Decimal("60000.00"),
            status=RentChargeStatus.UNPAID,
            description="Security Deposit",
        )

        # 2. Overdue rent charge (from prior month cycle, due 10 days ago)
        prior_month_start = (self.start_date - timezone.timedelta(days=20)).replace(day=1)
        prior_month_end = self.start_date - timezone.timedelta(days=1)
        self.overdue_charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=prior_month_start,
            billing_period_end=prior_month_end,
            due_date=today - timezone.timedelta(days=10),
            amount=Decimal("15000.00"),
            status=RentChargeStatus.UNPAID,
            description="Overdue Rent",
        )

        # 3. Rent pending charge (current cycle, due 5 days in future)
        self.pending_charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=self.start_date,
            billing_period_end=self.start_date.replace(day=28),
            due_date=today + timezone.timedelta(days=5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
            description="Current Cycle Rent",
        )

    def test_dashboard_two_zones_metrics(self):
        """Verify Rent Pending, Overdue Rent, Rent Collected This Month, and Deposit Position."""
        # Record a payment for deposit (40,000 paid out of 60,000)
        pmt_deposit = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("40000.00"),
            payment_method="bank_transfer",
            status=PaymentStatus.COMPLETED,
            target_charge_type="security_deposit",
        )

        # Record a payment for rent (15,000 paid to overdue charge)
        pmt_rent = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("15000.00"),
            payment_method="upi",
            status=PaymentStatus.COMPLETED,
            target_charge_type="rent",
        )

        summary = get_owner_rent_summary(user=self.owner)

        # Monthly Rent Health
        self.assertEqual(summary["rent_collected_this_month"], "15000.00")
        self.assertEqual(summary["overdue_rent"], "0.00")  # overdue charge was paid
        self.assertEqual(summary["rent_pending"], "10000.00")  # pending charge remains unpaid

        # Security Deposit Position
        self.assertEqual(summary["security_deposits_held"], "40000.00")
        self.assertEqual(summary["pending_deposit_collection"], "20000.00")  # 60k - 40k

    def test_unified_financial_transactions(self):
        """Verify unified transactions feed lists rent payments, deposit payments, and refunds."""
        # 1. Deposit payment
        pmt = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("50000.00"),
            payment_method="bank_transfer",
            status=PaymentStatus.COMPLETED,
            target_charge_type="security_deposit",
            notes="Initial deposit receipt",
        )

        # 2. Refund 10,000
        ref = create_refund(
            user=self.owner,
            payment_id=pmt.id,
            amount=Decimal("10000.00"),
            reason="Partial deposit return",
            status=PaymentRefundStatus.COMPLETED,
        )

        self.client.force_authenticate(user=self.owner)
        url = reverse("rent:financial-transactions")
        resp = self.client.get(url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data["results"] if "results" in resp.data else resp.data["data"]
        
        # Check that both refund and deposit payment exist in chronological stream
        tx_types = [tx["transaction_type"] for tx in results]
        self.assertIn("deposit_payment", tx_types)
        self.assertIn("refund", tx_types)

    def test_tenancy_settlement_preview(self):
        """Verify settlement preview returns accurate deposit received, refunds, and max refundable."""
        record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("60000.00"),
            payment_method="bank_transfer",
            status=PaymentStatus.COMPLETED,
            target_charge_type="security_deposit",
        )

        preview = get_tenancy_settlement_preview(owner=self.owner, tenancy_id=self.tenancy.id)
        self.assertEqual(preview["agreed_deposit"], "60000.00")
        self.assertEqual(preview["deposit_received"], "60000.00")
        self.assertEqual(preview["prior_refunds"], "0.00")
        self.assertEqual(preview["deposit_held"], "60000.00")
        self.assertEqual(preview["max_refundable_amount"], "60000.00")

    def test_checkout_settlement_with_deductions_and_refund(self):
        """Verify checkout ends tenancy, logs Option A deduction charge, and processes refund."""
        # Fully collect 60,000 deposit
        record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("60000.00"),
            payment_method="bank_transfer",
            status=PaymentStatus.COMPLETED,
            target_charge_type="security_deposit",
        )

        today = timezone.localdate()
        deductions = [
            {"reason": "Deep cleaning", "amount": "3000.00"},
            {"reason": "Wall repainting", "amount": "5000.00"},
        ]
        refund_amount = Decimal("52000.00")

        ended_tenancy = end_tenancy(
            owner=self.owner,
            tenancy_id=self.tenancy.id,
            move_out_date=today,
            settle_deposit=True,
            deductions=deductions,
            refund_amount=refund_amount,
            refund_reference="REF-CHECKOUT-001",
        )

        self.assertEqual(ended_tenancy.status, TenancyStatus.ENDED)
        self.assertEqual(ended_tenancy.actual_move_out_date, today)

        # Verify Option A deduction record (MAINTENANCE charge of 8,000)
        deduction_charge = RentCharge.objects.filter(
            tenancy=self.tenancy,
            charge_type=RentChargeType.MAINTENANCE,
        ).first()
        self.assertIsNotNone(deduction_charge)
        self.assertEqual(deduction_charge.amount, Decimal("8000.00"))
        self.assertEqual(deduction_charge.status, RentChargeStatus.PAID)
        self.assertIn("Deep cleaning", deduction_charge.description)
        self.assertIn("Wall repainting", deduction_charge.description)
        self.assertIn(self.owner.email, deduction_charge.description)

        # Verify refund processed for 52,000
        refund = PaymentRefund.objects.filter(
            payment__tenancy=self.tenancy,
            status=PaymentRefundStatus.COMPLETED,
        ).first()
        self.assertIsNotNone(refund)
        self.assertEqual(refund.amount, Decimal("52000.00"))

        # Verify property returned to AVAILABLE
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.AVAILABLE)

    def test_checkout_settlement_exceeding_deposit_held_rejected(self):
        """Verify error if deductions + refund exceed deposit held."""
        record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("30000.00"),
            payment_method="bank_transfer",
            status=PaymentStatus.COMPLETED,
            target_charge_type="security_deposit",
        )

        from apps.leasing.services.exceptions import TenancyStateError
        with self.assertRaises(TenancyStateError):
            end_tenancy(
                owner=self.owner,
                tenancy_id=self.tenancy.id,
                settle_deposit=True,
                deductions=[{"reason": "Major damage", "amount": "25000.00"}],
                refund_amount=Decimal("10000.00"),  # 25k + 10k = 35k > 30k held
            )

    def test_checkout_idempotency_duplicate_prevented(self):
        """Verify ending already ended tenancy raises TenancyStateError."""
        end_tenancy(owner=self.owner, tenancy_id=self.tenancy.id)

        from apps.leasing.services.exceptions import TenancyStateError
        with self.assertRaises(TenancyStateError):
            end_tenancy(owner=self.owner, tenancy_id=self.tenancy.id)

    def test_cross_owner_isolation_in_settlement_and_transactions(self):
        """Verify another owner cannot preview settlement or access transactions."""
        self.client.force_authenticate(user=self.other_owner)

        # Other owner accessing settlement preview
        url = reverse("leasing:tenancy-settlement-preview", kwargs={"pk": self.tenancy.id})
        resp = self.client.get(url)
        self.assertIn(resp.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # Other owner requesting transactions
        tx_url = reverse("rent:financial-transactions")
        resp_tx = self.client.get(tx_url)
        results = resp_tx.data["results"] if "results" in resp_tx.data else resp_tx.data["data"]
        self.assertEqual(len(results), 0)
