import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.test import TestCase
from django.utils import timezone

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


class DocumentModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="doc_owner@example.com",
            password="securepassword123",
            first_name="Olivia",
            last_name="Owner",
            is_active=True,
            is_tenant=False,
            is_owner=True,
        )
        self.tenant = User.objects.create_user(
            email="doc_tenant@example.com",
            password="securepassword123",
            first_name="Liam",
            last_name="Tenant",
            is_active=True,
            is_tenant=True,
        )
        self.property = self._create_property(self.owner, title="Skyline Loft")
        self.listing = Listing.objects.create(
            property=self.property,
            title="Skyline Loft Listing",
            monthly_rent=Decimal("30000.00"),
            security_deposit=Decimal("90000.00"),
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
            start_date=date(2026, 7, 1),
            end_date=date(2027, 6, 30),
            monthly_rent=Decimal("30000.00"),
            status=TenancyStatus.ACTIVE,
        )

    def _create_property(self, owner, *, title="Sample Property"):
        return Property.objects.create(
            owner=owner,
            title=title,
            category=PropertyCategory.RESIDENTIAL,
            property_type=PropertyType.APARTMENT,
            address_line_1="100 Residency Road",
            locality="MG Road",
            city="Bengaluru",
            district="Bengaluru Urban",
            state="Karnataka",
            pin_code="560001",
            latitude=Decimal("12.9715987"),
            longitude=Decimal("77.5945627"),
            bedrooms=2,
            bathrooms=Decimal("2.0"),
            status=PropertyStatus.AVAILABLE,
        )

    def _build_document_data(self, **overrides):
        data = {
            "uploaded_by": self.tenant,
            "document_type": DocumentType.ID_PROOF,
            "file_url": f"documents/{uuid.uuid4().hex}.pdf",
            "original_filename": "passport.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 204800,
        }
        data.update(overrides)
        return data

    # ============================================================
    # 1. Document Creation, Choices, Timestamps & String Repr
    # ============================================================
    def test_document_creation_uuid_defaults_and_timestamps(self):
        document = Document.objects.create(**self._build_document_data())

        self.assertIsInstance(document.id, uuid.UUID)
        self.assertEqual(document.uploaded_by, self.tenant)
        self.assertEqual(document.document_type, DocumentType.ID_PROOF)
        self.assertEqual(document.status, DocumentStatus.ACTIVE)
        self.assertEqual(document.original_filename, "passport.pdf")
        self.assertEqual(document.mime_type, "application/pdf")
        self.assertEqual(document.file_size_bytes, 204800)
        self.assertIsNone(document.property)
        self.assertIsNone(document.application)
        self.assertIsNone(document.tenancy)
        self.assertIsNotNone(document.created_at)
        self.assertIsNotNone(document.updated_at)
        self.assertIn(document, self.tenant.uploaded_documents.all())

        previous_updated_at = document.updated_at
        document.status = DocumentStatus.ARCHIVED
        document.save(update_fields=["status", "updated_at"])
        document.refresh_from_db()
        self.assertEqual(document.status, DocumentStatus.ARCHIVED)
        self.assertGreaterEqual(document.updated_at, previous_updated_at)

    def test_string_representation(self):
        document = Document.objects.create(
            **self._build_document_data(original_filename="lease_contract.pdf")
        )
        self.assertEqual(str(document), "lease_contract.pdf")

    def test_valid_document_type_and_status_choices(self):
        for doc_type in DocumentType.values:
            for doc_status in DocumentStatus.values:
                doc = Document(
                    **self._build_document_data(
                        document_type=doc_type,
                        status=doc_status,
                    )
                )
                doc.full_clean()

    # ============================================================
    # 2. Relationships & Deletion Behaviour (PROTECT / SET_NULL)
    # ============================================================
    def test_deleting_uploaded_by_user_is_protected(self):
        standalone_user = User.objects.create_user(
            email="doc_standalone@example.com",
            password="securepassword123",
            is_active=True,
        )
        Document.objects.create(
            **self._build_document_data(uploaded_by=standalone_user)
        )

        with self.assertRaises(ProtectedError):
            standalone_user.delete()

    def test_deleting_property_sets_document_property_to_null(self):
        untenanted_property = self._create_property(
            self.owner,
            title="Garden Villa",
        )
        document = Document.objects.create(
            **self._build_document_data(
                uploaded_by=self.owner,
                document_type=DocumentType.PROPERTY_DOCUMENT,
                property=untenanted_property,
            )
        )
        self.assertIn(document, untenanted_property.documents.all())

        untenanted_property.delete()
        document.refresh_from_db()

        self.assertIsNone(document.property)
        self.assertTrue(Document.objects.filter(pk=document.pk).exists())

    def test_deleting_application_sets_document_application_to_null(self):
        document = Document.objects.create(
            **self._build_document_data(
                uploaded_by=self.tenant,
                document_type=DocumentType.INCOME_PROOF,
                application=self.application,
            )
        )
        self.assertIn(document, self.application.documents.all())

        self.application.delete()
        document.refresh_from_db()

        self.assertIsNone(document.application)
        self.assertTrue(Document.objects.filter(pk=document.pk).exists())

    def test_deleting_tenancy_sets_document_tenancy_to_null(self):
        document = Document.objects.create(
            **self._build_document_data(
                uploaded_by=self.owner,
                document_type=DocumentType.RENTAL_AGREEMENT,
                tenancy=self.tenancy,
            )
        )
        self.assertIn(document, self.tenancy.documents.all())

        self.tenancy.delete()
        document.refresh_from_db()

        self.assertIsNone(document.tenancy)
        self.assertTrue(Document.objects.filter(pk=document.pk).exists())

    # ============================================================
    # 3. Database Constraints (chk_doc_file_size_positive & chk_doc_single_parent)
    # ============================================================
    def test_db_check_constraint_file_size_positive(self):
        for invalid_size in (0, -1, -1024):
            with self.assertRaises(IntegrityError):
                with transaction.atomic():
                    Document.objects.create(
                        **self._build_document_data(
                            file_size_bytes=invalid_size
                        )
                    )

        smallest_valid = Document.objects.create(
            **self._build_document_data(file_size_bytes=1)
        )
        nullable_size = Document.objects.create(
            **self._build_document_data(file_size_bytes=None)
        )
        self.assertEqual(smallest_valid.file_size_bytes, 1)
        self.assertIsNone(nullable_size.file_size_bytes)

    def test_db_check_constraint_single_parent_valid_cases(self):
        prop_doc = Document.objects.create(
            **self._build_document_data(
                uploaded_by=self.owner,
                document_type=DocumentType.PROPERTY_DOCUMENT,
                property=self.property,
            )
        )
        app_doc = Document.objects.create(
            **self._build_document_data(
                uploaded_by=self.tenant,
                document_type=DocumentType.INCOME_PROOF,
                application=self.application,
            )
        )
        tenancy_doc = Document.objects.create(
            **self._build_document_data(
                uploaded_by=self.owner,
                document_type=DocumentType.RENTAL_AGREEMENT,
                tenancy=self.tenancy,
            )
        )
        unattached_doc = Document.objects.create(
            **self._build_document_data(
                uploaded_by=self.tenant,
                document_type=DocumentType.OTHER,
            )
        )

        self.assertEqual(prop_doc.property, self.property)
        self.assertEqual(app_doc.application, self.application)
        self.assertEqual(tenancy_doc.tenancy, self.tenancy)
        self.assertIsNone(unattached_doc.property)
        self.assertIsNone(unattached_doc.application)
        self.assertIsNone(unattached_doc.tenancy)

    def test_db_check_constraint_rejects_multiple_parents(self):
        invalid_parent_combinations = [
            {"property": self.property, "application": self.application},
            {"property": self.property, "tenancy": self.tenancy},
            {"application": self.application, "tenancy": self.tenancy},
            {
                "property": self.property,
                "application": self.application,
                "tenancy": self.tenancy,
            },
        ]

        for parent_kwargs in invalid_parent_combinations:
            with self.assertRaises(IntegrityError):
                with transaction.atomic():
                    Document.objects.create(
                        **self._build_document_data(**parent_kwargs)
                    )

    # ============================================================
    # 4. Additional Model Validation (full_clean)
    # ============================================================
    def test_nullable_fields_permitted_through_full_clean(self):
        document = Document(
            **self._build_document_data(
                property=None,
                application=None,
                tenancy=None,
                mime_type=None,
                file_size_bytes=None,
            )
        )
        document.full_clean()
        document.save()
        document.refresh_from_db()

        self.assertIsNone(document.mime_type)
        self.assertIsNone(document.file_size_bytes)
        self.assertIsNone(document.property)
        self.assertIsNone(document.application)
        self.assertIsNone(document.tenancy)

    def test_required_fields_and_invalid_choices_rejected_by_full_clean(self):
        for required_field in (
            "uploaded_by",
            "document_type",
            "file_url",
            "original_filename",
        ):
            data = self._build_document_data()
            data.pop(required_field)
            doc = Document(**data)
            with self.assertRaises(ValidationError) as ctx:
                doc.full_clean()
            self.assertIn(required_field, ctx.exception.message_dict)

        invalid_type_doc = Document(
            **self._build_document_data(document_type="tax_certificate")
        )
        with self.assertRaises(ValidationError) as ctx:
            invalid_type_doc.full_clean()
        self.assertIn("document_type", ctx.exception.message_dict)

        invalid_status_doc = Document(
            **self._build_document_data(status="deleted")
        )
        with self.assertRaises(ValidationError) as ctx:
            invalid_status_doc.full_clean()
        self.assertIn("status", ctx.exception.message_dict)

    def test_default_ordering_is_newest_first(self):
        oldest = Document.objects.create(
            **self._build_document_data(original_filename="oldest.pdf")
        )
        newest = Document.objects.create(
            **self._build_document_data(original_filename="newest.pdf")
        )
        now = timezone.now()
        Document.objects.filter(pk=oldest.pk).update(
            created_at=now - timedelta(minutes=10)
        )
        Document.objects.filter(pk=newest.pk).update(created_at=now)

        ordered_ids = list(
            Document.objects.filter(uploaded_by=self.tenant).values_list(
                "id", flat=True
            )
        )
        self.assertEqual(ordered_ids, [newest.id, oldest.id])

