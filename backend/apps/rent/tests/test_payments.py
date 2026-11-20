from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.leasing.models import Tenancy, TenancyStatus
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType
from apps.rent.models import Payment, PaymentMethod, PaymentStatus, RentCharge, RentChargeStatus, RentChargeType
from apps.rent.services import (
    PaymentPermissionError,
    TenancyNotFoundError,
    list_tenancy_payments,
    list_user_payments,
    record_payment,
)

User = get_user_model()


class PaymentServiceAndAPITests(APITestCase):
    def setUp(self):
        # 1. Owner
        self.owner = User.objects.create_user(
            email="owner_pmt@example.com",
            password="StrongPassword123!",
            first_name="Owner",
            last_name="User",
            is_active=True,
        )
        self.owner.is_owner = True
        self.owner.save(update_fields=["is_owner"])

        # 2. Tenant
        self.tenant = User.objects.create_user(
            email="tenant_pmt@example.com",
            password="StrongPassword123!",
            first_name="Tenant",
            last_name="User",
            is_active=True,
        )
        self.tenant.is_tenant = True
        self.tenant.save(update_fields=["is_tenant"])

        # 3. Unrelated Third Party
        self.unrelated_user = User.objects.create_user(
            email="stranger_pmt@example.com",
            password="StrongPassword123!",
            is_active=True,
        )

        # 4. Property & Tenancy
        self.property = Property.objects.create(
            owner=self.owner,
            title="Payment Test Villa",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            bedrooms=3,
            bathrooms=3,
            address_line_1="Willingdon Island",
            locality="Island South",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pin_code="682003",
            status=PropertyStatus.OCCUPIED,
        )
        self.tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=timezone.localdate(),
            monthly_rent=Decimal("45000.00"),
            security_deposit=Decimal("90000.00"),
            rent_due_day=5,
            status=TenancyStatus.ACTIVE,
        )

        # 5. Pre-existing Rent Charge to verify independence
        self.rent_charge = RentCharge.objects.create(
            tenancy=self.tenancy,
            charge_type=RentChargeType.RENT,
            billing_period_start=timezone.localdate().replace(day=1),
            billing_period_end=timezone.localdate().replace(day=28),
            due_date=timezone.localdate(),
            amount=Decimal("45000.00"),
            status=RentChargeStatus.UNPAID,
            description="Initial Rent",
        )

    def test_successful_manual_payment_recording(self):
        payment = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("45000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            transaction_reference="IMPS987654321",
            status=PaymentStatus.COMPLETED,
            notes="Full month rent transfer received",
        )
        self.assertEqual(payment.amount, Decimal("45000.00"))
        self.assertEqual(payment.currency, "INR")
        self.assertEqual(payment.payment_method, PaymentMethod.BANK_TRANSFER)
        self.assertEqual(payment.status, PaymentStatus.COMPLETED)
        self.assertIsNotNone(payment.paid_at)
        self.assertEqual(payment.transaction_reference, "IMPS987654321")

    def test_zero_and_negative_payment_amounts_rejected(self):
        with self.assertRaises(Exception):
            record_payment(
                user=self.owner,
                tenancy_id=self.tenancy.id,
                amount=Decimal("0.00"),
                payment_method=PaymentMethod.CASH,
            )

        with self.assertRaises(Exception):
            record_payment(
                user=self.owner,
                tenancy_id=self.tenancy.id,
                amount=Decimal("-500.00"),
                payment_method=PaymentMethod.CASH,
            )

    def test_supported_payment_methods_and_statuses(self):
        for method in [PaymentMethod.UPI, PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.CHEQUE]:
            p = record_payment(
                user=self.owner,
                tenancy_id=self.tenancy.id,
                amount=Decimal("1000.00"),
                payment_method=method,
                status=PaymentStatus.PENDING,
            )
            self.assertEqual(p.payment_method, method)
            self.assertEqual(p.status, PaymentStatus.PENDING)

    def test_optional_and_duplicate_transaction_references(self):
        # Cash/None references are allowed multiple times
        p1 = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.CASH,
            transaction_reference=None,
        )
        p2 = record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.CASH,
            transaction_reference="",
        )
        self.assertIsNone(p1.transaction_reference)
        self.assertIsNone(p2.transaction_reference)

        # Unique non-empty reference
        record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("10000.00"),
            payment_method=PaymentMethod.UPI,
            transaction_reference="UPI_TXN_UNIQUE_001",
        )
        # Duplicate raises IntegrityError
        with self.assertRaises(Exception):
            record_payment(
                user=self.owner,
                tenancy_id=self.tenancy.id,
                amount=Decimal("10000.00"),
                payment_method=PaymentMethod.UPI,
                transaction_reference="UPI_TXN_UNIQUE_001",
            )

    def test_payment_recording_with_pending_status_does_not_modify_rent_charge_status(self):
        # Pending payment recording does not allocate or modify charge status
        initial_charge_status = self.rent_charge.status
        initial_charge_amount = self.rent_charge.amount

        record_payment(
            user=self.owner,
            tenancy_id=self.tenancy.id,
            amount=Decimal("45000.00"),
            payment_method=PaymentMethod.BANK_TRANSFER,
            status=PaymentStatus.PENDING,
        )

        self.rent_charge.refresh_from_db()
        self.assertEqual(self.rent_charge.status, initial_charge_status)
        self.assertEqual(self.rent_charge.amount, initial_charge_amount)

    def test_authorization_owner_and_tenant_access_control(self):
        # Owner can view payments
        payments_owner = list_tenancy_payments(user=self.owner, tenancy_id=self.tenancy.id)
        self.assertIsNotNone(payments_owner)

        # Tenant can view payments
        payments_tenant = list_tenancy_payments(user=self.tenant, tenancy_id=self.tenancy.id)
        self.assertIsNotNone(payments_tenant)

        # Unauthorized stranger cannot view or record payments
        with self.assertRaises(PaymentPermissionError):
            list_tenancy_payments(user=self.unrelated_user, tenancy_id=self.tenancy.id)

        with self.assertRaises(PaymentPermissionError):
            record_payment(
                user=self.unrelated_user,
                tenancy_id=self.tenancy.id,
                amount=Decimal("1000.00"),
                payment_method=PaymentMethod.UPI,
            )

    def test_api_payment_recording_and_retrieval(self):
        url = reverse("rent:payment-list")

        # 1. Unauthenticated -> 401
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Authenticated Tenant records payment
        self.client.force_authenticate(user=self.tenant)
        create_payload = {
            "tenancy_id": str(self.tenancy.id),
            "amount": "45000.00",
            "payment_method": "upi",
            "transaction_reference": "UPI_API_998877",
            "status": "completed",
            "notes": "Paid rent via GPay",
        }
        res_create = self.client.post(url, create_payload)
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_create.data["success"])
        payment_id = res_create.data["data"]["id"]
        self.assertEqual(res_create.data["data"]["amount"], "45000.00")

        # 3. Authenticated Owner retrieves payment list
        self.client.force_authenticate(user=self.owner)
        res_list = self.client.get(f"{url}?tenancy_id={self.tenancy.id}")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        results = res_list.data.get("results") or (res_list.data.get("data") if isinstance(res_list.data.get("data"), list) else res_list.data.get("data", {}).get("results", []))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["transaction_reference"], "UPI_API_998877")

        # 4. Unauthorized User blocked from retrieving payment detail -> 403
        self.client.force_authenticate(user=self.unrelated_user)
        detail_url = reverse("rent:payment-detail", kwargs={"pk": payment_id})
        res_detail = self.client.get(detail_url)
        self.assertEqual(res_detail.status_code, status.HTTP_403_FORBIDDEN)

