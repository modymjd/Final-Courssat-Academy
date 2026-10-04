from pathlib import Path

from django.conf import settings
from django.test import TestCase, override_settings


class CorsContractTests(TestCase):
    @override_settings(
        CORS_ALLOWED_ORIGINS=["https://courssat.online"],
        CORS_ALLOW_ALL_ORIGINS=False,
    )
    def test_course_create_preflight_allows_idempotency_and_correlation_headers(self):
        response = self.client.options(
            "/api/v1/courses/",
            HTTP_ORIGIN="https://courssat.online",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS=(
                "authorization,content-type,idempotency-key,x-correlation-id"
            ),
        )

        self.assertEqual(response.status_code, 200)
        allow_headers = response.get("Access-Control-Allow-Headers", "").lower()
        self.assertIn("idempotency-key", allow_headers)
        self.assertIn("x-correlation-id", allow_headers)
        self.assertIn("authorization", allow_headers)

    def test_nginx_preflight_allowlist_contains_all_course_creation_headers(self):
        template = (
            Path(__file__).resolve().parents[4]
            / "infrastructure"
            / "nginx"
            / "templates"
            / "courssat.online.conf.template"
        )
        content = template.read_text(encoding="utf-8")

        expected = (
            'add_header Access-Control-Allow-Headers '
            '"Accept, Authorization, Content-Type, Idempotency-Key, X-Correlation-Id" always;'
        )
        self.assertEqual(content.count(expected), 2)
