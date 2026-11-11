import io
import tempfile
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.documents.models import Document, DocumentType
from apps.documents.services import upload_document
from apps.leasing.models import (
    ApplicationStatus,
    TenancyStatus,
)
from apps.leasing.services import (
    activate_tenancy,
    cancel_tenancy,
    confirm_tenancy,
    create_tenancy,
    end_tenancy,
    review_application,
    submit_application,
    withdraw_application,
)
from apps.listings.models import Listing, ListingStatus
from apps.notifications.models import (
    Notification,
    NotificationType,
    RelatedObjectType,
)
from apps.properties.models import (
    Property,
    PropertyCategory,
    PropertyImage,
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class PlatformNotificationsAndLifecycleIntegrationTests(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.test_storage = FileSystemStorage(
            location=self.temp_dir.name,
            base_url=None,
        )
        self.storage_patcher = patch(
            "apps.documents.services.document_service.private_document_storage",
            self.test_storage,
        )
        self.storage_patcher.start()
        self.addCleanup(self.storage_patcher.stop)

        self.owner = User.objects.create_user(
            email="integ_owner@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = User.objects.create_user(
            email="integ_tenant@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=True,
        )
        self.second_tenant = User.objects.create_user(
            email="integ_tenant2@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=True,
        )

        self.property = Property.objects.create(
            owner=self.owner,
            title="Emerald Residency",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="88 Emerald Road",
            locality="Sadashivanagar",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560080",
            latitude=Decimal("13.0067518"),
            longitude=Decimal("77.5813075"),
            bedrooms=3,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )
        PropertyImage.objects.create(
            property=self.property,
            image_url="properties/emerald/main.jpg",
            is_primary=True,
        )
        self.listing = Listing.objects.create(
            property=self.property,
            title="Emerald 3BHK",
            monthly_rent=Decimal("42000.00"),
            security_deposit=Decimal("150000.00"),
            status=ListingStatus.PUBLISHED,
        )

    def _pdf(self, name="doc.pdf"):
        return SimpleUploadedFile(
            name,
            b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF",
            content_type="application/pdf",
        )

    def test_end_to_end_rental_lifecycle_notifications_and_state_sync(self):
        # 1. Tenant submits application -> owner notified.
        app = submit_application(
            applicant=self.tenant,
            listing_id=self.listing.id,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                notification_type=NotificationType.APPLICATION_SUBMITTED,
                related_object_type=RelatedObjectType.APPLICATION,
                related_object_id=app.id,
            ).exists()
        )

        # 2. Tenant uploads application document -> owner notified.
        app_doc = upload_document(
            uploaded_by=self.tenant,
            uploaded_file=self._pdf("payslip.pdf"),
            document_type=DocumentType.INCOME_PROOF,
            application_instance=app,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                notification_type=NotificationType.DOCUMENT_UPLOADED,
                related_object_type=RelatedObjectType.DOCUMENT,
                related_object_id=app_doc.id,
            ).exists()
        )

        # 3. Owner reviews -> under_review & approved -> tenant notified for each.
        review_application(
            owner=self.owner,
            application_id=app.id,
            new_status=ApplicationStatus.UNDER_REVIEW,
        )
        review_application(
            owner=self.owner,
            application_id=app.id,
            new_status=ApplicationStatus.APPROVED,
        )
        self.assertEqual(
            Notification.objects.filter(
                user=self.tenant,
                related_object_type=RelatedObjectType.APPLICATION,
                related_object_id=app.id,
                notification_type__in=[
                    NotificationType.APPLICATION_UNDER_REVIEW,
                    NotificationType.APPLICATION_APPROVED,
                ],
            ).count(),
            2,
        )

        # 4. Owner creates tenancy -> tenant notified.
        tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            application_id=app.id,
            start_date=date(2026, 11, 1),
            end_date=date(2027, 10, 31),
            monthly_rent=Decimal("42000.00"),
            security_deposit=Decimal("150000.00"),
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.TENANCY_CREATED,
                related_object_type=RelatedObjectType.TENANCY,
                related_object_id=tenancy.id,
            ).exists()
        )

        # 5. Owner confirms tenancy -> listing paused, tenant notified.
        confirm_tenancy(owner=self.owner, tenancy_id=tenancy.id)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, ListingStatus.PAUSED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.TENANCY_CONFIRMED,
                related_object_id=tenancy.id,
            ).exists()
        )

        # 6. Owner activates tenancy -> property occupied, tenant notified.
        activate_tenancy(
            owner=self.owner,
            tenancy_id=tenancy.id,
            move_in_date=date(2026, 11, 1),
        )
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.OCCUPIED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.TENANCY_ACTIVATED,
                related_object_id=tenancy.id,
            ).exists()
        )

        # 7. Tenancy document exchange notifies counterparty only.
        lease_doc = upload_document(
            uploaded_by=self.owner,
            uploaded_file=self._pdf("signed_lease.pdf"),
            document_type=DocumentType.RENTAL_AGREEMENT,
            tenancy_instance=tenancy,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.DOCUMENT_UPLOADED,
                related_object_id=lease_doc.id,
            ).exists()
        )
        tenant_doc = upload_document(
            uploaded_by=self.tenant,
            uploaded_file=self._pdf("handover.pdf"),
            document_type=DocumentType.OTHER,
            tenancy_instance=tenancy,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                notification_type=NotificationType.DOCUMENT_UPLOADED,
                related_object_id=tenant_doc.id,
            ).exists()
        )

        # 8. Property-only & unattached uploads create zero notifications.
        count_before_non_notifying = Notification.objects.count()
        upload_document(
            uploaded_by=self.owner,
            uploaded_file=self._pdf("tax.pdf"),
            document_type=DocumentType.PROPERTY_DOCUMENT,
            property_instance=self.property,
        )
        upload_document(
            uploaded_by=self.tenant,
            uploaded_file=self._pdf("misc.pdf"),
            document_type=DocumentType.OTHER,
        )
        self.assertEqual(
            Notification.objects.count(),
            count_before_non_notifying,
        )

        # 9. Owner ends tenancy -> property restored to available, tenant notified.
        end_tenancy(
            owner=self.owner,
            tenancy_id=tenancy.id,
            move_out_date=date(2027, 10, 31),
        )
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.AVAILABLE)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.TENANCY_ENDED,
                related_object_id=tenancy.id,
            ).exists()
        )

    def test_end_tenancy_does_not_restore_available_when_other_active_tenancy_exists(self):
        tenancy_1 = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            monthly_rent=Decimal("40000.00"),
        )
        confirm_tenancy(owner=self.owner, tenancy_id=tenancy_1.id)
        activate_tenancy(owner=self.owner, tenancy_id=tenancy_1.id)

        # Second non-overlapping active tenancy starting later.
        tenancy_2 = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.second_tenant,
            start_date=date(2026, 7, 1),
            end_date=date(2027, 6, 30),
            monthly_rent=Decimal("42000.00"),
        )
        confirm_tenancy(owner=self.owner, tenancy_id=tenancy_2.id)
        activate_tenancy(owner=self.owner, tenancy_id=tenancy_2.id)

        end_tenancy(owner=self.owner, tenancy_id=tenancy_1.id)
        self.property.refresh_from_db()
        self.assertEqual(self.property.status, PropertyStatus.OCCUPIED)

    def test_rejection_withdrawal_cancellation_and_failure_rollbacks(self):
        # Application rejection and withdrawal notifications
        app_reject = submit_application(
            applicant=self.tenant,
            listing_id=self.listing.id,
        )
        review_application(
            owner=self.owner,
            application_id=app_reject.id,
            new_status=ApplicationStatus.REJECTED,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.APPLICATION_REJECTED,
                related_object_id=app_reject.id,
            ).exists()
        )

        app_withdraw = submit_application(
            applicant=self.second_tenant,
            listing_id=self.listing.id,
        )
        withdraw_application(
            applicant=self.second_tenant,
            application_id=app_withdraw.id,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                notification_type=NotificationType.APPLICATION_WITHDRAWN,
                related_object_id=app_withdraw.id,
            ).exists()
        )

        # Tenancy cancellation notification
        pending_tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.tenant,
            start_date=date(2027, 1, 1),
            monthly_rent=Decimal("42000.00"),
        )
        cancel_tenancy(owner=self.owner, tenancy_id=pending_tenancy.id)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tenant,
                notification_type=NotificationType.TENANCY_CANCELLED,
                related_object_id=pending_tenancy.id,
            ).exists()
        )

        # Rollback on notification failure for confirm_tenancy (listing stays published) & document upload (file deleted)
        draft_tenancy = create_tenancy(
            owner=self.owner,
            property_id=self.property.id,
            tenant=self.second_tenant,
            start_date=date(2028, 1, 1),
            monthly_rent=Decimal("45000.00"),
        )
        with patch(
            "apps.leasing.services.tenancy_service.create_notification",
            side_effect=RuntimeError("Simulated failure"),
        ):
            with self.assertRaises(RuntimeError):
                confirm_tenancy(owner=self.owner, tenancy_id=draft_tenancy.id)

        draft_tenancy.refresh_from_db()
        self.listing.refresh_from_db()
        self.assertEqual(draft_tenancy.status, TenancyStatus.PENDING)
        self.assertEqual(self.listing.status, ListingStatus.PUBLISHED)

        docs_before = Document.objects.count()
        with patch(
            "apps.documents.services.document_service.create_notification",
            side_effect=RuntimeError("Simulated failure"),
        ):
            with self.assertRaises(RuntimeError):
                upload_document(
                    uploaded_by=self.owner,
                    uploaded_file=self._pdf("rollback.pdf"),
                    document_type=DocumentType.RENTAL_AGREEMENT,
                    tenancy_instance=draft_tenancy,
                )

        self.assertEqual(Document.objects.count(), docs_before)
        _, stored_files = self.test_storage.listdir("documents")
        self.assertEqual(stored_files, [])


class EndToEndRentalLifecycleHTTPTests(APITestCase):
    """
    Comprehensive HTTP integration & negative-security suite covering the complete
    12-step owner-to-tenant rental lifecycle, authorization boundaries, and dashboard
    server-side status filter endpoints.
    """

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.test_storage = FileSystemStorage(
            location=self.temp_dir.name,
            base_url=None,
        )
        for target in (
            "apps.documents.services.document_service.private_document_storage",
            "apps.documents.views.document.private_document_storage",
        ):
            patcher = patch(target, self.test_storage)
            patcher.start()
            self.addCleanup(patcher.stop)

        self.owner_user = User.objects.create_user(
            email="e2e_owner@example.com",
            password="securepassword123",
            first_name="Asha",
            last_name="Menon",
            is_active=True,
            is_tenant=True,
            is_owner=False,
        )
        self.other_owner = User.objects.create_user(
            email="e2e_other_owner@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = User.objects.create_user(
            email="e2e_tenant@example.com",
            password="securepassword123",
            first_name="Rohan",
            last_name="Nair",
            is_active=True,
            is_tenant=True,
        )
        self.other_tenant = User.objects.create_user(
            email="e2e_other_tenant@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=True,
        )

    def _pdf(self, name="doc.pdf"):
        return SimpleUploadedFile(
            name,
            b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF",
            content_type="application/pdf",
        )

    def _png(self, name="photo.png"):
        buf = io.BytesIO()
        Image.new("RGB", (24, 24), color="teal").save(buf, format="PNG")
        buf.seek(0)
        return SimpleUploadedFile(name, buf.read(), content_type="image/png")

    def test_complete_12_step_owner_to_tenant_lifecycle_over_http(self):
        # 1. Owner creates a property (also activates is_owner capability) & uploads photo
        self.client.force_authenticate(user=self.owner_user)
        prop_res = self.client.post(
            reverse("properties:property-list"),
            {
                "title": "Greenwood Corner Loft",
                "description": "Sunlit corner residence",
                "category": PropertyCategory.RESIDENTIAL,
                "property_type": PropertyType.APARTMENT,
                "address_line_1": "10 Greenwood Ave",
                "locality": "Indiranagar",
                "city": "Bengaluru",
                "district": "Bengaluru Urban",
                "state": "Karnataka",
                "pin_code": "560038",
                "bedrooms": 2,
                "bathrooms": "2.0",
                "built_up_area": "1250.00",
            },
            format="json",
        )
        self.assertEqual(prop_res.status_code, status.HTTP_201_CREATED)
        property_id = prop_res.data["data"]["id"]
        self.owner_user.refresh_from_db()
        self.assertTrue(self.owner_user.is_owner)

        img_res = self.client.post(
            reverse("properties:property-images", kwargs={"pk": property_id}),
            {"file": self._png("loft.png"), "is_primary": True},
            format="multipart",
        )
        self.assertEqual(img_res.status_code, status.HTTP_201_CREATED)

        # 2. Owner creates a draft listing -> hidden publicly -> publishes listing
        listing_create_res = self.client.post(
            reverse("listings:listing-list"),
            {
                "property_id": property_id,
                "title": "Greenwood 2BHK Loft",
                "monthly_rent": "38000.00",
                "security_deposit": "100000.00",
                "available_from": "2027-01-01",
            },
            format="json",
        )
        self.assertEqual(listing_create_res.status_code, status.HTTP_201_CREATED)
        listing_id = listing_create_res.data["data"]["id"]
        self.assertEqual(listing_create_res.data["data"]["status"], ListingStatus.DRAFT)

        # Server-side status filter on /listings/me/
        self.assertEqual(
            self.client.get(reverse("listings:listing-me"), {"status": "draft"}).data["count"],
            1,
        )
        self.assertEqual(
            self.client.get(reverse("listings:listing-me"), {"status": "published"}).data["count"],
            0,
        )
        self.assertEqual(
            self.client.get(reverse("listings:listing-me"), {"status": "invalid"}).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        # Unauthenticated public user cannot see draft listing
        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.get(reverse("listings:listing-list")).data["count"],
            0,
        )

        # Owner publishes listing
        self.client.force_authenticate(user=self.owner_user)
        pub_res = self.client.post(
            reverse("listings:listing-publish", kwargs={"pk": listing_id}),
            {},
            format="json",
        )
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_res.data["data"]["status"], ListingStatus.PUBLISHED)
        self.assertEqual(
            self.client.get(reverse("listings:listing-me"), {"status": "published"}).data["count"],
            1,
        )

        # Owner cannot apply to their own property listing
        self_apply = self.client.post(
            reverse("leasing:application-list"),
            {"listing_id": listing_id, "message": "Applying to self"},
            format="json",
        )
        self.assertEqual(self_apply.status_code, status.HTTP_403_FORBIDDEN)

        # 3 & 4. Tenant discovers published property & opens details
        self.client.force_authenticate(user=self.tenant)
        public_list = self.client.get(reverse("listings:listing-list"))
        self.assertEqual(public_list.status_code, status.HTTP_200_OK)
        self.assertEqual(public_list.data["count"], 1)
        detail_res = self.client.get(
            reverse("listings:listing-detail", kwargs={"pk": listing_id})
        )
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data["data"]["id"], listing_id)

        # 5. Tenant submits rental application + attaches income proof document
        apply_res = self.client.post(
            reverse("leasing:application-list"),
            {"listing_id": listing_id, "message": "Looking for a 12-month lease."},
            format="json",
        )
        self.assertEqual(apply_res.status_code, status.HTTP_201_CREATED)
        app_id = apply_res.data["data"]["id"]

        # Duplicate application by same tenant rejected
        dup_apply = self.client.post(
            reverse("leasing:application-list"),
            {"listing_id": listing_id, "message": "Duplicate"},
            format="json",
        )
        self.assertEqual(dup_apply.status_code, status.HTTP_400_BAD_REQUEST)

        app_doc_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf("salary_slip.pdf"),
                "document_type": DocumentType.INCOME_PROOF,
                "title": "Salary Certificate",
                "application_id": app_id,
            },
            format="multipart",
        )
        self.assertEqual(app_doc_res.status_code, status.HTTP_201_CREATED)
        app_doc_id = app_doc_res.data["data"]["id"]

        # 6 & 7. Owner receives, filters, reviews -> under_review -> approved
        self.client.force_authenticate(user=self.owner_user)
        pending_filter_res = self.client.get(
            reverse("leasing:application-received"),
            {"status": "submitted,under_review"},
        )
        self.assertEqual(pending_filter_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pending_filter_res.data["count"], 1)
        self.assertEqual(
            self.client.get(
                reverse("leasing:application-received"),
                {"status": "bogus"},
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            self.client.post(
                reverse("leasing:application-review", kwargs={"pk": app_id}),
                {"status": ApplicationStatus.UNDER_REVIEW},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )
        approve_res = self.client.post(
            reverse("leasing:application-review", kwargs={"pk": app_id}),
            {"status": ApplicationStatus.APPROVED, "change_reason": "Verified docs"},
            format="json",
        )
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.get(
                reverse("leasing:application-received"),
                {"status": "submitted,under_review"},
            ).data["count"],
            0,
        )
        self.assertEqual(
            self.client.get(
                reverse("leasing:application-received"),
                {"status": "approved"},
            ).data["count"],
            1,
        )

        # 8. Owner creates tenancy from approved application + duplicate rejected
        tenancy_res = self.client.post(
            reverse("leasing:tenancy-list"),
            {
                "property_id": property_id,
                "tenant_id": str(self.tenant.id),
                "application_id": app_id,
                "start_date": "2027-01-01",
                "end_date": "2027-12-31",
                "monthly_rent": "38000.00",
                "security_deposit": "100000.00",
                "rent_due_day": 5,
            },
            format="json",
        )
        self.assertEqual(tenancy_res.status_code, status.HTTP_201_CREATED)
        tenancy_id = tenancy_res.data["data"]["id"]

        dup_tenancy = self.client.post(
            reverse("leasing:tenancy-list"),
            {
                "property_id": property_id,
                "tenant_id": str(self.tenant.id),
                "application_id": app_id,
                "start_date": "2028-02-01",
                "monthly_rent": "38000.00",
            },
            format="json",
        )
        self.assertEqual(dup_tenancy.status_code, status.HTTP_400_BAD_REQUEST)

        # 9. Owner performs confirm -> activate -> invalid transition check -> end
        self.assertEqual(
            self.client.post(
                reverse("leasing:tenancy-confirm", kwargs={"pk": tenancy_id}),
                {},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )
        # Confirm paused the listing -> no longer publicly listed
        self.assertEqual(
            self.client.get(reverse("listings:listing-list")).data["count"],
            0,
        )

        act_res = self.client.post(
            reverse("leasing:tenancy-activate", kwargs={"pk": tenancy_id}),
            {"move_in_date": "2027-01-01"},
            format="json",
        )
        self.assertEqual(act_res.status_code, status.HTTP_200_OK)
        self.assertEqual(act_res.data["data"]["status"], TenancyStatus.ACTIVE)

        # Invalid transitions rejected while active
        self.assertEqual(
            self.client.post(
                reverse("leasing:tenancy-confirm", kwargs={"pk": tenancy_id}),
                {},
                format="json",
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.post(
                reverse("leasing:tenancy-cancel", kwargs={"pk": tenancy_id}),
                {},
                format="json",
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        # 10 & 11. Owner uploads private property doc + shared tenancy doc; tenant views tenancy & docs
        priv_prop_doc = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf("deed.pdf"),
                "document_type": DocumentType.PROPERTY_DOCUMENT,
                "title": "Sale Deed",
                "property_id": property_id,
            },
            format="multipart",
        )
        self.assertEqual(priv_prop_doc.status_code, status.HTTP_201_CREATED)
        priv_prop_doc_id = priv_prop_doc.data["data"]["id"]

        lease_doc = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf("lease.pdf"),
                "document_type": DocumentType.RENTAL_AGREEMENT,
                "title": "Executed Lease",
                "tenancy_id": tenancy_id,
            },
            format="multipart",
        )
        self.assertEqual(lease_doc.status_code, status.HTTP_201_CREATED)
        lease_doc_id = lease_doc.data["data"]["id"]

        # Tenant sees active tenancy & authorized docs (tenancy + application), NEVER private property doc
        self.client.force_authenticate(user=self.tenant)
        my_tenancies = self.client.get(reverse("leasing:tenancy-me"))
        self.assertEqual(my_tenancies.status_code, status.HTTP_200_OK)
        self.assertEqual(my_tenancies.data["results"][0]["status"], TenancyStatus.ACTIVE)

        tenant_doc_ids = {
            row["id"]
            for row in self.client.get(reverse("documents:document-list")).data["results"]
        }
        self.assertEqual(tenant_doc_ids, {app_doc_id, lease_doc_id})
        self.assertNotIn(priv_prop_doc_id, tenant_doc_ids)
        self.assertEqual(
            self.client.get(
                reverse("documents:document-download", kwargs={"pk": priv_prop_doc_id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        dl_lease = self.client.get(
            reverse("documents:document-download", kwargs={"pk": lease_doc_id})
        )
        self.assertEqual(dl_lease.status_code, status.HTTP_200_OK)
        b"".join(dl_lease.streaming_content)

        # Owner ends tenancy -> property returns to available & tenant sees ended
        self.client.force_authenticate(user=self.owner_user)
        end_res = self.client.post(
            reverse("leasing:tenancy-end", kwargs={"pk": tenancy_id}),
            {"move_out_date": "2027-12-31"},
            format="json",
        )
        self.assertEqual(end_res.status_code, status.HTTP_200_OK)
        self.assertEqual(end_res.data["data"]["status"], TenancyStatus.ENDED)

        # 12. Both owner and tenant check notifications, unread counts, and mark read
        self.client.force_authenticate(user=self.owner_user)
        owner_unread = self.client.get(reverse("notifications:notification-unread-count"))
        self.assertGreaterEqual(owner_unread.data["data"]["unread_count"], 2)
        self.assertEqual(
            self.client.post(
                reverse("notifications:notification-read-all"),
                {},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(reverse("notifications:notification-unread-count")).data["data"]["unread_count"],
            0,
        )

        self.client.force_authenticate(user=self.tenant)
        tenant_notifs = self.client.get(reverse("notifications:notification-list"))
        self.assertGreaterEqual(tenant_notifs.data["count"], 6)
        first_id = tenant_notifs.data["results"][0]["id"]
        self.assertEqual(
            self.client.post(
                reverse("notifications:notification-read", kwargs={"pk": first_id}),
                {},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )
        self.client.post(reverse("notifications:notification-read-all"), {}, format="json")
        self.assertEqual(
            self.client.get(reverse("notifications:notification-unread-count")).data["data"]["unread_count"],
            0,
        )

    def test_negative_security_and_isolation_controls(self):
        # Set up owner property, paused/draft/occupied/inactive visibility checks, and tenant application
        prop = Property.objects.create(
            owner=self.owner_user,
            title="Security Villa",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.VILLA,
            address_line_1="1 Security Rd",
            locality="Koramangala",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560034",
            bedrooms=3,
            bathrooms=Decimal("3.0"),
            status=PropertyStatus.AVAILABLE,
        )
        self.owner_user.is_owner = True
        self.owner_user.save(update_fields=["is_owner"])
        PropertyImage.objects.create(property=prop, image_url="properties/sec.jpg", is_primary=True)

        # Draft, Paused, Occupied, Inactive properties/listings never appear in public discovery
        for prop_status, listing_status in (
            (PropertyStatus.DRAFT, ListingStatus.DRAFT),
            (PropertyStatus.AVAILABLE, ListingStatus.PAUSED),
            (PropertyStatus.OCCUPIED, ListingStatus.PUBLISHED),
            (PropertyStatus.INACTIVE, ListingStatus.PUBLISHED),
        ):
            Property.objects.filter(pk=prop.pk).update(status=prop_status)
            Listing.objects.filter(property=prop).delete()
            listing = Listing.objects.create(
                property=prop,
                title="Hidden Listing",
                monthly_rent=Decimal("50000.00"),
                status=listing_status,
            )
            self.client.force_authenticate(user=None)
            self.assertEqual(self.client.get(reverse("listings:listing-list")).data["count"], 0)
            self.assertEqual(
                self.client.get(
                    reverse("listings:listing-detail", kwargs={"pk": listing.id})
                ).status_code,
                status.HTTP_404_NOT_FOUND,
            )

        # Make available + published for application/tenancy isolation tests
        Property.objects.filter(pk=prop.pk).update(status=PropertyStatus.AVAILABLE)
        Listing.objects.filter(property=prop).delete()
        pub_listing = Listing.objects.create(
            property=prop,
            title="Visible Villa",
            monthly_rent=Decimal("50000.00"),
            status=ListingStatus.PUBLISHED,
        )

        # Invalid/incomplete application request rejected
        self.client.force_authenticate(user=self.tenant)
        self.assertEqual(
            self.client.post(reverse("leasing:application-list"), {}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        app = submit_application(applicant=self.tenant, listing_id=pub_listing.id)

        # Other tenant cannot view or withdraw tenant's application
        self.client.force_authenticate(user=self.other_tenant)
        self.assertEqual(
            self.client.get(
                reverse("leasing:application-detail", kwargs={"pk": app.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(
                reverse("leasing:application-withdraw", kwargs={"pk": app.id}),
                {},
                format="json",
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

        # Other owner cannot access property, application, or create/view tenancy
        self.client.force_authenticate(user=self.other_owner)
        self.assertEqual(
            self.client.get(
                reverse("properties:property-detail", kwargs={"pk": prop.id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(
                reverse("leasing:tenancy-list"),
                {
                    "property_id": str(prop.id),
                    "tenant_id": str(self.tenant.id),
                    "start_date": "2027-05-01",
                    "monthly_rent": "50000.00",
                },
                format="json",
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        # Unauthenticated users cannot access protected files
        doc = upload_document(
            uploaded_by=self.owner_user,
            uploaded_file=self._pdf("secret.pdf"),
            document_type=DocumentType.PROPERTY_DOCUMENT,
            property_instance=prop,
        )
        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.get(
                reverse("documents:document-download", kwargs={"pk": doc.id})
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
