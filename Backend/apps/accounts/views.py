from hashlib import md5

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Avg, Count, FloatField, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.common.permissions import IsAdmin
from apps.courses.models import Course, CourseStatus, Review
from apps.courses.serializers import CourseSummarySerializer, ReviewSerializer
from apps.enrollments.models import Enrollment

from .models import AuthProvider, User, UserRole
from .permissions import IsProfileCompleted
from .serializers import (
    ChangePasswordSerializer,
    CompleteProfileSerializer,
    EmailTokenObtainPairSerializer,
    GoogleAuthSerializer,
    InstructorPublicSerializer,
    RegisterSerializer,
    RoleChangeSerializer,
    UserAdminSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user, context={"request": request}).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class GoogleAuthView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = GoogleAuthSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_register"

    @extend_schema(request=GoogleAuthSerializer, responses={200: UserSerializer})
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["credential"]
        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
        except Exception:
            return Response(
                {"error": {"status": 400, "message": "رمز Google غير صالح أو منتهي الصلاحية."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not idinfo.get("email_verified"):
            return Response(
                {"error": {"status": 400, "message": "البريد الإلكتروني الخاص بحساب Google غير موثّق."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = idinfo.get("email")
        if not email:
            return Response(
                {"error": {"status": 400, "message": "لم يتم العثور على بريد إلكتروني في حساب Google."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = User.objects.filter(email=email).select_for_update().first()
            if not user:
                given_name = idinfo.get("given_name") or (
                    idinfo.get("name", "").split()[0] if idinfo.get("name") else "User"
                )
                family_name = idinfo.get("family_name") or "Google"
                user = User.objects.create(
                    email=email,
                    first_name=given_name[:80],
                    last_name=family_name[:80],
                    auth_provider=AuthProvider.GOOGLE,
                    profile_completed=False,
                    role=serializer.validated_data.get("role", UserRole.STUDENT),
                )
                user.set_unusable_password()
                user.save()

                if user.role == UserRole.INSTRUCTOR:
                    from apps.accounts.models import InstructorProfile
                    InstructorProfile.objects.get_or_create(user=user)
                elif user.role == UserRole.CENTER:
                    from apps.accounts.models import CenterProfile
                    CenterProfile.objects.get_or_create(user=user)

            user.last_login_at = timezone.now()
            user.save(update_fields=["last_login_at"])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user, context={"request": request}).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "profile_completed": user.profile_completed,
            },
            status=status.HTTP_200_OK if user.profile_completed else status.HTTP_201_CREATED,
        )


class CompleteProfileView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    allow_incomplete_profile = True
    serializer_class = CompleteProfileSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_register"

    @extend_schema(request=CompleteProfileSerializer, responses={200: UserSerializer})
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(instance=request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "user": UserSerializer(user, context={"request": request}).data,
                "profile_completed": True,
                "message": "تم إكمال بيانات الحساب بنجاح! 🎉",
            },
            status=status.HTTP_200_OK,
        )


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]  # type: ignore[assignment]
    serializer_class = EmailTokenObtainPairSerializer  # type: ignore[assignment]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            email = request.data.get("email")
            User.objects.filter(email=email).update(last_login_at=timezone.now())
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]  # type: ignore[assignment]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_refresh"


class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"detail": "refresh token required"}, status=400)
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            return Response({"detail": "invalid token"}, status=400)
        return Response(status=204)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted]
    serializer_class = ChangePasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response({"detail": "كلمة المرور الحالية غير صحيحة."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.is_first_login = False
        user.save(update_fields=["password", "must_change_password", "is_first_login", "updated_at"])
        return Response({"detail": "تم تغيير كلمة المرور بنجاح."}, status=status.HTTP_200_OK)



class AdminUserViewSet(viewsets.ModelViewSet):
    """Admin-only user CRUD + role change."""

    queryset = User.objects.all().order_by("-created_at")
    serializer_class = UserAdminSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["role", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    ordering_fields = ["created_at", "email"]

    @action(detail=True, methods=["post"], url_path="set-role")
    def set_role(self, request, pk=None):
        user = self.get_object()
        serializer = RoleChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data["role"]
        user.role = new_role
        user.save(update_fields=["role", "updated_at"])
        # Signal will create the missing profile on save.
        return Response(UserAdminSerializer(user).data)

    @action(detail=False, methods=["get"], url_path="instructors")
    def instructors(self, request):
        qs = self.get_queryset().filter(role=UserRole.INSTRUCTOR)
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page or qs, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)


class InstructorPublicViewSet(viewsets.ReadOnlyModelViewSet):
    """Public instructor profile directory and individual instructor profile."""

    serializer_class = InstructorPublicSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["first_name", "last_name", "instructor_profile__specialization", "instructor_profile__title"]
    filterset_fields = [
        "instructor_profile__specialization",
        "instructor_profile__is_verified",
        "instructor_profile__is_featured",
    ]
    ordering_fields = ["created_at", "students_count", "rating_avg", "courses_count"]

    def get_queryset(self):
        students_subq = (
            Enrollment.objects.filter(course__instructor_id=OuterRef("pk"))
            .order_by()
            .values("course__instructor_id")
            .annotate(c=Count("student_id", distinct=True))
            .values("c")
        )

        courses_subq = (
            Course.objects.filter(instructor_id=OuterRef("pk"), status=CourseStatus.PUBLISHED)
            .order_by()
            .values("instructor_id")
            .annotate(c=Count("id"))
            .values("c")
        )

        rating_subq = (
            Review.objects.filter(course__instructor_id=OuterRef("pk"))
            .order_by()
            .values("course__instructor_id")
            .annotate(avg=Avg("rating"))
            .values("avg")
        )

        review_count_subq = (
            Review.objects.filter(course__instructor_id=OuterRef("pk"))
            .order_by()
            .values("course__instructor_id")
            .annotate(c=Count("id"))
            .values("c")
        )

        qs = (
            User.objects.filter(role=UserRole.INSTRUCTOR, is_active=True)
            .select_related("instructor_profile")
            .annotate(
                students_count=Coalesce(Subquery(students_subq), Value(0), output_field=IntegerField()),
                courses_count=Coalesce(Subquery(courses_subq), Value(0), output_field=IntegerField()),
                rating_avg=Coalesce(Subquery(rating_subq), Value(0.0), output_field=FloatField()),
                review_count=Coalesce(Subquery(review_count_subq), Value(0), output_field=IntegerField()),
            )
            .order_by("-created_at")
        )

        # Support specialization and curriculum filtering
        spec = self.request.query_params.get("specialization")
        if spec:
            qs = qs.filter(
                Q(instructor_profile__specialization__icontains=spec)
                | Q(instructor_profile__teaching_subject__icontains=spec)
            )

        subject = self.request.query_params.get("subject")
        if subject:
            qs = qs.filter(
                Q(instructor_profile__teaching_subject=subject)
                | Q(instructor_profile__specialization__icontains=subject)
            )

        stage = self.request.query_params.get("stage")
        if stage:
            qs = qs.filter(instructor_profile__teaching_stages__contains=[stage])

        grade = self.request.query_params.get("grade")
        if grade:
            qs = qs.filter(instructor_profile__teaching_grades__contains=[grade])

        return qs

    def list(self, request, *args, **kwargs):
        version = cache.get_or_set("instructors_cache_version", 1, timeout=None)
        param_str = "&".join(f"{k}={v}" for k, v in sorted(request.GET.items()))
        param_hash = md5(param_str.encode("utf-8")).hexdigest()
        cache_key = f"instructors_list:v{version}:{param_hash}"

        cached_response = cache.get(cache_key)
        if cached_response is not None:
            return Response(cached_response)

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, timeout=120)
        return response

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        courses = Course.objects.filter(instructor=instance, status="published").order_by("-created_at")
        course_serializer = CourseSummarySerializer(courses, many=True, context={"request": request})
        reviews_qs = Review.objects.filter(course__instructor=instance).select_related("student", "course").order_by("-created_at")[:15]
        reviews_data = ReviewSerializer(reviews_qs, many=True, context={"request": request}).data
        return Response({
            "instructor": serializer.data,
            "courses": course_serializer.data,
            "reviews": reviews_data,
        })

    @action(detail=True, methods=["get", "post"], url_path="reviews", permission_classes=[IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        instructor = self.get_object()
        if request.method == "GET":
            qs = Review.objects.filter(course__instructor=instructor).select_related("student", "course").order_by("-created_at")
            page = self.paginate_queryset(qs)
            serializer = ReviewSerializer(page or qs, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

        # POST: Student reviews the instructor via an enrolled course
        user = request.user
        if not user.is_authenticated:
            return Response({"detail": "يجب تسجيل الدخول لإضافة تقييم."}, status=status.HTTP_401_UNAUTHORIZED)

        enrolled_courses = Course.objects.filter(instructor=instructor, enrollments__student=user)
        if not user.is_staff and getattr(user, "role", "") not in ("admin", "super_admin") and not enrolled_courses.exists():
            return Response(
                {"detail": "يجب أن تكون مسجلاً في إحدى دورات هذا المعلم لتتمكن من تقييمه."},
                status=status.HTTP_403_FORBIDDEN,
            )

        course_id = request.data.get("course_id") or request.data.get("course")
        target_course = None
        if course_id:
            target_course = enrolled_courses.filter(pk=course_id).first()
        if not target_course:
            target_course = enrolled_courses.first()
            if not target_course and (user.is_staff or getattr(user, "role", "") in ("admin", "super_admin")):
                target_course = Course.objects.filter(instructor=instructor).first()

        if not target_course:
            return Response({"detail": "لم يتم العثور على دورة صالحة للتقييم."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ReviewSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        review, _ = Review.objects.update_or_create(
            course=target_course,
            student=user,
            defaults={
                "rating": serializer.validated_data["rating"],
                "comment": serializer.validated_data.get("comment", ""),
            },
        )
        return Response(ReviewSerializer(review, context={"request": request}).data, status=status.HTTP_201_CREATED)


class UserEntitlementsView(generics.GenericAPIView):
    """Returns dynamic feature permissions & entitlement matrix for the authenticated user."""

    permission_classes = [IsAuthenticated, IsProfileCompleted]

    def get(self, request):
        from .entitlements import resolve_user_entitlements

        entitlements = resolve_user_entitlements(request.user)
        return Response(
            {
                "user_id": request.user.id,
                "role": request.user.role,
                "subscription_plan": request.user.subscription_plan,
                "organization": request.user.organization,
                "entitlements": entitlements,
            }
        )


class AdminFeatureControlView(generics.GenericAPIView):
    """Super Admin endpoint to grant, revoke, or override feature permissions for specific users or plans."""

    permission_classes = [IsAdmin]

    def post(self, request):
        from .entitlements import invalidate_user_entitlements_cache
        from .models import Feature, PermissionAuditHistory, UserFeatureOverride

        target_user_id = request.data.get("user_id")
        feature_slug = request.data.get("feature_slug")
        is_enabled = request.data.get("is_enabled", True)
        reason = request.data.get("reason", "تعديل بواسطة السوبر أدمن")

        if not target_user_id or not feature_slug:
            return Response({"detail": "user_id and feature_slug are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=target_user_id)
            feature = Feature.objects.get(slug=feature_slug)
        except (User.DoesNotExist, Feature.DoesNotExist):
            return Response({"detail": "User or Feature not found."}, status=status.HTTP_404_NOT_FOUND)

        override, created = UserFeatureOverride.objects.update_or_create(
            user=target_user, feature=feature, defaults={"is_enabled": is_enabled, "reason": reason}
        )

        invalidate_user_entitlements_cache(target_user.id)

        PermissionAuditHistory.objects.create(
            actor=request.user,
            target_user=target_user,
            feature_slug=feature_slug,
            action="OVERRIDE_UPDATED",
            details_json={"is_enabled": is_enabled, "reason": reason},
        )

        return Response(
            {
                "status": "success",
                "message": f"تم {'تفعيل' if is_enabled else 'إيقاف'} ميزة '{feature.name}' للمستخدم {target_user.email} بنجاح.",
                "override_id": override.id,
            }
        )


class UserAvatarUploadView(generics.GenericAPIView):
    """Uploads and automatically converts user profile image to optimized WebP format."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get("avatar") or request.FILES.get("file") or request.FILES.get("image")
        if not file_obj:
            return Response({"detail": "يرجى اختيار ملف الصورة الشخصية."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.common.image_service import ImageProcessingError, process_and_save_webp

        try:
            result = process_and_save_webp(
                image_file=file_obj,
                subfolder="avatars/webp",
                max_dimension=1024,
                quality=88,
                filename_prefix=f"user_{request.user.id}",
            )
        except ImageProcessingError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"detail": "تعذر معالجة الصورة الشخصية حالياً."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        request.user.avatar = f"avatars/webp/{result['filename']}"
        request.user.save(update_fields=["avatar", "updated_at"])

        # If instructor, invalidate public instructors cache in Redis
        if request.user.role == UserRole.INSTRUCTOR:
            current_v = cache.get_or_set("instructors_cache_version", 1, timeout=None)
            cache.set("instructors_cache_version", current_v + 1, timeout=None)

        user_data = UserSerializer(request.user, context={"request": request}).data
        return Response(
            {
                "user": user_data,
                "avatar_url": result["url"],
                "format": result["format"],
                "size_bytes": result["size_bytes"],
                "message": "تم تحديث الصورة الشخصية بنجاح بصيغة WebP فائقة السرعة.",
            },
            status=status.HTTP_200_OK,
        )

