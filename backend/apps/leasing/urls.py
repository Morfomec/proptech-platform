from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.leasing.views import ApplicationViewSet, TenancyViewSet

app_name = "leasing"

router = DefaultRouter()

router.register(
    r"applications",
    ApplicationViewSet,
    basename="application",
)

router.register(
    r"tenancies",
    TenancyViewSet,
    basename="tenancy",
)

urlpatterns = [
    path("", include(router.urls)),
]

