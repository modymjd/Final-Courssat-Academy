from rest_framework import serializers


class ErrorDetailSerializer(serializers.Serializer):
    status = serializers.IntegerField(
        help_text="HTTP Status Code",
    )
    detail = serializers.CharField(
        help_text="Human-readable error summary",
    )
    # DRF exposes `Serializer.errors` as a property; the API contract also requires
    # an `errors` response field, so django-stubs cannot type this declaration cleanly.
    errors = serializers.JSONField(  # type: ignore[assignment]
        required=False,
        allow_null=True,
        help_text="Field-specific error dictionary if applicable",
        default=None,
    )


class ErrorResponseSerializer(serializers.Serializer):
    error = ErrorDetailSerializer()


def postprocess_error_responses(result, generator, request, public):
    """
    drf-spectacular postprocessing hook that injects standardized error response schemas
    (400, 401, 403, 404, 429, 500) into all OpenAPI endpoints.
    """
    components = result.setdefault("components", {}).setdefault("schemas", {})

    if "ErrorResponse" not in components:
        components["ErrorResponse"] = {
            "type": "object",
            "properties": {
                "error": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "integer",
                            "description": "HTTP status code",
                            "example": 400,
                        },
                        "detail": {
                            "type": "string",
                            "description": "Human-readable error summary",
                            "example": "Request validation failed",
                        },
                        "errors": {
                            "type": "object",
                            "nullable": True,
                            "additionalProperties": True,
                            "description": "Field-specific error mapping if applicable",
                        },
                    },
                    "required": ["status", "detail"],
                }
            },
            "required": ["error"],
        }

    error_schema_ref = {"$ref": "#/components/schemas/ErrorResponse"}

    standard_errors = {
        "400": "Bad Request - Validation or parameter error",
        "401": "Unauthorized - Missing or invalid authentication token",
        "403": "Forbidden - Insufficient permissions",
        "404": "Not Found - The requested resource was not found",
        "429": "Too Many Requests - Rate limit exceeded",
        "500": "Internal Server Error - Unexpected server condition",
    }

    paths = result.get("paths", {})
    for _path, methods in paths.items():
        for method, operation in methods.items():
            if method.lower() in ("get", "post", "put", "patch", "delete", "options", "head"):
                responses = operation.setdefault("responses", {})
                for code, description in standard_errors.items():
                    if code not in responses:
                        responses[code] = {
                            "description": description,
                            "content": {"application/json": {"schema": error_schema_ref}},
                        }

    return result
