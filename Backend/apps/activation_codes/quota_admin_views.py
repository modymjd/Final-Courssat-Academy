from calendar import monthrange
from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.response import Response

from apps.accounts.models import User
from apps.common.permissions import IsAdmin
from apps.finance.models import DetailedAuditLog

from .models import ActivationCode, CodeQuotaContract, CodeQuotaPeriod
from .serializers import CodeQuotaContractSerializer, CodeQuotaPeriodSerializer
from .services.quota import QuotaService


class SuperAdminCodeQuotaContractViewSet(viewsets.ModelViewSet):
    """Manage commercial monthly activation-code capacity contracts."""

    permission_classes = [IsAdmin]
    serializer_class = CodeQuotaContractSerializer
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        qs = CodeQuotaContract.objects.select_related("owner").all()
        owner_id = self.request.query_params.get("owner_id")
        role = self.request.query_params.get("owner_role")
        active = self.request.query_params.get("is_active")

        if owner_id:
            qs = qs.filter(owner_id=owner_id)
        if role in ("instructor", "center"):
            qs = qs.filter(owner__role=role)
        if active in ("true", "false"):
            qs = qs.filter(is_active=active == "true")
        return qs.order_by("-is_active", "-effective_from", "-created_at")

    @staticmethod
    def _month_bounds(day: date):
        return day.replace(day=1), day.replace(day=monthrange(day.year, day.month)[1])

    def _assert_no_mid_period_switch(self, owner, effective_from, monthly_code_limit=None):
        today = timezone.localdate()
        if effective_from > today:
            return

        month_start, month_end = self._month_bounds(today)
        generated_count = ActivationCode.objects.filter(
            batch__created_by=owner,
            created_at__date__gte=month_start,
            created_at__date__lte=month_end,
        ).count()
        if monthly_code_limit is not None and monthly_code_limit < generated_count:
            raise ValidationError(
                {
                    "monthly_code_limit": f"الحد الشهري ({monthly_code_limit}) لا يمكن أن يكون أقل من عدد الأكواد المولدة بالفعل لهذا الشهر ({generated_count})."
                }
            )

    @transaction.atomic
    def perform_create(self, serializer):
        owner = serializer.validated_data["owner"]
        is_active = serializer.validated_data.get("is_active", True)
        effective_from = serializer.validated_data["effective_from"]
        monthly_code_limit = serializer.validated_data.get("monthly_code_limit")
        self._assert_no_mid_period_switch(owner, effective_from, monthly_code_limit)

        if is_active:
            CodeQuotaContract.objects.filter(owner=owner, is_active=True).update(
                is_active=False, updated_at=timezone.now()
            )

        contract = serializer.save()
        if contract.effective_from <= timezone.localdate() and contract.is_active:
            period = QuotaService._get_current_period(contract, for_update=True)
            period.monthly_code_limit_snapshot = contract.monthly_code_limit
            period.billing_unit_size_snapshot = contract.billing_unit_size
            period.price_per_billing_unit_snapshot = contract.price_per_billing_unit
            period.save(
                update_fields=[
                    "monthly_code_limit_snapshot",
                    "billing_unit_size_snapshot",
                    "price_per_billing_unit_snapshot",
                    "updated_at",
                ]
            )

        self._audit("QUOTA_CONTRACT_CREATED", contract, {}, CodeQuotaContractSerializer(contract).data)

    @transaction.atomic
    def perform_update(self, serializer):
        contract = self.get_object()
        effective_from = serializer.validated_data.get("effective_from", contract.effective_from)
        monthly_code_limit = serializer.validated_data.get("monthly_code_limit", contract.monthly_code_limit)
        self._assert_no_mid_period_switch(contract.owner, effective_from, monthly_code_limit)
        old_data = CodeQuotaContractSerializer(contract).data
        updated = serializer.save()

        if updated.effective_from <= timezone.localdate() and updated.is_active:
            period = QuotaService._get_current_period(updated, for_update=True)
            period.monthly_code_limit_snapshot = updated.monthly_code_limit
            period.billing_unit_size_snapshot = updated.billing_unit_size
            period.price_per_billing_unit_snapshot = updated.price_per_billing_unit
            period.save(
                update_fields=[
                    "monthly_code_limit_snapshot",
                    "billing_unit_size_snapshot",
                    "price_per_billing_unit_snapshot",
                    "updated_at",
                ]
            )

        self._audit("QUOTA_CONTRACT_UPDATED", updated, old_data, CodeQuotaContractSerializer(updated).data)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            "DELETE",
            detail="Quota contracts are deactivated, never deleted, to preserve billing history.",
        )

    def _audit(self, action, contract, old_value, new_value):
        DetailedAuditLog.objects.create(
            actor=self.request.user,
            action=action,
            entity_type="CodeQuotaContract",
            entity_id=contract.id,
            old_value=old_value,
            new_value=new_value,
            reason="إدارة عقد سعة أكواد التفعيل بواسطة المشرف العام",
        )

    @action(detail=True, methods=["post"], url_path="deactivate")
    @transaction.atomic
    def deactivate(self, request, pk=None):
        contract = self.get_object()
        if not contract.is_active:
            return Response({"status": "already_inactive"}, status=status.HTTP_200_OK)

        contract.is_active = False
        contract.save(update_fields=["is_active", "updated_at"])
        self._audit(
            "QUOTA_CONTRACT_DEACTIVATED",
            contract,
            {"is_active": True},
            {"is_active": False},
        )
        return Response({"status": "deactivated"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="quick-grant")
    def quick_grant(self, request):
        owner_id = request.data.get("owner_id")
        if not owner_id:
            raise ValidationError({"owner_id": "معرف المالك مطلوب."})

        try:
            owner = User.objects.get(pk=owner_id)
        except (User.DoesNotExist, ValueError, TypeError) as exc:
            raise ValidationError({"owner_id": "المستخدم المحدد غير موجود."}) from exc

        if owner.role not in ("instructor", "center"):
            raise ValidationError({"owner_id": "يمكن منح وتعديل الكوتة فقط للمدرسين والمراكز التعليمية."})

        additional_quantity = int(request.data.get("additional_quantity") or 0)
        new_monthly_limit = request.data.get("new_monthly_limit")
        if new_monthly_limit is not None and str(new_monthly_limit).strip() != "":
            new_monthly_limit = int(new_monthly_limit)
        else:
            new_monthly_limit = None

        billing_unit_size = request.data.get("billing_unit_size")
        if billing_unit_size is not None and str(billing_unit_size).strip() != "":
            billing_unit_size = int(billing_unit_size)
        else:
            billing_unit_size = None

        price_per_billing_unit = request.data.get("price_per_billing_unit")
        if price_per_billing_unit is not None and str(price_per_billing_unit).strip() != "":
            price_per_billing_unit = str(price_per_billing_unit).strip()
        else:
            price_per_billing_unit = None

        notes = request.data.get("notes", "")

        snapshot = QuotaService.grant_or_adjust_quota(
            user=owner,
            additional_quantity=additional_quantity,
            new_monthly_limit=new_monthly_limit,
            billing_unit_size=billing_unit_size,
            price_per_billing_unit=price_per_billing_unit,
            notes=notes,
            actor=request.user,
        )

        return Response(
            {
                "message": "تم تعديل ومنح الكوتة بنجاح",
                "quota": snapshot,
                "contract_id": snapshot["contract_id"],
            },
            status=status.HTTP_200_OK,
        )


class SuperAdminCodeQuotaPeriodViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAdmin]
    serializer_class = CodeQuotaPeriodSerializer

    def get_queryset(self):
        qs = CodeQuotaPeriod.objects.select_related("contract__owner").all()
        owner_id = self.request.query_params.get("owner_id")
        if owner_id:
            qs = qs.filter(contract__owner_id=owner_id)
        return qs.order_by("-period_start", "-created_at")
