from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.courses.models import Category, Course, CourseStatus

User = get_user_model()


class CurriculumTaxonomyApiTests(APITestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email="instructor_acad@example.com",
            password="StrongPassword123!",
            role="instructor",
            first_name="Ahmed",
            last_name="Zewail",
        )
        self.category = Category.objects.create(name="العلوم الطبيعية", slug="natural-sciences")

    def test_curriculum_taxonomy_endpoint_returns_all_stages(self):
        response = self.client.get("/api/v1/courses/curriculum-taxonomy/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn("stages", data)
        stage_ids = [s["id"] for s in data["stages"]]
        self.assertIn("primary", stage_ids)
        self.assertIn("prep", stage_ids)
        self.assertIn("secondary", stage_ids)
        self.assertIn("baccalaureate", stage_ids)
        self.assertIn("university", stage_ids)

    def test_create_valid_secondary_3_science_with_geology(self):
        self.client.force_authenticate(self.instructor)
        payload = {
            "title": "جيولوجيا الصف الثالث الثانوي",
            "category": self.category.id,
            "description": "شرح شامل للجيولوجيا والعلوم البيئية لطلاب الثانوية العامة.",
            "short_description": "جيولوجيا 3 ثانوي",
            "educational_stage": "secondary",
            "educational_grade": "secondary_3",
            "educational_track": "scientific_science",
            "subject": "geology",
            "price": "250.00",
            "is_free": False,
            "status": "draft",
        }
        response = self.client.post("/api/v1/courses/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        course = Course.objects.get(title="جيولوجيا الصف الثالث الثانوي")
        self.assertEqual(course.educational_stage, "secondary")
        self.assertEqual(course.educational_grade, "secondary_3")
        self.assertEqual(course.educational_track, "scientific_science")
        self.assertEqual(course.subject, "geology")

    def test_invalid_secondary_2_with_geology_rejected(self):
        self.client.force_authenticate(self.instructor)
        payload = {
            "title": "جيولوجيا تانية ثانوي (غير معتمدة)",
            "category": self.category.id,
            "description": "محاولة نشر مادة في صف غير معتمد",
            "educational_stage": "secondary",
            "educational_grade": "secondary_2",
            "educational_track": "scientific_science",
            "subject": "geology",
            "price": "100.00",
            "status": "published",
        }
        response = self.client.post("/api/v1/courses/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = response.data.get("error", {}).get("errors", response.data)
        self.assertIn("subject", errors)

    def test_secondary_1_cannot_have_specialized_track(self):
        self.client.force_authenticate(self.instructor)
        payload = {
            "title": "أولى ثانوي عام بشعبة",
            "category": self.category.id,
            "description": "محاولة تشعيب أولى ثانوي",
            "educational_stage": "secondary",
            "educational_grade": "secondary_1",
            "educational_track": "scientific_science",
            "subject": "math",
            "price": "100.00",
            "status": "published",
        }
        response = self.client.post("/api/v1/courses/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = response.data.get("error", {}).get("errors", response.data)
        self.assertIn("educational_track", errors)

    def test_valid_baccalaureate_engineering_track(self):
        self.client.force_authenticate(self.instructor)
        payload = {
            "title": "الرياضيات المتقدمة - بكالوريا هندسة",
            "category": self.category.id,
            "description": "شرح متعمق للرياضيات المتقدمة في مسار الهندسة بالبكالوريا المصرية.",
            "educational_stage": "baccalaureate",
            "educational_grade": "baccalaureate_2",
            "educational_track": "bac_engineering",
            "subject": "advanced_math",
            "price": "300.00",
            "status": "draft",
        }
        response = self.client.post("/api/v1/courses/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_invalid_baccalaureate_medical_with_advanced_math_rejected(self):
        self.client.force_authenticate(self.instructor)
        payload = {
            "title": "رياضيات متقدمة لمسار الطب",
            "category": self.category.id,
            "description": "خطأ منهجي",
            "educational_stage": "baccalaureate",
            "educational_grade": "baccalaureate_2",
            "educational_track": "bac_medical",
            "subject": "advanced_math",
            "price": "100.00",
            "status": "published",
        }
        response = self.client.post("/api/v1/courses/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        errors = response.data.get("error", {}).get("errors", response.data)
        self.assertIn("subject", errors)

    def test_filter_courses_by_track_and_branch(self):
        Course.objects.create(
            title="جبر وإحصاء 1 إعدادي",
            instructor=self.instructor,
            category=self.category,
            educational_stage="prep",
            educational_grade="prep_1",
            subject="math",
            subject_branch="algebra_stats",
            price=Decimal("150.00"),
            status=CourseStatus.PUBLISHED,
        )
        Course.objects.create(
            title="هندسة 1 إعدادي",
            instructor=self.instructor,
            category=self.category,
            educational_stage="prep",
            educational_grade="prep_1",
            subject="math",
            subject_branch="geometry",
            price=Decimal("150.00"),
            status=CourseStatus.PUBLISHED,
        )

        resp1 = self.client.get("/api/v1/courses/?subject_branch=algebra_stats")
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        results1 = resp1.data.get("data", resp1.data)
        self.assertEqual(len(results1), 1)
        self.assertEqual(results1[0]["title"], "جبر وإحصاء 1 إعدادي")

        resp2 = self.client.get("/api/v1/courses/?subject_branch=geometry")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        results2 = resp2.data.get("data", resp2.data)
        self.assertEqual(len(results2), 1)
        self.assertEqual(results2[0]["title"], "هندسة 1 إعدادي")
