from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views.amenity import AmenityListView
from .views.property import PropertyViewSet

app_name = "properties"

router = DefaultRouter()
router.register(r"properties", PropertyViewSet, basename="property")

urlpatterns = [
    path("amenities/", AmenityListView.as_view(), name="amenity-list"),
    path("", include(router.urls)),
]

