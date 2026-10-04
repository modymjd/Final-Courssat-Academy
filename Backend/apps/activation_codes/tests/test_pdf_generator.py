from django.test import SimpleTestCase

from apps.activation_codes.services.pdf_generator import build_activation_url


class ActivationQrDestinationTests(SimpleTestCase):
    def test_single_course_access_qr_targets_course_checkout(self):
        url = build_activation_url(
            "https://courssat.online",
            "course_access",
            "ES-ABC23456",
            [42],
        )

        assert url == "https://courssat.online/course/42/checkout?code=ES-ABC23456"

    def test_multi_course_access_qr_keeps_generic_activation_flow(self):
        url = build_activation_url(
            "https://courssat.online",
            "course_access",
            "ES-ABC23456",
            [42, 84],
        )

        assert url == "https://courssat.online/activate?code=ES-ABC23456"

    def test_non_course_voucher_qr_keeps_generic_activation_flow(self):
        url = build_activation_url(
            "https://courssat.online",
            "digital_balance",
            "ES-ABC23456",
            [],
        )

        assert url == "https://courssat.online/activate?code=ES-ABC23456"
