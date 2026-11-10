from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.listings.views.listing import ListingViewSet
from apps.listings.views.saved_property import SavedPropertyViewSet

app_name = "listings"

router = DefaultRouter()
router.register(r"listings", ListingViewSet, basename="listing")
router.register(r"saved-properties", SavedPropertyViewSet, basename="saved-property")

urlpatterns = [
    path("", include(router.urls)),
]
