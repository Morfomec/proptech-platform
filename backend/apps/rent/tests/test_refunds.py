import uuid
from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import models
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.leasing.models import Tenancy, TenancyStatus
from apps.properties.models import Property, PropertyCategory, PropertyType
from apps.rent.models import (
    Payment,
    PaymentAllocation,
    PaymentAllocationReversal,
    PaymentMethod,
    PaymentRefund,
    PaymentRefundStatus,
    PaymentStatus,
    RentCharge,
    RentChargeStatus,
    RentChargeType,
)
from apps.rent.services.allocation_service import (
    allocate_payment_fifo,
    get_charge_effective_allocated_total,
    get_payment_effective_allocated_total,
)
from apps.rent.services.exceptions import (
    PaymentPermissionError,
    RefundError,
    RefundPermissionError,
    RefundValidationError,
)
from apps.rent.services.payment_service import record_payment
from apps.rent.services.refund_service import (
    create_refund,
    fail_refund,
    get_payment_refundable_amount,
    get_payment_unallocated_balance,
    get_refund_details,
    list_payment_refunds,
    process_refund,
)

User = get_user_model()


class RefundManagementTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_refund@example.com",
            password="testpassword123",
            first_name="Alice",
            last_name="Owner",
        )
        self.tenant = User.objects.create_user(
            email="tenant_refund@example.com",
            password="testpassword123",
            first_name="Bob",
            last_name="Tenant",
        )
        self.other_user = User.objects.create_user(
            email="other_refund@example.com",
            password="testpassword123",
            first_name="Charlie",
            last_name="Other",
        )
        self.property = Property.objects.create(
            owner=self.owner,
            title="Kochi Waterfront Apartment",
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
        )
        self.tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 1, 1),
            monthly_rent=Decimal("10000.00"),
            security_deposit=Decimal("20000.00"),
            rent_due_day=5,
            status=TenancyStatus.ACTIVE,
        )

        self.client = APIClient()

    def test_create_partial_refund_unallocated_balance_first(self):
        """
        Unallocated balance must be refunded first.
        Payment: ₹15,000. Allocation: ₹10,000 (Dec rent). Unallocated: ₹5,000.
        Refund of ₹3,000 should come entirely from unallocated balance.
        No allocation reversals should be created.
        """
        charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("15000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.COMPLETED,
        )

        # Payment should have settled the ₹10,000 charge and left ₹5,000 unallocated
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PAID)
        self.assertEqual(get_payment_unallocated_balance(payment=payment), Decimal("5000.00"))

        # Issue partial refund of ₹3,000
        refund = create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("3000.00"),
            reason="Partial overpayment return",
            refund_reference="REF-001",
            status=PaymentRefundStatus.COMPLETED,
        )

        self.assertEqual(refund.status, PaymentRefundStatus.COMPLETED)
        self.assertIsNotNone(refund.processed_at)

        # Allocation remains untouched; 0 reversals created
        self.assertEqual(PaymentAllocationReversal.objects.filter(refund=refund).count(), 0)
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PAID)

        # Unallocated balance reduced to ₹2,000; remaining refundable is ₹12,000
        self.assertEqual(get_payment_unallocated_balance(payment=payment), Decimal("2000.00"))
        self.assertEqual(get_payment_refundable_amount(payment=payment), Decimal("12000.00"))

    def test_partial_refund_exceeding_unallocated_reverses_allocation(self):
        """
        Payment: ₹15,000. Allocation: ₹10,000. Unallocated: ₹5,000.
        Refund of ₹7,000:
        ₹5,000 absorbed by unallocated balance, remaining ₹2,000 reverses allocation.
        Charge effective paid becomes ₹8,000 and status becomes partially_paid.
        """
        charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("15000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )

        refund = create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("7000.00"),
            reason="Tenant requested return",
            status=PaymentRefundStatus.COMPLETED,
        )

        # Check reversal record
        reversal = PaymentAllocationReversal.objects.get(refund=refund)
        self.assertEqual(reversal.reversed_amount, Decimal("2000.00"))
        self.assertEqual(reversal.rent_charge_id, charge.id)

        # Original allocation amount preserved!
        allocation = PaymentAllocation.objects.get(payment=payment, rent_charge=charge)
        self.assertEqual(allocation.allocated_amount, Decimal("10000.00"))
        self.assertEqual(allocation.effective_amount, Decimal("8000.00"))

        # Charge status updated to partially_paid
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PARTIALLY_PAID)
        self.assertEqual(get_charge_effective_allocated_total(rent_charge=charge), Decimal("8000.00"))

        # Unallocated balance is now 0; refundable is ₹8,000
        self.assertEqual(get_payment_unallocated_balance(payment=payment), Decimal("0.00"))
        self.assertEqual(get_payment_refundable_amount(payment=payment), Decimal("8000.00"))

    def test_reverse_chronology_multiple_allocations(self):
        """
        Payment: ₹15,000.
        Alloc 1 (Jan): ₹10,000.
        Alloc 2 (Feb): ₹5,000.
        Refund of ₹5,000 must reverse Alloc 2 first (newest allocation).
        Feb rent reverts to unpaid, Jan rent remains paid.
        """
        charge_jan = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )
        charge_feb = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 2, 1),
            billing_period_end=date(2026, 2, 28),
            due_date=date(2026, 2, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("15000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.COMPLETED,
        )

        charge_jan.refresh_from_db()
        charge_feb.refresh_from_db()
        self.assertEqual(charge_jan.status, RentChargeStatus.PAID)
        self.assertEqual(charge_feb.status, RentChargeStatus.PARTIALLY_PAID)

        # Refund ₹5,000
        refund = create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("5000.00"),
            reason="Reversal of Feb rent portion",
            status=PaymentRefundStatus.COMPLETED,
        )

        # Feb rent reversed by ₹5,000 -> effective paid becomes 0 -> UNPAID
        charge_feb.refresh_from_db()
        self.assertEqual(charge_feb.status, RentChargeStatus.UNPAID)
        self.assertEqual(get_charge_effective_allocated_total(rent_charge=charge_feb), Decimal("0.00"))

        # Jan rent untouched -> remains PAID
        charge_jan.refresh_from_db()
        self.assertEqual(charge_jan.status, RentChargeStatus.PAID)
        self.assertEqual(get_charge_effective_allocated_total(rent_charge=charge_jan), Decimal("10000.00"))

        # Only 1 reversal record created for the Feb charge
        reversals = PaymentAllocationReversal.objects.filter(refund=refund)
        self.assertEqual(reversals.count(), 1)
        self.assertEqual(reversals.first().rent_charge_id, charge_feb.id)
        self.assertEqual(reversals.first().reversed_amount, Decimal("5000.00"))

    def test_full_refund_reverses_all_allocations(self):
        """
        Payment: ₹15,000. Allocations: Jan ₹10,000, Feb ₹5,000.
        Full refund of ₹15,000 reverses both allocations. Both charges revert to UNPAID.
        """
        charge_jan = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )
        charge_feb = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 2, 1),
            billing_period_end=date(2026, 2, 28),
            due_date=date(2026, 2, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("15000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.COMPLETED,
        )

        refund = create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("15000.00"),
            reason="Full payment refund",
            status=PaymentRefundStatus.COMPLETED,
        )

        charge_jan.refresh_from_db()
        charge_feb.refresh_from_db()
        self.assertEqual(charge_jan.status, RentChargeStatus.UNPAID)
        self.assertEqual(charge_feb.status, RentChargeStatus.UNPAID)

        self.assertEqual(get_payment_refundable_amount(payment=payment), Decimal("0.00"))
        self.assertEqual(get_payment_effective_allocated_total(payment=payment), Decimal("0.00"))

        # Both reversals exist
        self.assertEqual(PaymentAllocationReversal.objects.filter(refund=refund).count(), 2)

    def test_multiple_partial_refunds_progressive_reversal(self):
        """
        Payment: ₹10,000 allocated to ₹10,000 charge.
        Refund 1: ₹3,000 -> effective ₹7,000 (PARTIALLY_PAID)
        Refund 2: ₹3,000 -> effective ₹4,000 (PARTIALLY_PAID)
        Refund 3: ₹4,000 -> effective ₹0 (UNPAID)
        Refund 4: ₹1 -> rejected, exceeds balance
        """
        charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )

        create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("3000.00"),
            reason="Partial 1",
            status=PaymentRefundStatus.COMPLETED,
        )
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PARTIALLY_PAID)
        self.assertEqual(get_charge_effective_allocated_total(rent_charge=charge), Decimal("7000.00"))

        create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("3000.00"),
            reason="Partial 2",
            status=PaymentRefundStatus.COMPLETED,
        )
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PARTIALLY_PAID)
        self.assertEqual(get_charge_effective_allocated_total(rent_charge=charge), Decimal("4000.00"))

        create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("4000.00"),
            reason="Partial 3",
            status=PaymentRefundStatus.COMPLETED,
        )
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.UNPAID)
        self.assertEqual(get_charge_effective_allocated_total(rent_charge=charge), Decimal("0.00"))

        # Refund 4 exceeds remaining refundable
        with self.assertRaises(RefundValidationError):
            create_refund(
                user=self.owner,
                payment_id=payment.id,
                amount=Decimal("1.00"),
                reason="Exceeding refund",
                status=PaymentRefundStatus.COMPLETED,
            )

    def test_pending_and_failed_refunds_do_not_affect_balances(self):
        """
        Pending and failed refunds must never alter allocations or rent charge statuses.
        Only completed refunds reverse allocations.
        """
        charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )

        # Create pending refund
        pending_refund = create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("5000.00"),
            reason="Pending refund request",
            status=PaymentRefundStatus.PENDING,
        )

        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PAID)
        self.assertEqual(PaymentAllocationReversal.objects.filter(refund=pending_refund).count(), 0)

        # Process the pending refund
        processed_refund = process_refund(
            user=self.owner,
            refund_id=pending_refund.id,
            refund_reference="REF-PROC-01",
        )
        self.assertEqual(processed_refund.status, PaymentRefundStatus.COMPLETED)
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PARTIALLY_PAID)
        self.assertEqual(PaymentAllocationReversal.objects.filter(refund=processed_refund).count(), 1)

        # Create second pending refund and fail it
        pending2 = create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("2000.00"),
            reason="Pending 2",
            status=PaymentRefundStatus.PENDING,
        )
        failed_refund = fail_refund(user=self.owner, refund_id=pending2.id, reason="Bank rejected")
        self.assertEqual(failed_refund.status, PaymentRefundStatus.FAILED)

        # Balances remain unchanged after failure
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PARTIALLY_PAID)

    def test_prevent_duplicate_processing(self):
        """A refund cannot be processed more than once."""
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.COMPLETED,
        )
        refund = create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("2000.00"),
            reason="Return",
            status=PaymentRefundStatus.COMPLETED,
        )

        with self.assertRaises(RefundValidationError):
            process_refund(user=self.owner, refund_id=refund.id)

    def test_refund_amount_validation(self):
        """Refund amount must be > 0 and <= payment amount."""
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.COMPLETED,
        )

        # Zero or negative rejected
        with self.assertRaises(RefundValidationError):
            create_refund(user=self.owner, payment_id=payment.id, amount=Decimal("0.00"), reason="Zero")

        with self.assertRaises(RefundValidationError):
            create_refund(user=self.owner, payment_id=payment.id, amount=Decimal("-500.00"), reason="Negative")

        # Exceeding amount rejected
        with self.assertRaises(RefundValidationError):
            create_refund(user=self.owner, payment_id=payment.id, amount=Decimal("5001.00"), reason="Too high")

    def test_non_completed_payment_cannot_be_refunded(self):
        """Pending and failed payments cannot be refunded."""
        pending_payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.PENDING,
        )

        with self.assertRaises(RefundValidationError):
            create_refund(
                user=self.owner,
                payment_id=pending_payment.id,
                amount=Decimal("1000.00"),
                reason="Invalid refund",
            )

    def test_api_refund_endpoints(self):
        """Test API creation, listing, retrieval, and permission enforcement."""
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )

        # 1. Owner creates refund via API
        self.client.force_authenticate(user=self.owner)
        res_create = self.client.post(
            f"/api/v1/payments/{payment.id}/refunds/",
            data={
                "amount": "2500.00",
                "reason": "Security deposit adjustment",
                "refund_reference": "TXN-REF-101",
                "status": "completed",
            },
            format="json",
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        refund_id = res_create.data["data"]["id"]

        # 2. Owner lists refunds for payment
        res_list = self.client.get(f"/api/v1/payments/{payment.id}/refunds/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        results = res_list.data.get("results") or res_list.data.get("data")
        self.assertEqual(len(results), 1)

        # 3. Tenant views refund detail (Authorized)
        self.client.force_authenticate(user=self.tenant)
        res_detail = self.client.get(f"/api/v1/refunds/{refund_id}/")
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data["data"]["amount"], "2500.00")

        # 4. Tenant cannot initiate refund (Forbidden)
        res_tenant_create = self.client.post(
            f"/api/v1/payments/{payment.id}/refunds/",
            data={"amount": "1000.00", "reason": "Tenant request"},
            format="json",
        )
        self.assertEqual(res_tenant_create.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Third-party user cannot view or create (Forbidden)
        self.client.force_authenticate(user=self.other_user)
        res_other_list = self.client.get(f"/api/v1/payments/{payment.id}/refunds/")
        self.assertEqual(res_other_list.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Admin can create and list refunds
        admin_user = User.objects.create_superuser(
            email="admin_refund@example.com",
            password="adminpassword123",
            first_name="Admin",
            last_name="Super",
        )
        self.client.force_authenticate(user=admin_user)
        res_admin_create = self.client.post(
            f"/api/v1/payments/{payment.id}/refunds/",
            data={
                "amount": "1000.00",
                "reason": "Admin adjustment",
                "status": "completed",
            },
            format="json",
        )
        self.assertEqual(res_admin_create.status_code, status.HTTP_201_CREATED)
        res_admin_list = self.client.get(f"/api/v1/payments/{payment.id}/refunds/")
        self.assertEqual(res_admin_list.status_code, status.HTTP_200_OK)

    def test_cross_tenancy_integrity_rejected(self):
        """Reversal cannot cross tenancies or link to unrelated allocations."""
        from django.core.exceptions import ValidationError
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.COMPLETED,
        )
        refund = PaymentRefund.objects.create(
            payment=payment,
            amount=Decimal("1000.00"),
            reason="Test",
            status=PaymentRefundStatus.PENDING,
            created_by=self.owner,
        )

        # Other property and tenancy
        other_property = Property.objects.create(
            owner=self.owner,
            title="Second Property",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            bedrooms=1,
            bathrooms=1,
            address_line_1="MG Road",
            locality="Kochi North",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682002",
        )
        other_tenancy = Tenancy.objects.create(
            property=other_property,
            tenant=self.other_user,
            start_date=date(2026, 2, 1),
            monthly_rent=Decimal("8000.00"),
            status=TenancyStatus.ACTIVE,
        )
        other_charge = RentCharge.objects.create(
            tenancy=other_tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 2, 1),
            billing_period_end=date(2026, 2, 28),
            due_date=date(2026, 2, 5),
            amount=Decimal("8000.00"),
        )
        other_payment = record_payment(
            user=self.owner,
            tenancy_id=other_tenancy.id,
            amount=Decimal("8000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.COMPLETED,
        )
        other_alloc = PaymentAllocation.objects.get(payment=other_payment, rent_charge=other_charge)

        # Attempt to link refund from tenancy 1 to allocation from tenancy 2
        bad_reversal = PaymentAllocationReversal(
            refund=refund,
            allocation=other_alloc,
            rent_charge=other_charge,
            tenancy=self.tenancy,
            reversed_amount=Decimal("500.00"),
        )
        with self.assertRaises(ValidationError):
            bad_reversal.clean()

    def test_database_composite_fk_rejects_mismatched_allocation_tenancy(self):
        """
        Directly verify that PostgreSQL raises IntegrityError (fk_alloc_reversal_alloc_tenancy)
        when attempting to insert an allocation reversal where the tenancy_id does not match
        the referenced allocation's tenancy_id.
        """
        from django.db import IntegrityError

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.COMPLETED,
        )
        refund = PaymentRefund.objects.create(
            payment=payment,
            amount=Decimal("1000.00"),
            reason="Test DB FK",
            status=PaymentRefundStatus.PENDING,
            created_by=self.owner,
        )

        other_property = Property.objects.create(
            owner=self.owner,
            title="Second Property Direct DB FK Test",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            bedrooms=1,
            bathrooms=1,
            address_line_1="Banerji Road",
            locality="Kochi North",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682018",
        )
        other_tenancy = Tenancy.objects.create(
            property=other_property,
            tenant=self.other_user,
            start_date=date(2026, 3, 1),
            monthly_rent=Decimal("8000.00"),
            status=TenancyStatus.ACTIVE,
        )
        other_charge = RentCharge.objects.create(
            tenancy=other_tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 3, 1),
            billing_period_end=date(2026, 3, 31),
            due_date=date(2026, 3, 5),
            amount=Decimal("8000.00"),
        )
        other_payment = record_payment(
            user=self.owner,
            tenancy_id=other_tenancy.id,
            amount=Decimal("8000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.COMPLETED,
        )
        other_alloc = PaymentAllocation.objects.get(payment=other_payment, rent_charge=other_charge)

        # Directly insert bypassing clean(): PostgreSQL fk_alloc_reversal_alloc_tenancy must reject it!
        with self.assertRaises(IntegrityError):
            PaymentAllocationReversal.objects.create(
                refund=refund,
                allocation=other_alloc,
                rent_charge=other_charge,
                tenancy=self.tenancy,
                reversed_amount=Decimal("500.00"),
            )

    def test_transaction_rollback_on_failure(self):
        """If error occurs midway during reversal, entire transaction rolls back."""
        from unittest.mock import patch
        charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("10000.00"),
            status=RentChargeStatus.UNPAID,
        )
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.COMPLETED,
        )

        with patch("apps.rent.services.refund_service.execute_refund_reversals", side_effect=RuntimeError("Database glitch")):
            with self.assertRaises(RuntimeError):
                create_refund(
                    user=self.owner,
                    payment_id=payment.id,
                    amount=Decimal("5000.00"),
                    reason="Fail test",
                    status=PaymentRefundStatus.COMPLETED,
                )

        # Verify nothing was persisted
        self.assertEqual(PaymentRefund.objects.filter(payment=payment).count(), 0)
        self.assertEqual(PaymentAllocationReversal.objects.count(), 0)
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PAID)


class RefundConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_concurrent@example.com",
            password="testpassword123",
        )
        self.tenant = User.objects.create_user(
            email="tenant_concurrent@example.com",
            password="testpassword123",
        )
        self.property = Property.objects.create(
            owner=self.owner,
            title="Concurrent Property",
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
        )
        self.tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 1, 1),
            monthly_rent=Decimal("10000.00"),
            status=TenancyStatus.ACTIVE,
        )

    def test_concurrent_simultaneous_refunds_cannot_exceed_payment_amount(self):
        """
        Two simultaneous threads attempt to refund ₹7,000 each on a ₹10,000 payment.
        Row locking with select_for_update() must serialize them:
        One thread succeeds (₹7,000 refunded).
        The other thread fails with RefundValidationError (remaining ₹3,000 < ₹7,000).
        Total refunded must never exceed payment amount.
        """
        import threading
        from django.db import connections

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )

        results = []
        errors = []

        def attempt_refund():
            try:
                r = create_refund(
                    user=self.owner,
                    payment_id=payment.id,
                    amount=Decimal("7000.00"),
                    reason="Concurrent refund attempt",
                    status=PaymentRefundStatus.COMPLETED,
                )
                results.append(r)
            except Exception as e:
                errors.append(e)
            finally:
                connections.close_all()

        t1 = threading.Thread(target=attempt_refund)
        t2 = threading.Thread(target=attempt_refund)

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Exactly 1 success, 1 failure
        self.assertEqual(len(results), 1)
        self.assertEqual(len(errors), 1)
        self.assertIsInstance(errors[0], RefundValidationError)

        # Total successful refunds in DB is exactly ₹7,000 (<= ₹10,000)
        total_refunded = (
            PaymentRefund.objects.filter(payment=payment, status=PaymentRefundStatus.COMPLETED)
            .aggregate(total=models.Sum("amount"))["total"]
        )
        self.assertEqual(total_refunded, Decimal("7000.00"))

    def test_concurrent_processing_same_pending_refund_serialized(self):
        """
        Two simultaneous threads attempt to process the exact same pending refund.
        Only one thread must succeed; the second must get RefundValidationError.
        """
        import threading
        from django.db import connections

        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )
        pending_refund = create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("4000.00"),
            reason="Concurrent pending refund",
            status=PaymentRefundStatus.PENDING,
        )

        successes = []
        failures = []

        def attempt_process():
            try:
                r = process_refund(user=self.owner, refund_id=pending_refund.id)
                successes.append(r)
            except Exception as e:
                failures.append(e)
            finally:
                connections.close_all()

        t1 = threading.Thread(target=attempt_process)
        t2 = threading.Thread(target=attempt_process)

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertEqual(len(successes), 1)
        self.assertEqual(len(failures), 1)
        self.assertIsInstance(failures[0], RefundValidationError)
        pending_refund.refresh_from_db()
        self.assertEqual(pending_refund.status, PaymentRefundStatus.COMPLETED)
