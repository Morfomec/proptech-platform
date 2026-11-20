from decimal import Decimal
from datetime import date

from django.contrib.auth.models import Permission
from django.test import Client, TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.leasing.models import Application, ApplicationStatus, Tenancy, TenancyStatus
from apps.listings.models import Listing, ListingStatus, ReviewStatus
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType
from apps.rent.models import (
    PaymentAllocation,
    PaymentAllocationReversal,
    PaymentRefund,
    PaymentRefundStatus,
    RentCharge,
    RentChargeStatus,
)
from apps.rent.services.allocation_service import allocate_payment_fifo
from apps.rent.services.payment_service import record_payment
from apps.rent.services.refund_service import create_refund
from config.admin_dashboard import get_financial_metrics, get_needs_attention, get_recent_activity


class AdminDashboardMinimalistRedesignTests(TestCase):
    """
    Tests for the redesigned minimalist Django Unfold admin dashboard:
    - 4 Core KPI cards: Total Properties, Active Tenancies, Pending Listing Reviews, Outstanding Rent.
    - Needs Attention section (zero-value items omitted, direct links).
    - Compact unified Recent Activity (max 5 items, permission-aware).
    - Removed: 6-month chart, large KPI rows, individual activity tables, System Live badge.
    - Financial calculation ledger integrity preserved.
    - Strict permission filtering across staff profiles.
    """

    def setUp(self):
        self.client = Client()

        # 1. Users
        self.owner = User.objects.create_user(
            email="owner_dash@example.com",
            password="Password123!",
            is_owner=True,
            is_active=True,
        )
        self.tenant = User.objects.create_user(
            email="tenant_dash@example.com",
            password="Password123!",
            is_tenant=True,
            is_active=True,
        )
        self.superuser = User.objects.create_superuser(
            email="super_dash@example.com",
            password="AdminPass123!",
        )

        # 2. Property
        self.property = Property.objects.create(
            owner=self.owner,
            title="Dashboard Luxury Suite",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="Marine Drive",
            locality="Kochi",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682001",
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )

        # 3. Listing
        self.listing = Listing.objects.create(
            property=self.property,
            title="Suite Listing",
            monthly_rent=Decimal("15000.00"),
            status=ListingStatus.PUBLISHED,
            review_status=ReviewStatus.APPROVED,
        )

        # 4. Application & Tenancy
        self.application = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
            status=ApplicationStatus.APPROVED,
        )
        self.tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            application=self.application,
            start_date=date(2026, 1, 1),
            monthly_rent=Decimal("15000.00"),
            security_deposit=Decimal("30000.00"),
            status=TenancyStatus.ACTIVE,
        )

    def test_financial_metrics_calculation_and_reversals(self):
        """Verify outstanding rent and net collections account for reversals and non-liabilities."""
        # 1. Create rent charge
        charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            amount=Decimal("15000.00"),
            due_date=date(2026, 1, 5),
            billing_period_start=date(2026, 1, 1),
            billing_period_end=date(2026, 1, 31),
            status=RentChargeStatus.UNPAID,
        )

        # Before payment: outstanding is ₹15,000, collections ₹0
        metrics_before = get_financial_metrics(self.superuser)
        self.assertEqual(metrics_before["total_completed_payments"], Decimal("0.00"))
        self.assertEqual(metrics_before["net_collections"], Decimal("0.00"))
        self.assertEqual(metrics_before["total_charges_amt"], Decimal("15000.00"))
        self.assertEqual(metrics_before["effective_allocated"], Decimal("0.00"))
        self.assertEqual(metrics_before["outstanding_rent"], Decimal("15000.00"))

        # Record payment of ₹15,000 and allocate FIFO
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("15000.00"),
            payment_method="bank_transfer",
            transaction_reference="TX_DASH_001",
        )
        allocate_payment_fifo(payment_id=payment.id)
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PAID)

        # After full allocation: outstanding is ₹0, net collections ₹15,000
        metrics_after_pay = get_financial_metrics(self.superuser)
        self.assertEqual(metrics_after_pay["total_completed_payments"], Decimal("15000.00"))
        self.assertEqual(metrics_after_pay["net_collections"], Decimal("15000.00"))
        self.assertEqual(metrics_after_pay["effective_allocated"], Decimal("15000.00"))
        self.assertEqual(metrics_after_pay["outstanding_rent"], Decimal("0.00"))

        # Create and process a partial refund of ₹5,000
        create_refund(
            user=self.owner,
            payment_id=payment.id,
            amount=Decimal("5000.00"),
            reason="Partial refund test",
            refund_reference="REF_DASH_001",
            status=PaymentRefundStatus.COMPLETED,
        )
        charge.refresh_from_db()
        self.assertEqual(charge.status, RentChargeStatus.PARTIALLY_PAID)

        # Verify calculations:
        # - Net collections: 15,000 - 5,000 = 10,000
        # - Effective allocated: 15,000 - 5,000 = 10,000
        # - Outstanding rent: 15,000 - 10,000 = 5,000
        metrics_after_refund = get_financial_metrics(self.superuser)
        self.assertEqual(metrics_after_refund["total_completed_payments"], Decimal("15000.00"))
        self.assertEqual(metrics_after_refund["completed_refunds_amt"], Decimal("5000.00"))
        self.assertEqual(metrics_after_refund["net_collections"], Decimal("10000.00"))
        self.assertEqual(metrics_after_refund["total_charges_amt"], Decimal("15000.00"))
        self.assertEqual(metrics_after_refund["effective_allocated"], Decimal("10000.00"))
        self.assertEqual(metrics_after_refund["outstanding_rent"], Decimal("5000.00"))

    def test_net_collections_not_clamped_to_zero(self):
        """Edge case: If refunds exceed completed payments, net_collections must be negative."""
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("5000.00"),
            payment_method="bank_transfer",
            transaction_reference="TX_DASH_NET_01",
        )
        PaymentRefund.objects.create(
            payment=payment,
            amount=Decimal("7000.00"),
            reason="Edge case test",
            status=PaymentRefundStatus.COMPLETED,
            created_by=self.superuser,
        )

        metrics = get_financial_metrics(self.superuser)
        # 5,000 - 7,000 = -2,000 (must NOT be clamped to zero)
        self.assertEqual(metrics["net_collections"], Decimal("-2000.00"))

    def test_minimalist_dashboard_structure_superuser(self):
        """Verify minimal structure: Header, exactly 4 KPI cards, no charts or large tables."""
        self.client.force_login(self.superuser)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        # 1. Minimal Header
        self.assertIn("Overview", content)
        self.assertIn("A simple overview of platform activity.", content)
        self.assertNotIn("System Live", content)
        self.assertNotIn("Operations Dashboard", content)

        # 2. Four Primary KPI Cards
        self.assertIn("Total Properties", content)
        self.assertIn("Active Tenancies", content)
        self.assertIn("Pending Listing Reviews", content)
        self.assertIn("Outstanding Rent", content)

        # 3. Removed Sections (Not on dashboard)
        self.assertNotIn("Financial Overview & Ledger Integrity", content)
        self.assertNotIn("Financial Overview &amp; Ledger Integrity", content)
        self.assertNotIn("Listing Moderation & Inventory", content)
        self.assertNotIn("Listing Moderation &amp; Inventory", content)
        self.assertNotIn("Leasing Pipeline & Applications", content)
        self.assertNotIn("Leasing Pipeline &amp; Applications", content)
        self.assertNotIn("Owner Subscription Plans & SaaS Billing", content)
        self.assertNotIn("Owner Subscription Plans &amp; SaaS Billing", content)
        self.assertNotIn("6-Month Collections &", content)
        self.assertNotIn("6-Month Collections &amp;", content)
        self.assertNotIn("Recent Platform Activity", content)

    def test_staff_only_property_permissions(self):
        """Staff with property perms sees only Total Properties card, no other cards."""
        staff = User.objects.create_user(
            email="staff_props_only@example.com",
            password="StaffPass123!",
            is_staff=True,
            is_active=True,
        )
        staff.user_permissions.add(
            Permission.objects.get(codename="view_property", content_type__app_label="properties")
        )
        staff = User.objects.get(pk=staff.pk)

        self.client.force_login(staff)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        self.assertIn("Total Properties", content)
        self.assertNotIn("Active Tenancies", content)
        self.assertNotIn("Pending Listing Reviews", content)
        self.assertNotIn("Outstanding Rent", content)

    def test_staff_only_leasing_permissions(self):
        """Staff with tenancy perms sees only Active Tenancies card."""
        staff = User.objects.create_user(
            email="staff_leasing_only@example.com",
            password="StaffPass123!",
            is_staff=True,
            is_active=True,
        )
        staff.user_permissions.add(
            Permission.objects.get(codename="view_tenancy", content_type__app_label="leasing")
        )
        staff = User.objects.get(pk=staff.pk)

        self.client.force_login(staff)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        self.assertIn("Active Tenancies", content)
        self.assertNotIn("Total Properties", content)
        self.assertNotIn("Pending Listing Reviews", content)
        self.assertNotIn("Outstanding Rent", content)

    def test_staff_only_listing_permissions(self):
        """Staff with listing perms sees only Pending Listing Reviews card."""
        staff = User.objects.create_user(
            email="staff_listings_only@example.com",
            password="StaffPass123!",
            is_staff=True,
            is_active=True,
        )
        staff.user_permissions.add(
            Permission.objects.get(codename="view_listing", content_type__app_label="listings")
        )
        staff = User.objects.get(pk=staff.pk)

        self.client.force_login(staff)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        self.assertIn("Pending Listing Reviews", content)
        self.assertNotIn("Total Properties", content)
        self.assertNotIn("Active Tenancies", content)
        self.assertNotIn("Outstanding Rent", content)

    def test_staff_only_finance_permissions(self):
        """Staff with finance perms sees Outstanding Rent and relevant recent payments."""
        record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("15000.00"),
            payment_method="bank_transfer",
            transaction_reference="TX_DASH_FIN_01",
        )
        staff = User.objects.create_user(
            email="staff_finance_only@example.com",
            password="StaffPass123!",
            is_staff=True,
            is_active=True,
        )
        staff.user_permissions.add(
            Permission.objects.get(codename="view_payment", content_type__app_label="rent")
        )
        staff = User.objects.get(pk=staff.pk)

        self.client.force_login(staff)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        self.assertIn("Outstanding Rent", content)
        self.assertIn("Rent Payment Received", content)
        self.assertNotIn("Total Properties", content)
        self.assertNotIn("Active Tenancies", content)
        self.assertNotIn("Pending Listing Reviews", content)

    def test_staff_no_relevant_permissions(self):
        """Staff with no operational permissions sees clean empty state."""
        staff = User.objects.create_user(
            email="staff_no_perms@example.com",
            password="StaffPass123!",
            is_staff=True,
            is_active=True,
        )

        self.client.force_login(staff)
        res = self.client.get("/admin/")
        self.assertEqual(res.status_code, 200)
        content = res.content.decode("utf-8")

        self.assertIn("No Operational Modules Assigned", content)
        self.assertNotIn("Total Properties", content)
        self.assertNotIn("Active Tenancies", content)
        self.assertNotIn("Pending Listing Reviews", content)
        self.assertNotIn("Outstanding Rent", content)

    def test_needs_attention_zero_values_omitted(self):
        """Needs Attention section omits zero-value items and renders only actionable tasks."""
        # 1. When all counts are 0, Needs Attention section is not rendered
        self.client.force_login(self.superuser)
        res_before = self.client.get("/admin/")
        content_before = res_before.content.decode("utf-8")
        self.assertNotIn("Needs Attention", content_before)

        # 2. When an item requires attention (e.g. pending listing review)
        self.listing.review_status = ReviewStatus.PENDING
        self.listing.save(update_fields=["review_status"])

        # Create a pending refund
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method="bank_transfer",
            transaction_reference="TX_DASH_ATTN_01",
        )
        PaymentRefund.objects.create(
            payment=payment,
            amount=Decimal("2000.00"),
            reason="Customer request",
            status=PaymentRefundStatus.PENDING,
            created_by=self.superuser,
        )

        res_after = self.client.get("/admin/")
        content_after = res_after.content.decode("utf-8")
        self.assertIn("Needs Attention", content_after)
        self.assertIn("Listings pending review", content_after)
        self.assertIn("Refund requests pending", content_after)
