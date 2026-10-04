from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.accounts.models import InstructorProfile, User, UserRole
from apps.courses.models import Category, Course, CourseStatus, Review
from apps.enrollments.models import Enrollment


class PublicTrainersAPITestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(name="الرياضيات والفيزياء", slug="math-physics")

    def create_mock_instructor(self, email_suffix: int, is_verified=False, is_featured=False):
        user = User.objects.create_user(
            email=f"instructor_{email_suffix}@edusmart.edu",
            password="password123",
            first_name=f"مدرب_{email_suffix}",
            last_name="سليمان",
            role=UserRole.INSTRUCTOR,
        )
        profile = getattr(user, "instructor_profile", None)
        if not profile:
            profile = InstructorProfile.objects.create(user=user)
        profile.specialization = "الفيزياء والرياضيات"
        profile.is_verified = is_verified
        profile.is_featured = is_featured
        profile.save()
        return user

    def test_cartesian_product_and_subquery_accuracy(self):
        """Verify that 1 student enrolled in 2 courses taught by the same instructor results in students_count=1 and courses_count=2 (No Cartesian explosion)."""
        instructor = self.create_mock_instructor(1, is_verified=True)
        student = User.objects.create_user(
            email="student_test@edusmart.edu",
            password="password123",
            first_name="طالب",
            last_name="اختبار",
            role=UserRole.STUDENT,
        )

        # Create 2 published courses for this instructor
        course1 = Course.objects.create(
            title="فيزياء 1",
            instructor=instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
        )
        course2 = Course.objects.create(
            title="فيزياء 2",
            instructor=instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
        )

        # Student enrolls in BOTH courses
        Enrollment.objects.create(student=student, course=course1)
        Enrollment.objects.create(student=student, course=course2)

        # Reviews added
        Review.objects.create(course=course1, student=student, rating=5, comment="ممتاز جداً")
        Review.objects.create(course=course2, student=student, rating=4, comment="جيد جداً")

        res = self.client.get("/api/v1/accounts/instructors/")
        self.assertEqual(res.status_code, 200)
        data = res.data.get("data") or res.data.get("results")
        self.assertEqual(len(data), 1)

        inst_data = data[0]
        self.assertEqual(inst_data["id"], instructor.id)
        students_cnt = inst_data.get("students_count", inst_data.get("studentsCount"))
        courses_cnt = inst_data.get("courses_count", inst_data.get("coursesCount"))
        rating_avg = inst_data.get("rating_avg", inst_data.get("ratingAvg"))
        review_cnt = inst_data.get("review_count", inst_data.get("reviewCount"))
        is_verif = inst_data.get("is_verified", inst_data.get("isVerified"))

        self.assertEqual(students_cnt, 1)  # 1 unique student, NOT 2 or 4!
        self.assertEqual(courses_cnt, 2)   # 2 published courses
        self.assertEqual(rating_avg, 4.5)   # (5 + 4) / 2
        self.assertEqual(review_cnt, 2)
        self.assertTrue(is_verif)

    def test_n_plus_one_query_safety_comparative(self):
        """Compare query counts for 3 instructors vs 15 instructors to prove O(1) query complexity."""
        for i in range(3):
            self.create_mock_instructor(100 + i)

        cache.clear()
        with CaptureQueriesContext(connection) as ctx_small:
            res1 = self.client.get("/api/v1/accounts/instructors/")
            self.assertEqual(res1.status_code, 200)
        queries_with_3 = len(ctx_small.captured_queries)

        for i in range(12):
            self.create_mock_instructor(200 + i)

        cache.clear()
        with CaptureQueriesContext(connection) as ctx_large:
            res2 = self.client.get("/api/v1/accounts/instructors/")
            self.assertEqual(res2.status_code, 200)
        queries_with_15 = len(ctx_large.captured_queries)

        self.assertEqual(
            queries_with_3,
            queries_with_15,
            f"N+1 regression detected! {queries_with_3} queries with 3 instructors vs {queries_with_15} with 15 instructors",
        )

    def test_cache_versioning_invalidation_on_verification_change(self):
        """Verify that modifying is_verified bumps cache version and returns fresh data."""
        instructor = self.create_mock_instructor(300, is_verified=False)

        # Initial request caches unverified instructor
        res1 = self.client.get("/api/v1/accounts/instructors/")
        self.assertEqual(res1.status_code, 200)
        data1 = res1.data.get("data") or res1.data.get("results")
        is_verif1 = data1[0].get("is_verified", data1[0].get("isVerified"))
        self.assertFalse(is_verif1)

        # Update verification flag (triggers pre_save/post_save signal -> bump_instructors_cache_version)
        profile = instructor.instructor_profile
        profile.is_verified = True
        profile.save()

        # Subsequent request must bypass stale cache and return is_verified=True
        res2 = self.client.get("/api/v1/accounts/instructors/")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.data.get("data") or res2.data.get("results")
        is_verif2 = data2[0].get("is_verified", data2[0].get("isVerified"))
        self.assertTrue(is_verif2)


