import hashlib
import secrets
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.activation_codes.models import ActivationCode, ActivationCodeBatch
from apps.activation_codes.services.quota import QuotaService

CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
PASSWORD_CHARSET = "0123456789"


def generate_random_string(length, charset):
    return "".join(secrets.choice(charset) for _ in range(length))


def generate_unique_codes(quantity, code_length=8, pin_length=6):
    """Generates unique codes (format: ES-XXXXXXXX) and 6-digit PIN passwords."""
    generated_codes = set()
    code_password_pairs = []

    while len(generated_codes) < quantity:
        code_str = f"ES-{generate_random_string(code_length, CODE_CHARSET)}"
        if code_str not in generated_codes:
            password = generate_random_string(pin_length, PASSWORD_CHARSET)
            generated_codes.add(code_str)
            code_password_pairs.append((code_str, password))

    return code_password_pairs


class CodeGeneratorService:
    @staticmethod
    @transaction.atomic
    def generate_batch(
        user,
        batch_type,
        quantity,
        price_per_code=Decimal("0.00"),
        expires_at=None,
        courses=None,
        balance_amount=Decimal("0.00"),
        notes="",
        target_instructor=None,
        access_duration_days=None,
        fixed_access_until=None,
        shelf_life_days=90,
    ):
        if expires_at is None and shelf_life_days:
            expires_at = timezone.now() + timedelta(days=int(shelf_life_days))
        elif expires_at is None:
            expires_at = timezone.now() + timedelta(days=90)

        # Reserve capacity before materializing any codes and in the same
        # transaction. Any later failure therefore rolls the reservation back.
        QuotaService.reserve_generation(user, quantity)

        batch = ActivationCodeBatch.objects.create(
            batch_type=batch_type,
            created_by=user,
            target_instructor=target_instructor,
            quantity=quantity,
            price_per_code=price_per_code,
            balance_amount=balance_amount,
            access_duration_days=access_duration_days,
            fixed_access_until=fixed_access_until,
            expires_at=expires_at,
            notes=notes,
        )

        if courses:
            batch.courses.set(courses)

        pairs = generate_unique_codes(quantity, pin_length=6)
        existing_codes = set(
            ActivationCode.objects.filter(code__in=[p[0] for p in pairs]).values_list("code", flat=True)
        )

        while existing_codes:
            pairs = [p for p in pairs if p[0] not in existing_codes]
            replacements = generate_unique_codes(len(existing_codes), pin_length=6)
            pairs.extend(replacements)
            existing_codes = set(
                ActivationCode.objects.filter(code__in=[p[0] for p in replacements]).values_list("code", flat=True)
            )

        activation_codes = [
            ActivationCode(
                batch=batch,
                code=code,
                password=password,
                pin_hash=hashlib.sha256(password.encode("utf-8")).hexdigest(),
                status=ActivationCode.CodeStatus.ACTIVE,
            )
            for code, password in pairs
        ]

        ActivationCode.objects.bulk_create(activation_codes)

        return batch
