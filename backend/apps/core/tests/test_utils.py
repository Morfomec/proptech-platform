import io
from decimal import Decimal
from unittest.mock import Mock

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image
from rest_framework import exceptions, status

from apps.core.exceptions import custom_exception_handler
from apps.core.validators import (
    validate_file_size,
    validate_image_file,
    validate_phone_number,
    validate_positive_amount,
)


class CoreValidatorsTests(SimpleTestCase):
    def test_validate_file_size(self):
        validator = validate_file_size(max_size_mb=1)
        validator(Mock(size=1024 * 1024))

        with self.assertRaises(DjangoValidationError):
            validator(Mock(size=1024 * 1024 + 1))

    def test_validate_image_file(self):
        buf = io.BytesIO()
        Image.new("RGB", (10, 10), color="green").save(buf, format="PNG")
        buf.seek(0)
        valid_png = SimpleUploadedFile("ok.png", buf.read(), content_type="image/png")
        validate_image_file(valid_png)

        gif_buf = io.BytesIO()
        Image.new("RGB", (10, 10), color="green").save(gif_buf, format="GIF")
        gif_buf.seek(0)
        unsupported_gif = SimpleUploadedFile("bad.gif", gif_buf.read(), content_type="image/gif")
        with self.assertRaises(DjangoValidationError):
            validate_image_file(unsupported_gif)

        corrupted = SimpleUploadedFile("bad.jpg", b"not-an-image", content_type="image/jpeg")
        with self.assertRaises(DjangoValidationError):
            validate_image_file(corrupted)

    def test_validate_phone_number(self):
        validate_phone_number("+91 98765-43210")

        for invalid in ("12345", "abc-1234567", "+1 (234) 567-890123456789"):
            with self.assertRaises(DjangoValidationError):
                validate_phone_number(invalid)

    def test_validate_positive_amount(self):
        validate_positive_amount(Decimal("100.50"))

        for invalid in (0, Decimal("-10.00"), "invalid", Decimal("NaN")):
            with self.assertRaises(DjangoValidationError):
                validate_positive_amount(invalid)


class CustomExceptionHandlerTests(SimpleTestCase):
    def test_converts_django_validation_error_to_standard_400_envelope(self):
        exc_dict = DjangoValidationError({"field": ["Invalid value."]})
        res_dict = custom_exception_handler(exc_dict, {})
        self.assertEqual(res_dict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res_dict.data["success"])
        self.assertEqual(res_dict.data["message"], "Request failed.")
        self.assertIn("field", res_dict.data["errors"])

        exc_list = DjangoValidationError(["Bad input."])
        res_list = custom_exception_handler(exc_list, {})
        self.assertEqual(res_list.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res_list.data["success"])

    def test_formats_drf_detail_and_unhandled_exceptions(self):
        not_found = custom_exception_handler(
            exceptions.NotFound("Missing item."),
            {},
        )
        self.assertEqual(not_found.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(not_found.data["success"])
        self.assertEqual(not_found.data["message"], "Missing item.")
        self.assertIsNone(not_found.data["errors"])

        unhandled = custom_exception_handler(RuntimeError("Boom"), {})
        self.assertIsNone(unhandled)

