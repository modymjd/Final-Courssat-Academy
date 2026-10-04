import secrets
import string

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CenterInstructor, CenterProfile, InstructorProfile, User, UserRole
from apps.accounts.permissions import IsProfileCompleted
from apps.notifications.models import Notification


class IsCenterOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [UserRole.CENTER, UserRole.ADMIN, UserRole.SUPER_ADMIN]


class CenterInstructorSerializer(serializers.ModelSerializer):
    instructor_id = serializers.IntegerField(source="instructor.id", read_only=True)
    full_name = serializers.CharField(source="instructor.full_name", read_only=True)
    email = serializers.CharField(source="instructor.email", read_only=True)
    phone = serializers.CharField(source="instructor.phone", read_only=True)
    teacher_uid = serializers.SerializerMethodField()
    specialization = serializers.SerializerMethodField()
    qualification = serializers.SerializerMethodField()
    active_students_count = serializers.SerializerMethodField()

    class Meta:
        model = CenterInstructor
        fields = (
            "id",
            "instructor_id",
            "full_name",
            "email",
            "phone",
            "teacher_uid",
            "specialization",
            "qualification",
            "subject",
            "student_quota",
            "is_active",
            "is_approved",
            "joined_at",
            "active_students_count",
        )
        read_only_fields = ("id", "instructor_id", "full_name", "email", "phone", "joined_at")

    def get_teacher_uid(self, obj) -> str:
        profile = getattr(obj.instructor, "instructor_profile", None)
        return profile.teacher_uid if profile else ""

    def get_specialization(self, obj) -> str:
        profile = getattr(obj.instructor, "instructor_profile", None)
        return profile.specialization if profile else ""

    def get_qualification(self, obj) -> str:
        profile = getattr(obj.instructor, "instructor_profile", None)
        return profile.qualification if profile else ""

    def get_active_students_count(self, obj) -> int:
        return getattr(obj, "active_students_count", 0)


class CenterInstructorListView(generics.ListAPIView):
    serializer_class = CenterInstructorSerializer
    permission_classes = [IsAuthenticated, IsProfileCompleted, IsCenterOrAdmin]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        queryset = CenterInstructor.objects.select_related("instructor", "instructor__instructor_profile").annotate(
            active_students_count=Count(
                "instructor__instructor_student_memberships",
                filter=Q(instructor__instructor_student_memberships__is_active=True),
                distinct=True,
            )
        )

        if user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            center_id = self.request.query_params.get("center_id")
            if center_id:
                return queryset.filter(center_id=center_id).order_by("-joined_at")
            return queryset.order_by("-joined_at")

        center_profile = get_object_or_404(CenterProfile, user=user)
        return queryset.filter(center=center_profile).order_by("-joined_at")


class CenterInstructorLinkExistingView(APIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted, IsCenterOrAdmin]

    def post(self, request, *args, **kwargs):
        center_profile = get_object_or_404(CenterProfile, user=request.user)
        teacher_uid = request.data.get("teacher_uid", "").strip().upper()
        email = request.data.get("email", "").strip().lower()
        subject = request.data.get("subject", "").strip()
        student_quota = int(request.data.get("student_quota", 0) or 0)

        instructor_user = None
        if teacher_uid:
            instructor_profile = (
                InstructorProfile.objects.filter(teacher_uid=teacher_uid).select_related("user").first()
            )
            if instructor_profile:
                instructor_user = instructor_profile.user
        elif email:
            instructor_user = User.objects.filter(email=email, role=UserRole.INSTRUCTOR).first()

        if not instructor_user or instructor_user.role != UserRole.INSTRUCTOR:
            return Response(
                {"detail": "لم يتم العثور على معلم مسجل بهذا الكود التعريفي (Teacher UID) أو البريد الإلكتروني."},
                status=status.HTTP_404_NOT_FOUND,
            )

        membership, created = CenterInstructor.objects.get_or_create(
            center=center_profile,
            instructor=instructor_user,
            defaults={
                "subject": subject,
                "student_quota": student_quota,
                "is_active": True,
                "is_approved": True,
            },
        )

        if not created:
            membership.subject = subject or membership.subject
            membership.student_quota = student_quota
            membership.is_active = True
            membership.save()

        Notification.objects.create(
            user=instructor_user,
            type="center_linked",
            title="تم ربط حسابك بمركز تعليمي",
            message=f"قام سنتر '{center_profile.institution_name}' بإضافتك إلى هيئة التدريس التابعة له لمادة ({subject or 'العامة'}).",
        )

        return Response(
            {
                "detail": "تم ربط المعلم بالسنتر بنجاح.",
                "membership": CenterInstructorSerializer(membership).data,
                "is_newly_linked": created,
            },
            status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED,
        )


class CenterInstructorProvisionNewView(APIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted, IsCenterOrAdmin]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        center_profile = get_object_or_404(CenterProfile, user=request.user)

        full_name = request.data.get("full_name", "").strip()
        email = request.data.get("email", "").strip().lower()
        phone = request.data.get("phone", "").strip()
        national_id = request.data.get("national_id", "").strip()
        subject = request.data.get("subject", "").strip()
        student_quota = int(request.data.get("student_quota", 0) or 0)

        if not full_name or not email:
            return Response({"detail": "الاسم والبريد الإلكتروني حقول إجبارية."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "البريد الإلكتروني مسجل بالفعل لمستخدم آخر. يمكنك استخدام ميزة الربط المباشر."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if phone and User.objects.filter(phone=phone).exists():
            return Response({"detail": "رقم الهاتف مسجل بالفعل لمعلم آخر."}, status=status.HTTP_400_BAD_REQUEST)

        chars = string.ascii_letters + string.digits
        temp_suffix = "".join(secrets.choice(chars) for _ in range(6))
        temp_password = f"Edu@{temp_suffix}!"

        name_parts = full_name.split()
        first_name = name_parts[0]
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "المعلم"

        user = User.objects.create_user(
            email=email,
            password=temp_password,
            first_name=first_name,
            last_name=last_name,
            phone=phone or None,
            national_id=national_id or None,
            role=UserRole.INSTRUCTOR,
            profile_completed=True,
            must_change_password=True,
            is_first_login=True,
        )

        instructor_profile, _ = InstructorProfile.objects.get_or_create(
            user=user,
            defaults={
                "specialization": subject or "عام",
                "title": "معلم",
                "qualification": "مؤهل تربوي",
            },
        )

        membership = CenterInstructor.objects.create(
            center=center_profile,
            instructor=user,
            subject=subject,
            student_quota=student_quota,
            is_active=True,
            is_approved=True,
        )

        return Response(
            {
                "detail": "تم إنشاء حساب المعلم وربطه بالسنتر بنجاح.",
                "temporary_password": temp_password,
                "teacher_uid": instructor_profile.teacher_uid,
                "user_id": user.id,
                "email": user.email,
                "membership": CenterInstructorSerializer(membership).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CenterInstructorDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CenterInstructorSerializer
    permission_classes = [IsAuthenticated, IsProfileCompleted, IsCenterOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            return CenterInstructor.objects.all()
        center_profile = get_object_or_404(CenterProfile, user=user)
        return CenterInstructor.objects.filter(center=center_profile)

    def perform_destroy(self, instance):
        Notification.objects.create(
            user=instance.instructor,
            type="center_unlinked",
            title="تم فك الارتباط بالمركز التعليمي",
            message=f"تم إلغاء ارتباطك بمركز '{instance.center.institution_name}'.",
        )
        instance.delete()
