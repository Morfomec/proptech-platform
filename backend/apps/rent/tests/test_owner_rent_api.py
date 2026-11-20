from datetime import date, timedelta
from decimal import Decimal

from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.leasing.models import Application, ApplicationStatus, Tenancy, TenancyStatus
from apps.listings.models import Listing, ListingStatus, ReviewStatus
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType
from apps.rent.models import (
    Payment,
    PaymentMethod,
    PaymentRefund,
    PaymentRefundStatus,
    PaymentStatus,
    RentCharge,
    RentChargeStatus,
    RentChargeType,
)
from apps.rent.services.payment_service import record_payment
from apps.rent.services.refund_service import create_refund


class OwnerRentAPITests(TestCase):
    """
    Focused test suite verifying:
    1. Rent Charges API (filtering, pagination, serialization, data isolation)
    2. Owner Financial Summary API (aggregates, payment status handling, isolation)
    3. Payment Allocations exposure in payment detail response
    4. Refunds history list and filtering
    """

    def setUp(self):
        self.client = Client()

        # 1. Users: Owner 1, Owner 2, Tenant 1, Tenant 2
        self.owner1 = User.objects.create_user(
            email="owner1_rent_api@example.com",
            password="Password123!",
            first_name="Alice",
            last_name="Owner",
            is_owner=True,
            is_active=True,
        )
        self.owner2 = User.objects.create_user(
            email="owner2_rent_api@example.com",
            password="Password123!",
            first_name="Bob",
            last_name="Owner",
            is_owner=True,
            is_active=True,
        )
        self.tenant1 = User.objects.create_user(
            email="tenant1_rent_api@example.com",
            password="Password123!",
            first_name="Charlie",
            last_name="Tenant",
            is_tenant=True,
            is_active=True,
        )
        self.tenant2 = User.objects.create_user(
            email="tenant2_rent_api@example.com",
            password="Password123!",
            first_name="David",
            last_name="Tenant",
            is_tenant=True,
            is_active=True,
        )

        # 2. Properties
        self.property_owner1 = Property.objects.create(
            owner=self.owner1,
            title="Sunrise Residency Villa",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            address_line_1="MG Road",
            locality="Kaloor",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682017",
            bedrooms=3,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.OCCUPIED,
        )
        self.property_owner2 = Property.objects.create(
            owner=self.owner2,
            title="Skyline Commercial Hub",
            category=PropertyCategory.COMMERCIAL,
            property_type=PropertyType.OFFICE,
            address_line_1="Tech Park",
            locality="Kakkanad",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682030",
            status=PropertyStatus.OCCUPIED,
        )

        # 3. Tenancies
        self.tenancy1 = Tenancy.objects.create(
            property=self.property_owner1,
            tenant=self.tenant1,
            start_date=date(2026, 1, 1),
            monthly_rent=Decimal("20000.00"),
            security_deposit=Decimal("40000.00"),
            status=TenancyStatus.ACTIVE,
        )
        self.tenancy2 = Tenancy.objects.create(
            property=self.property_owner2,
            tenant=self.tenant2,
            start_date=date(2026, 1, 1),
            monthly_rent=Decimal("35000.00"),
            security_deposit=Decimal("70000.00"),
            status=TenancyStatus.ACTIVE,
        )

    # =========================================================================
    # 1. Rent Charges API Tests
    # =========================================================================

    def test_rent_charges_list_and_owner_isolation(self):
        """Owner 1 must only see charges for their properties; Owner 2 charges must be excluded."""
        # Create charges for owner 1
        charge1 = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("20000.00"),
            status=RentChargeStatus.UNPAID,
            description="January Rent",
        )
        charge_deposit = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.SECURITY_DEPOSIT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 1),
            due_date=date(2026, 1, 1),
            amount=Decimal("40000.00"),
            status=RentChargeStatus.UNPAID,
            description="Security Deposit",
        )

        # Create charge for owner 2
        charge_owner2 = RentCharge.objects.create(
            tenancy=self.tenancy2,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("35000.00"),
            status=RentChargeStatus.UNPAID,
            description="Owner 2 Rent",
        )

        # Authenticate as Owner 1
        self.client.force_login(self.owner1)
        response = self.client.get(reverse("rent:rent-charge-list"))
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["count"], 2)
        charge_ids = [item["id"] for item in data["results"]]
        self.assertIn(str(charge1.id), charge_ids)
        self.assertIn(str(charge_deposit.id), charge_ids)
        self.assertNotIn(str(charge_owner2.id), charge_ids)

        # Check response fields
        item = next(x for x in data["results"] if x["id"] == str(charge1.id))
        self.assertEqual(item["property_title"], "Sunrise Residency Villa")
        self.assertEqual(item["property_id"], str(self.property_owner1.id))
        self.assertEqual(item["tenant_name"], "Charlie Tenant")
        self.assertEqual(item["amount"], "20000.00")
        self.assertEqual(item["paid_amount"], "0.00")
        self.assertEqual(item["outstanding_amount"], "20000.00")
        self.assertEqual(item["status"], "unpaid")
        self.assertEqual(item["charge_type"], "rent")

    def test_rent_charges_filtering(self):
        """Verify filtering by tenancy_id, status, charge_type, and due date range."""
        today = timezone.localdate()

        # Charge A: rent, unpaid, due yesterday
        charge_a = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.RENT,
            billing_period_start=today - timedelta(days=30),
            billing_period_end=today - timedelta(days=1),
            due_date=today - timedelta(days=5),
            amount=Decimal("20000.00"),
            status=RentChargeStatus.UNPAID,
        )
        # Charge B: security deposit, paid, due today
        charge_b = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.SECURITY_DEPOSIT,
            billing_period_start=today,
            billing_period_end=today,
            due_date=today,
            amount=Decimal("40000.00"),
            status=RentChargeStatus.PAID,
        )
        # Charge C: maintenance, partially paid, due in 10 days
        charge_c = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.MAINTENANCE,
            billing_period_start=today,
            billing_period_end=today + timedelta(days=30),
            due_date=today + timedelta(days=10),
            amount=Decimal("3000.00"),
            status=RentChargeStatus.PARTIALLY_PAID,
        )

        self.client.force_login(self.owner1)

        # 1. Filter by status: unpaid
        resp = self.client.get(reverse("rent:rent-charge-list"), {"status": "unpaid"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 1)
        self.assertEqual(resp.json()["results"][0]["id"], str(charge_a.id))

        # 2. Filter by status comma-separated: unpaid,partially_paid
        resp = self.client.get(reverse("rent:rent-charge-list"), {"status": "unpaid,partially_paid"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 2)

        # 3. Filter by charge_type: security_deposit
        resp = self.client.get(reverse("rent:rent-charge-list"), {"charge_type": "security_deposit"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 1)
        self.assertEqual(resp.json()["results"][0]["id"], str(charge_b.id))

        # 4. Filter by due_date range: due_date_to <= today
        resp = self.client.get(reverse("rent:rent-charge-list"), {"due_date_to": today.isoformat()})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 2)

    def test_rent_charge_retrieve_detail(self):
        """Owner can retrieve their charge; unauthorized owner receives 404/403."""
        charge = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 2, 1),
            billing_period_end=date(2026, 2, 28),
            due_date=date(2026, 2, 5),
            amount=Decimal("20000.00"),
            status=RentChargeStatus.UNPAID,
        )

        self.client.force_login(self.owner1)
        resp = self.client.get(reverse("rent:rent-charge-detail", kwargs={"pk": charge.id}))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])
        self.assertEqual(resp.json()["data"]["id"], str(charge.id))

        # Owner 2 cannot access Owner 1's charge
        self.client.force_login(self.owner2)
        resp_unauth = self.client.get(reverse("rent:rent-charge-detail", kwargs={"pk": charge.id}))
        self.assertEqual(resp_unauth.status_code, 404)

    # =========================================================================
    # 2. Owner Financial Summary API Tests
    # =========================================================================

    def test_owner_financial_summary_calculations(self):
        """
        Verify portfolio-level aggregates:
        - total_billed
        - total_collected
        - outstanding_rent
        - overdue_rent
        - total_active_rent_charges
        """
        today = timezone.localdate()

        # Charge 1: Overdue rent (due 5 days ago, Rs 20,000)
        charge1 = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.RENT,
            billing_period_start=today - timedelta(days=30),
            billing_period_end=today - timedelta(days=1),
            due_date=today - timedelta(days=5),
            amount=Decimal("20000.00"),
            status=RentChargeStatus.UNPAID,
        )
        # Charge 2: Current rent (due in 15 days, Rs 20,000)
        charge2 = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.RENT,
            billing_period_start=today,
            billing_period_end=today + timedelta(days=30),
            due_date=today + timedelta(days=15),
            amount=Decimal("20000.00"),
            status=RentChargeStatus.UNPAID,
        )
        # Charge 3: Waived charge (should NOT count in billed or outstanding)
        RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.LATE_FEE,
            billing_period_start=today,
            billing_period_end=today,
            due_date=today,
            amount=Decimal("1000.00"),
            status=RentChargeStatus.WAIVED,
        )

        # Payment 1: Completed payment of Rs 15,000 allocated to charge 1
        record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=Decimal("15000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )

        # Payment 2: Pending payment of Rs 5,000 (must NOT be counted in collected)
        record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.PENDING,
        )

        # Expected state:
        # Total billed = 20000 + 20000 = 40000.00
        # Total collected = 15000.00 (pending 5000 ignored)
        # Charge 1 effective balance = 20000 - 15000 = 5000.00 (overdue)
        # Charge 2 effective balance = 20000.00 (not overdue)
        # Outstanding rent = 5000 + 20000 = 25000.00
        # Overdue rent = 5000.00
        # Active charges count = 2 (charges 1 & 2)

        self.client.force_login(self.owner1)
        resp = self.client.get(reverse("rent:rent-summary"))
        self.assertEqual(resp.status_code, 200)

        data = resp.json()["data"]
        self.assertEqual(data["total_billed"], "40000.00")
        self.assertEqual(data["total_collected"], "15000.00")
        self.assertEqual(data["outstanding_rent"], "25000.00")
        self.assertEqual(data["overdue_rent"], "5000.00")
        self.assertEqual(data["total_active_rent_charges"], 2)
        self.assertEqual(data["currency"], "INR")

    def test_owner_financial_summary_with_refund(self):
        """Completed refund must reduce total_collected and increase outstanding balance."""
        today = timezone.localdate()
        charge = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.RENT,
            billing_period_start=today,
            billing_period_end=today + timedelta(days=30),
            due_date=today + timedelta(days=5),
            amount=Decimal("20000.00"),
            status=RentChargeStatus.UNPAID,
        )

        payment = record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=Decimal("20000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.COMPLETED,
        )
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PAID)

        # Create full refund
        create_refund(
            user=self.owner1,
            payment_id=payment.id,
            amount=Decimal("20000.00"),
            reason="Accidental double payment",
            status=PaymentRefundStatus.COMPLETED,
        )

        self.client.force_login(self.owner1)
        resp = self.client.get(reverse("rent:rent-summary"))
        self.assertEqual(resp.status_code, 200)

        data = resp.json()["data"]
        self.assertEqual(data["total_billed"], "20000.00")
        self.assertEqual(data["total_collected"], "0.00")
        self.assertEqual(data["outstanding_rent"], "20000.00")
        self.assertEqual(data["total_active_rent_charges"], 1)

    # =========================================================================
    # 3. Payment Allocations Exposure Tests
    # =========================================================================

    def test_payment_detail_exposes_allocations(self):
        """Payment detail response must include allocation records with charge references and amounts."""
        charge = RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 3, 1),
            billing_period_end=date(2026, 3, 31),
            due_date=date(2026, 3, 5),
            amount=Decimal("20000.00"),
            status=RentChargeStatus.UNPAID,
        )

        payment = record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=Decimal("12000.00"),
            payment_method=PaymentMethod.UPI,
            status=PaymentStatus.COMPLETED,
        )

        self.client.force_login(self.owner1)
        resp = self.client.get(reverse("rent:payment-detail", kwargs={"pk": payment.id}))
        self.assertEqual(resp.status_code, 200)

        pay_data = resp.json()["data"]
        self.assertIn("allocations", pay_data)
        self.assertEqual(len(pay_data["allocations"]), 1)

        alloc = pay_data["allocations"][0]
        self.assertEqual(alloc["rent_charge"], str(charge.id))
        self.assertEqual(alloc["rent_charge_id"], str(charge.id))
        self.assertEqual(alloc["allocated_amount"], "12000.00")
        self.assertEqual(alloc["charge_type"], "rent")
        self.assertIsNotNone(alloc["allocated_at"])

    # =========================================================================
    # 4. Refund History API Tests
    # =========================================================================

    def test_refunds_list_and_filtering(self):
        """Verify GET /api/v1/refunds/ returns portfolio refunds and supports status filtering."""
        payment = record_payment(
            user=self.owner1,
            tenancy_id=self.tenancy1.id,
            amount=Decimal("20000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.COMPLETED,
        )

        refund_completed = create_refund(
            user=self.owner1,
            payment_id=payment.id,
            amount=Decimal("5000.00"),
            reason="Partial adjustment",
            status=PaymentRefundStatus.COMPLETED,
        )

        self.client.force_login(self.owner1)
        resp = self.client.get(reverse("rent:refund-list"))
        self.assertEqual(resp.status_code, 200)

        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["id"], str(refund_completed.id))
        self.assertEqual(data["results"][0]["amount"], "5000.00")
        self.assertEqual(data["results"][0]["status"], "completed")

        # Filter by payment_id
        resp_filtered = self.client.get(reverse("rent:refund-list"), {"payment_id": str(payment.id)})
        self.assertEqual(resp_filtered.status_code, 200)
        self.assertEqual(resp_filtered.json()["count"], 1)

        # Owner 2 cannot see Owner 1's refunds
        self.client.force_login(self.owner2)
        resp_unauth = self.client.get(reverse("rent:refund-list"))
        self.assertEqual(resp_unauth.status_code, 200)
        self.assertEqual(resp_unauth.json()["count"], 0)

    # =========================================================================
    # 5. Cross-Owner and Dual-Role Isolation Tests
    # =========================================================================

    def test_dual_role_user_owner_vs_tenant_isolation(self):
        """
        Verify that a user who is BOTH an Owner (on their own properties) AND a Tenant
        (on someone else's property) does not experience cross-role or cross-owner leakage.
        """
        # Create a charge on tenancy1 (which belongs to owner1 and tenant1)
        RentCharge.objects.create(
            tenancy=self.tenancy1,
            charge_type=RentChargeType.RENT,
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            due_date=date(2026, 1, 5),
            amount=Decimal("20000.00"),
            status=RentChargeStatus.UNPAID,
            description="January Rent",
        )

        # Make tenant1 an owner as well (similar to Breaker in live system)
        self.tenant1.is_owner = True
        self.tenant1.save()

        # 1. tenant1 calls owner summary in owner workspace: must return 0 billed
        self.client.force_login(self.tenant1)
        summary_resp = self.client.get(reverse("rent:rent-summary"))
        self.assertEqual(summary_resp.status_code, 200)
        self.assertEqual(Decimal(summary_resp.json()["data"]["total_billed"]), Decimal("0.00"))
        self.assertEqual(summary_resp.json()["data"]["total_active_rent_charges"], 0)

        # 2. tenant1 calls rent-charges with role=owner: must return 0 charges
        owner_charges_resp = self.client.get(reverse("rent:rent-charge-list"), {"role": "owner"})
        self.assertEqual(owner_charges_resp.status_code, 200)
        self.assertEqual(owner_charges_resp.json()["count"], 0)

        # 3. tenant1 calls rent-charges with role=tenant: returns charges owed as tenant
        tenant_charges_resp = self.client.get(reverse("rent:rent-charge-list"), {"role": "tenant"})
        self.assertEqual(tenant_charges_resp.status_code, 200)
        self.assertGreater(tenant_charges_resp.json()["count"], 0)

        # 4. owner1 sees their charges in owner summary
        self.client.force_login(self.owner1)
        owner1_summary = self.client.get(reverse("rent:rent-summary"))
        self.assertEqual(owner1_summary.status_code, 200)
        self.assertGreater(Decimal(owner1_summary.json()["data"]["total_billed"]), Decimal("0.00"))
