
from drf_spectacular.utils import (
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.core.pagination import StandardResultsSetPagination
from apps.core.schemas import (
    ApiErrorResponseSerializer,
    success_envelope,
)
from apps.notifications.models import Notification
from apps.notifications.serializers import (
    NotificationSerializer,
    NotificationFilterSerializer,
)
from apps.notifications.services import (
    get_user_notifications,
    get_unread_notification_count,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)
from apps.notifications.services.exceptions import (
    NotificationNotFoundError,
)


@extend_schema_view(
    list=extend_schema(
        tags=["Notifications"],
        summary="List notifications",
        description="Returns notifications belonging to the authenticated user.",
        parameters=[NotificationFilterSerializer],
        responses={
            200: NotificationSerializer(many=True),
            400: ApiErrorResponseSerializer,
            401: ApiErrorResponseSerializer,
        },
    ),
    retrieve=extend_schema(
        tags=["Notifications"],
        summary="Retrieve notification",
        description="Returns one notification belonging to the authenticated user.",
        responses={
            200: success_envelope("NotificationDetailResponse", NotificationSerializer),
            401: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    ),
)
class NotificationViewSet(GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "head", "options"]
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()

        if not self.request.user.is_authenticated:
            return Notification.objects.none()

        return get_user_notifications(user=self.request.user)

    def list(self, request, *args, **kwargs):
        filter_serializer = NotificationFilterSerializer(
            data=request.query_params
        )
        filter_serializer.is_valid(raise_exception=True)

        notifications = get_user_notifications(
            user=request.user,
            is_read=filter_serializer.validated_data.get("is_read"),
        )

        page = self.paginate_queryset(notifications)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(notifications, many=True)

        return Response(
            {
                "success": True,
                "message": "Notifications retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        notification = self.get_object()

        serializer = self.get_serializer(notification)

        return Response(
            {
                "success": True,
                "message": "Notification retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Notifications"],
        summary="Get unread notification count",
        responses={
            200: success_envelope(
                "UnreadNotificationCountResponse",
                inline_serializer(
                    name="UnreadNotificationCountData",
                    fields={"unread_count": serializers.IntegerField()},
                ),
            ),
            401: ApiErrorResponseSerializer,
        },
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="unread-count",
    )
    def unread_count(self, request):
        count = get_unread_notification_count(user=request.user)

        return Response(
            {
                "success": True,
                "message": "Unread notification count retrieved successfully.",
                "data": {"unread_count": count},
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Notifications"],
        summary="Mark notification as read",
        request=None,
        responses={
            200: success_envelope("NotificationReadResponse", NotificationSerializer),
            401: ApiErrorResponseSerializer,
            404: ApiErrorResponseSerializer,
        },
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="read",
    )
    def read(self, request, pk=None):
        try:
            notification = mark_notification_as_read(
                user=request.user,
                notification_id=pk,
            )
        except NotificationNotFoundError as exc:
            raise NotFound("Notification not found.") from exc

        serializer = self.get_serializer(notification)

        return Response(
            {
                "success": True,
                "message": "Notification marked as read.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Notifications"],
        summary="Mark all notifications as read",
        request=None,
        responses={
            200: success_envelope(
                "NotificationReadAllResponse",
                inline_serializer(
                    name="NotificationReadAllData",
                    fields={"updated_count": serializers.IntegerField()},
                ),
            ),
            401: ApiErrorResponseSerializer,
        },
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="read-all",
    )
    def read_all(self, request):
        updated_count = mark_all_notifications_as_read(
            user=request.user,
        )

        return Response(
            {
                "success": True,
                "message": "All notifications marked as read.",
                "data": {"updated_count": updated_count},
            },
            status=status.HTTP_200_OK,
        )
