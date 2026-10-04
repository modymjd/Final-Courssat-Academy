import re

from rest_framework import serializers


def camel_to_snake(name: str) -> str:
    """Converts a camelCase string to snake_case."""
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def camel_to_snake_dict(data):
    """Recursively converts all dictionary keys from camelCase to snake_case."""
    if not isinstance(data, dict):
        return data
    result = {}
    for key, value in data.items():
        snake_key = camel_to_snake(key) if isinstance(key, str) else key
        if isinstance(value, dict):
            result[snake_key] = camel_to_snake_dict(value)
        elif isinstance(value, list):
            result[snake_key] = [
                camel_to_snake_dict(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[snake_key] = value
    return result


class FlexiCaseModelSerializer(serializers.ModelSerializer):
    """
    ModelSerializer that transparently accepts incoming data with either camelCase or snake_case keys.
    Converts incoming camelCase keys to snake_case before DRF field validation.
    """

    def to_internal_value(self, data):
        if hasattr(data, "dict"):
            # Handle QueryDict or MultiValueDict if passed
            data = data.dict()
        if isinstance(data, dict):
            data = camel_to_snake_dict(data)
        return super().to_internal_value(data)
