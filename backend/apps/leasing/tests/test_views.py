from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.leasing.models import (
    Application,
    ApplicationStatus,
    Tenancy,
    TenancyStatus,
)
from apps.listings.models import Listing, ListingStatus
from apps.properties.models import (
    Property,
    PropertyCategory,
    PropertyImage,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class LeasingAPITestMixin:
    """Shared fixtures for Leasing API tests."""

    def create_user(
        self,
        email,
        *,
        is_tenant=True,
        is_owner=False,
        is_platform_admin=False,
    ):
        if is_platform_admin:
            return User.objects.create_superuser(
                email=email,
                password="securepassword123",
            )
        return User.objects.create_user(
            email=email,
            password="securepassword123",
            first_name="Test",
            last_name="User",
            is_active=True,
            is_tenant=is_tenant,
            is_owner=is_owner,
        )

    def create_property(self, owner, *, title="Maple Court 4A"):
        prop = Property.objects.create(
            owner=owner,
            title=title,
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="15 Maple Lane",
            locality="Whitefield",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560066",
            latitude=Decimal("12.9698196"),
            longitude=Decimal("77.7499721"),
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )
        PropertyImage.objects.create(
            property=prop,
            image_url="properties/sample/main.jpg",
            is_primary=True,
        )
        return prop

    def create_listing(
        self,
        property_instance,
        *,
        title="Maple Court Listing",
        status_value=ListingStatus.PUBLISHED,
    ):
        return Listing.objects.create(
            property=property_instance,
            title=title,
            monthly_rent=Decimal("24000.00"),
            security_deposit=Decimal("80000.00"),
            status=status_value,
        )


class ApplicationAPITests(LeasingAPITestMixin, APITestCase):
    def setUp(self):
        self.owner = self.create_user(
            "api_app_owner@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.other_owner = self.create_user(
            "api_app_owner2@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = self.create_user("api_app_tenant@example.com")
        self.other_tenant = self.create_user("api_app_tenant2@example.com")
        self.admin = self.create_user(
            "api_app_admin@example.com",
            is_platform_admin=True,
        )

        self.property = self.create_property(self.owner)
        self.listing = self.create_listing(self.property)
        self.draft_property = self.create_property(
            self.owner,
            title="Draft Residence",
        )
        self.draft_listing = self.create_listing(
            self.draft_property,
            title="Draft Listing",
            status_value=ListingStatus.DRAFT,
        )

    def test_application_endpoints_require_authentication(self):
        app = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
        )
        endpoints = [
            ("post", reverse("leasing:application-list"), {"listing_id": str(self.listing.id)}),
            ("get", reverse("leasing:application-me"), None),
            ("get", reverse("leasing:application-received"), None),
            ("get", reverse("leasing:application-detail", kwargs={"pk": app.id}), None),
            ("post", reverse("leasing:application-review", kwargs={"pk": app.id}), {"status": ApplicationStatus.APPROVED}),
            ("post", reverse("leasing:application-withdraw", kwargs={"pk": app.id}), {}),
        ]
        for method, url, payload in endpoints:
            res = getattr(self.client, method)(url, payload or {}, format="json")
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_submit_list_me_and_retrieve_permissions(self):
        # Owner without tenant capability cannot submit.
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            reverse("leasing:application-list"),
            {"listing_id": str(self.listing.id)},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Tenant submits application -> 201 envelope.
        self.client.force_authenticate(user=self.tenant)
        res = self.client.post(
            reverse("leasing:application-list"),
            {"listing_id": str(self.listing.id), "message": "Ready to move."},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["success"])
        app_id = res.data["data"]["id"]
        self.assertEqual(res.data["data"]["status"], ApplicationStatus.SUBMITTED)

        # Duplicate submission -> 400.
        dup_res = self.client.post(
            reverse("leasing:application-list"),
            {"listing_id": str(self.listing.id)},
            format="json",
        )
        self.assertEqual(dup_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(dup_res.data["success"])

        # Draft listing -> 400.
        draft_res = self.client.post(
            reverse("leasing:application-list"),
            {"listing_id": str(self.draft_listing.id)},
            format="json",
        )
        self.assertEqual(draft_res.status_code, status.HTTP_400_BAD_REQUEST)

        # /me returns only tenant's applications.
        me_res = self.client.get(reverse("leasing:application-me"))
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertEqual(me_res.data["count"], 1)

        # Unrelated tenant gets 404 on retrieve (does not expose existence).
        self.client.force_authenticate(user=self.other_tenant)
        other_res = self.client.get(
            reverse("leasing:application-detail", kwargs={"pk": app_id})
        )
        self.assertEqual(other_res.status_code, status.HTTP_404_NOT_FOUND)

        # Platform admin can retrieve.
        self.client.force_authenticate(user=self.admin)
        admin_res = self.client.get(
            reverse("leasing:application-detail", kwargs={"pk": app_id})
        )
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)

    def test_received_and_review_workflow_and_permissions(self):
        app = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
        )

        # Tenant and platform admin cannot access received or review.
        for forbidden_user in (self.tenant, self.admin):
            self.client.force_authenticate(user=forbidden_user)
            res_rec = self.client.get(reverse("leasing:application-received"))
            self.assertEqual(res_rec.status_code, status.HTTP_403_FORBIDDEN)
            res_rev = self.client.post(
                reverse("leasing:application-review", kwargs={"pk": app.id}),
                {"status": ApplicationStatus.APPROVED},
                format="json",
            )
            self.assertEqual(res_rev.status_code, status.HTTP_403_FORBIDDEN)

        # Cross-owner gets 404 on review.
        self.client.force_authenticate(user=self.other_owner)
        cross_res = self.client.post(
            reverse("leasing:application-review", kwargs={"pk": app.id}),
            {"status": ApplicationStatus.APPROVED},
            format="json",
        )
        self.assertEqual(cross_res.status_code, status.HTTP_404_NOT_FOUND)

        # Property owner lists received and approves.
        self.client.force_authenticate(user=self.owner)
        rec_res = self.client.get(reverse("leasing:application-received"))
        self.assertEqual(rec_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rec_res.data["count"], 1)

        approve_res = self.client.post(
            reverse("leasing:application-review", kwargs={"pk": app.id}),
            {"status": ApplicationStatus.APPROVED, "change_reason": "Verified."},
            format="json",
        )
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        self.assertTrue(approve_res.data["success"])
        self.assertEqual(
            approve_res.data["data"]["status"],
            ApplicationStatus.APPROVED,
        )

        # Re-reviewing approved application -> 400.
        re_review = self.client.post(
            reverse("leasing:application-review", kwargs={"pk": app.id}),
            {"status": ApplicationStatus.REJECTED},
            format="json",
        )
        self.assertEqual(re_review.status_code, status.HTTP_400_BAD_REQUEST)

    def test_withdraw_workflow_and_permissions(self):
        app = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
        )

        # Other tenant gets 404 via scoped queryset.
        self.client.force_authenticate(user=self.other_tenant)
        other_res = self.client.post(
            reverse("leasing:application-withdraw", kwargs={"pk": app.id}),
            {},
            format="json",
        )
        self.assertEqual(other_res.status_code, status.HTTP_404_NOT_FOUND)

        # Applicant withdraws -> 200.
        self.client.force_authenticate(user=self.tenant)
        res = self.client.post(
            reverse("leasing:application-withdraw", kwargs={"pk": app.id}),
            {"change_reason": "Plans changed."},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["data"]["status"], ApplicationStatus.WITHDRAWN)

        # Second withdraw -> 400.
        again = self.client.post(
            reverse("leasing:application-withdraw", kwargs={"pk": app.id}),
            {},
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)


class TenancyAPITests(LeasingAPITestMixin, APITestCase):
    def setUp(self):
        self.owner = self.create_user(
            "api_ten_owner@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.other_owner = self.create_user(
            "api_ten_owner2@example.com",
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = self.create_user("api_ten_tenant@example.com")
        self.other_tenant = self.create_user("api_ten_tenant2@example.com")
        self.admin = self.create_user(
            "api_ten_admin@example.com",
            is_platform_admin=True,
        )

        self.property = self.create_property(self.owner)
        self.listing = self.create_listing(self.property)
        self.approved_app = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
            status=ApplicationStatus.APPROVED,
        )

    def _create_payload(self, **overrides):
        payload = {
            "property_id": str(self.property.id),
            "tenant_id": str(self.tenant.id),
            "application_id": str(self.approved_app.id),
            "start_date": "2026-09-01",
            "end_date": "2027-08-31",
            "monthly_rent": "24000.00",
            "security_deposit": "80000.00",
        }
        payload.update(overrides)
        return payload

    def test_tenancy_endpoints_require_authentication(self):
        tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            monthly_rent=Decimal("24000.00"),
        )
        endpoints = [
            ("post", reverse("leasing:tenancy-list"), self._create_payload()),
            ("get", reverse("leasing:tenancy-me"), None),
            ("get", reverse("leasing:tenancy-managed"), None),
            ("get", reverse("leasing:tenancy-detail", kwargs={"pk": tenancy.id}), None),
            ("post", reverse("leasing:tenancy-confirm", kwargs={"pk": tenancy.id}), {}),
            ("post", reverse("leasing:tenancy-activate", kwargs={"pk": tenancy.id}), {}),
            ("post", reverse("leasing:tenancy-cancel", kwargs={"pk": tenancy.id}), {}),
            ("post", reverse("leasing:tenancy-end", kwargs={"pk": tenancy.id}), {}),
        ]
        for method, url, payload in endpoints:
            res = getattr(self.client, method)(url, payload or {}, format="json")
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_list_retrieve_and_cross_user_isolation(self):
        # Tenant cannot create tenancy.
        self.client.force_authenticate(user=self.tenant)
        forbidden = self.client.post(
            reverse("leasing:tenancy-list"),
            self._create_payload(),
            format="json",
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # Other owner cannot create for self.owner's property -> 403.
        self.client.force_authenticate(user=self.other_owner)
        cross_create = self.client.post(
            reverse("leasing:tenancy-list"),
            self._create_payload(),
            format="json",
        )
        self.assertEqual(cross_create.status_code, status.HTTP_403_FORBIDDEN)

        # Owner creates tenancy -> 201 envelope.
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            reverse("leasing:tenancy-list"),
            self._create_payload(),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["success"])
        tenancy_id = res.data["data"]["id"]
        self.assertEqual(res.data["data"]["status"], TenancyStatus.PENDING)

        # Owner sees in /managed/.
        managed_res = self.client.get(reverse("leasing:tenancy-managed"))
        self.assertEqual(managed_res.status_code, status.HTTP_200_OK)
        self.assertEqual(managed_res.data["count"], 1)

        # Tenant sees in /me/ and can retrieve.
        self.client.force_authenticate(user=self.tenant)
        me_res = self.client.get(reverse("leasing:tenancy-me"))
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertEqual(me_res.data["count"], 1)
        det_res = self.client.get(
            reverse("leasing:tenancy-detail", kwargs={"pk": tenancy_id})
        )
        self.assertEqual(det_res.status_code, status.HTTP_200_OK)

        # Unrelated tenant gets 404; admin gets 200.
        self.client.force_authenticate(user=self.other_tenant)
        other_res = self.client.get(
            reverse("leasing:tenancy-detail", kwargs={"pk": tenancy_id})
        )
        self.assertEqual(other_res.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(user=self.admin)
        admin_res = self.client.get(
            reverse("leasing:tenancy-detail", kwargs={"pk": tenancy_id})
        )
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)

    def test_tenancy_lifecycle_transitions_and_invalid_transitions(self):
        tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2026, 9, 1),
            end_date=date(2027, 8, 31),
            monthly_rent=Decimal("24000.00"),
        )

        # Tenant cannot call lifecycle endpoints.
        self.client.force_authenticate(user=self.tenant)
        for action_name in (
            "leasing:tenancy-confirm",
            "leasing:tenancy-activate",
            "leasing:tenancy-cancel",
            "leasing:tenancy-end",
        ):
            res = self.client.post(
                reverse(action_name, kwargs={"pk": tenancy.id}),
                {},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Owner cannot activate before confirming -> 400.
        self.client.force_authenticate(user=self.owner)
        early_activate = self.client.post(
            reverse("leasing:tenancy-activate", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(early_activate.status_code, status.HTTP_400_BAD_REQUEST)

        # Confirm -> 200 & listing paused.
        confirm_res = self.client.post(
            reverse("leasing:tenancy-confirm", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            confirm_res.data["data"]["status"],
            TenancyStatus.CONFIRMED,
        )

        # Activate -> 200 & property occupied.
        activate_res = self.client.post(
            reverse("leasing:tenancy-activate", kwargs={"pk": tenancy.id}),
            {"move_in_date": "2026-09-02"},
            format="json",
        )
        self.assertEqual(activate_res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            activate_res.data["data"]["status"],
            TenancyStatus.ACTIVE,
        )
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.OCCUPIED)

        # Cancel active -> 400.
        cancel_active = self.client.post(
            reverse("leasing:tenancy-cancel", kwargs={"pk": tenancy.id}),
            {},
            format="json",
        )
        self.assertEqual(cancel_active.status_code, status.HTTP_400_BAD_REQUEST)

        # End active -> 200 & property available.
        end_res = self.client.post(
            reverse("leasing:tenancy-end", kwargs={"pk": tenancy.id}),
            {"move_out_date": "2027-08-31"},
            format="json",
        )
        self.assertEqual(end_res.status_code, status.HTTP_200_OK)
        self.assertEqual(end_res.data["data"]["status"], TenancyStatus.ENDED)
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.AVAILABLE)

        # Second pending tenancy can be cancelled.
        pending = Tenancy.objects.create(
            property=self.property,
            tenant=self.other_tenant,
            start_date=date(2027, 9, 1),
            monthly_rent=Decimal("25000.00"),
        )
        cancel_res = self.client.post(
            reverse("leasing:tenancy-cancel", kwargs={"pk": pending.id}),
            {},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            cancel_res.data["data"]["status"],
            TenancyStatus.CANCELLED,
        )

    def test_confirm_and_activate_endpoints_reject_unavailable_property(self):
        self.client.force_authenticate(user=self.owner)
        tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2028, 1, 1),
            end_date=date(2028, 12, 31),
            monthly_rent=Decimal("25000.00"),
        )

        for disallowed_status in (
            PropertyStatus.DRAFT,
            PropertyStatus.OCCUPIED,
            PropertyStatus.MAINTENANCE,
            PropertyStatus.INACTIVE,
        ):
            with self.subTest(action="confirm", property_status=disallowed_status):
                Property.objects.filter(pk=self.property.pk).update(status=disallowed_status)
                res = self.client.post(
                    reverse("leasing:tenancy-confirm", kwargs={"pk": tenancy.id}),
                    {},
                    format="json",
                )
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertFalse(res.data["success"])
                self.assertIn("property", res.data["errors"])

        # Confirm while available, then block activation on unavailable property statuses.
        Property.objects.filter(pk=self.property.pk).update(status=PropertyStatus.AVAILABLE)
        self.assertEqual(
            self.client.post(
                reverse("leasing:tenancy-confirm", kwargs={"pk": tenancy.id}),
                {},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

        for disallowed_status in (
            PropertyStatus.DRAFT,
            PropertyStatus.OCCUPIED,
            PropertyStatus.MAINTENANCE,
            PropertyStatus.INACTIVE,
        ):
            with self.subTest(action="activate", property_status=disallowed_status):
                Property.objects.filter(pk=self.property.pk).update(status=disallowed_status)
                res = self.client.post(
                    reverse("leasing:tenancy-activate", kwargs={"pk": tenancy.id}),
                    {},
                    format="json",
                )
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertFalse(res.data["success"])
                self.assertIn("property", res.data["errors"])

    def test_managed_status_filter_and_display_fields(self):
        self.client.force_authenticate(user=self.owner)
        pending_tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2028, 2, 1),
            end_date=date(2028, 7, 31),
            monthly_rent=Decimal("25000.00"),
            status=TenancyStatus.PENDING,
        )
        cancelled_tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            start_date=date(2028, 9, 1),
            end_date=date(2029, 2, 28),
            monthly_rent=Decimal("26000.00"),
            status=TenancyStatus.CANCELLED,
        )

        # Valid status filter returns matching tenancies and display metadata.
        filtered = self.client.get(
            reverse("leasing:tenancy-managed"),
            {"status": TenancyStatus.PENDING},
        )
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered.data["count"], 1)
        item = filtered.data["results"][0]
        self.assertEqual(item["id"], str(pending_tenancy.id))
        self.assertEqual(item["property_title"], self.property.title)
        self.assertTrue(item["property_address"])
        self.assertTrue(item["tenant_name"])

        # Detail includes tenant_email too.
        detail = self.client.get(
            reverse("leasing:tenancy-detail", kwargs={"pk": cancelled_tenancy.id}),
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["data"]["tenant_email"], self.tenant.email)
        self.assertEqual(detail.data["data"]["property_title"], self.property.title)

        # Invalid status filter yields 400.
        invalid = self.client.get(
            reverse("leasing:tenancy-managed"),
            {"status": "bogus"},
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_application_serializer_exposes_property_and_tenancy_id(self):
        self.client.force_authenticate(user=self.owner)

        received_before = self.client.get(reverse("leasing:application-received"))
        self.assertEqual(received_before.status_code, status.HTTP_200_OK)
        entry_before = next(
            row
            for row in received_before.data["results"]
            if row["id"] == str(self.approved_app.id)
        )
        self.assertEqual(entry_before["property_id"], str(self.property.id))
        self.assertIsNone(entry_before["tenancy_id"])

        tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            application=self.approved_app,
            start_date=date(2028, 3, 1),
            monthly_rent=Decimal("25000.00"),
        )
        detail_after = self.client.get(
            reverse("leasing:application-detail", kwargs={"pk": self.approved_app.id}),
        )
        self.assertEqual(detail_after.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_after.data["data"]["property_id"], str(self.property.id))
        self.assertEqual(detail_after.data["data"]["tenancy_id"], str(tenancy.id))

