import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import exceptions
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            detail = exc.message_dict
        elif hasattr(exc, "messages"):
            detail = exc.messages
        else:
            detail = list(exc)
        exc = exceptions.ValidationError(detail=detail)

    response = exception_handler(exc, context)

    if response is None:
        logger.exception(
            "Unhandled API exception",
            exc_info=exc,
        )

        return None

    detail = response.data

    if isinstance(detail, dict) and "detail" in detail:
        message = str(detail["detail"])
        errors = None
    else:
        message = "Request failed."
        errors = detail

    response.data = {
        "success": False,
        "message": message,
        "errors": errors,
    }

    return response