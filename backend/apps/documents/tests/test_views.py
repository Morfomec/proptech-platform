import io
import tempfile
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.documents.models import Document, DocumentStatus, DocumentType
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
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class DocumentAPITests(APITestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.test_storage = FileSystemStorage(
            location=self.temp_dir.name,
            base_url=None,
        )
        self.svc_storage_patcher = patch(
            "apps.documents.services.document_service.private_document_storage",
            self.test_storage,
        )
        self.view_storage_patcher = patch(
            "apps.documents.views.document.private_document_storage",
            self.test_storage,
        )
        self.svc_storage_patcher.start()
        self.view_storage_patcher.start()
        self.addCleanup(self.svc_storage_patcher.stop)
        self.addCleanup(self.view_storage_patcher.stop)

        self.owner = User.objects.create_user(
            email="doc_api_owner@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = User.objects.create_user(
            email="doc_api_tenant@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=True,
        )
        self.outsider = User.objects.create_user(
            email="doc_api_outsider@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=True,
        )
        self.admin = User.objects.create_superuser(
            email="doc_api_admin@example.com",
            password="securepassword123",
        )

        self.property = Property.objects.create(
            owner=self.owner,
            title="Lotus Suites",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="22 Lotus Street",
            locality="Jayanagar",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560011",
            latitude=Decimal("12.9298921"),
            longitude=Decimal("77.5838044"),
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )
        self.listing = Listing.objects.create(
            property=self.property,
            title="Lotus Suites Rental",
            monthly_rent=Decimal("27000.00"),
            status=ListingStatus.PUBLISHED,
        )
        self.application = Application.objects.create(
            listing=self.listing,
            applicant=self.tenant,
            status=ApplicationStatus.APPROVED,
        )
        self.tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.tenant,
            application=self.application,
            start_date=date(2026, 10, 1),
            end_date=date(2027, 9, 30),
            monthly_rent=Decimal("27000.00"),
            status=TenancyStatus.ACTIVE,
        )

    def _pdf_upload(self, name="contract.pdf"):
        return SimpleUploadedFile(
            name,
            b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF",
            content_type="text/plain",
        )

    def _png_upload(self, name="id_front.png"):
        buf = io.BytesIO()
        Image.new("RGB", (20, 20), color="navy").save(buf, format="PNG")
        buf.seek(0)
        return SimpleUploadedFile(name, buf.read(), content_type="image/png")

    def test_unauthenticated_requests_rejected_with_401(self):
        doc_id = "00000000-0000-0000-0000-000000000000"
        self.assertEqual(
            self.client.get(reverse("documents:document-list")).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.post(reverse("documents:document-list"), {}).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.get(
                reverse("documents:document-detail", kwargs={"pk": doc_id})
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.get(
                reverse("documents:document-download", kwargs={"pk": doc_id})
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_upload_list_retrieve_and_download_flow(self):
        # Tenant uploads application document -> 201, file_url omitted, MIME from content.
        self.client.force_authenticate(user=self.tenant)
        upload_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("salary_slip.pdf"),
                "document_type": DocumentType.INCOME_PROOF,
                "application_id": str(self.application.id),
            },
            format="multipart",
        )
        self.assertEqual(upload_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(upload_res.data["success"])
        doc_data = upload_res.data["data"]
        self.assertNotIn("file_url", doc_data)
        self.assertEqual(doc_data["mime_type"], "application/pdf")
        self.assertEqual(doc_data["original_filename"], "salary_slip.pdf")
        doc_id = doc_data["id"]

        # Tenant sees own document in list.
        list_res = self.client.get(reverse("documents:document-list"))
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data["count"], 1)

        # Owner can retrieve and download the applicant's document.
        self.client.force_authenticate(user=self.owner)
        det_res = self.client.get(
            reverse("documents:document-detail", kwargs={"pk": doc_id})
        )
        self.assertEqual(det_res.status_code, status.HTTP_200_OK)
        self.assertTrue(det_res.data["success"])

        dl_res = self.client.get(
            reverse("documents:document-download", kwargs={"pk": doc_id})
        )
        self.assertEqual(dl_res.status_code, status.HTTP_200_OK)
        self.assertEqual(dl_res["Content-Type"], "application/pdf")
        self.assertIn("attachment", dl_res["Content-Disposition"])
        body = b"".join(dl_res.streaming_content)
        self.assertTrue(body.startswith(b"%PDF-1.4"))

        # Outsider receives 404 on both retrieve and download (no existence leak).
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(
            self.client.get(
                reverse("documents:document-detail", kwargs={"pk": doc_id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(
                reverse("documents:document-download", kwargs={"pk": doc_id})
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_upload_validation_errors_and_unauthorized_parents(self):
        self.client.force_authenticate(user=self.tenant)

        # Corrupted image rejected (400).
        bad_img = SimpleUploadedFile(
            "bad.png",
            b"\x89PNG\r\n\x1a\ncorrupt-body",
            content_type="image/png",
        )
        res_bad = self.client.post(
            reverse("documents:document-list"),
            {"file": bad_img, "document_type": DocumentType.ID_PROOF},
            format="multipart",
        )
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res_bad.data["success"])

        # Multiple parents rejected (400).
        res_multi = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._png_upload(),
                "document_type": DocumentType.OTHER,
                "property_id": str(self.property.id),
                "tenancy_id": str(self.tenancy.id),
            },
            format="multipart",
        )
        self.assertEqual(res_multi.status_code, status.HTTP_400_BAD_REQUEST)

        # Tenant cannot upload to owner's property -> 403.
        res_forbidden = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._png_upload(),
                "document_type": DocumentType.PROPERTY_DOCUMENT,
                "property_id": str(self.property.id),
            },
            format="multipart",
        )
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_platform_admin_read_only_and_archived_document_policy(self):
        # Upload an unattached document as tenant.
        self.client.force_authenticate(user=self.tenant)
        res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._png_upload("personal.png"),
                "document_type": DocumentType.ID_PROOF,
            },
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        doc_id = res.data["data"]["id"]

        # Platform admin cannot upload -> 403.
        self.client.force_authenticate(user=self.admin)
        admin_upload = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("admin.pdf"),
                "document_type": DocumentType.OTHER,
            },
            format="multipart",
        )
        self.assertEqual(admin_upload.status_code, status.HTTP_403_FORBIDDEN)

        # Platform admin can list, retrieve, and download.
        admin_list = self.client.get(reverse("documents:document-list"))
        self.assertEqual(admin_list.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_list.data["count"], 1)

        admin_dl = self.client.get(
            reverse("documents:document-download", kwargs={"pk": doc_id})
        )
        self.assertEqual(admin_dl.status_code, status.HTTP_200_OK)
        self.assertTrue(b"".join(admin_dl.streaming_content).startswith(b"\x89PNG"))

        # Archive the document -> hidden from list, still retrievable & downloadable by tenant and admin.
        Document.objects.filter(pk=doc_id).update(status=DocumentStatus.ARCHIVED)

        self.client.force_authenticate(user=self.tenant)
        self.assertEqual(
            self.client.get(reverse("documents:document-list")).data["count"],
            0,
        )
        self.assertEqual(
            self.client.get(
                reverse("documents:document-detail", kwargs={"pk": doc_id})
            ).status_code,
            status.HTTP_200_OK,
        )
        archived_dl = self.client.get(
            reverse("documents:document-download", kwargs={"pk": doc_id})
        )
        self.assertEqual(archived_dl.status_code, status.HTTP_200_OK)
        self.assertTrue(b"".join(archived_dl.streaming_content).startswith(b"\x89PNG"))

    def test_download_missing_physical_file_returns_standard_404(self):
        self.client.force_authenticate(user=self.tenant)
        res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("missing.pdf"),
                "document_type": DocumentType.OTHER,
            },
            format="multipart",
        )
        doc_id = res.data["data"]["id"]
        doc = Document.objects.get(pk=doc_id)
        self.test_storage.delete(doc.file_url)

        dl_res = self.client.get(
            reverse("documents:document-download", kwargs={"pk": doc_id})
        )
        self.assertEqual(dl_res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(dl_res.data["success"])

    def test_personal_document_title_persists_and_blank_title_rejected(self):
        self.client.force_authenticate(user=self.tenant)

        upload_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("scan_2026.pdf"),
                "document_type": DocumentType.OTHER,
                "title": "Aadhaar Card",
            },
            format="multipart",
        )
        self.assertEqual(upload_res.status_code, status.HTTP_201_CREATED)
        doc_data = upload_res.data["data"]
        self.assertEqual(doc_data["title"], "Aadhaar Card")
        self.assertEqual(doc_data["original_filename"], "scan_2026.pdf")
        self.assertEqual(doc_data["document_type"], DocumentType.OTHER)
        self.assertIsNone(doc_data["application"])
        self.assertIsNone(doc_data["tenancy"])
        self.assertIsNone(doc_data["property"])

        list_res = self.client.get(reverse("documents:document-list"))
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data["results"][0]["title"], "Aadhaar Card")

        dl_res = self.client.get(
            reverse("documents:document-download", kwargs={"pk": doc_data["id"]})
        )
        self.assertEqual(dl_res.status_code, status.HTTP_200_OK)
        self.assertIn('filename="scan_2026.pdf"', dl_res["Content-Disposition"])
        b"".join(dl_res.streaming_content)

        blank_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("blank_title.pdf"),
                "document_type": DocumentType.OTHER,
                "title": "   ",
            },
            format="multipart",
        )
        self.assertEqual(blank_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_uploader_can_edit_document_title_and_replace_file_with_permissions(self):
        self.client.force_authenticate(user=self.tenant)
        create_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("initial_id.pdf"),
                "document_type": DocumentType.OTHER,
                "title": "Old ID Name",
                "application_id": str(self.application.id),
            },
            format="multipart",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        doc_id = create_res.data["data"]["id"]
        initial_doc = Document.objects.get(pk=doc_id)
        old_key = initial_doc.file_url

        detail_url = reverse("documents:document-detail", kwargs={"pk": doc_id})

        # 1. Empty PATCH -> 400
        empty_res = self.client.patch(detail_url, {}, format="json")
        self.assertEqual(empty_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Blank title -> 400
        blank_res = self.client.patch(detail_url, {"title": "   "}, format="json")
        self.assertEqual(blank_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Uploader renames document via JSON PATCH -> 200
        rename_res = self.client.patch(
            detail_url,
            {"title": "  Aadhaar Card Updated  "},
            format="json",
        )
        self.assertEqual(rename_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rename_res.data["data"]["title"], "Aadhaar Card Updated")
        self.assertEqual(rename_res.data["data"]["original_filename"], "Aadhaar Card Updated.pdf")

        # 4. Property owner (application recipient) and admin cannot modify tenant's upload -> 403
        self.client.force_authenticate(user=self.owner)
        owner_patch = self.client.patch(detail_url, {"title": "Hijack"}, format="json")
        self.assertEqual(owner_patch.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        admin_patch = self.client.patch(detail_url, {"title": "Admin Edit"}, format="json")
        self.assertEqual(admin_patch.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Outsider cannot see or modify -> 404
        self.client.force_authenticate(user=self.outsider)
        outsider_patch = self.client.patch(detail_url, {"title": "Outsider Edit"}, format="json")
        self.assertEqual(outsider_patch.status_code, status.HTTP_404_NOT_FOUND)

        # 6. Uploader replaces file and name via multipart PATCH -> 200 & old file cleaned up on commit
        self.client.force_authenticate(user=self.tenant)
        with self.captureOnCommitCallbacks(execute=True):
            replace_res = self.client.patch(
                detail_url,
                {
                    "title": "Aadhaar Front Scan",
                    "file": self._png_upload("aadhaar_front.png"),
                },
                format="multipart",
            )
        self.assertEqual(replace_res.status_code, status.HTTP_200_OK)
        self.assertEqual(replace_res.data["data"]["title"], "Aadhaar Front Scan")
        self.assertEqual(replace_res.data["data"]["original_filename"], "Aadhaar Front Scan.png")
        self.assertEqual(replace_res.data["data"]["mime_type"], "image/png")

        initial_doc.refresh_from_db()
        self.assertNotEqual(initial_doc.file_url, old_key)
        self.assertFalse(self.test_storage.exists(old_key))
        self.assertTrue(self.test_storage.exists(initial_doc.file_url))

    def test_owner_document_scopes_permissions_and_filters(self):
        # Other owner cannot upload against self.owner's property or tenancy -> 403
        other_owner = User.objects.create_user(
            email="doc_api_other_owner@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=False,
            is_owner=True,
        )
        self.client.force_authenticate(user=other_owner)
        forbidden_prop = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("deed.pdf"),
                "document_type": DocumentType.PROPERTY_DOCUMENT,
                "title": "Title Deed",
                "property_id": str(self.property.id),
            },
            format="multipart",
        )
        self.assertEqual(forbidden_prop.status_code, status.HTTP_403_FORBIDDEN)

        # Owner uploads property document -> 201
        self.client.force_authenticate(user=self.owner)
        prop_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("tax.pdf"),
                "document_type": DocumentType.PROPERTY_DOCUMENT,
                "title": "Property Tax Receipt",
                "property_id": str(self.property.id),
            },
            format="multipart",
        )
        self.assertEqual(prop_res.status_code, status.HTTP_201_CREATED)
        prop_doc_id = prop_res.data["data"]["id"]
        self.assertEqual(prop_res.data["data"]["uploaded_by_name"], self.owner.email)

        # Owner uploads tenancy document -> 201
        tenancy_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("lease.pdf"),
                "document_type": DocumentType.RENTAL_AGREEMENT,
                "title": "Signed Lease",
                "tenancy_id": str(self.tenancy.id),
            },
            format="multipart",
        )
        self.assertEqual(tenancy_res.status_code, status.HTTP_201_CREATED)
        tenancy_doc_id = tenancy_res.data["data"]["id"]

        # Owner uploads personal document -> 201
        personal_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("owner_id.pdf"),
                "document_type": DocumentType.OTHER,
                "title": "Owner PAN",
            },
            format="multipart",
        )
        self.assertEqual(personal_res.status_code, status.HTTP_201_CREATED)
        personal_doc_id = personal_res.data["data"]["id"]

        # Owner cannot upload directly to tenant's application -> 403
        app_forbidden = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("app.pdf"),
                "document_type": DocumentType.ID_PROOF,
                "application_id": str(self.application.id),
            },
            format="multipart",
        )
        self.assertEqual(app_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # Tenant uploads application doc so owner has all 4 scopes
        self.client.force_authenticate(user=self.tenant)
        app_res = self.client.post(
            reverse("documents:document-list"),
            {
                "file": self._pdf_upload("salary.pdf"),
                "document_type": DocumentType.INCOME_PROOF,
                "title": "Payslip",
                "application_id": str(self.application.id),
            },
            format="multipart",
        )
        self.assertEqual(app_res.status_code, status.HTTP_201_CREATED)
        app_doc_id = app_res.data["data"]["id"]

        # Tenant sees tenancy & application docs only (NEVER owner's property or personal docs)
        tenant_docs = self.client.get(reverse("documents:document-list")).data["results"]
        tenant_ids = {d["id"] for d in tenant_docs}
        self.assertIn(tenancy_doc_id, tenant_ids)
        self.assertIn(app_doc_id, tenant_ids)
        self.assertNotIn(prop_doc_id, tenant_ids)
        self.assertNotIn(personal_doc_id, tenant_ids)

        # Owner ?scope= filters work accurately
        self.client.force_authenticate(user=self.owner)
        for scope_val, expected_id in (
            ("property", prop_doc_id),
            ("tenancy", tenancy_doc_id),
            ("application", app_doc_id),
            ("personal", personal_doc_id),
        ):
            scoped = self.client.get(reverse("documents:document-list"), {"scope": scope_val})
            self.assertEqual(scoped.status_code, status.HTTP_200_OK)
            self.assertEqual(scoped.data["count"], 1)
            self.assertEqual(scoped.data["results"][0]["id"], expected_id)

        # Invalid scope or invalid UUID filter returns 400
        self.assertEqual(
            self.client.get(reverse("documents:document-list"), {"scope": "bad"}).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.get(reverse("documents:document-list"), {"property_id": "not-uuid"}).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        # Other owner sees 0 documents
        self.client.force_authenticate(user=other_owner)
        self.assertEqual(
            self.client.get(reverse("documents:document-list")).data["count"],
            0,
        )

