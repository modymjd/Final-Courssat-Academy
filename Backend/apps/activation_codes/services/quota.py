from calendar import monthrange
from datetime import date

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.accounts.models import User
from apps.activation_codes.models import ActivationCode, CodeQuotaContract, CodeQuotaPeriod
from apps.finance.models import DetailedAuditLog


class QuotaExceededError(DRFValidationError):
    """Raised when a monthly code-capacity reservation cannot be fulfilled."""


class QuotaService:
    DEFAULT_CENTER_QUOTA = 50
    DEFAULT_INSTRUCTOR_QUOTA = 1
    DEFAULT_BILLING_UNIT_SIZE = 100

    @staticmethod
    def _owner_role(user):
        role = getattr(user, "role", "")
        if role in ("center", "instructor"):
            return role
        return None

    @classmethod
    def get_default_limit(cls, user):
        role = cls._owner_role(user)
        if role == "center":
            return cls.DEFAULT_CENTER_QUOTA
        if role == "instructor":
            return cls.DEFAULT_INSTRUCTOR_QUOTA
        return 0

    @staticmethod
    def _period_bounds(day: date):
        start = day.replace(day=1)
        end = day.replace(day=monthrange(day.year, day.month)[1])
        return start, end

    @classmethod
    def get_active_contract(cls, user, *, for_update=False):
        today = timezone.localdate()
        qs = (
            CodeQuotaContract.objects.filter(owner=user, is_active=True, effective_from__lte=today)
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))
            .order_by("-effective_from", "-created_at")
        )
        if for_update:
            qs = qs.select_for_update()
        return qs.first()

    @classmethod
    def get_or_create_default_contract(cls, user):
        default_limit = cls.get_default_limit(user)
        if default_limit <= 0:
            raise ValueError("Activation-code quota is only available to instructors and centers.")

        today = timezone.localdate()
        with transaction.atomic():
            locked_owner = User.objects.select_for_update().get(pk=user.pk)
            contract = (
                CodeQuotaContract.objects.filter(owner=locked_owner, is_active=True, effective_from__lte=today)
                .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))
                .order_by("-effective_from", "-created_at")
                .first()
            )
            if contract:
                return contract

            future_active = CodeQuotaContract.objects.filter(
                owner=locked_owner, is_active=True, effective_from__gt=today
            )
            if future_active.exists():
                raise DRFValidationError(
                    {"detail": "An active quota contract is scheduled for a future effective date."}
                )

            CodeQuotaContract.objects.filter(
                owner=locked_owner,
                is_active=True,
                effective_to__lt=today,
            ).update(is_active=False, updated_at=timezone.now())

            return CodeQuotaContract.objects.create(
                owner=locked_owner,
                monthly_code_limit=default_limit,
                billing_unit_size=cls.DEFAULT_BILLING_UNIT_SIZE,
                price_per_billing_unit=0,
                currency="EGP",
                effective_from=today,
                is_active=True,
                notes="System default quota. Replace with a commercial contract from Super Admin.",
            )

    @classmethod
    def _current_generated_count(cls, owner, period_start, period_end):
        return ActivationCode.objects.filter(
            batch__created_by=owner,
            created_at__date__gte=period_start,
            created_at__date__lte=period_end,
        ).count()

    @classmethod
    def _get_current_period(cls, contract, *, for_update=False):
        today = timezone.localdate()
        period_start, period_end = cls._period_bounds(today)
        qs = CodeQuotaPeriod.objects.filter(contract=contract, period_start=period_start)
        if for_update:
            qs = qs.select_for_update()

        period = qs.first()
        if period:
            return period

        existing_count = cls._current_generated_count(contract.owner, period_start, period_end)
        period, _ = CodeQuotaPeriod.objects.get_or_create(
            contract=contract,
            period_start=period_start,
            defaults={
                "period_end": period_end,
                "monthly_code_limit_snapshot": contract.monthly_code_limit,
                "billing_unit_size_snapshot": contract.billing_unit_size,
                "price_per_billing_unit_snapshot": contract.price_per_billing_unit,
                "generated_count": existing_count,
            },
        )
        if for_update:
            period = CodeQuotaPeriod.objects.select_for_update().get(pk=period.pk)
        return period

    @classmethod
    def get_quota_snapshot(cls, user):
        """Return current quota state without mutating persistent state."""
        role = cls._owner_role(user)
        if role is None:
            return {
                "available": 0,
                "max_limit": 0,
                "generated": 0,
                "billing_unit_size": cls.DEFAULT_BILLING_UNIT_SIZE,
                "price_per_billing_unit": None,
                "currency": "EGP",
                "billing_units": 0,
                "billing_amount": None,
                "pricing_configured": False,
                "source": "not_applicable",
                "period_start": None,
                "period_end": None,
                "contract_id": None,
            }

        today = timezone.localdate()
        period_start, period_end = cls._period_bounds(today)
        contract = cls.get_active_contract(user)

        if contract:
            period = CodeQuotaPeriod.objects.filter(contract=contract, period_start=period_start).first()
            generated = period.generated_count if period else cls._current_generated_count(user, period_start, period_end)
            monthly_limit = period.monthly_code_limit_snapshot if period else contract.monthly_code_limit
            billing_unit = period.billing_unit_size_snapshot if period else contract.billing_unit_size
            unit_price = period.price_per_billing_unit_snapshot if period else contract.price_per_billing_unit
            currency = contract.currency
            contract_id = contract.id
            source = "custom_contract"
            pricing_configured = unit_price > 0
        else:
            monthly_limit = cls.get_default_limit(user)
            billing_unit = cls.DEFAULT_BILLING_UNIT_SIZE
            unit_price = None
            generated = cls._current_generated_count(user, period_start, period_end)
            currency = "EGP"
            contract_id = None
            source = "system_default"
            pricing_configured = False

        available = max(0, monthly_limit - generated)
        billing_units = (monthly_limit + billing_unit - 1) // billing_unit if monthly_limit > 0 else 0
        billing_amount = str(billing_units * unit_price) if unit_price is not None else None

        return {
            "available": available,
            "max_limit": monthly_limit,
            "generated": generated,
            "billing_unit_size": billing_unit,
            "price_per_billing_unit": str(unit_price) if unit_price is not None else None,
            "currency": currency,
            "billing_units": billing_units,
            "billing_amount": billing_amount,
            "pricing_configured": pricing_configured,
            "source": source,
            "period_start": period_start,
            "period_end": period_end,
            "contract_id": contract_id,
        }

    @classmethod
    def get_max_quota_limit(cls, user):
        return cls.get_quota_snapshot(user)["max_limit"]

    @classmethod
    def get_available_quota(cls, user):
        return cls.get_quota_snapshot(user)["available"]

    @classmethod
    @transaction.atomic
    def reserve_generation(cls, user, quantity):
        """Atomically reserve monthly capacity before code materialization."""
        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")

        if cls._owner_role(user) is None:
            raise ValueError("Activation-code quota is only available to instructors and centers.")

        contract = cls.get_active_contract(user, for_update=True)
        if contract is None:
            contract = cls.get_or_create_default_contract(user)
            contract = CodeQuotaContract.objects.select_for_update().get(pk=contract.pk)

        period = cls._get_current_period(contract, for_update=True)
        if period.status != CodeQuotaPeriod.Status.OPEN:
            raise QuotaExceededError("The current quota period is closed.")

        if period.generated_count + quantity > period.monthly_code_limit_snapshot:
            raise QuotaExceededError(
                {"detail": f"Monthly activation-code quota exceeded. Remaining: {period.available_count}."}
            )

        period.generated_count += quantity
        period.save(update_fields=["generated_count", "updated_at"])
        return period

    @classmethod
    def grant_or_adjust_quota(
        cls,
        user,
        additional_quantity=0,
        new_monthly_limit=None,
        billing_unit_size=None,
        price_per_billing_unit=None,
        notes="",
        actor=None,
    ):
        if getattr(user, "role", "") not in ("instructor", "center"):
            raise DRFValidationError({"detail": "Activation-code quota is only available to instructors and centers."})

        additional_quantity = int(additional_quantity or 0)
        if additional_quantity < 0:
            raise DRFValidationError({"additional_quantity": "Additional quantity cannot be negative."})

        if new_monthly_limit is not None:
            new_monthly_limit = int(new_monthly_limit)
            if new_monthly_limit <= 0:
                raise DRFValidationError({"new_monthly_limit": "New monthly limit must be greater than zero."})

        with transaction.atomic():
            contract = cls.get_active_contract(user, for_update=True)
            if contract is None:
                contract = cls.get_or_create_default_contract(user)
                contract = CodeQuotaContract.objects.select_for_update().get(pk=contract.pk)

            period = cls._get_current_period(contract, for_update=True)

            old_value = {
                "monthly_code_limit": contract.monthly_code_limit,
                "billing_unit_size": contract.billing_unit_size,
                "price_per_billing_unit": str(contract.price_per_billing_unit),
            }

            if new_monthly_limit is not None:
                contract.monthly_code_limit = new_monthly_limit
                period.monthly_code_limit_snapshot = new_monthly_limit

            if additional_quantity > 0:
                contract.monthly_code_limit += additional_quantity
                period.monthly_code_limit_snapshot += additional_quantity

            if billing_unit_size is not None:
                billing_unit_size = int(billing_unit_size)
                if billing_unit_size > 0:
                    contract.billing_unit_size = billing_unit_size
                    period.billing_unit_size_snapshot = billing_unit_size

            if price_per_billing_unit is not None:
                contract.price_per_billing_unit = price_per_billing_unit
                period.price_per_billing_unit_snapshot = price_per_billing_unit

            if notes:
                contract.notes = f"{contract.notes}\n{notes}".strip() if contract.notes else notes

            contract.save()
            period.save()

            new_value = {
                "monthly_code_limit": contract.monthly_code_limit,
                "billing_unit_size": contract.billing_unit_size,
                "price_per_billing_unit": str(contract.price_per_billing_unit),
                "additional_quantity": additional_quantity,
                "period_limit_snapshot": period.monthly_code_limit_snapshot,
            }

            DetailedAuditLog.objects.create(
                actor=actor,
                action="QUOTA_GRANTED_OR_ADJUSTED",
                entity_type="CodeQuotaContract",
                entity_id=contract.id,
                old_value=old_value,
                new_value=new_value,
                reason=notes or "تعديل أو منح كوتة أكواد التفعيل",
            )

            return cls.get_quota_snapshot(user)
