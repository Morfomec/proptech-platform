from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.properties.models import Amenity
from apps.properties.serializers import AmenitySerializer


class AmenityListView(APIView):
    """
    List all active amenities from the global master catalogue.
    Available to all authenticated users.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Amenities"],
        summary="List active amenities",
        description="Retrieve all active amenities organized by category.",
        responses={200: AmenitySerializer(many=True)},
    )
    def get(self, request):
        amenities = Amenity.objects.filter(is_active=True).order_by("category", "name")
        serializer = AmenitySerializer(amenities, many=True)

        return Response(
            {
                "success": True,
                "message": "Amenities retrieved successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

