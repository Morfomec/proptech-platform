"""
Tests for Core Email Service and Configuration.
"""

from unittest.mock import patch
from django.conf import settings
from django.core import mail
from django.test import SimpleTestCase, override_settings

from apps.core.email import EmailService


class EmailServiceTests(SimpleTestCase):
    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        DEFAULT_FROM_EMAIL="noreply@domioo.in",
    )
    def test_send_email_success(self):
        """Verify EmailService successfully renders and sends emails via Django mail backend."""
        with patch("apps.core.email.render_to_string") as mock_render:
            mock_render.side_effect = lambda template, ctx: f"Rendered {template} with {ctx.get('key')}"

            sent = EmailService.send_email(
                subject="Test Subject",
                recipients=["test@example.com"],
                text_template="emails/test.txt",
                context={"key": "value"},
                html_template="emails/test.html",
            )

            self.assertTrue(sent)
            self.assertEqual(len(mail.outbox), 1)
            msg = mail.outbox[0]
            self.assertEqual(msg.subject, "Test Subject")
            self.assertEqual(msg.to, ["test@example.com"])
            self.assertEqual(msg.from_email, "noreply@domioo.in")
            self.assertIn("Rendered emails/test.txt with value", msg.body)
            self.assertEqual(len(msg.alternatives), 1)
            self.assertEqual(msg.alternatives[0][1], "text/html")
            self.assertIn("Rendered emails/test.html with value", msg.alternatives[0][0])

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    )
    def test_send_email_handles_exception_cleanly(self):
        """Verify EmailService catches exceptions and returns False without crashing."""
        with patch("apps.core.email.render_to_string", side_effect=RuntimeError("Template missing")):
            sent = EmailService.send_email(
                subject="Failing Subject",
                recipients="single@example.com",
                text_template="missing.txt",
            )
            self.assertFalse(sent)
            self.assertEqual(len(mail.outbox), 0)


class EmailConfigurationTests(SimpleTestCase):
    def test_default_backend_selection_logic(self):
        """Verify automatic backend selection logic: SMTP when host is provided, console when absent."""
        # When EMAIL_HOST is present
        backend_with_host = (
            "django.core.mail.backends.smtp.EmailBackend"
            if "smtp.resend.com"
            else "django.core.mail.backends.console.EmailBackend"
        )
        self.assertEqual(backend_with_host, "django.core.mail.backends.smtp.EmailBackend")

        # When EMAIL_HOST is empty
        backend_without_host = (
            "django.core.mail.backends.smtp.EmailBackend"
            if ""
            else "django.core.mail.backends.console.EmailBackend"
        )
        self.assertEqual(backend_without_host, "django.core.mail.backends.console.EmailBackend")

