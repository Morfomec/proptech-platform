from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.leasing.models import Tenancy, TenancyStatus
from apps.properties.models import Property, PropertyCategory, PropertyType, PropertyStatus
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
    generate_initial_rent_charge,
    get_owner_rent_summary,
    list_security_deposits,
    record_payment,
)

User = get_user_model()


class RentDepositSeparationTests(APITestCase):
    """
    Focused test suite verifying:
    1. Rent-only summary calculations.
    2. Deposit-only summary calculations.
    3. Deposit refunds and outstanding balance recalculations.
    4. Owner/tenant workspace isolation and role parameter spoofing protection.
    5. Payment allocation restrictions between rent and security deposit.
    """

    def setUp(self):
        # Owner 1
        self.owner1 = User.objects.create_user(
            email="owner1_ledger@example.com",
            password="Password123!",
            is_active=True,
            is_owner=True,
            is_tenant=False,
            first_name="Owner",
            last_name="One",
        )
        # Owner 2
        self.owner2 = User.objects.create_user(
            email="owner2_ledger@example.com",
            password="Password123!",
            is_active=True,
            is_owner=True,
            is_tenant=False,
            first_name="Owner",
            last_name="Two",
        )
        # Tenant 1 (strictly tenant, no owner capability)
        self.tenant1 = User.objects.create_user(
            email="tenant1_ledger@example.com",
            password="Password123!",
            is_active=True,
            is_owner=False,
            is_tenant=True,
            first_name="Tenant",
            last_name="One",
        )

        # Property owned by Owner 1
        self.property1 = Property.objects.create(
            owner=self.owner1,
            title="Sunrise Apartments 101",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            status=PropertyStatus.OCCUPIED,
            address_line_1="101 Coastal Road",
            locality="Marine Drive",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            country_code="IN",
            pin_code="682001",
            bedrooms=2,
            bathrooms=Decimal("2.0"),
        )

        # Active Tenancy for Owner 1 with both rent and security deposit
        self.today = timezone.localdate()
        self.tenancy1 = Tenancy.objects.create(
            property=self.property1,
            tenant=self.tenant1,
            start_date=self.today,
            monthly_rent=Decimal("30000.00"),
            security_deposit=Decimal("60000.00"),
            rent_due_day=self.today.day if 1 <= self.today.day <= 28 else 1,
            status=TenancyStatus.ACTIVE,
        )

        # Generate initial charges (Rent: ₹30,000, Deposit: ₹60,000)
        self.rent_charge1, self.deposit_charge1 = generate_initial_rent_charge(tenancy=self.tenancy1)

    def test_rent_and_deposit_summary_separation(self):
        """
        Financial summary must separate rent metrics from security deposit metrics:
        - Rent Outstanding includes ONLY rent charges (prorated rent amount, NOT including deposit).
        - Rent Collected includes ONLY payments allocated to rent.
        - Security Deposits Held is calculated separately.
        """
        summary = get_owner_rent_summary(user=self.owner1)
        expected_rent = str(self.rent_charge1.amount)

        self.assertEqual(summary["total_billed"], expected_rent)
        self.assertEqual(summary["outstanding_rent"], expected_rent)
        self.assertEqual(summary["total_collected"], "0.00")
        self.assertEqual(summary["total_active_rent_charges"], 1)

        # Security deposit fields
        self.assertEqual(summary["total_deposits_agreed"], "60000.00")
        self.assertEqual(summary["total_deposits_received"], "0.00")
        self.assertEqual(summary["total_deposits_outstanding"], "60000.00")
        self.assertEqual(summary["security_deposits_held"], "0.00")
        self.assertEqual(summary["total_deposits_refunded"], "0.00")

    def test_payment_allocation_restriction_deposit_never_allocates_to_rent(self):
        """
        A deposit payment must allocate strictly to the deposit charge and NEVER to a rent charge.
        """
        deposit_payment = record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=Decimal("40000.00"),
            payment_method="upi",
            target_charge_type="security_deposit",
            notes="Initial deposit tranche",
        )

        self.deposit_charge1.refresh_from_db()
        self.rent_charge1.refresh_from_db()

        # Deposit charge should be partially paid
        self.assertEqual(self.deposit_charge1.status, RentChargeStatus.PARTIALLY_PAID)

        # Rent charge must remain strictly UNPAID with 0 allocations
        self.assertEqual(self.rent_charge1.status, RentChargeStatus.UNPAID)
        self.assertEqual(PaymentAllocation.objects.filter(rent_charge=self.rent_charge1).count(), 0)

        # Allocation should be on deposit charge
        alloc = PaymentAllocation.objects.get(payment=deposit_payment)
        self.assertEqual(alloc.rent_charge_id, self.deposit_charge1.id)
        self.assertEqual(alloc.allocated_amount, Decimal("40000.00"))

        # Verify summary reflects the deposit payment without contaminating rent
        summary = get_owner_rent_summary(user=self.owner1)
        expected_rent = str(self.rent_charge1.amount)
        self.assertEqual(summary["outstanding_rent"], expected_rent)
        self.assertEqual(summary["total_collected"], "0.00")  # Rent collected remains 0
        self.assertEqual(summary["total_deposits_received"], "40000.00")
        self.assertEqual(summary["total_deposits_outstanding"], "20000.00")
        self.assertEqual(summary["security_deposits_held"], "40000.00")

    def test_payment_allocation_restriction_rent_never_allocates_to_deposit(self):
        """
        A rent payment must allocate strictly to rent charges and NEVER to a deposit charge.
        """
        rent_amount = self.rent_charge1.amount
        rent_payment = record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=rent_amount,
            payment_method="bank_transfer",
            target_charge_type="rent",
            notes="November Rent",
        )

        self.rent_charge1.refresh_from_db()
        self.deposit_charge1.refresh_from_db()

        # Rent charge is paid
        self.assertEqual(self.rent_charge1.status, RentChargeStatus.PAID)

        # Deposit charge must remain strictly UNPAID with 0 allocations
        self.assertEqual(self.deposit_charge1.status, RentChargeStatus.UNPAID)
        self.assertEqual(PaymentAllocation.objects.filter(rent_charge=self.deposit_charge1).count(), 0)

        # Verify summary
        summary = get_owner_rent_summary(user=self.owner1)
        self.assertEqual(summary["outstanding_rent"], "0.00")
        self.assertEqual(summary["total_collected"], str(rent_amount))
        self.assertEqual(summary["total_deposits_outstanding"], "60000.00")
        self.assertEqual(summary["security_deposits_held"], "0.00")

    def test_security_deposit_refund_and_balance_recalculation(self):
        """
        Refunding a security deposit reduces security_deposits_held and restores deposit outstanding.
        """
        # 1. Pay deposit in full (₹60,000)
        pmt = record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=Decimal("60000.00"),
            payment_method="bank_transfer",
            target_charge_type="security_deposit",
        )
        self.deposit_charge1.refresh_from_db()
        self.assertEqual(self.deposit_charge1.status, RentChargeStatus.PAID)

        # Deposit held is ₹60,000
        summary_before = get_owner_rent_summary(user=self.owner1)
        self.assertEqual(summary_before["security_deposits_held"], "60000.00")
        self.assertEqual(summary_before["total_deposits_outstanding"], "0.00")

        # 2. Refund ₹20,000 of the deposit
        refund = create_refund(
            user=self.owner1,
            payment_id=pmt.id,
            amount=Decimal("20000.00"),
            reason="Partial deposit refund after initial adjustment",
        )
        self.assertEqual(refund.status, PaymentRefundStatus.COMPLETED)

        # 3. Check deposit held is now ₹40,000 and deposit charge status is partially_paid
        self.deposit_charge1.refresh_from_db()
        self.assertEqual(self.deposit_charge1.status, RentChargeStatus.PARTIALLY_PAID)

        summary_after = get_owner_rent_summary(user=self.owner1)
        self.assertEqual(summary_after["security_deposits_held"], "40000.00")
        self.assertEqual(summary_after["total_deposits_refunded"], "20000.00")
        self.assertEqual(summary_after["total_deposits_outstanding"], "20000.00")

    def test_list_security_deposits_breakdown(self):
        """
        list_security_deposits must return all required fields for the security deposit section:
        Property, Tenant, Agreed deposit, Deposit received, Outstanding deposit, Adjustments, Refunds, Held.
        """
        record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=Decimal("60000.00"),
            payment_method="upi",
            target_charge_type="security_deposit",
        )

        deposits = list_security_deposits(user=self.owner1, role="owner")
        self.assertEqual(len(deposits), 1)
        dep = deposits[0]

        self.assertEqual(dep["property_title"], "Sunrise Apartments 101")
        self.assertEqual(dep["tenant_name"], "Tenant One")
        self.assertEqual(dep["agreed_deposit"], "60000.00")
        self.assertEqual(dep["deposit_received"], "60000.00")
        self.assertEqual(dep["outstanding_deposit"], "0.00")
        self.assertEqual(dep["adjustments"], "0.00")
        self.assertEqual(dep["refunds"], "0.00")
        self.assertEqual(dep["deposit_held"], "60000.00")
        self.assertEqual(dep["status"], "paid")

    def test_security_deposit_endpoint_api(self):
        """
        GET /api/v1/rent/security-deposits/ returns the formatted list.
        """
        self.client.force_authenticate(user=self.owner1)
        response = self.client.get(reverse("rent:security-deposits"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(len(response.data["data"]), 1)
        self.assertEqual(response.data["data"][0]["property_title"], "Sunrise Apartments 101")
        self.assertEqual(response.data["data"][0]["agreed_deposit"], "60000.00")

    def test_workspace_security_role_spoofing_prevented(self):
        """
        A non-owner user (tenant) cannot access owner endpoints or query ?role=owner.
        The server must deny access with 403 Forbidden.
        """
        self.client.force_authenticate(user=self.tenant1)

        # 1. Summary endpoint (owner only)
        resp_summary = self.client.get(reverse("rent:rent-summary"))
        self.assertEqual(resp_summary.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp_summary.data["error"]["code"], "FORBIDDEN")

        # 2. Rent charges endpoint with ?role=owner
        resp_charges = self.client.get(reverse("rent:rent-charge-list"), {"role": "owner"})
        self.assertEqual(resp_charges.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp_charges.data["error"]["code"], "FORBIDDEN")

        # 3. Payments endpoint with ?role=owner
        resp_payments = self.client.get(reverse("rent:payment-list"), {"role": "owner"})
        self.assertEqual(resp_payments.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp_payments.data["error"]["code"], "FORBIDDEN")

        # 4. Security deposits endpoint with ?role=owner
        resp_deposits = self.client.get(reverse("rent:security-deposits"), {"role": "owner"})
        self.assertEqual(resp_deposits.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp_deposits.data["error"]["code"], "FORBIDDEN")

    def test_strict_cross_owner_isolation(self):
        """
        Owner 2 must not see Owner 1's rent charges, summary, or security deposits.
        """
        self.client.force_authenticate(user=self.owner2)

        # Summary for Owner 2 has 0 values
        resp_summary = self.client.get(reverse("rent:rent-summary"))
        self.assertEqual(resp_summary.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_summary.data["data"]["total_billed"], "0.00")
        self.assertEqual(resp_summary.data["data"]["outstanding_rent"], "0.00")
        self.assertEqual(resp_summary.data["data"]["security_deposits_held"], "0.00")

        # Charges list for Owner 2 returns empty
        resp_charges = self.client.get(reverse("rent:rent-charge-list"), {"role": "owner"})
        self.assertEqual(resp_charges.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_charges.data["count"], 0)

        # Security deposits for Owner 2 returns empty
        resp_deposits = self.client.get(reverse("rent:security-deposits"), {"role": "owner"})
        self.assertEqual(resp_deposits.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_deposits.data["data"]), 0)
