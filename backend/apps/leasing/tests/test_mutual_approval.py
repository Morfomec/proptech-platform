from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models.deletion import ProtectedError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.leasing.admin import TenancyAdmin
from apps.leasing.models import (
    Application,
    ApplicationStatus,
    Tenancy,
    TenancyStatus,
    TenancyTermsHistory,
    TermsProposalStatus,
)
from apps.leasing.services import (
    accept_tenancy_proposal,
    activate_tenancy,
    create_tenancy,
    reject_tenancy_proposal,
    update_tenancy_proposal,
)
from apps.leasing.services.exceptions import (
    TenancyApplicationError,
    TenancyOwnershipError,
    TenancyStateError,
)
from apps.listings.models import Listing, ListingStatus
from apps.notifications.models import (
    Notification,
    NotificationType,
    RelatedObjectType,
)
from apps.properties.models import Property, PropertyCategory, PropertyStatus, PropertyType
from apps.rent.models import RentCharge

User = get_user_model()


class MutualTenancyApprovalTests(APITestCase):
    """
    Comprehensive tests for mutual tenant approval workflow before tenancy activation.
    Covers:
    - Owner creates proposal in PENDING state.
    - Tenant reviews and accepts proposal -> CONFIRMED.
    - Tenant rejects proposal with reason -> REJECTED.
    - Unauthorized users (including owner) cannot accept or reject on behalf of tenant.
    - Owner attempting to activate PENDING or REJECTED tenancy is strictly blocked.
    - Modifying proposed terms resets approval to PENDING.
    - Duplicate tenancy creation from same application is prevented.
    - No rent charges generated before tenant acceptance and activation.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@test.com",
            password="TestPassword123!",
            is_active=True,
            is_owner=True,
            is_tenant=True,
            first_name="Alice",
            last_name="Owner",
        )
        self.tenant = User.objects.create_user(
            email="tenant@test.com",
            password="TestPassword123!",
            is_active=True,
            is_owner=False,
            is_tenant=True,
            first_name="Bob",
            last_name="Tenant",
        )
        self.other_tenant = User.objects.create_user(
            email="other_tenant@test.com",
            password="TestPassword123!",
            is_active=True,
            is_owner=False,
            is_tenant=True,
            first_name="Charlie",
            last_name="Other",
        )

        self.property = Property.objects.create(
            owner=self.owner,
            title="Sunrise Apartments 4B",
            property_type=PropertyType.APARTMENT,
            category=PropertyCategory.RESIDENTIAL,
            bedrooms=2,
            bathrooms=2,
            address_line_1="Marine Drive",
            locality="Kozhikode Beach",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673001",
            status=PropertyStatus.AVAILABLE,
        )

        self.listing = Listing.objects.create(
            property=self.property,
            title="Modern 2BHK Apartment",
            monthly_rent=Decimal("25000.00"),
            security_deposit=Decimal("75000.00"),
            status=ListingStatus.PUBLISHED,
        )

        self.application = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
            status=ApplicationStatus.APPROVED,
            message="Looking forward to moving in.",
        )

    def test_owner_create_tenancy_creates_pending_proposal(self):
        """Owner creates tenancy proposal; it starts in PENDING status awaiting tenant approval."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("25000.00"),
            security_deposit=Decimal("75000.00"),
            rent_due_day=5,
            notes="Standard 11-month lease agreement.",
        )

        self.assertEqual(tenancy.status, TenancyStatus.PENDING)
        self.assertIsNotNone(tenancy.proposed_at)
        self.assertEqual(tenancy.proposed_by, self.owner)
        self.assertIsNone(tenancy.tenant_responded_at)
        self.assertIsNone(tenancy.rejection_reason)

        # Tenant receives TENANCY_PROPOSED notification
        notif = Notification.objects.get(
            user=self.tenant,
            notification_type=NotificationType.TENANCY_PROPOSED,
        )
        self.assertEqual(notif.related_object_type, RelatedObjectType.TENANCY)
        self.assertEqual(notif.related_object_id, tenancy.id)

    def test_tenant_successfully_accepts_proposal_via_api(self):
        """Tenant accepts proposed terms -> tenancy transitions to CONFIRMED."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("25000.00"),
            security_deposit=Decimal("75000.00"),
        )
        Notification.objects.all().delete()

        self.client.force_authenticate(user=self.tenant)
        res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["data"]["status"], TenancyStatus.CONFIRMED)

        tenancy.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.CONFIRMED)
        self.assertIsNotNone(tenancy.tenant_responded_at)

        # Published listing is paused once confirmed
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, ListingStatus.PAUSED)

        # Owner receives notification of acceptance
        owner_notif = Notification.objects.get(
            user=self.owner,
            notification_type=NotificationType.TENANCY_CONFIRMED,
        )
        self.assertEqual(owner_notif.related_object_id, tenancy.id)

    def test_tenant_rejects_proposal_with_reason(self):
        """Tenant rejects proposed terms with reason -> tenancy transitions to REJECTED."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("30000.00"),
            security_deposit=Decimal("100000.00"),
        )
        Notification.objects.all().delete()

        self.client.force_authenticate(user=self.tenant)
        res = self.client.post(
            reverse("leasing:tenancy-reject", kwargs={"pk": tenancy.id}),
            {"reason": "Security deposit is higher than what was discussed."},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["status"], TenancyStatus.REJECTED)

        tenancy.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.REJECTED)
        self.assertEqual(
            tenancy.rejection_reason,
            "Security deposit is higher than what was discussed.",
        )
        self.assertIsNotNone(tenancy.tenant_responded_at)

        # Owner receives rejection notification with reason
        owner_notif = Notification.objects.get(
            user=self.owner,
            notification_type=NotificationType.TENANCY_REJECTED,
        )
        self.assertIn("Security deposit is higher", owner_notif.message)

    def test_unauthorized_users_cannot_accept_or_reject(self):
        """Owner and third-party tenants cannot accept or reject on behalf of the tenant."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )

        # 1. Owner tries to accept -> 404/403 (owner is not the tenant)
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # 2. Owner tries to reject -> 404/403
        res = self.client.post(
            reverse("leasing:tenancy-reject", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # 3. Different tenant tries to accept -> 404 (scoped queryset)
        self.client.force_authenticate(user=self.other_tenant)
        res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # 4. Service layer directly enforces tenant check
        with self.assertRaises(TenancyOwnershipError):
            accept_tenancy_proposal(tenant=self.owner, tenancy_id=tenancy.id)

        with self.assertRaises(TenancyOwnershipError):
            reject_tenancy_proposal(tenant=self.other_tenant, tenancy_id=tenancy.id)

    def test_owner_cannot_activate_tenancy_without_tenant_approval(self):
        """Owner attempting to activate a PENDING or REJECTED proposal is rejected."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )

        # 1. While PENDING, activation via service fails
        with self.assertRaises(TenancyStateError) as ctx:
            activate_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        self.assertIn("tenant has not yet accepted", str(ctx.exception))

        # 2. While PENDING, activation via API fails (400)
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            reverse("leasing:tenancy-activate", kwargs={"pk": tenancy.id}),
            {"move_in_date": "2026-09-01"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tenant has not yet accepted", str(res.data))

        # 3. Reject proposal
        reject_tenancy_proposal(
            tenant=self.tenant,
            tenancy_id=tenancy.id,
            reason="Offer declined",
        )
        tenancy.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.REJECTED)

        # 4. Rejected proposal cannot be activated
        with self.assertRaises(TenancyStateError) as ctx:
            activate_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        self.assertIn("Rejected", str(ctx.exception))

        res = self.client.post(
            reverse("leasing:tenancy-activate", kwargs={"pk": tenancy.id}),
            {"move_in_date": "2026-09-01"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_updating_proposed_terms_resets_approval_to_pending(self):
        """Modifying proposed terms resets tenancy to PENDING, requiring renewed tenant approval."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
            security_deposit=Decimal("75000.00"),
        )

        # Tenant accepts first version
        accept_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id)
        tenancy.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.CONFIRMED)

        # Owner updates rent terms via API
        self.client.force_authenticate(user=self.owner)
        res = self.client.patch(
            reverse("leasing:tenancy-update-terms", kwargs={"pk": tenancy.id}),
            {
                "monthly_rent": "24000.00",
                "security_deposit": "70000.00",
                "notes": "Discounted rent agreed upon mutual discussion.",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["status"], TenancyStatus.PENDING)
        self.assertEqual(res.data["data"]["monthly_rent"], "24000.00")

        tenancy.refresh_from_db()
        # Status has reset to PENDING!
        self.assertEqual(tenancy.status, TenancyStatus.PENDING)
        self.assertEqual(tenancy.monthly_rent, Decimal("24000.00"))
        self.assertIsNone(tenancy.tenant_responded_at)

        # Owner cannot activate now because renewed approval is pending
        with self.assertRaises(TenancyStateError):
            activate_tenancy(owner=self.owner, tenancy_id=tenancy.id)

        # Tenant accepts updated terms
        self.client.force_authenticate(user=self.tenant)
        accept_res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_res.data["data"]["status"], TenancyStatus.CONFIRMED)

        # Now activation succeeds
        activated = activate_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        self.assertEqual(activated.status, TenancyStatus.ACTIVE)

    def test_prevent_duplicate_tenancy_from_same_application(self):
        """An application cannot be linked to more than one tenancy."""
        create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )

        with self.assertRaises(TenancyApplicationError):
            create_tenancy(
                owner=self.owner,
                property_id=self.property.id,
                tenant=self.tenant,
                application_id=self.application.id,
                start_date=date(2026, 10, 1),
                monthly_rent=Decimal("25000.00"),
            )

    def test_no_rent_charges_generated_before_tenant_acceptance_and_activation(self):
        """Pending and rejected proposals must not generate rent charges."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )

        # 0 rent charges while PENDING
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 0)

        # Reject proposal
        reject_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id)
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 0)

        # Update terms and accept
        update_tenancy_proposal(
            owner=self.owner,
            tenancy_id=tenancy.id,
            monthly_rent=Decimal("24000.00"),
        )
        accept_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id)

        # Still 0 rent charges while CONFIRMED (before move-in)
        self.assertEqual(RentCharge.objects.filter(tenancy=tenancy).count(), 0)

        # Only after activation do initial charges generate
        activate_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        self.assertGreater(RentCharge.objects.filter(tenancy=tenancy).count(), 0)

    def test_owner_cannot_create_proposal_using_another_owners_application_or_property(self):
        """Owners cannot create tenancy proposals using applications or properties they do not own."""
        other_owner = User.objects.create_user(
            email="other_owner@test.com",
            password="TestPassword123!",
            is_active=True,
            is_owner=True,
            is_tenant=True,
        )
        other_prop = Property.objects.create(
            owner=other_owner,
            title="Other Owner Villa",
            property_type=PropertyType.VILLA,
            category=PropertyCategory.RESIDENTIAL,
            bedrooms=3,
            bathrooms=3,
            address_line_1="Wayanad Road",
            locality="East Hill",
            city="Kozhikode",
            district="Kozhikode",
            state="Kerala",
            pin_code="673005",
            status=PropertyStatus.AVAILABLE,
        )
        other_listing = Listing.objects.create(
            property=other_prop,
            title="Spacious Villa",
            monthly_rent=Decimal("45000.00"),
            security_deposit=Decimal("150000.00"),
            status=ListingStatus.PUBLISHED,
        )
        other_app = Application.objects.create(
            listing=other_listing,
            applicant=self.tenant,
            status=ApplicationStatus.APPROVED,
        )

        # 1. Owner A tries to use Application B (belonging to Owner B's listing) for Owner A's property
        with self.assertRaises(TenancyApplicationError) as ctx:
            create_tenancy(
                owner=self.owner,
                property_id=self.property.id,
                tenant=self.tenant,
                application_id=other_app.id,
                start_date=date(2026, 9, 1),
                monthly_rent=Decimal("25000.00"),
            )
        self.assertIn("Application property must match", str(ctx.exception))

        # 2. Owner A tries to create a proposal directly on Owner B's property -> ownership error
        with self.assertRaises(TenancyOwnershipError):
            create_tenancy(
                owner=self.owner,
                property_id=other_prop.id,
                tenant=self.tenant,
                application_id=other_app.id,
                start_date=date(2026, 9, 1),
                monthly_rent=Decimal("45000.00"),
            )

        # 3. Via API: Owner A attempts POST /api/v1/tenancies/ targeting Owner B's property -> 403 Forbidden
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            reverse("leasing:tenancy-list"),
            {
                "property_id": str(other_prop.id),
                "tenant_id": str(self.tenant.id),
                "application_id": str(other_app.id),
                "start_date": "2026-09-01",
                "monthly_rent": "45000.00",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Via API: Owner A attempts POST /api/v1/tenancies/ with Owner A's property and Owner B's application -> 400 Bad Request
        res_mismatch = self.client.post(
            reverse("leasing:tenancy-list"),
            {
                "property_id": str(self.property.id),
                "tenant_id": str(self.tenant.id),
                "application_id": str(other_app.id),
                "start_date": "2026-09-01",
                "monthly_rent": "25000.00",
            },
            format="json",
        )
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Application property must match", str(res_mismatch.data))

    def test_tenant_cannot_approve_or_reject_another_tenants_proposal(self):
        """Tenant B cannot view, accept, or reject a proposal directed to Tenant A."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )

        self.client.force_authenticate(user=self.other_tenant)

        # Direct API calls return 404 (scoped queryset)
        accept_res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(accept_res.status_code, status.HTTP_404_NOT_FOUND)

        reject_res = self.client.post(
            reverse("leasing:tenancy-reject", kwargs={"pk": tenancy.id}),
            {"reason": "Hijack attempt"},
            format="json",
        )
        self.assertEqual(reject_res.status_code, status.HTTP_404_NOT_FOUND)

        # Service layer directly throws TenancyOwnershipError
        with self.assertRaises(TenancyOwnershipError):
            accept_tenancy_proposal(tenant=self.other_tenant, tenancy_id=tenancy.id)

        with self.assertRaises(TenancyOwnershipError):
            reject_tenancy_proposal(tenant=self.other_tenant, tenancy_id=tenancy.id)

    def test_owner_cannot_modify_another_owners_proposal(self):
        """Owner B cannot modify the proposed terms of a tenancy owned by Owner A."""
        other_owner = User.objects.create_user(
            email="intruder_owner@test.com",
            password="TestPassword123!",
            is_active=True,
            is_owner=True,
            is_tenant=True,
        )
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )

        # API call from intruder owner returns 404 (scoped queryset)
        self.client.force_authenticate(user=other_owner)
        res = self.client.patch(
            reverse("leasing:tenancy-update-terms", kwargs={"pk": tenancy.id}),
            {"monthly_rent": "10000.00"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Service call throws TenancyOwnershipError
        with self.assertRaises(TenancyOwnershipError):
            update_tenancy_proposal(
                owner=other_owner,
                tenancy_id=tenancy.id,
                monthly_rent=Decimal("10000.00"),
            )

    def test_unauthorized_approval_through_direct_api_calls_blocked(self):
        """Direct unauthenticated or non-tenant API requests cannot bypass approval permissions."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )

        # 1. Unauthenticated request -> 401 Unauthorized
        self.client.logout()
        res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Authenticated non-tenant (owner without tenant capability) -> 403 Forbidden
        owner_only = User.objects.create_user(
            email="owner_only_strict@test.com",
            password="TestPassword123!",
            is_active=True,
            is_owner=True,
            is_tenant=False,
        )
        self.client.force_authenticate(user=owner_only)
        res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_repeated_and_conflicting_tenant_decisions_prevented(self):
        """Tenancy state machine strictly forbids repeated or conflicting tenant decisions."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("25000.00"),
        )

        # 1. Accept once -> CONFIRMED
        self.client.force_authenticate(user=self.tenant)
        accept_res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)

        # 2. Repeated acceptance fails with 400
        repeat_res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(repeat_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been accepted", str(repeat_res.data))

        # 3. Rejecting an already accepted proposal fails with 400
        reject_after_accept_res = self.client.post(
            reverse("leasing:tenancy-reject", kwargs={"pk": tenancy.id}),
            {"reason": "Changed my mind"},
            format="json",
        )
        self.assertEqual(reject_after_accept_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Create another proposal to test repeated reject and accept-after-reject
        tenancy2 = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.other_tenant,
            start_date=date(2027, 10, 1),
            monthly_rent=Decimal("30000.00"),
        )
        self.client.force_authenticate(user=self.other_tenant)

        # Reject proposal
        reject_res = self.client.post(
            reverse("leasing:tenancy-reject", kwargs={"pk": tenancy2.id}),
            {"reason": "Too expensive"},
            format="json",
        )
        self.assertEqual(reject_res.status_code, status.HTTP_200_OK)

        # Repeated reject fails with 400
        repeat_reject_res = self.client.post(
            reverse("leasing:tenancy-reject", kwargs={"pk": tenancy2.id}),
            {"reason": "Still too expensive"},
            format="json",
        )
        self.assertEqual(repeat_reject_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Accepting a rejected proposal without owner revision fails with 400
        accept_after_reject_res = self.client.post(
            reverse("leasing:tenancy-accept", kwargs={"pk": tenancy2.id}),
            {},
            format="json",
        )
        self.assertEqual(accept_after_reject_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot accept a rejected proposal", str(accept_after_reject_res.data))

    def test_notification_consistency_after_failed_operations(self):
        """Failed state change operations roll back completely and never create orphaned notifications."""
        # 1. Proposal creation rollback when notification fails
        with patch(
            "apps.leasing.services.tenancy_service.create_notification",
            side_effect=RuntimeError("Notification service offline"),
        ):
            with self.assertRaises(RuntimeError):
                create_tenancy(
                    owner=self.owner,
                    property_id=self.property.id,
                    tenant=self.tenant,
                    start_date=date(2026, 9, 1),
                    monthly_rent=Decimal("25000.00"),
                )

        # No tenancy was created
        self.assertEqual(Tenancy.objects.count(), 0)
        # No orphaned notifications
        self.assertEqual(Notification.objects.count(), 0)

        # 2. Create tenancy successfully
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )
        Notification.objects.all().delete()

        # 3. Proposal acceptance rollback when notification fails
        with patch(
            "apps.leasing.services.tenancy_service.create_notification",
            side_effect=RuntimeError("Notification write failed"),
        ):
            with self.assertRaises(RuntimeError):
                accept_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id)

        # Tenancy remains in PENDING status, not CONFIRMED
        tenancy.refresh_from_db()
        self.assertEqual(tenancy.status, TenancyStatus.PENDING)
        self.assertIsNone(tenancy.tenant_responded_at)
        # No orphaned notifications
        self.assertEqual(Notification.objects.count(), 0)

    def test_tenancy_terms_history_tracks_initial_and_revised_proposals_sequentially(self):
        """TenancyTermsHistory records sequential versions and preserves previous values untouched."""
        # 1. Create initial proposal -> Version 1
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=self.application.id,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("25000.00"),
            security_deposit=Decimal("75000.00"),
            rent_due_day=5,
            notes="Initial proposal terms.",
        )

        history_records = list(TenancyTermsHistory.objects.filter(tenancy=tenancy).order_by("version"))
        self.assertEqual(len(history_records), 1)

        v1 = history_records[0]
        self.assertEqual(v1.version, 1)
        self.assertEqual(v1.proposed_by, self.owner)
        self.assertEqual(v1.monthly_rent, Decimal("25000.00"))
        self.assertEqual(v1.security_deposit, Decimal("75000.00"))
        self.assertEqual(v1.start_date, date(2026, 9, 1))
        self.assertEqual(v1.end_date, date(2027, 8, 31))
        self.assertEqual(v1.rent_due_day, 5)
        self.assertEqual(v1.notes, "Initial proposal terms.")

        # 2. Update proposal terms -> Version 2
        update_tenancy_proposal(
            owner=self.owner,
            tenancy_id=tenancy.id,
            monthly_rent=Decimal("24000.00"),
            security_deposit=Decimal("70000.00"),
            rent_due_day=1,
            notes="Revised after tenant requested rent discount.",
        )

        history_records = list(TenancyTermsHistory.objects.filter(tenancy=tenancy).order_by("version"))
        self.assertEqual(len(history_records), 2)

        # 3. Preservation of historical values: verify v1 remains unchanged
        v1_recheck = history_records[0]
        self.assertEqual(v1_recheck.version, 1)
        self.assertEqual(v1_recheck.monthly_rent, Decimal("25000.00"))
        self.assertEqual(v1_recheck.security_deposit, Decimal("75000.00"))
        self.assertEqual(v1_recheck.rent_due_day, 5)
        self.assertEqual(v1_recheck.notes, "Initial proposal terms.")

        # Verify v2 has new values
        v2 = history_records[1]
        self.assertEqual(v2.version, 2)
        self.assertEqual(v2.proposed_by, self.owner)
        self.assertEqual(v2.monthly_rent, Decimal("24000.00"))
        self.assertEqual(v2.security_deposit, Decimal("70000.00"))
        self.assertEqual(v2.rent_due_day, 1)
        self.assertEqual(v2.notes, "Revised after tenant requested rent discount.")

        # 4. Update proposal terms a second time -> Version 3
        update_tenancy_proposal(
            owner=self.owner,
            tenancy_id=tenancy.id,
            monthly_rent=Decimal("23500.00"),
            notes="Final agreed discount.",
        )

        history_records = list(TenancyTermsHistory.objects.filter(tenancy=tenancy).order_by("version"))
        self.assertEqual(len(history_records), 3)
        self.assertEqual([h.version for h in history_records], [1, 2, 3])
        self.assertEqual(history_records[2].monthly_rent, Decimal("23500.00"))

        # 5. Detail API exposes terms_history (read-only)
        self.client.force_authenticate(user=self.tenant)
        res = self.client.get(reverse("leasing:tenancy-detail", kwargs={"pk": tenancy.id}))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("terms_history", res.data["data"])
        api_history = res.data["data"]["terms_history"]
        self.assertEqual(len(api_history), 3)
        self.assertEqual(api_history[0]["version"], 1)
        self.assertEqual(api_history[0]["monthly_rent"], "25000.00")
        self.assertEqual(api_history[1]["version"], 2)
        self.assertEqual(api_history[1]["monthly_rent"], "24000.00")
        self.assertEqual(api_history[2]["version"], 3)
        self.assertEqual(api_history[2]["monthly_rent"], "23500.00")

    def test_tenancy_terms_history_rollback_on_failed_creation_or_update(self):
        """Terms history creation is atomic; failed operations never leave orphaned history rows."""
        # 1. Rollback on proposal creation failure
        with patch.object(
            Notification.objects,
            "create",
            side_effect=RuntimeError("Notification DB down"),
        ):
            with self.assertRaises(RuntimeError):
                create_tenancy(
                    owner=self.owner,
                    property_id=self.property.id,
                    tenant=self.tenant,
                    start_date=date(2026, 9, 1),
                    monthly_rent=Decimal("25000.00"),
                )

        # 0 tenancies and 0 terms history records
        self.assertEqual(Tenancy.objects.count(), 0)
        self.assertEqual(TenancyTermsHistory.objects.count(), 0)

        # 2. Successfully create tenancy -> 1 history record
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )
        self.assertEqual(TenancyTermsHistory.objects.filter(tenancy=tenancy).count(), 1)

        # 3. Rollback on proposal update failure
        with patch.object(
            Notification.objects,
            "create",
            side_effect=RuntimeError("Notification DB down during update"),
        ):
            with self.assertRaises(RuntimeError):
                update_tenancy_proposal(
                    owner=self.owner,
                    tenancy_id=tenancy.id,
                    monthly_rent=Decimal("99999.00"),
                )

        # Still only 1 history record (version 2 was not persisted)
        self.assertEqual(TenancyTermsHistory.objects.filter(tenancy=tenancy).count(), 1)
        tenancy.refresh_from_db()
        self.assertEqual(tenancy.monthly_rent, Decimal("25000.00"))

    def test_accepted_decision_attached_to_correct_version(self):
        """Accepted decisions record status ACCEPTED and timestamp on the exact proposal version."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )
        v1 = TenancyTermsHistory.objects.get(tenancy=tenancy, version=1)
        self.assertEqual(v1.status, TermsProposalStatus.PENDING)
        self.assertIsNone(v1.responded_at)

        accept_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id)

        v1.refresh_from_db()
        self.assertEqual(v1.status, TermsProposalStatus.ACCEPTED)
        self.assertIsNotNone(v1.responded_at)
        self.assertIsNone(v1.rejection_reason)

    def test_rejected_decision_and_reason_preserved_after_revisions(self):
        """Rejected decisions and reasons are permanently preserved on the rejected version even when revised."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("30000.00"),
        )
        reject_tenancy_proposal(
            tenant=self.tenant,
            tenancy_id=tenancy.id,
            reason="Rent too high, please reduce to 28000.",
        )

        v1 = TenancyTermsHistory.objects.get(tenancy=tenancy, version=1)
        self.assertEqual(v1.status, TermsProposalStatus.REJECTED)
        self.assertEqual(v1.rejection_reason, "Rent too high, please reduce to 28000.")
        self.assertIsNotNone(v1.responded_at)
        v1_responded_at = v1.responded_at

        # Owner revises terms based on feedback
        update_tenancy_proposal(
            owner=self.owner,
            tenancy_id=tenancy.id,
            monthly_rent=Decimal("28000.00"),
        )

        # v1 remains completely preserved with rejection details
        v1.refresh_from_db()
        self.assertEqual(v1.status, TermsProposalStatus.REJECTED)
        self.assertEqual(v1.rejection_reason, "Rent too high, please reduce to 28000.")
        self.assertEqual(v1.responded_at, v1_responded_at)

        # v2 is created as PENDING without previous rejection reason
        v2 = TenancyTermsHistory.objects.get(tenancy=tenancy, version=2)
        self.assertEqual(v2.status, TermsProposalStatus.PENDING)
        self.assertEqual(v2.monthly_rent, Decimal("28000.00"))
        self.assertIsNone(v2.rejection_reason)
        self.assertIsNone(v2.responded_at)

    def test_pending_version_becomes_superseded_when_replaced(self):
        """A pending proposal version transitions to SUPERSEDED when replaced before tenant decision."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("30000.00"),
        )
        v1 = TenancyTermsHistory.objects.get(tenancy=tenancy, version=1)
        self.assertEqual(v1.status, TermsProposalStatus.PENDING)

        # Owner updates terms before tenant responds
        update_tenancy_proposal(
            owner=self.owner,
            tenancy_id=tenancy.id,
            monthly_rent=Decimal("29000.00"),
        )

        v1.refresh_from_db()
        self.assertEqual(v1.status, TermsProposalStatus.SUPERSEDED)
        self.assertIsNotNone(v1.responded_at)

        v2 = TenancyTermsHistory.objects.get(tenancy=tenancy, version=2)
        self.assertEqual(v2.status, TermsProposalStatus.PENDING)
        self.assertEqual(v2.monthly_rent, Decimal("29000.00"))

    def test_accepted_and_rejected_versions_are_never_overwritten(self):
        """A multi-round negotiation preserves all historical states accurately."""
        # Round 1: v1 proposed and rejected
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("35000.00"),
        )
        reject_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id, reason="Too expensive")

        # Round 2: v2 proposed and accepted
        update_tenancy_proposal(
            owner=self.owner,
            tenancy_id=tenancy.id,
            monthly_rent=Decimal("32000.00"),
        )
        accept_tenancy_proposal(tenant=self.tenant, tenancy_id=tenancy.id)

        # Round 3: Owner proposes amendment (v3)
        update_tenancy_proposal(
            owner=self.owner,
            tenancy_id=tenancy.id,
            monthly_rent=Decimal("31000.00"),
        )

        history = list(TenancyTermsHistory.objects.filter(tenancy=tenancy).order_by("version"))
        self.assertEqual(len(history), 3)

        self.assertEqual(history[0].version, 1)
        self.assertEqual(history[0].status, TermsProposalStatus.REJECTED)
        self.assertEqual(history[0].rejection_reason, "Too expensive")

        self.assertEqual(history[1].version, 2)
        self.assertEqual(history[1].status, TermsProposalStatus.ACCEPTED)

        self.assertEqual(history[2].version, 3)
        self.assertEqual(history[2].status, TermsProposalStatus.PENDING)

    def test_each_version_can_receive_only_one_final_decision(self):
        """Historical version cannot transition more than once out of PENDING."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )
        v1 = TenancyTermsHistory.objects.get(tenancy=tenancy, version=1)
        v1.transition_status(TermsProposalStatus.ACCEPTED)

        with self.assertRaises(ValidationError):
            v1.transition_status(TermsProposalStatus.REJECTED)

        with self.assertRaises(ValidationError):
            v1.transition_status(TermsProposalStatus.SUPERSEDED)

    def test_tenancy_deletion_protected_by_terms_history(self):
        """Deleting a tenancy that has terms history is blocked by ProtectedError."""
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )
        self.assertTrue(TenancyTermsHistory.objects.filter(tenancy=tenancy).exists())

        with self.assertRaises(ProtectedError):
            tenancy.delete()

        # Tenancy and history records remain untouched
        self.assertTrue(Tenancy.objects.filter(id=tenancy.id).exists())
        self.assertTrue(TenancyTermsHistory.objects.filter(tenancy=tenancy).exists())

    def test_tenancy_admin_disallows_deletion(self):
        """TenancyAdmin explicitly disables deletion permission."""
        admin_instance = TenancyAdmin(Tenancy, admin.site)
        self.assertFalse(admin_instance.has_delete_permission(request=None))

