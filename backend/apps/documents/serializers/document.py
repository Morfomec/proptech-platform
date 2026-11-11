from rest_framework import serializers

from apps.documents.models import Document, DocumentType
from apps.documents.services import (
    DocumentServiceError,
    validate_and_detect_document_file,
)


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(write_only=True)
    title = serializers.CharField(
        required=False,
        max_length=255,
        allow_blank=False,
        trim_whitespace=True,
    )
    document_type = serializers.ChoiceField(choices=DocumentType.choices)
    property_id = serializers.UUIDField(required=False, allow_null=True)
    application_id = serializers.UUIDField(required=False, allow_null=True)
    tenancy_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_file(self, uploaded_file):
        try:
            validate_and_detect_document_file(uploaded_file)
        except DocumentServiceError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return uploaded_file

    def validate(self, attrs):
        parent_fields = [
            attrs.get("property_id"),
            attrs.get("application_id"),
            attrs.get("tenancy_id"),
        ]

        if sum(value is not None for value in parent_fields) > 1:
            raise serializers.ValidationError(
                "A document can be associated with only one parent."
            )

        return attrs


class DocumentUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(
        required=False,
        max_length=255,
        allow_blank=False,
        trim_whitespace=True,
    )
    file = serializers.FileField(required=False, write_only=True)

    def validate_file(self, uploaded_file):
        try:
            validate_and_detect_document_file(uploaded_file)
        except DocumentServiceError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return uploaded_file

    def validate(self, attrs):
        if "title" not in attrs and "file" not in attrs:
            raise serializers.ValidationError(
                "Provide a document name or replacement file to update."
            )
        return attrs


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "uploaded_by",
            "uploaded_by_name",
            "property",
            "application",
            "tenancy",
            "document_type",
            "title",
            "original_filename",
            "mime_type",
            "file_size_bytes",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj) -> str:
        user = getattr(obj, "uploaded_by", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email
