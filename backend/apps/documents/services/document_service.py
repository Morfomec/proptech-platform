import logging
import re
import uuid
from pathlib import Path

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from apps.core.validators import validate_image_file
from apps.documents.models import Document
from apps.documents.services.exceptions import (
    DocumentServiceError,
    InvalidDocumentParentError,
)
from apps.documents.storage import private_document_storage
from apps.notifications.models import NotificationType, RelatedObjectType
from apps.notifications.services import create_notification

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_FILENAME_LENGTH = 255
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

FILE_SIGNATURES = {
    ".pdf": (b"%PDF-", "application/pdf"),
    ".jpg": (b"\xff\xd8\xff", "image/jpeg"),
    ".jpeg": (b"\xff\xd8\xff", "image/jpeg"),
    ".png": (b"\x89PNG\r\n\x1a\n", "image/png"),
    ".webp": (b"RIFF", "image/webp"),
}


def validate_and_detect_document_file(uploaded_file) -> tuple[str, str]:
    """
    Validate filename, size, magic-byte signature, and image integrity.
    Returns (original_filename, detected_mime_type) derived strictly from content.
    """
    raw_name = getattr(uploaded_file, "name", "") or ""
    original_filename = Path(raw_name).name

    if not original_filename:
        raise DocumentServiceError("A valid filename is required.")

    if len(original_filename) > MAX_FILENAME_LENGTH:
        raise DocumentServiceError("Filename cannot exceed 255 characters.")

    extension = Path(original_filename).suffix.lower()
    if extension not in FILE_SIGNATURES:
        raise DocumentServiceError(
            "Only PDF, JPG, JPEG, PNG and WebP files are allowed."
        )

    file_size = getattr(uploaded_file, "size", None)
    if file_size is None or file_size <= 0:
        raise DocumentServiceError("The uploaded file is empty.")

    if file_size > MAX_FILE_SIZE_BYTES:
        raise DocumentServiceError("File size cannot exceed 10 MB.")

    uploaded_file.seek(0)
    signature = uploaded_file.read(12)
    uploaded_file.seek(0)

    expected_signature, detected_mime = FILE_SIGNATURES[extension]
    if not signature.startswith(expected_signature):
        raise DocumentServiceError(
            "The file content does not match its extension."
        )

    if extension == ".webp" and signature[8:12] != b"WEBP":
        raise DocumentServiceError(
            "The file content does not match its extension."
        )

    if extension in IMAGE_EXTENSIONS:
        try:
            validate_image_file(uploaded_file)
        except DjangoValidationError as exc:
            message = (
                exc.messages[0]
                if exc.messages
                else "Invalid or corrupted image file."
            )
            raise DocumentServiceError(message) from exc
        finally:
            uploaded_file.seek(0)

    return original_filename, detected_mime


def _validate_and_clean_title(title: str) -> str:
    cleaned_title = title.strip()
    if not cleaned_title:
        raise DocumentServiceError("Document name cannot be empty.")
    if len(cleaned_title) > MAX_FILENAME_LENGTH:
        raise DocumentServiceError("Document name cannot exceed 255 characters.")
    return cleaned_title


def _build_filename_from_title(cleaned_title: str, reference_filename: str) -> str:
    extension = Path(reference_filename).suffix.lower()
    safe_base = re.sub(r'[\\/:*?"<>|\r\n]+', "_", cleaned_title).strip(". ")
    if not safe_base:
        safe_base = "document"
    if extension and not safe_base.lower().endswith(extension):
        max_stem_len = max(1, MAX_FILENAME_LENGTH - len(extension))
        return f"{safe_base[:max_stem_len]}{extension}"
    return safe_base[:MAX_FILENAME_LENGTH]


@transaction.atomic
def upload_document(
    *,
    uploaded_by,
    uploaded_file,
    document_type,
    title=None,
    property_instance=None,
    application_instance=None,
    tenancy_instance=None,
):
    """
    Validate and store a document privately, then persist its metadata record.
    Cleans up stored file bytes if database persistence fails.
    """
    parents = [
        property_instance,
        application_instance,
        tenancy_instance,
    ]

    if sum(parent is not None for parent in parents) > 1:
        raise InvalidDocumentParentError(
            "A document can belong to only one parent."
        )

    original_filename, mime_type = validate_and_detect_document_file(
        uploaded_file
    )
    if title is not None:
        cleaned_title = _validate_and_clean_title(title)
    else:
        cleaned_title = (
            Path(original_filename).stem or original_filename
        )[:MAX_FILENAME_LENGTH]

    extension = Path(original_filename).suffix.lower()
    storage_path = f"documents/{uuid.uuid4().hex}{extension}"

    uploaded_file.seek(0)
    stored_key = private_document_storage.save(
        storage_path,
        uploaded_file,
    )

    try:
        document = Document.objects.create(
            uploaded_by=uploaded_by,
            property=property_instance,
            application=application_instance,
            tenancy=tenancy_instance,
            document_type=document_type,
            title=cleaned_title,
            file_url=stored_key,
            original_filename=original_filename,
            mime_type=mime_type,
            file_size_bytes=uploaded_file.size,
        )

        # Notify the relevant party after a document is uploaded.
        if application_instance is not None:
            # Application document: notify the property owner.
            create_notification(
                user=application_instance.listing.owner,
                notification_type=NotificationType.DOCUMENT_UPLOADED,
                title="New application document uploaded",
                message=(
                    f"A document ({document.original_filename}) "
                    "has been uploaded for an application."
                ),
                related_object_type=RelatedObjectType.DOCUMENT,
                related_object_id=document.id,
            )

        elif tenancy_instance is not None:
            # Tenancy document: notify the other party.
            recipient = None
            message = None

            if uploaded_by.id == tenancy_instance.property.owner_id:
                recipient = tenancy_instance.tenant
                message = (
                    f"The property owner uploaded a document "
                    f"({document.original_filename}) for your tenancy."
                )

            elif uploaded_by.id == tenancy_instance.tenant_id:
                recipient = tenancy_instance.property.owner
                message = (
                    f"The tenant uploaded a document "
                    f"({document.original_filename}) for their tenancy."
                )

            if recipient is not None:
                create_notification(
                    user=recipient,
                    notification_type=NotificationType.DOCUMENT_UPLOADED,
                    title="New tenancy document uploaded",
                    message=message,
                    related_object_type=RelatedObjectType.DOCUMENT,
                    related_object_id=document.id,
                )


    except Exception:
        try:
            private_document_storage.delete(stored_key)
        except Exception:
            logger.exception(
                "Failed to clean up uploaded document: %s",
                stored_key,
            )
        raise

    return document


@transaction.atomic
def update_document(
    *,
    document: Document,
    title=None,
    uploaded_file=None,
) -> Document:
    """
    Update a document's display name (`title`) and/or replace its attached file.
    Preserves parent associations and cleans up replaced files after commit.
    """
    if title is None and uploaded_file is None:
        raise DocumentServiceError(
            "Provide a document name or replacement file to update."
        )

    locked_document = Document.objects.select_for_update().get(pk=document.pk)
    previous_file_url = locked_document.file_url
    new_stored_key = None

    if uploaded_file is not None:
        original_filename, mime_type = validate_and_detect_document_file(
            uploaded_file
        )
        extension = Path(original_filename).suffix.lower()
        storage_path = f"documents/{uuid.uuid4().hex}{extension}"

        uploaded_file.seek(0)
        new_stored_key = private_document_storage.save(
            storage_path,
            uploaded_file,
        )
        locked_document.file_url = new_stored_key
        locked_document.original_filename = original_filename
        locked_document.mime_type = mime_type
        locked_document.file_size_bytes = uploaded_file.size

    if title is not None:
        cleaned_title = _validate_and_clean_title(title)
        locked_document.title = cleaned_title
        locked_document.original_filename = _build_filename_from_title(
            cleaned_title,
            locked_document.original_filename,
        )

    try:
        locked_document.full_clean()
        locked_document.save()
    except Exception:
        if new_stored_key:
            try:
                private_document_storage.delete(new_stored_key)
            except Exception:
                logger.exception(
                    "Failed to clean up replacement document: %s",
                    new_stored_key,
                )
        raise

    if new_stored_key and previous_file_url and previous_file_url != new_stored_key:
        def _cleanup_previous_file():
            try:
                private_document_storage.delete(previous_file_url)
            except Exception:
                logger.warning(
                    "Failed to delete replaced document file: %s",
                    previous_file_url,
                )

        transaction.on_commit(_cleanup_previous_file)

    return locked_document
