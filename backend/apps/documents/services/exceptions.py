
class DocumentServiceError(Exception):
    """Base exception for document service errors."""


class InvalidDocumentParentError(DocumentServiceError):
    """Raised when a document has more than one parent reference."""
