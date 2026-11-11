from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.validation import validate_schema
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class OpenAPISchemaConsistencyTests(TestCase):
    """Verify generated OpenAPI schema validity, tags, status codes, and response envelopes."""

    def setUp(self):
        self.schema = SchemaGenerator().get_schema(request=None, public=True)
        self.schemas = self.schema["components"]["schemas"]

    def _resolve_schema(self, schema_obj):
        if "$ref" in schema_obj:
            name = schema_obj["$ref"].split("/")[-1]
            return self.schemas[name]
        return schema_obj

    def test_generated_openapi_schema_passes_spectacular_validation(self):
        validate_schema(self.schema)

        out = StringIO()
        call_command("spectacular", "--file", "/dev/null", "--validate", stdout=out, stderr=out)

    def test_no_endpoint_uses_fallback_v1_tag(self):
        for path, methods in self.schema["paths"].items():
            for method, operation in methods.items():
                if method in ("get", "post", "put", "patch", "delete"):
                    tags = operation.get("tags", [])
                    self.assertTrue(tags, f"Missing tags on {method.upper()} {path}")
                    self.assertNotIn("v1", tags, f"Fallback 'v1' tag found on {method.upper()} {path}")

    def test_status_codes_match_actual_endpoint_behavior(self):
        paths = self.schema["paths"]

        # DELETE endpoints return 200 with JSON envelope rather than 204
        self.assertIn("200", paths["/api/v1/properties/{id}/"]["delete"]["responses"])
        self.assertNotIn("204", paths["/api/v1/properties/{id}/"]["delete"]["responses"])

        self.assertIn("200", paths["/api/v1/properties/{id}/images/{image_id}/"]["delete"]["responses"])
        self.assertNotIn("204", paths["/api/v1/properties/{id}/images/{image_id}/"]["delete"]["responses"])

        self.assertIn("200", paths["/api/v1/saved-properties/{property_id}/"]["delete"]["responses"])
        self.assertNotIn("204", paths["/api/v1/saved-properties/{property_id}/"]["delete"]["responses"])

        # POST /properties/{id}/images/ returns 201 Created
        self.assertIn("201", paths["/api/v1/properties/{id}/images/"]["post"]["responses"])
        self.assertNotIn("200", paths["/api/v1/properties/{id}/images/"]["post"]["responses"])

        # POST /saved-properties/ returns 201 (new) or 200 (already saved)
        self.assertIn("201", paths["/api/v1/saved-properties/"]["post"]["responses"])
        self.assertIn("200", paths["/api/v1/saved-properties/"]["post"]["responses"])

    def test_wrapped_and_paginated_response_schemas_are_documented(self):
        paths = self.schema["paths"]

        # Paginated list endpoints include success, message, count, next, previous, results, data
        for paginated_path in (
            "/api/v1/properties/",
            "/api/v1/properties/me/",
            "/api/v1/listings/",
            "/api/v1/listings/me/",
            "/api/v1/saved-properties/",
            "/api/v1/applications/me/",
            "/api/v1/applications/received/",
            "/api/v1/tenancies/me/",
            "/api/v1/tenancies/managed/",
            "/api/v1/documents/",
            "/api/v1/notifications/",
        ):
            op_schema = paths[paginated_path]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
            resolved = self._resolve_schema(op_schema)
            props = resolved.get("properties", {})
            for key in ("success", "message", "count", "next", "previous", "results", "data"):
                self.assertIn(key, props, f"Missing '{key}' in OpenAPI schema for {paginated_path}")

        # Notifications unread-count and read-all expose typed data fields instead of bare dict
        unread_op = paths["/api/v1/notifications/unread-count/"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        unread_props = self._resolve_schema(unread_op)["properties"]
        self.assertEqual(set(unread_props.keys()), {"success", "message", "data"})
        self.assertIn("unread_count", self._resolve_schema(unread_props["data"])["properties"])

        read_all_op = paths["/api/v1/notifications/read-all/"]["post"]["responses"]["200"]["content"]["application/json"]["schema"]
        read_all_props = self._resolve_schema(read_all_op)["properties"]
        self.assertEqual(set(read_all_props.keys()), {"success", "message", "data"})
        self.assertIn("updated_count", self._resolve_schema(read_all_props["data"])["properties"])


class ResponseEnvelopeConsistencyTests(APITestCase):
    """Verify runtime JSON response envelopes across paginated, non-paginated, and error endpoints."""

    def test_paginated_endpoints_include_standard_envelope_and_pagination_keys(self):
        user = User.objects.create_user(
            email="envelope_user@example.com",
            password="StrongPassword123!",
            is_owner=True,
            is_tenant=True,
            is_active=True,
        )
        self.client.force_authenticate(user=user)

        for route_name in (
            "properties:property-list",
            "properties:property-my-properties",
            "listings:listing-list",
            "listings:listing-me",
            "listings:saved-property-list",
            "leasing:application-me",
            "leasing:application-received",
            "leasing:tenancy-me",
            "leasing:tenancy-managed",
            "documents:document-list",
            "notifications:notification-list",
        ):
            res = self.client.get(reverse(route_name))
            self.assertEqual(res.status_code, status.HTTP_200_OK, route_name)
            self.assertIs(res.data["success"], True, route_name)
            self.assertIsInstance(res.data["message"], str, route_name)
            self.assertIn("count", res.data, route_name)
            self.assertIn("next", res.data, route_name)
            self.assertIn("previous", res.data, route_name)
            self.assertIn("results", res.data, route_name)
            self.assertIn("data", res.data, route_name)
            self.assertEqual(res.data["data"], res.data["results"], route_name)

    def test_auth_inline_error_and_null_data_envelopes(self):
        from django.core.cache import cache

        cache.clear()
        verify_res = self.client.post(reverse("accounts:verify-email"), {}, format="json")
        self.assertEqual(verify_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIs(verify_res.data["success"], False)
        self.assertIn("errors", verify_res.data)
        self.assertIsNone(verify_res.data["errors"])

        reset_res = self.client.post(
            reverse("accounts:password-reset-confirm"),
            {
                "uid": "00000000-0000-0000-0000-000000000000",
                "token": "invalid-token",
                "new_password": "StrongPassword123!",
                "confirm_password": "StrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(reset_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIs(reset_res.data["success"], False)
        self.assertIn("errors", reset_res.data)
        self.assertNotIn("data", reset_res.data)

        resend_res = self.client.post(
            reverse("accounts:resend-email-verification"),
            {"email": "nonexistent@example.com"},
            format="json",
        )
        self.assertEqual(resend_res.status_code, status.HTTP_200_OK)
        self.assertIs(resend_res.data["success"], True)
        self.assertIn("data", resend_res.data)
        self.assertIsNone(resend_res.data["data"])
        cache.clear()

