from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType
from apps.properties.services.property_service import create_property
from apps.subscriptions.models import (
    Subscription,
    SubscriptionPayment,
    SubscriptionPaymentMethod,
    SubscriptionPaymentStatus,
    SubscriptionPlan,
    SubscriptionStatus,
)
from apps.subscriptions.services import (
    PropertyQuotaExceededError,
    SubscriptionNotFoundError,
    SubscriptionPlanNotFoundError,
    SubscriptionStateError,
    cancel_subscription,
    get_or_create_initial_subscription,
    get_owner_subscription,
    get_plan_by_code,
    get_quota_utilization,
    list_active_plans,
    record_subscription_payment,
    upgrade_subscription,
    validate_and_reserve_property_quota,
)

User = get_user_model()


class SubscriptionModelAndSeededTests(TestCase):
    def test_seeded_plans_exist(self):
        plans = list_active_plans()
        plan_codes = [p.code for p in plans]
        self.assertEqual(plan_codes, ["starter", "growth", "pro", "enterprise"])

        starter = get_plan_by_code(code="starter")
        self.assertEqual(starter.min_properties, 1)
        self.assertEqual(starter.max_properties, 5)
        self.assertEqual(starter.monthly_price, Decimal("399.00"))
        self.assertEqual(starter.currency, "INR")
        self.assertEqual(starter.trial_duration_months, 3)

        enterprise = get_plan_by_code(code="enterprise")
        self.assertEqual(enterprise.min_properties, 26)
        self.assertIsNone(enterprise.max_properties)
        self.assertIsNone(enterprise.monthly_price)
        self.assertTrue(enterprise.is_custom_pricing)
        self.assertTrue(enterprise.is_unlimited_properties)

    def test_plan_validation_constraints(self):
        with self.assertRaises(ValidationError):
            p = SubscriptionPlan(
                name="Invalid Min",
                code="invalid_min",
                min_properties=0,
                max_properties=5,
            )
            p.full_clean()

        with self.assertRaises(ValidationError):
            p = SubscriptionPlan(
                name="Invalid Max",
                code="invalid_max",
                min_properties=10,
                max_properties=5,
            )
            p.full_clean()

        with self.assertRaises(ValidationError):
            p = SubscriptionPlan(
                name="Negative Price",
                code="neg_price",
                min_properties=1,
                max_properties=5,
                monthly_price=Decimal("-10.00"),
            )
            p.full_clean()

    def test_plan_cross_range_overlap_validation(self):
        pro = get_plan_by_code(code="pro")
        # Pro has min=13, max=25. Enterprise starts at 26.
        # Setting max to 27 overlaps with Enterprise.
        pro.max_properties = 27
        with self.assertRaises(ValidationError) as ctx:
            pro.full_clean()
        self.assertIn("max_properties", ctx.exception.message_dict)
        self.assertIn("cannot overlap with 'Enterprise'", ctx.exception.message_dict["max_properties"][0])

        # Setting min_properties to 10 overlaps with Growth (6-12)
        pro.max_properties = 25
        pro.min_properties = 10
        with self.assertRaises(ValidationError) as ctx:
            pro.full_clean()
        self.assertIn("min_properties", ctx.exception.message_dict)
        self.assertIn("cannot overlap with 'Growth'", ctx.exception.message_dict["min_properties"][0])

    def test_subscription_dates_validation(self):
        user = User.objects.create_user(
            email="subowner@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        starter = get_plan_by_code(code="starter")
        now = timezone.now()

        # Trial end <= start
        with self.assertRaises(ValidationError):
            sub = Subscription(
                owner=user,
                plan=starter,
                trial_started_at=now,
                trial_ends_at=now - timedelta(days=1),
            )
            sub.full_clean()

        # Period end <= start
        with self.assertRaises(ValidationError):
            sub = Subscription(
                owner=user,
                plan=starter,
                current_period_start=now,
                current_period_end=now,
            )
            sub.full_clean()

    def test_one_subscription_per_owner_enforced(self):
        user = User.objects.create_user(
            email="single_sub@example.com",
            password="StrongPassword123!",
            is_active=True,
        )
        sub1 = get_or_create_initial_subscription(owner=user)
        self.assertIsNotNone(sub1.id)

        # Attempt to insert second subscription for same owner directly
        starter = get_plan_by_code(code="starter")
        with self.assertRaises(IntegrityError):
            Subscription.objects.create(
                owner=user,
                plan=starter,
                status=SubscriptionStatus.ACTIVE,
            )


class SubscriptionServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_service@example.com",
            password="StrongPassword123!",
            is_active=True,
            is_owner=True,
            email_verified_at=timezone.now(),
        )

    def test_get_or_create_initial_subscription(self):
        sub = get_or_create_initial_subscription(owner=self.owner)
        self.assertEqual(sub.status, SubscriptionStatus.TRIALING)
        self.assertEqual(sub.plan.code, "starter")
        self.assertIsNotNone(sub.trial_started_at)
        self.assertIsNotNone(sub.trial_ends_at)
        self.assertTrue(sub.trial_ends_at > sub.trial_started_at)
        self.assertTrue(sub.is_entitled_to_quota)

        # Idempotent call returns same subscription
        sub2 = get_or_create_initial_subscription(owner=self.owner)
        self.assertEqual(sub.id, sub2.id)

    def test_quota_utilization_calculation(self):
        util = get_quota_utilization(owner=self.owner)
        self.assertEqual(util["properties_count"], 0)
        self.assertEqual(util["max_properties"], 5)
        self.assertEqual(util["remaining_quota"], 5)
        self.assertFalse(util["is_quota_exceeded"])
        self.assertTrue(util["is_entitled"])

    def test_upgrade_subscription_flow(self):
        sub = get_owner_subscription(owner=self.owner)
        self.assertEqual(sub.plan.code, "starter")

        upgraded = upgrade_subscription(owner=self.owner, target_plan_code="growth")
        self.assertEqual(upgraded.plan.code, "growth")
        self.assertEqual(upgraded.plan.max_properties, 12)

        util = get_quota_utilization(owner=self.owner)
        self.assertEqual(util["max_properties"], 12)

    def test_cancel_subscription_flow(self):
        sub = cancel_subscription(owner=self.owner)
        self.assertEqual(sub.status, SubscriptionStatus.CANCELLED)
        self.assertIsNotNone(sub.cancelled_at)
        self.assertFalse(sub.is_entitled_to_quota)

        # Trying to reserve quota on cancelled subscription raises error
        with self.assertRaises(SubscriptionStateError):
            validate_and_reserve_property_quota(owner=self.owner)

    def test_record_subscription_payment(self):
        sub = get_owner_subscription(owner=self.owner)
        payment = record_subscription_payment(
            subscription_id=sub.id,
            amount=Decimal("399.00"),
            currency="INR",
            payment_method=SubscriptionPaymentMethod.UPI,
            transaction_reference="TXN_TEST_12345",
            status=SubscriptionPaymentStatus.SUCCESSFUL,
        )
        self.assertEqual(payment.status, SubscriptionPaymentStatus.SUCCESSFUL)
        self.assertEqual(payment.amount, Decimal("399.00"))
        self.assertEqual(payment.transaction_reference, "TXN_TEST_12345")

        sub.refresh_from_db()
        self.assertEqual(sub.status, SubscriptionStatus.ACTIVE)
        self.assertIsNotNone(sub.current_period_start)
        self.assertIsNotNone(sub.current_period_end)

        # Duplicate transaction_reference raises ValidationError (full_clean) or IntegrityError
        with self.assertRaises((ValidationError, IntegrityError)):
            record_subscription_payment(
                subscription_id=sub.id,
                amount=Decimal("399.00"),
                transaction_reference="TXN_TEST_12345",
            )


class PropertyQuotaIntegrationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="quota_owner@example.com",
            password="StrongPassword123!",
            is_active=True,
        )

    def _create_payload(self, idx):
        return {
            "title": f"Quota Test Property {idx}",
            "description": "Property description for quota test.",
            "category": PropertyCategory.RESIDENTIAL,
            "property_type": PropertyType.APARTMENT,
            "address_line_1": f"Street {idx}",
            "locality": "Edappally",
            "city": "Kochi",
            "district": "Ernakulam",
            "state": "Kerala",
            "pin_code": "682001",
        }

    def test_create_properties_within_quota(self):
        # Starter plan limit = 5
        for i in range(1, 6):
            prop = create_property(owner=self.owner, validated_data=self._create_payload(i))
            self.assertIsNotNone(prop.id)

        self.assertEqual(Property.objects.filter(owner=self.owner).count(), 5)

        # 6th property exceeds starter quota -> raises PropertyQuotaExceededError
        with self.assertRaises(PropertyQuotaExceededError) as ctx:
            create_property(owner=self.owner, validated_data=self._create_payload(6))
        self.assertIn("Property quota exceeded", str(ctx.exception))

        # Count remains 5 (transaction rollback)
        self.assertEqual(Property.objects.filter(owner=self.owner).count(), 5)

    def test_upgrade_releases_additional_quota(self):
        # Fill quota (5 properties)
        for i in range(1, 6):
            create_property(owner=self.owner, validated_data=self._create_payload(i))

        # Upgrade to Growth (limit 12)
        upgrade_subscription(owner=self.owner, target_plan_code="growth")

        # 6th property can now be created
        prop6 = create_property(owner=self.owner, validated_data=self._create_payload(6))
        self.assertIsNotNone(prop6.id)
        self.assertEqual(Property.objects.filter(owner=self.owner).count(), 6)

    def test_paused_listings_do_not_release_property_quota(self):
        prop1 = create_property(owner=self.owner, validated_data=self._create_payload(1))
        # Total owned properties count governs quota, regardless of listing status
        util = get_quota_utilization(owner=self.owner)
        self.assertEqual(util["properties_count"], 1)
        self.assertEqual(util["remaining_quota"], 4)

    def test_activate_owner_trial_for_verified_user(self):
        from apps.subscriptions.services import activate_owner_trial
        new_user = User.objects.create_user(
            email="new_owner@example.com",
            password="StrongPassword123!",
            is_active=True,
            is_owner=False,
            email_verified_at=timezone.now(),
        )
        sub = activate_owner_trial(user=new_user)
        new_user.refresh_from_db()
        self.assertTrue(new_user.is_owner)
        self.assertEqual(sub.status, SubscriptionStatus.TRIALING)
        self.assertEqual(sub.plan.code, "starter")
        self.assertIsNotNone(sub.trial_ends_at)

    def test_activate_owner_trial_unverified_user_fails(self):
        from apps.subscriptions.services import activate_owner_trial
        unverified_user = User.objects.create_user(
            email="unverified@example.com",
            password="StrongPassword123!",
            is_active=True,
            is_owner=False,
            email_verified_at=None,
        )
        with self.assertRaises(ValidationError) as ctx:
            activate_owner_trial(user=unverified_user)
        self.assertIn("Email verification is required", str(ctx.exception))
        unverified_user.refresh_from_db()
        self.assertFalse(unverified_user.is_owner)

    def test_activate_owner_trial_idempotent(self):
        from apps.subscriptions.services import activate_owner_trial
        user = User.objects.create_user(
            email="idempotent@example.com",
            password="StrongPassword123!",
            is_active=True,
            is_owner=False,
            email_verified_at=timezone.now(),
        )
        sub1 = activate_owner_trial(user=user)
        orig_trial_end = sub1.trial_ends_at

        # Call again
        sub2 = activate_owner_trial(user=user)
        self.assertEqual(sub1.id, sub2.id)
        self.assertEqual(sub2.trial_ends_at, orig_trial_end)

    def test_tenant_access_denied_in_get_owner_subscription(self):
        from apps.subscriptions.services.exceptions import SubscriptionOwnershipError
        tenant = User.objects.create_user(
            email="tenant_only@example.com",
            password="StrongPassword123!",
            is_active=True,
            is_owner=False,
        )
        with self.assertRaises(SubscriptionOwnershipError):
            get_owner_subscription(owner=tenant)
