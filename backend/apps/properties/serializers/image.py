import os
from PIL import Image as PILImage
from rest_framework import serializers

from apps.properties.models import PropertyImage

MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}


class PropertyImageSerializer(serializers.ModelSerializer):
    """
    Serializer for Property photo gallery assets.
    Supports binary file uploads (multipart/form-data) via write-only `file`
    as well as JSON payloads containing `image_url`.
    """
    id = serializers.UUIDField(read_only=True)
    property_id = serializers.UUIDField(read_only=True)
    image_url = serializers.CharField(max_length=1000, required=False, allow_blank=False)
    file = serializers.FileField(write_only=True, required=False)
    caption = serializers.CharField(max_length=255, required=False, allow_null=True, allow_blank=True)
    display_order = serializers.IntegerField(required=False, min_value=0)
    is_primary = serializers.BooleanField(required=False, default=False)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = PropertyImage
        fields = [
            "id",
            "property_id",
            "image_url",
            "file",
            "caption",
            "display_order",
            "is_primary",
            "created_at",
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        image_url = ret.get("image_url")
        request = self.context.get("request")
        if request and image_url and image_url.startswith("/"):
            ret["image_url"] = request.build_absolute_uri(image_url)
        return ret

    def validate(self, attrs):
        file = attrs.get("file")
        image_url = attrs.get("image_url")

        if not file and not image_url:
            raise serializers.ValidationError({
                "file": "Either an image file or an image_url must be provided."
            })

        if file:
            # 1. Validate file size (max 10MB)
            if file.size > MAX_IMAGE_SIZE_BYTES:
                raise serializers.ValidationError({
                    "file": "File size exceeds the maximum allowed limit of 10 MB."
                })

            # 2. Validate file extension
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise serializers.ValidationError({
                    "file": f"Unsupported file extension '{ext}'. Allowed extensions are: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
                })

            # 3. Validate image integrity using Pillow
            try:
                file.seek(0)
                img = PILImage.open(file)
                img.verify()
                if img.format not in ALLOWED_PIL_FORMATS:
                    raise serializers.ValidationError({
                        "file": f"Unsupported image format '{img.format}'. Allowed formats are JPEG, PNG, WEBP."
                    })
                file.seek(0)
            except serializers.ValidationError:
                raise
            except Exception:
                raise serializers.ValidationError({
                    "file": "Uploaded file is corrupted or not a valid image."
                })

        return attrs


