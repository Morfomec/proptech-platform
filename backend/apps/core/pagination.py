from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination for all API list endpoints.
    Preserves DRF pagination fields alongside the standard success/message/data envelope.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                "success": True,
                "message": "Data retrieved successfully.",
                "count": self.page.paginator.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "results": data,
                "data": data,
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "required": ["success", "message", "count", "results", "data"],
            "properties": {
                "success": {
                    "type": "boolean",
                    "example": True,
                },
                "message": {
                    "type": "string",
                    "example": "Data retrieved successfully.",
                },
                "count": {
                    "type": "integer",
                    "example": 20,
                },
                "next": {
                    "type": "string",
                    "nullable": True,
                    "format": "uri",
                    "example": "http://api.example.com/accounts/?page=4",
                },
                "previous": {
                    "type": "string",
                    "nullable": True,
                    "format": "uri",
                    "example": "http://api.example.com/accounts/?page=2",
                },
                "results": schema,
                "data": schema,
            },
        }