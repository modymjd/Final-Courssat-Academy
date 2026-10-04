from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import GuardianProfile, InstructorProfile, StudentProfile, User, UserRole
from apps.accounts.serializers import _sanitize_string
from apps.accounts.views import CompleteProfileView, GoogleAuthView, RegisterView


class AuthAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        RegisterView.throttle_classes = []

    def _get_errors(self, response_data):
        if "errors" in response_data:
            return response_data["errors"]
        if "error" in response_data and "errors" in response_data["error"]:
            return response_data["error"]["errors"]
        return response_data

    # ================================================================
    # Student Registration — Happy Path (preserved from original suite)
    # ================================================================

    def test_register_student_basic_success(self):
        payload = {
            "email": "student_basic@edusmart.edu",
            "full_name": "أحمد محمود حسن علي",
            "password": "Password123!",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["role"], "student")

        user = User.objects.get(email="student_basic@edusmart.edu")
        self.assertEqual(user.role, UserRole.STUDENT)
        self.assertEqual(user.first_name, "أحمد")
        self.assertEqual(user.last_name, "محمود حسن علي")
        self.assertTrue(StudentProfile.objects.filter(user=user).exists())

    def test_register_student_full_details_success(self):
        payload = {
            "email": "student_full@edusmart.edu",
            "full_name": "محمد علي السيد حسن",
            "password": "Password123!",
            "phone": "01012345678",
            "national_id": "29805150101235",  # 1998-05-15, Cairo (01), Odd (5 -> Male)
            "governorate": "القاهرة",
            "city": "مدينة نصر",
            "education_level": "university",
            "university_name": "جامعة القاهرة",
            "faculty_name": "كلية الهندسة",
            "grade_level": "الفرقة الثالثة",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)

        user = User.objects.get(email="student_full@edusmart.edu")
        self.assertEqual(user.phone, "01012345678")
        self.assertEqual(user.national_id, "29805150101235")
        self.assertEqual(user.gender, "male")
        self.assertEqual(str(user.date_of_birth), "1998-05-15")

        profile = user.student_profile
        self.assertEqual(profile.education_level, "university")
        self.assertEqual(profile.university_name, "جامعة القاهرة")
        self.assertEqual(profile.faculty_name, "كلية الهندسة")

    def test_register_minor_student_with_guardian_success(self):
        payload = {
            "email": "minor_student@edusmart.edu",
            "full_name": "عمر محمود أحمد",
            "password": "Password123!",
            "phone": "01122334455",
            "national_id": "31004121401235",  # 2010-04-12 (Under 18), Qalubia (14), Male
            "education_level": "secondary",
            "school_name": "مدرسة المتفوقين للعلوم والتكنولوجيا",
            "grade_level": "الصف الأول الثانوي",
            "guardian": {
                "full_name": "محمود أحمد علي",
                "relationship": "father",
                "phone": "01234567890",
            },
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)

        user = User.objects.get(email="minor_student@edusmart.edu")
        profile = user.student_profile
        guardian = profile.guardians.first()
        self.assertIsNotNone(guardian)
        self.assertEqual(guardian.full_name, "محمود أحمد علي")
        self.assertEqual(guardian.phone, "01234567890")

    def test_register_minor_student_without_guardian_phone_fails(self):
        payload = {
            "email": "minor_no_guardian@edusmart.edu",
            "full_name": "كريم هاني محمود",
            "password": "Password123!",
            "national_id": "31004121401235",  # 2010-04-12 (Age ~16 < 18)
            "education_level": "secondary",
            "school_name": "مدرسة الأورمان",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        errors = self._get_errors(response.data)
        self.assertIn("guardian", errors)

    def test_register_invalid_national_id_structure_fails(self):
        payload = {
            "email": "bad_nid@edusmart.edu",
            "full_name": "سارة إبراهيم علي",
            "password": "Password123!",
            "national_id": "19905159901234",  # Invalid century '1', invalid gov code '99'
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        errors = self._get_errors(response.data)
        self.assertIn("national_id", errors)

    def test_register_duplicate_phone_and_nid_fails(self):
        # Register first user
        User.objects.create_user(
            email="existing@edusmart.edu",
            password="Password123!",
            first_name="علي",
            last_name="حسن",
            phone="01099887766",
            national_id="29501010101234",
        )

        # Try duplicate phone
        res1 = self.client.post("/api/v1/auth/register/", {
            "email": "new1@edusmart.edu",
            "full_name": "حسام الدين رضا",
            "password": "Password123!",
            "phone": "01099887766",
        }, format="json")
        self.assertEqual(res1.status_code, 400)
        errors1 = self._get_errors(res1.data)
        self.assertIn("phone", errors1)

        # Try duplicate national id
        res2 = self.client.post("/api/v1/auth/register/", {
            "email": "new2@edusmart.edu",
            "full_name": "ياسر سمير طارق",
            "password": "Password123!",
            "national_id": "29501010101234",
        }, format="json")
        self.assertEqual(res2.status_code, 400)
        errors2 = self._get_errors(res2.data)
        self.assertIn("national_id", errors2)

    # ================================================================
    # Strict Privilege Registration Lockdown — Security Tests
    # ================================================================

    def test_register_admin_role_returns_403(self):
        """Attempting to register with role=admin must return 403 Forbidden."""
        payload = {
            "email": "attacker_admin@edusmart.edu",
            "full_name": "هاكر مهاجم أول",
            "password": "Password123!",
            "role": "admin",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data["error"]["error_code"],
            "PRIVILEGE_ESCALATION_ATTEMPT",
        )
        self.assertFalse(User.objects.filter(email="attacker_admin@edusmart.edu").exists())

    def test_register_super_admin_role_returns_403(self):
        """Attempting to register with role=super_admin must return 403 Forbidden."""
        payload = {
            "email": "attacker_sa@edusmart.edu",
            "full_name": "هاكر مهاجم ثاني",
            "password": "Password123!",
            "role": "super_admin",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data["error"]["error_code"],
            "PRIVILEGE_ESCALATION_ATTEMPT",
        )
        self.assertFalse(User.objects.filter(email="attacker_sa@edusmart.edu").exists())

    def test_register_center_role_success(self):
        """Registering with role=center should create User and CenterProfile successfully."""
        payload = {
            "email": "new_center@edusmart.edu",
            "full_name": "مدير سنتر الأوائل",
            "password": "Password123!",
            "role": "center",
            "institution_name": "سنتر الأوائل التعليمي",
            "institution_type": "center",
            "address": "القاهرة - مدينة نصر",
            "phone": "01099887755",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"]["role"], "center")

        user = User.objects.get(email="new_center@edusmart.edu")
        self.assertEqual(user.role, UserRole.CENTER)
        self.assertTrue(hasattr(user, "center_profile"))
        self.assertEqual(user.center_profile.institution_name, "سنتر الأوائل التعليمي")

    def test_register_instructor_role_success(self):
        """Registering with role=instructor should create User and InstructorProfile."""
        payload = {
            "email": "new_instructor@edusmart.edu",
            "full_name": "أحمد حسام معلم الرياضيات",
            "password": "Password123!",
            "role": "instructor",
            "specialization": "رياضيات ثانوية عامة",
            "qualification": "بكالوريوس تربية",
            "phone": "01233445566",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"]["role"], "instructor")

        user = User.objects.get(email="new_instructor@edusmart.edu")
        self.assertEqual(user.role, UserRole.INSTRUCTOR)
        self.assertTrue(hasattr(user, "instructor_profile"))
        self.assertEqual(user.instructor_profile.specialization, "رياضيات ثانوية عامة")

    def test_register_with_is_staff_field_returns_403(self):
        """Injecting is_staff=True in registration payload must return 403."""
        payload = {
            "email": "staff_inject@edusmart.edu",
            "full_name": "هاكر حقل النظام",
            "password": "Password123!",
            "is_staff": True,
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data["error"]["error_code"],
            "PRIVILEGE_ESCALATION_ATTEMPT",
        )
        self.assertFalse(User.objects.filter(email="staff_inject@edusmart.edu").exists())

    def test_register_with_is_superuser_field_returns_403(self):
        """Injecting is_superuser=True in registration payload must return 403."""
        payload = {
            "email": "superuser_inject@edusmart.edu",
            "full_name": "هاكر حقل السوبر",
            "password": "Password123!",
            "is_superuser": True,
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data["error"]["error_code"],
            "PRIVILEGE_ESCALATION_ATTEMPT",
        )
        self.assertFalse(User.objects.filter(email="superuser_inject@edusmart.edu").exists())

    def test_register_student_role_explicit_succeeds(self):
        """Explicitly sending role=student should succeed gracefully (not trigger 403)."""
        payload = {
            "email": "explicit_student@edusmart.edu",
            "full_name": "طالب صريح الدور",
            "password": "Password123!",
            "role": "student",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"]["role"], "student")

    def test_register_no_role_defaults_to_student(self):
        """Omitting the role field should default to student registration."""
        payload = {
            "email": "no_role@edusmart.edu",
            "full_name": "طالب بدون دور",
            "password": "Password123!",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="no_role@edusmart.edu")
        self.assertEqual(user.role, UserRole.STUDENT)

    def test_register_strips_html_from_inputs(self):
        """HTML tags in string inputs should be rejected (not silently stripped)."""
        payload = {
            "email": "xss_attempt@edusmart.edu",
            "full_name": '<script>alert("xss")</script> أحمد محمود',
            "password": "Password123!",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="xss_attempt@edusmart.edu").exists())

    def test_register_created_user_is_always_student(self):
        """DB-level verification: no matter what, created user role is student."""
        payload = {
            "email": "forced_student@edusmart.edu",
            "full_name": "طالب مؤكد دائماً",
            "password": "Password123!",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)

        user = User.objects.get(email="forced_student@edusmart.edu")
        self.assertEqual(user.role, UserRole.STUDENT)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(StudentProfile.objects.filter(user=user).exists())

    def test_register_html_injection_arabic_name_not_corrupted(self):
        """
        Arabic names with diacritics (tashkeel) and special characters
        must pass sanitization without corruption.
        """
        # Test _sanitize_string directly for precision
        self.assertEqual(_sanitize_string("محمَّد"), "محمَّد")
        self.assertEqual(_sanitize_string("علاء الدين"), "علاء الدين")
        self.assertEqual(_sanitize_string("عبد الرَّحْمَن"), "عبد الرَّحْمَن")
        self.assertEqual(_sanitize_string("مُؤَسَّسَة"), "مُؤَسَّسَة")

        # Also verify through the full registration flow
        payload = {
            "email": "arabic_diacritics@edusmart.edu",
            "full_name": "محمَّد عبد الرَّحْمَن",
            "password": "Password123!",
        }
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 201)

        user = User.objects.get(email="arabic_diacritics@edusmart.edu")
        self.assertEqual(user.first_name, "محمَّد")
        self.assertEqual(user.last_name, "عبد الرَّحْمَن")

    def test_register_endpoint_is_throttled(self):
        """RegisterView must have auth_register throttle scope configured."""
        self.assertEqual(RegisterView.throttle_scope, "auth_register")

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_RATES": {"auth_register": "2/min"},
            "DEFAULT_AUTHENTICATION_CLASSES": (
                "rest_framework_simplejwt.authentication.JWTAuthentication",
            ),
            "DEFAULT_PERMISSION_CLASSES": (),
            "DEFAULT_RENDERER_CLASSES": (
                "rest_framework.renderers.JSONRenderer",
            ),
            "DEFAULT_PARSER_CLASSES": (
                "rest_framework.parsers.JSONParser",
            ),
        },
        CACHES={
            "default": {
                "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                "LOCATION": "throttle-test-unique",
            }
        },
    )
    def test_register_endpoint_throttle_enforced(self):
        """Verify that the register endpoint actually enforces rate limiting."""
        # Restore throttle classes for this test
        RegisterView.throttle_classes = [ScopedRateThrottle]

        base_payload = {
            "full_name": "طالب اختبار الثروتل",
            "password": "Password123!",
        }
        for i in range(3):
            payload = {**base_payload, "email": f"throttle_test_{i}@edusmart.edu"}
            self.client.post("/api/v1/auth/register/", payload, format="json")

        # The 4th request should be throttled (rate is 2/min)
        payload = {**base_payload, "email": "throttle_test_blocked@edusmart.edu"}
        response = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, 429)

        # Restore for other tests
        RegisterView.throttle_classes = []

    # ================================================================
    # Google OAuth — Preserved Tests
    # ================================================================

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_new_user_creates_incomplete_profile(self, mock_verify):
        mock_verify.return_value = {
            "email": "new_google_user@edusmart.edu",
            "email_verified": True,
            "given_name": "طارق",
            "family_name": "كمال",
        }
        GoogleAuthView.throttle_classes = []

        response = self.client.post("/api/v1/auth/google/", {"credential": "valid_google_token"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertFalse(response.data["profile_completed"])

        user = User.objects.get(email="new_google_user@edusmart.edu")
        self.assertEqual(user.auth_provider, "google")
        self.assertFalse(user.profile_completed)
        self.assertFalse(user.has_usable_password())

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_existing_google_user_success(self, mock_verify):
        User.objects.create(
            email="existing_google@edusmart.edu",
            first_name="ماهر",
            last_name="سعيد",
            auth_provider="google",
            profile_completed=True,
        )
        mock_verify.return_value = {
            "email": "existing_google@edusmart.edu",
            "email_verified": True,
        }
        GoogleAuthView.throttle_classes = []

        response = self.client.post("/api/v1/auth/google/", {"credential": "valid_google_token"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["profile_completed"])

    @patch("google.oauth2.id_token.verify_oauth2_token")
    def test_google_login_email_exists_via_password_seamless_login(self, mock_verify):
        User.objects.create_user(
            email="pwd_user@edusmart.edu",
            password="Password123!",
            first_name="نبيل",
            last_name="مصطفى",
            auth_provider="email",
        )
        mock_verify.return_value = {
            "email": "pwd_user@edusmart.edu",
            "email_verified": True,
        }
        GoogleAuthView.throttle_classes = []

        response = self.client.post("/api/v1/auth/google/", {"credential": "valid_google_token"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    # ================================================================
    # Profile Completion — Preserved + Security Tests
    # ================================================================

    def test_complete_profile_success_marks_profile_completed(self):
        user = User.objects.create(
            email="incomplete_user@edusmart.edu",
            first_name="خالد",
            last_name="حسن",
            auth_provider="google",
            profile_completed=False,
            role=UserRole.STUDENT,
        )
        self.client.force_authenticate(user=user)
        CompleteProfileView.throttle_classes = []

        payload = {
            "role": "student",
            "phone": "01099887711",
            "national_id": "29708200101235",  # 1997-08-20, Cairo, Male
            "governorate": "القاهرة",
            "education_level": "university",
            "university_name": "جامعة عين شمس",
            "faculty_name": "كلية الحاسبات والمعلومات",
        }
        response = self.client.post("/api/v1/auth/complete-profile/", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["profile_completed"])

        user.refresh_from_db()
        self.assertTrue(user.profile_completed)
        self.assertEqual(user.phone, "01099887711")
        self.assertEqual(user.national_id, "29708200101235")
        self.assertEqual(user.student_profile.university_name, "جامعة عين شمس")

    def test_incomplete_profile_can_read_current_user_for_auth_bootstrap(self):
        incomplete_user = User.objects.create(
            email="incomplete_me@edusmart.edu",
            first_name="محمود",
            last_name="علي",
            auth_provider="google",
            profile_completed=False,
            role=UserRole.STUDENT,
        )
        self.client.force_authenticate(user=incomplete_user)

        response = self.client.get("/api/v1/accounts/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], incomplete_user.id)
        self.assertFalse(response.data["profile_completed"])

    def test_incomplete_profile_cannot_update_current_user_before_completion(self):
        incomplete_user = User.objects.create(
            email="incomplete_me_patch@edusmart.edu",
            first_name="حسن",
            last_name="محمد",
            auth_provider="google",
            profile_completed=False,
            role=UserRole.STUDENT,
        )
        self.client.force_authenticate(user=incomplete_user)

        response = self.client.patch(
            "/api/v1/accounts/me/",
            {"first_name": "محاولة"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        incomplete_user.refresh_from_db()
        self.assertEqual(incomplete_user.first_name, "حسن")

    def test_dashboard_access_blocked_when_profile_incomplete(self):
        incomplete_user = User.objects.create(
            email="blocked_user@edusmart.edu",
            first_name="وائل",
            last_name="صلاح",
            auth_provider="google",
            profile_completed=False,
            role=UserRole.STUDENT,
        )
        self.client.force_authenticate(user=incomplete_user)

        # Try to access entitlement API protected by DRF IsProfileCompleted permission
        response = self.client.get("/api/v1/auth/entitlements/")
        self.assertEqual(response.status_code, 403)
        self.assertIn("إكمال بيانات حسابك", str(response.data))
