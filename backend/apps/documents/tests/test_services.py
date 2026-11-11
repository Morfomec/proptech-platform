import io
import os
import tempfile
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image

from apps.documents.models import Document, DocumentType
from apps.documents.storage import private_document_storage
from apps.documents.services import (
    DocumentServiceError,
    InvalidDocumentParentError,
    can_access_document,
    can_upload_document,
    get_accessible_documents,
    upload_document,
    validate_and_detect_document_file,
)
from apps.leasing.models import (
    Application,
    ApplicationStatus,
    Tenancy,
    TenancyStatus,
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
    PropertyStatus,
    PropertyType,
)

User = get_user_model()


class DocumentServiceTests(TestCase):
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
            email="doc_svc_owner@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=False,
            is_owner=True,
        )
        self.applicant = User.objects.create_user(
            email="doc_svc_tenant@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=True,
        )
        self.other_user = User.objects.create_user(
            email="doc_svc_other@example.com",
            password="securepassword123",
            is_active=True,
            is_tenant=True,
        )
        self.admin = User.objects.create_superuser(
            email="doc_svc_admin@example.com",
            password="securepassword123",
        )
        self.property = Property.objects.create(
            owner=self.owner,
            title="Riverfront Residency",
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="18 River Road",
            locality="Ulsoor",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560008",
            latitude=Decimal("12.9817134"),
            longitude=Decimal("77.6284967"),
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )
        self.listing = Listing.objects.create(
            property=self.property,
            title="Riverfront Listing",
            monthly_rent=Decimal("32000.00"),
            status=ListingStatus.PUBLISHED,
        )
        self.application = Application.objects.create(
            listing=self.listing,
            applicant=self.applicant,
            status=ApplicationStatus.APPROVED,
        )
        self.tenancy = Tenancy.objects.create(
            property=self.property,
            tenant=self.applicant,
            application=self.application,
            start_date=date(2026, 8, 1),
            end_date=date(2027, 7, 31),
            monthly_rent=Decimal("32000.00"),
            status=TenancyStatus.ACTIVE,
        )

    def _make_pdf_file(
        self,
        name="agreement.pdf",
        content=b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF",
        content_type="application/pdf",
    ):
        return SimpleUploadedFile(name, content, content_type=content_type)

    def _make_image_file(self, image_format="JPEG", name="id_card.jpg"):
        buf = io.BytesIO()
        Image.new("RGB", (24, 24), color="teal").save(buf, format=image_format)
        buf.seek(0)
        return SimpleUploadedFile(
            name,
            buf.read(),
            content_type="application/octet-stream",
        )

    # ============================================================
    # 1. File Validation & MIME Detection
    # ============================================================
    def test_valid_pdf_jpg_png_and_webp_detected_from_content(self):
        cases = [
            (
                self._make_pdf_file(content_type="text/html"),
                "application/pdf",
                ".pdf",
            ),
            (
                self._make_image_file("JPEG", "photo.jpg"),
                "image/jpeg",
                ".jpg",
            ),
            (
                self._make_image_file("PNG", "scan.png"),
                "image/png",
                ".png",
            ),
            (
                self._make_image_file("WEBP", "receipt.webp"),
                "image/webp",
                ".webp",
            ),
        ]

        for uploaded_file, expected_mime, expected_ext in cases:
            doc = upload_document(
                uploaded_by=self.applicant,
                uploaded_file=uploaded_file,
                document_type=DocumentType.ID_PROOF,
            )
            self.assertEqual(doc.mime_type, expected_mime)
            self.assertTrue(doc.file_url.startswith("documents/"))
            self.assertTrue(doc.file_url.endswith(expected_ext))
            self.assertTrue(self.test_storage.exists(doc.file_url))

    def test_rejects_invalid_empty_oversized_corrupted_and_long_filenames(self):
        # Unsupported extension
        with self.assertRaises(DocumentServiceError):
            validate_and_detect_document_file(
                SimpleUploadedFile("script.exe", b"MZ...", content_type="application/octet-stream")
            )

        # Empty file
        with self.assertRaises(DocumentServiceError):
            validate_and_detect_document_file(
                SimpleUploadedFile("empty.pdf", b"", content_type="application/pdf")
            )

        # Oversized (> 10 MB)
        oversized = SimpleUploadedFile(
            "huge.pdf",
            b"%PDF-" + b"a" * (10 * 1024 * 1024),
            content_type="application/pdf",
        )
        with self.assertRaises(DocumentServiceError):
            validate_and_detect_document_file(oversized)

        # Extension/signature mismatch
        with self.assertRaises(DocumentServiceError):
            validate_and_detect_document_file(
                SimpleUploadedFile("spoof.pdf", b"<html>nope</html>", content_type="application/pdf")
            )

        # Valid JPEG magic header but corrupted image body -> caught by Pillow in service
        with self.assertRaises(DocumentServiceError):
            validate_and_detect_document_file(
                SimpleUploadedFile(
                    "broken.jpg",
                    b"\xff\xd8\xff\xe0not-a-valid-jpeg-stream",
                    content_type="image/jpeg",
                )
            )

        # Filename > 255 chars (bypass UploadedFile._set_name 255-char truncation)
        long_name = ("a" * 252) + ".pdf"
        raw_pdf = io.BytesIO(b"%PDF-1.4\n%%EOF")
        raw_pdf.name = long_name
        raw_pdf.size = len(raw_pdf.getvalue())
        with self.assertRaises(DocumentServiceError):
            validate_and_detect_document_file(raw_pdf)

    # ============================================================
    # 2. Private Storage & Cleanup Behaviour
    # ============================================================
    def test_private_storage_outside_media_root(self):
        self.assertNotEqual(
            os.path.abspath(settings.PRIVATE_MEDIA_ROOT),
            os.path.abspath(settings.MEDIA_ROOT),
        )
        self.assertEqual(
            os.path.abspath(private_document_storage.location),
            os.path.abspath(settings.PRIVATE_MEDIA_ROOT),
        )

    def test_database_failure_deletes_stored_file(self):
        pdf = self._make_pdf_file()
        with patch.object(
            Document.objects,
            "create",
            side_effect=RuntimeError("Simulated DB failure"),
        ):
            with self.assertRaises(RuntimeError):
                upload_document(
                    uploaded_by=self.applicant,
                    uploaded_file=pdf,
                    document_type=DocumentType.ID_PROOF,
                )

        # Temporary private storage directory should have zero leftover files.
        _, files = self.test_storage.listdir("documents")
        self.assertEqual(files, [])

    def test_cleanup_exception_does_not_mask_original_db_exception(self):
        pdf = self._make_pdf_file()
        with patch.object(
            Document.objects,
            "create",
            side_effect=RuntimeError("Original DB exception"),
        ), patch.object(
            self.test_storage,
            "delete",
            side_effect=OSError("Storage delete failure"),
        ):
            with self.assertRaisesMessage(RuntimeError, "Original DB exception"):
                upload_document(
                    uploaded_by=self.applicant,
                    uploaded_file=pdf,
                    document_type=DocumentType.ID_PROOF,
                )

    # ============================================================
    # 3. Parent Validation & Notification Integration
    # ============================================================
    def test_rejects_multiple_parents(self):
        with self.assertRaises(InvalidDocumentParentError):
            upload_document(
                uploaded_by=self.owner,
                uploaded_file=self._make_pdf_file(),
                document_type=DocumentType.OTHER,
                property_instance=self.property,
                application_instance=self.application,
            )

    def test_notifications_by_parent_and_rollback_with_storage_cleanup(self):
        # 1. Application document -> notifies listing owner
        app_doc = upload_document(
            uploaded_by=self.applicant,
            uploaded_file=self._make_pdf_file("income.pdf"),
            document_type=DocumentType.INCOME_PROOF,
            application_instance=self.application,
        )
        app_notif = Notification.objects.get(
            user=self.owner,
            related_object_id=app_doc.id,
        )
        self.assertEqual(
            app_notif.notification_type,
            NotificationType.DOCUMENT_UPLOADED,
        )
        self.assertEqual(
            app_notif.related_object_type,
            RelatedObjectType.DOCUMENT,
        )

        # 2. Tenancy document by owner -> notifies tenant
        tenancy_doc_owner = upload_document(
            uploaded_by=self.owner,
            uploaded_file=self._make_pdf_file("lease.pdf"),
            document_type=DocumentType.RENTAL_AGREEMENT,
            tenancy_instance=self.tenancy,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.applicant,
                notification_type=NotificationType.DOCUMENT_UPLOADED,
                related_object_id=tenancy_doc_owner.id,
            ).exists()
        )

        # 3. Tenancy document by tenant -> notifies property owner
        tenancy_doc_tenant = upload_document(
            uploaded_by=self.applicant,
            uploaded_file=self._make_pdf_file("receipt.pdf"),
            document_type=DocumentType.OTHER,
            tenancy_instance=self.tenancy,
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.owner,
                notification_type=NotificationType.DOCUMENT_UPLOADED,
                related_object_id=tenancy_doc_tenant.id,
            ).exists()
        )

        # 4. Property-only & unattached -> zero new notifications
        notif_count_before = Notification.objects.count()
        upload_document(
            uploaded_by=self.owner,
            uploaded_file=self._make_pdf_file("deed.pdf"),
            document_type=DocumentType.PROPERTY_DOCUMENT,
            property_instance=self.property,
        )
        upload_document(
            uploaded_by=self.applicant,
            uploaded_file=self._make_pdf_file("personal.pdf"),
            document_type=DocumentType.OTHER,
        )
        self.assertEqual(Notification.objects.count(), notif_count_before)

        # 5. Notification failure rolls back Document and deletes stored file.
        files_before = set(self.test_storage.listdir("documents")[1])
        docs_before = Document.objects.count()
        with patch(
            "apps.documents.services.document_service.create_notification",
            side_effect=RuntimeError("Notification error"),
        ):
            with self.assertRaises(RuntimeError):
                upload_document(
                    uploaded_by=self.applicant,
                    uploaded_file=self._make_pdf_file("rollback.pdf"),
                    document_type=DocumentType.INCOME_PROOF,
                    application_instance=self.application,
                )

        self.assertEqual(Document.objects.count(), docs_before)
        self.assertEqual(set(self.test_storage.listdir("documents")[1]), files_before)

    # ============================================================
    # 4. Access Control Service Rules
    # ============================================================
    def test_upload_and_access_permissions_across_roles(self):
        anon = AnonymousUser()
        self.assertFalse(can_upload_document(anon))
        self.assertFalse(
            can_upload_document(self.admin, property_instance=self.property)
        )
        self.assertTrue(
            can_upload_document(self.owner, property_instance=self.property)
        )
        self.assertFalse(
            can_upload_document(self.applicant, property_instance=self.property)
        )
        self.assertTrue(
            can_upload_document(
                self.applicant,
                application_instance=self.application,
            )
        )
        self.assertFalse(
            can_upload_document(
                self.owner,
                application_instance=self.application,
            )
        )
        self.assertTrue(
            can_upload_document(self.owner, tenancy_instance=self.tenancy)
        )
        self.assertTrue(
            can_upload_document(self.applicant, tenancy_instance=self.tenancy)
        )
        self.assertFalse(
            can_upload_document(self.other_user, tenancy_instance=self.tenancy)
        )

        prop_doc = upload_document(
            uploaded_by=self.owner,
            uploaded_file=self._make_pdf_file("p.pdf"),
            document_type=DocumentType.PROPERTY_DOCUMENT,
            property_instance=self.property,
        )
        app_doc = upload_document(
            uploaded_by=self.applicant,
            uploaded_file=self._make_pdf_file("a.pdf"),
            document_type=DocumentType.INCOME_PROOF,
            application_instance=self.application,
        )
        ten_doc = upload_document(
            uploaded_by=self.owner,
            uploaded_file=self._make_pdf_file("t.pdf"),
            document_type=DocumentType.RENTAL_AGREEMENT,
            tenancy_instance=self.tenancy,
        )
        unattached_doc = upload_document(
            uploaded_by=self.applicant,
            uploaded_file=self._make_pdf_file("u.pdf"),
            document_type=DocumentType.OTHER,
        )

        self.assertFalse(can_access_document(anon, prop_doc))
        self.assertTrue(can_access_document(self.admin, prop_doc))
        self.assertTrue(can_access_document(self.admin, unattached_doc))
        self.assertFalse(can_access_document(self.applicant, prop_doc))
        self.assertTrue(can_access_document(self.owner, app_doc))
        self.assertTrue(can_access_document(self.applicant, app_doc))
        self.assertFalse(can_access_document(self.other_user, ten_doc))
        self.assertFalse(can_access_document(self.owner, unattached_doc))

        self.assertEqual(
            Document.objects.filter(get_accessible_documents(anon)).count(),
            0,
        )
        self.assertEqual(
            set(
                Document.objects.filter(
                    get_accessible_documents(self.admin)
                ).values_list("id", flat=True)
            ),
            {prop_doc.id, app_doc.id, ten_doc.id, unattached_doc.id},
        )
        self.assertEqual(
            set(
                Document.objects.filter(
                    get_accessible_documents(self.applicant)
                ).values_list("id", flat=True)
            ),
            {app_doc.id, ten_doc.id, unattached_doc.id},
        )
        self.assertEqual(
            Document.objects.filter(
                get_accessible_documents(self.other_user)
            ).count(),
            0,
        )

    def test_upload_document_persists_and_validates_title(self):
        doc = upload_document(
            uploaded_by=self.applicant,
            uploaded_file=self._make_pdf_file("aadhaar_scan_01.pdf"),
            document_type=DocumentType.OTHER,
            title="  Aadhaar Card  ",
        )
        self.assertEqual(doc.title, "Aadhaar Card")
        self.assertEqual(doc.original_filename, "aadhaar_scan_01.pdf")

        defaulted = upload_document(
            uploaded_by=self.applicant,
            uploaded_file=self._make_pdf_file("salary_slip_jan.pdf"),
            document_type=DocumentType.OTHER,
        )
        self.assertEqual(defaulted.title, "salary_slip_jan")
        self.assertEqual(defaulted.original_filename, "salary_slip_jan.pdf")

        with self.assertRaises(DocumentServiceError):
            upload_document(
                uploaded_by=self.applicant,
                uploaded_file=self._make_pdf_file("blank.pdf"),
                document_type=DocumentType.OTHER,
                title="   ",
            )
