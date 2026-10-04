import io

import pyotp
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import GuardianProfile, InstructorProfile, StudentProfile, UserRole
from apps.common.sanitizers import sanitize_html_content
from apps.common.validators import validate_is_mp4_or_mov, validate_is_pdf
from apps.courses.models import Category

User = get_user_model()


class Phase0SecurityTests(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(name="الرياضيات", slug="math")

    def test_student_registration_creates_profile(self):
        """Test student registration creates a valid user and StudentProfile."""
        payload = {
            "role": "student",
            "email": "student1@test.com",
            "password": "Password123!",
            "first_name": "أحمد",
            "last_name": "علي",
            "phone": "01012345678",
            "national_id": "29901010101234",
            "education_level": "secondary",
            "school_name": "مدرسة النيل",
            "grade_level": "الصف الثالث الثانوي",
        }
        res = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="student1@test.com")
        self.assertEqual(user.role, UserRole.STUDENT)
        self.assertTrue(StudentProfile.objects.filter(user=user).exists())

    def test_instructor_registration_creates_profile(self):
        """Test instructor registration creates InstructorProfile with unverified status."""
        from django.core.cache import cache

        cache.clear()
        payload = {
            "role": "instructor",
            "email": "instructor1@test.com",
            "password": "Password123!",
            "first_name": "د. طارق",
            "last_name": "محمود",
            "phone": "01112345678",
            "national_id": "28501010101234",
            "specialization": "فيزياء ثانوية عامة",
            "qualification": "دكتوراه في الفيزياء",
        }
        res = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="instructor1@test.com")
        self.assertEqual(user.role, UserRole.INSTRUCTOR)
        profile = InstructorProfile.objects.get(user=user)
        self.assertEqual(profile.specialization, "فيزياء ثانوية عامة")
        self.assertFalse(profile.is_verified)

    def test_guardian_registration_with_valid_student_national_id(self):
        """Test guardian registration successfully links to student via National ID."""
        from django.core.cache import cache

        cache.clear()
        # 1. Create Student (post_save creates StudentProfile automatically)
        student = User.objects.create_user(
            email="student_child@test.com",
            password="Password123!",
            first_name="كريم",
            last_name="حسن",
            role=UserRole.STUDENT,
            national_id="30501010101234",
        )

        # 2. Register Guardian
        payload = {
            "role": "guardian",
            "email": "guardian_parent@test.com",
            "password": "Password123!",
            "first_name": "حسن",
            "last_name": "إبراهيم",
            "phone": "01212345678",
            "national_id": "27001010101234",
            "student_national_id": "30501010101234",
            "guardian_relationship": "father",
        }
        res = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        guardian = User.objects.get(email="guardian_parent@test.com")
        self.assertEqual(guardian.role, UserRole.GUARDIAN)
        self.assertTrue(
            GuardianProfile.objects.filter(
                guardian_user=guardian,
                student_profile__user=student,
            ).exists()
        )

    def test_guardian_registration_fails_if_student_not_found(self):
        """Test guardian registration rejects non-existent student national ID."""
        from django.core.cache import cache

        cache.clear()
        payload = {
            "role": "guardian",
            "email": "guardian_fail@test.com",
            "password": "Password123!",
            "first_name": "محمد",
            "last_name": "عثمان",
            "phone": "01287654321",
            "national_id": "27501010101234",
            "student_national_id": "30501010109999",  # Non-existent
        }
        res = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_privilege_escalation_blocked(self):
        """Test that attempting to register with role=admin or is_superuser is blocked with 403."""
        from django.core.cache import cache

        cache.clear()
        payload = {
            "role": "admin",
            "email": "hacker@test.com",
            "password": "Password123!",
            "first_name": "Evil",
            "last_name": "Hacker",
        }
        res = self.client.post("/api/v1/auth/register/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        cache.clear()
        # Injected is_superuser check
        payload_superuser = {
            "role": "student",
            "email": "hacker2@test.com",
            "password": "Password123!",
            "first_name": "Evil",
            "last_name": "Hacker",
            "is_superuser": True,
        }
        res2 = self.client.post("/api/v1/auth/register/", payload_superuser, format="json")
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_2fa_totp_enforcement(self):
        """Test Super Admin 2FA rejects dummy 123456 code and verifies true TOTP."""
        super_admin = User.objects.create_user(
            email="superadmin@test.com",
            password="AdminPassword123!",
            first_name="Super",
            last_name="Admin",
            role=UserRole.SUPER_ADMIN,
        )
        secret = pyotp.random_base32()
        super_admin.totp_secret = secret
        super_admin.save()

        self.client.force_authenticate(user=super_admin)

        # 1. Dummy code rejected
        res_fake = self.client.post("/api/v1/super-admin/auth/verify-2fa/", {"code": "123456"}, format="json")
        self.assertEqual(res_fake.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Valid TOTP code accepted
        totp = pyotp.TOTP(secret)
        valid_code = totp.now()
        res_valid = self.client.post("/api/v1/super-admin/auth/verify-2fa/", {"code": valid_code}, format="json")
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)
        self.assertTrue(res_valid.data.get("is_2fa_verified"))

    def test_html_ast_sanitizer(self):
        """Test HTML AST Sanitizer strips scripts and event handlers while preserving safe tags."""
        malicious_input = '<p>مرحباً بكم في <script>alert("XSS")</script><b onclick="evil()">الدرس الأول</b></p>'
        cleaned = sanitize_html_content(malicious_input)
        self.assertNotIn("script", cleaned)
        self.assertNotIn("onclick", cleaned)
        self.assertIn("<p>مرحباً بكم في ", cleaned)
        self.assertIn("<b>الدرس الأول</b>", cleaned)

    def test_magic_bytes_validator(self):
        """Test binary header sniffing for MP4 and PDF."""
        # Simulated MP4 ftyp box
        mp4_stream = io.BytesIO(b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2mp41")
        self.assertTrue(validate_is_mp4_or_mov(mp4_stream))

        # Simulated PDF header
        pdf_stream = io.BytesIO(b"%PDF-1.7\r\n\x25\xe2\xe3\xcf\xd3\r\n")
        self.assertTrue(validate_is_pdf(pdf_stream))

        # Disguised PHP script

    def test_complete_profile_as_guardian_with_valid_student_national_id(self):
        """Test completing profile as guardian links to student successfully."""
        from django.core.cache import cache

        cache.clear()

        # 1. Create Student
        student = User.objects.create_user(
            email="student_child_google@test.com",
            password="Password123!",
            first_name="مازن",
            last_name="سامح",
            role=UserRole.STUDENT,
            national_id="30601010101234",
        )

        # 2. Create Incomplete Guardian (e.g. from Google OAuth)
        guardian = User.objects.create_user(
            email="parent_google@test.com",
            first_name="سامح",
            last_name="عادل",
            role=UserRole.STUDENT,
            profile_completed=False,
        )

        self.client.force_authenticate(user=guardian)
        payload = {
            "role": "guardian",
            "phone": "01099887766",
            "national_id": "27801010101234",
            "student_national_id": "30601010101234",
            "guardian_relationship": "father",
            "governorate": "الجيزة",
            "city": "الدقي",
        }
        res = self.client.post("/api/v1/auth/complete-profile/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        guardian.refresh_from_db()
        self.assertEqual(guardian.role, UserRole.GUARDIAN)
        self.assertTrue(guardian.profile_completed)
        self.assertTrue(
            GuardianProfile.objects.filter(
                guardian_user=guardian,
                student_profile__user=student,
            ).exists()
        )

    def test_complete_profile_as_guardian_fails_if_student_not_found(self):
        """Test completing profile as guardian fails if student national ID does not exist."""
        from django.core.cache import cache

        cache.clear()

        guardian = User.objects.create_user(
            email="parent_fail_google@test.com",
            first_name="أحمد",
            last_name="سعيد",
            role=UserRole.STUDENT,
            profile_completed=False,
        )

        self.client.force_authenticate(user=guardian)
        payload = {
            "role": "guardian",
            "phone": "01099887755",
            "national_id": "27901010101234",
            "student_national_id": "30601010109999",  # Non-existent
            "guardian_relationship": "father",
        }
        res = self.client.post("/api/v1/auth/complete-profile/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
