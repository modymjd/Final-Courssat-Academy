from collections import OrderedDict
from math import ceil

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class CamelCasePageNumberPagination(PageNumberPagination):
    """Response shape matches the frontend's PaginatedResponse<T>.

    {
      "data": [...],
      "total": 42,
      "page": 1,
      "pageSize": 12,
      "totalPages": 4
    }
    """

    page_size = 12
    page_size_query_param = "pageSize"
    max_page_size = 50

    def get_paginated_response(self, data):
        total = self.page.paginator.count
        page_size = self.get_page_size(self.request)
        return Response(
            OrderedDict(
                [
                    ("data", data),
                    ("results", data),
                    ("total", total),
                    ("count", total),
                    ("page", self.page.number),
                    ("pageSize", page_size),
                    ("totalPages", ceil(total / page_size) if page_size else 0),
                ]
            )
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "data": schema,
                "total": {"type": "integer"},
                "page": {"type": "integer"},
                "pageSize": {"type": "integer"},
                "totalPages": {"type": "integer"},
            },
        }
