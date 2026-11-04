import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


class EmailService:

    @staticmethod
    def send_email(
        subject,
        recipients,
        text_template,
        context=None,
        html_template=None,
        from_email=None,
    ):
        """
        Send an email using reusable text and HTML templates.
        """

        if isinstance(recipients, str):
            recipients = [recipients]

        context = context or {}

        try:
            text_content = render_to_string(
                text_template,
                context,
            )

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=from_email or settings.DEFAULT_FROM_EMAIL,
                to=recipients,
            )

            if html_template:
                html_content = render_to_string(
                    html_template,
                    context,
                )
                email.attach_alternative(html_content, "text/html")

            return email.send(fail_silently=False) > 0

        except Exception:
            logger.exception(
                "Failed to send email. Subject: %s",
                subject,
            )
            return False