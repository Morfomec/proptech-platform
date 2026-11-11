import uuid

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.core.schemas import (
    ApiErrorResponseSerializer,
    success_envelope,
)
from apps.documents.models import Document, DocumentStatus
from apps.documents.serializers import (
    DocumentSerializer,
    DocumentUpdateSerializer,
    DocumentUploadSerializer,
)
from apps.documents.services import (
    DocumentServiceError,
    InvalidDocumentParentError,
    can_access_document,
    can_modify_document,
    can_upload_document,
    get_accessible_documents,
    update_document,
    upload_document,
)
from apps.documents.storage import private_document_storage
from apps.leasing.models import Application, Tenancy
from apps.properties.models import Property


@extend_schema_view(
    list=extend_schema(
        tags=["Documents"],
        summary="List accessible documents",
        description="Returns active documents accessible to the authenticated user.",
        parameters=[
            OpenApiParameter(
                name="scope",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=["all", "property", "application", "tenancy", "personal"],
                description="Filter documents by attachment scope.",
            ),
            OpenApiParameter(
                name="property_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter accessible documents attached to a specific property.",
            ),
            OpenApiParameter(
                name="application_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter accessible documents attached to a specific application.",
            ),
            OpenApiParameter(
                name="tenancy_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter accessible documents attached to a specific tenancy.",
            ),
        ],
        responses={
            200: DocumentSerializer(many=True),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
        },
    ),
    retrieve=extend_schema(
        tags=["Documents"],
        summary="Retrieve a document",
        responses={
            200: success_envelope("DocumentDetailResponse", DocumentSerializer),
            401: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
    create=extend_schema(
        tags=["Documents"],
        summary="Upload a document",
        request=DocumentUploadSerializer,
        responses={
            201: success_envelope("DocumentUploadResponse", DocumentSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
    partial_update=extend_schema(
        tags=["Documents"],
        summary="Edit a document name or replace its file",
        request=DocumentUpdateSerializer,
        responses={
            200: success_envelope("DocumentUpdateResponse", DocumentSerializer),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
)
class DocumentViewSet(GenericViewSet):
    queryset = Document.objects.all()
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "patch", "head", "options"]
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_queryset(self):
        if (
            getattr(self, "swagger_fake_view", False)
            or not self.request.user.is_authenticated
        ):
            return Document.objects.none()

        return (
            Document.objects
            .filter(get_accessible_documents(self.request.user))
            .select_related(
                "uploaded_by",
                "property",
                "application__listing__property",
                "tenancy__property",
            )
            .distinct()
        )

    def get_serializer_class(self):
        if self.action == "create":
            return DocumentUploadSerializer
        if self.action == "partial_update":
            return DocumentUpdateSerializer

        return DocumentSerializer

    def _translate_service_exception(self, exc):
        if isinstance(
            exc,
            (
                InvalidDocumentParentError,
                DocumentServiceError,
                DjangoValidationError,
            ),
        ):
            detail = (
                exc.message_dict
                if hasattr(exc, "message_dict")
                else str(exc)
            )
            raise ValidationError(detail)

        raise exc

    def list(self, request):
        documents = self.get_queryset().filter(status=DocumentStatus.ACTIVE)

        scope = request.query_params.get("scope")
        if scope and scope != "all":
            if scope == "property":
                documents = documents.filter(property__isnull=False)
            elif scope == "application":
                documents = documents.filter(application__isnull=False)
            elif scope == "tenancy":
                documents = documents.filter(tenancy__isnull=False)
            elif scope == "personal":
                documents = documents.filter(
                    property__isnull=True,
                    application__isnull=True,
                    tenancy__isnull=True,
                )
            else:
                raise ValidationError({"scope": ["Invalid document scope filter."]})

        for param_name, field_name in (
            ("property_id", "property_id"),
            ("application_id", "application_id"),
            ("tenancy_id", "tenancy_id"),
        ):
            raw_value = request.query_params.get(param_name)
            if raw_value:
                try:
                    parsed_uuid = uuid.UUID(raw_value)
                except ValueError as exc:
                    raise ValidationError(
                        {param_name: ["Must be a valid UUID."]}
                    ) from exc
                documents = documents.filter(**{field_name: parsed_uuid})

        page = self.paginate_queryset(documents)
        if page is not None:
            serializer = DocumentSerializer(
                page,
                many=True,
                context=self.get_serializer_context(),
            )
            return self.get_paginated_response(serializer.data)

        serializer = DocumentSerializer(
            documents,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(
            {
                "success": True,
                "message": "Documents retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, pk=None):
        document = self.get_object()
        serializer = self.get_serializer(document)
        return Response(
            {
                "success": True,
                "message": "Document retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        property_instance = None
        application_instance = None
        tenancy_instance = None

        if data.get("property_id"):
            property_instance = get_object_or_404(
                Property,
                pk=data["property_id"],
            )

        if data.get("application_id"):
            application_instance = get_object_or_404(
                Application,
                pk=data["application_id"],
            )

        if data.get("tenancy_id"):
            tenancy_instance = get_object_or_404(
                Tenancy,
                pk=data["tenancy_id"],
            )

        if not can_upload_document(
            request.user,
            property_instance=property_instance,
            application_instance=application_instance,
            tenancy_instance=tenancy_instance,
        ):
            raise PermissionDenied(
                "You do not have permission to upload this document."
            )

        try:
            document = upload_document(
                uploaded_by=request.user,
                uploaded_file=data["file"],
                document_type=data["document_type"],
                title=data.get("title"),
                property_instance=property_instance,
                application_instance=application_instance,
                tenancy_instance=tenancy_instance,
            )
        except (
            InvalidDocumentParentError,
            DocumentServiceError,
            DjangoValidationError,
        ) as exc:
            self._translate_service_exception(exc)

        response_serializer = DocumentSerializer(
            document,
            context=self.get_serializer_context(),
        )
        return Response(
            {
                "success": True,
                "message": "Document uploaded successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, pk=None):
        document = self.get_object()

        if not can_modify_document(request.user, document):
            raise PermissionDenied(
                "You do not have permission to edit this document."
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            updated_document = update_document(
                document=document,
                title=data.get("title"),
                uploaded_file=data.get("file"),
            )
        except (DocumentServiceError, DjangoValidationError) as exc:
            self._translate_service_exception(exc)

        response_serializer = DocumentSerializer(
            updated_document,
            context=self.get_serializer_context(),
        )
        return Response(
            {
                "success": True,
                "message": "Document updated successfully.",
                "data": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Documents"],
        summary="Download a document",
        description=(
            "Downloads a document after checking the user's access permissions."
        ),
        responses={
            (200, "application/pdf"): OpenApiTypes.BINARY,
            (200, "image/jpeg"): OpenApiTypes.BINARY,
            (200, "image/png"): OpenApiTypes.BINARY,
            (200, "image/webp"): OpenApiTypes.BINARY,
            (200, "application/octet-stream"): OpenApiTypes.BINARY,
            401: ApiErrorResponseSerializer,
            403: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        document = self.get_object()

        if not can_access_document(request.user, document):
            raise PermissionDenied(
                "You do not have permission to download this document."
            )

        try:
            file_handle = private_document_storage.open(
                document.file_url,
                "rb",
            )
        except FileNotFoundError as exc:
            raise NotFound("Document file could not be found.") from exc

        return FileResponse(
            file_handle,
            as_attachment=True,
            filename=document.original_filename,
            content_type=(
                document.mime_type or "application/octet-stream"
            ),
        )
