from rest_framework.routers import DefaultRouter

from apps.subscriptions.views import (
    SubscriptionPlanViewSet,
    SubscriptionViewSet,
)

app_name = "subscriptions"

router = DefaultRouter()
router.register("subscription-plans", SubscriptionPlanViewSet, basename="subscription-plan")
router.register("subscriptions", SubscriptionViewSet, basename="subscription")

urlpatterns = router.urls

