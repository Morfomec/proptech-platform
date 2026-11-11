
from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.models import BaseModel
from apps.leasing.models import Application, Tenancy
from apps.properties.models import Property




class DocumentType(models.TextChoices):
    RENTAL_AGREEMENT = "rental_agreement", "Rental Agreement"
    ID_PROOF = "id_proof", "ID Proof"
    INCOME_PROOF = "income_proof", "Income Proof"
    PROPERTY_DOCUMENT = "property_document", "Property Document"
    OTHER = "other", "Other"


class DocumentStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class Document(BaseModel):

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="uploaded_by",
        related_name="uploaded_documents",
    )

    property = models.ForeignKey(
        Property,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )

    application = models.ForeignKey(
        Application,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )

    tenancy = models.ForeignKey(
        Tenancy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )

    document_type = models.CharField(
        max_length=50,
        choices=DocumentType.choices,
    )

    title = models.CharField(max_length=255, blank=True, default="")
    file_url = models.CharField(max_length=1000)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.ACTIVE,
    )

    class Meta:
        db_table = "documents"

        ordering = ["-created_at"]

        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(file_size_bytes__isnull=True)
                    | Q(file_size_bytes__gt=0)
                ),
                name="chk_doc_file_size_positive",
            ),
            models.CheckConstraint(
                condition=(
                    Q(property__isnull=True, application__isnull=True)
                    | Q(property__isnull=True, tenancy__isnull=True)
                    | Q(application__isnull=True, tenancy__isnull=True)
                ),
                name="chk_doc_single_parent",
            ),
        ]

        indexes = [
            models.Index(
                fields=["uploaded_by", "created_at"],
                name="idx_doc_uploaded_created",
            ),
            models.Index(
                fields=["property", "document_type"],
                name="idx_doc_prop_type",
            ),
            models.Index(
                fields=["application", "document_type"],
                name="idx_doc_app_type",
            ),
            models.Index(
                fields=["tenancy", "document_type"],
                name="idx_doc_tenancy_type",
            ),
            models.Index(
                fields=["document_type", "status"],
                name="idx_doc_type_status",
            ),
        ]

    def __str__(self):
        return self.title or self.original_filename


