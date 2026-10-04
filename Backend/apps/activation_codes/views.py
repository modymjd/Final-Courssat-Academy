from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import CenterInstructor, User, UserRole
from apps.activation_codes.models import (
    ActivationCode,
    ActivationCodeBatch,
    CenterQuotaRequest,
)
from apps.activation_codes.serializers import (
    ActivationCodeBatchCreateSerializer,
    ActivationCodeBatchListSerializer,
    ActivationCodeItemSerializer,
    CenterQuotaRequestSerializer,
    CodeRedemptionRequestSerializer,
    CodeValidationRequestSerializer,
    CoursePreviewSerializer,
)
from apps.activation_codes.services.code_generator import CodeGeneratorService
from apps.activation_codes.services.pdf_generator import PDFGeneratorService
from apps.activation_codes.services.quota import QuotaService
from apps.activation_codes.services.redemption import RedemptionService
from apps.common.permissions import IsAdmin
from apps.courses.models import Course
from apps.notifications.models import Notification


class ActivationCodeBatchViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            return ActivationCodeBatch.objects.all().select_related("created_by", "target_instructor")
        if user.role == UserRole.INSTRUCTOR:
            return ActivationCodeBatch.objects.filter(
                Q(created_by=user) | Q(target_instructor=user)
            ).select_related("created_by", "target_instructor")
        return ActivationCodeBatch.objects.filter(created_by=user).select_related(
            "created_by", "target_instructor"
        )

    def get_serializer_class(self):
        if self.action == "create":
            return ActivationCodeBatchCreateSerializer
        return ActivationCodeBatchListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        quantity = serializer.validated_data["quantity"]
        batch_type = serializer.validated_data["batch_type"]
        price = serializer.validated_data.get("price_per_code", 0)
        balance_amount = serializer.validated_data.get("balance_amount", 0)
        course_ids = serializer.validated_data.get("course_ids", [])
        target_instructor_id = serializer.validated_data.get("target_instructor_id")

        target_instructor = None

        # Center Specific Verification
        if request.user.role == UserRole.CENTER:
            center_profile = getattr(request.user, "center_profile", None)
            if not center_profile or not CenterInstructor.objects.filter(center=center_profile, is_active=True).exists():
                return Response(
                    {"error": "يجب إضافة أو ربط معلم واحد على الأقل للمركز التعليمي قبل توليد أكواد التفعيل."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not target_instructor_id:
                return Response(
                    {"error": "يجب تحديد المعلم المستهدف لربط أكواد التفعيل بمواده ودوراته."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            membership = CenterInstructor.objects.filter(
                center=center_profile, instructor_id=target_instructor_id, is_active=True
            ).select_related("instructor").first()

            if not membership:
                return Response(
                    {"error": "المعلم المحدد غير مرتبط بهذا المركز التعليمي أو تم تعليق حسابه."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target_instructor = membership.instructor

        elif request.user.role == UserRole.INSTRUCTOR:
            target_instructor = request.user

        available_quota = QuotaService.get_available_quota(request.user)
        if quantity > available_quota:
            return Response(
                {
                    "error": f"الحصة المتبقية ({available_quota}) لا تكفي لتوليد {quantity} كود. يمكنك تقديم طلب اعتماد كوتة إضافية.",
                    "can_request_quota": True,
                    "available_quota": available_quota,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if course_ids:
            # Validate ownership: courses must belong to target_instructor (or request.user)
            owner = target_instructor or request.user
            if not request.user.is_staff and getattr(request.user, "role", "") not in ("admin", "super_admin"):
                owned_courses = Course.objects.filter(id__in=course_ids, instructor=owner)
                if owned_courses.count() != len(course_ids):
                    return Response(
                        {"error": "لا يمكن توليد أكواد إلا لدورات المعلم المحدد حصراً."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                courses = owned_courses
            else:
                courses = Course.objects.filter(id__in=course_ids)
        else:
            courses = Course.objects.none()

        access_duration_days = serializer.validated_data.get("access_duration_days")
        fixed_access_until = serializer.validated_data.get("fixed_access_until")
        shelf_life_days = serializer.validated_data.get("shelf_life_days", 90)

        batch = CodeGeneratorService.generate_batch(
            user=request.user,
            batch_type=batch_type,
            quantity=quantity,
            price_per_code=price,
            balance_amount=balance_amount,
            courses=courses,
            target_instructor=target_instructor,
            access_duration_days=access_duration_days,
            fixed_access_until=fixed_access_until,
            shelf_life_days=shelf_life_days,
        )

        pdf_url = PDFGeneratorService.generate_pdf_for_batch(batch)

        return Response(
            {
                "id": batch.id,
                "message": "تم توليد الأكواد بنجاح",
                "pdf_url": request.build_absolute_uri(pdf_url) if pdf_url else None,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="extend-shelf-life")
    def extend_shelf_life(self, request, pk=None):
        batch = self.get_object()
        if (
            batch.created_by != request.user
            and not request.user.is_staff
            and getattr(request.user, "role", "") not in ("admin", "super_admin")
        ):
            return Response({"detail": "لا تملك صلاحية تمديد هذه الدفعة."}, status=status.HTTP_403_FORBIDDEN)

        try:
            additional_days = int(request.data.get("additional_days", 30))
        except (ValueError, TypeError):
            return Response({"error": "عدد الأيام غير صالح."}, status=status.HTTP_400_BAD_REQUEST)

        if additional_days <= 0:
            return Response({"error": "يجب أن يكون عدد الأيام أكبر من الصفر."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        base_date = max(batch.expires_at, now) if batch.expires_at else now
        batch.expires_at = base_date + timedelta(days=int(additional_days))
        batch.save(update_fields=["expires_at", "updated_at"])

        return Response(
            {
                "message": f"تم تمديد صلاحية شحن الدفعة بنجاح حتى {batch.expires_at.strftime('%Y-%m-%d')}.",
                "expires_at": batch.expires_at,
                "id": batch.id,
            }
        )

    @action(detail=False, methods=["get"])
    def quota(self, request):
        available = QuotaService.get_available_quota(request.user)
        max_limit = QuotaService.get_max_quota_limit(request.user)
        return Response({"available": available, "max_limit": max_limit})


class ActivationCodeItemViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ActivationCodeItemSerializer

    def get_queryset(self):
        user = self.request.user
        qs = ActivationCode.objects.select_related(
            "batch", "redeemed_by", "batch__target_instructor", "batch__created_by"
        ).prefetch_related("batch__courses")

        if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            pass
        elif user.role == UserRole.CENTER:
            qs = qs.filter(batch__created_by=user)
        elif user.role == UserRole.INSTRUCTOR:
            qs = qs.filter(Q(batch__created_by=user) | Q(batch__target_instructor=user))
        else:
            return ActivationCode.objects.none()

        status_param = self.request.query_params.get("status")
        now = timezone.now()
        if status_param == "redeemed":
            qs = qs.filter(status=ActivationCode.CodeStatus.REDEEMED)
        elif status_param == "active":
            qs = qs.filter(status=ActivationCode.CodeStatus.ACTIVE, batch__expires_at__gt=now)
        elif status_param == "expired":
            qs = qs.filter(status=ActivationCode.CodeStatus.ACTIVE, batch__expires_at__lt=now)

        batch_id = self.request.query_params.get("batch_id")
        if batch_id:
            qs = qs.filter(batch_id=batch_id)

        target_instructor_id = self.request.query_params.get("target_instructor_id")
        if target_instructor_id:
            qs = qs.filter(batch__target_instructor_id=target_instructor_id)

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(code__icontains=search)
                | Q(redeemed_by__email__icontains=search)
                | Q(redeemed_by__first_name__icontains=search)
                | Q(redeemed_by__last_name__icontains=search)
            )

        return qs.order_by("-created_at")


class CenterQuotaRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CenterQuotaRequestSerializer

    def get_queryset(self):
        user = self.request.user
        qs = CenterQuotaRequest.objects.all().select_related("center", "requested_by", "reviewed_by")
        if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            return qs
        if user.role == UserRole.CENTER:
            center_profile = getattr(user, "center_profile", None)
            if center_profile:
                return qs.filter(Q(center=center_profile) | Q(requested_by=user))
            return qs.filter(requested_by=user)
        if user.role == UserRole.INSTRUCTOR:
            return qs.filter(requested_by=user)
        return CenterQuotaRequest.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in (UserRole.CENTER, UserRole.INSTRUCTOR):
            raise ValidationError("فقط المراكز التعليمية والمعلمين يمكنهم تقديم طلبات زيادة الكوتة.")

        center_profile = getattr(user, "center_profile", None)
        current_quota = QuotaService.get_available_quota(user)
        instance = serializer.save(
            center=center_profile,
            requested_by=user,
            current_quota=current_quota,
            status=CenterQuotaRequest.Status.PENDING,
        )

        # Notify Super Admins
        requester_label = (
            center_profile.institution_name
            if center_profile
            else (user.full_name or user.email)
        )
        super_admins = User.objects.filter(role=UserRole.SUPER_ADMIN)
        for sa in super_admins:
            Notification.objects.create(
                user=sa,
                type="quota_request_created",
                title="طلب اعتماد كوتة جديدة",
                message=f"قام '{requester_label}' بطلب اعتماد كوتة إضافية لعدد {instance.requested_quantity} كود.",
            )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdmin])
    @transaction.atomic
    def review(self, request, pk=None):
        quota_request = self.get_object()
        action_type = request.data.get("action")
        admin_notes = request.data.get("admin_notes", "")

        if action_type not in ["approve", "reject"]:
            return Response({"error": "الإجراء غير صالح. استخدم 'approve' أو 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        if quota_request.status != CenterQuotaRequest.Status.PENDING:
            return Response({"error": "تمت مراجعة هذا الطلب بالفعل مسبقاً."}, status=status.HTTP_400_BAD_REQUEST)

        if action_type == "approve":
            QuotaService.grant_or_adjust_quota(
                user=quota_request.requested_by,
                additional_quantity=quota_request.requested_quantity,
                notes=f"Approved Quota Request #{quota_request.id}: {admin_notes}".strip(),
                actor=request.user,
            )
            quota_request.status = CenterQuotaRequest.Status.APPROVED
            quota_request.reviewed_by = request.user
            quota_request.reviewed_at = timezone.now()
            quota_request.admin_notes = admin_notes
            quota_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "admin_notes", "updated_at"])

            # Send Notification to requester
            Notification.objects.create(
                user=quota_request.requested_by,
                type="quota_request_approved",
                title="تمت الموافقة على طلب الكوتة الإضافية 🎉",
                message=f"وافقت الإدارة على طلب زيادة كوتة الأكواد الخاصة بكم لعدد {quota_request.requested_quantity} كود إضافي بنجاح.",
            )
            return Response(
                {
                    "message": "تم اعتماد طلب الكوتة وإضافتها بنجاح.",
                    "status": "approved",
                    "granted_quantity": quota_request.requested_quantity,
                }
            )

        elif action_type == "reject":
            quota_request.status = CenterQuotaRequest.Status.REJECTED
            quota_request.reviewed_by = request.user
            quota_request.reviewed_at = timezone.now()
            quota_request.admin_notes = admin_notes
            quota_request.save()

            Notification.objects.create(
                user=quota_request.requested_by,
                type="quota_request_rejected",
                title="تم رفض طلب الكوتة الإضافية",
                message=f"نأسف، تم رفض طلب زيادة الكوتة المقدم منكم. ملاحظات الإدارة: {admin_notes or 'لا توجد ملاحظات إضافية'}.",
            )
            return Response({"message": "تم رفض طلب الكوتة.", "status": "rejected"})

        Notification.objects.create(
            user=quota_request.requested_by,
            type="quota_request_rejected",
            title="تم رفض طلب الكوتة الإضافية",
            message=f"نأسف، تم رفض طلب زيادة الكوتة المقدم من سنتركم. ملاحظات الإدارة: {admin_notes or 'لا توجد ملاحظات إضافية'}.",
        )
        return Response({"message": "تم رفض طلب الكوتة.", "status": "rejected"})


class ActivationCodeViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    throttle_scope = "activation_codes"

    @action(detail=False, methods=["post"])
    def validate(self, request):
        serializer = CodeValidationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            code = RedemptionService.validate_code(
                serializer.validated_data["code"],
                serializer.validated_data["password"],
                expected_course_id=serializer.validated_data.get("course_id"),
                user=request.user,
            )

            courses = code.batch.courses.all()
            return Response(
                {
                    "valid": True,
                    "batch_type": code.batch.batch_type,
                    "balance_amount": str(code.batch.balance_amount)
                    if code.batch.balance_amount > 0
                    else str(code.batch.price_per_code),
                    "courses": CoursePreviewSerializer(courses, many=True).data,
                    "is_renewal": getattr(code, "is_renewal", False),
                    "current_expires_at": getattr(code, "current_expires_at", None),
                    "new_projected_expires_at": getattr(code, "new_projected_expires_at", None),
                    "access_duration_days": code.batch.access_duration_days,
                    "fixed_access_until": code.batch.fixed_access_until,
                }
            )
        except ValidationError as e:
            return Response({"error": getattr(e, "message", str(e))}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def redeem(self, request):
        serializer = CodeRedemptionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = RedemptionService.redeem_code(
                user=request.user,
                code_str=serializer.validated_data["code"],
                password=serializer.validated_data["password"],
                expected_course_id=serializer.validated_data.get("course_id"),
            )
            return Response(
                {
                    "message": result.get("message", "تم تفعيل الكود بنجاح"),
                    "batch_type": result.get("batch_type"),
                    "wallet_credit": str(result.get("wallet_credit", "0.00")),
                    "enrolled_courses": CoursePreviewSerializer(result["enrolled_courses"], many=True).data,
                    "is_renewal": result.get("is_renewal", False),
                    "new_expires_at": result.get("new_expires_at"),
                    "access_duration_days": result.get("access_duration_days"),
                    "fixed_access_until": result.get("fixed_access_until"),
                }
            )
        except ValidationError as e:
            return Response({"error": getattr(e, "message", str(e))}, status=status.HTTP_400_BAD_REQUEST)
