from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User, UserRole
from apps.assessments.models import Exam, ExamKind
from apps.courses.models import Category, Course, CourseStatus, Lesson, Module


def make_user(email, role):
    return User.objects.create_user(
        email=email,
        password="pw12345678",
        first_name="Test",
        last_name="User",
        role=role,
    )


class InstructorCourseApiContractTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.instructor = make_user("contract-instructor@example.com", UserRole.INSTRUCTOR)
        cls.other_instructor = make_user("contract-other@example.com", UserRole.INSTRUCTOR)
        cls.super_admin = make_user("contract-super-admin@example.com", UserRole.SUPER_ADMIN)
        cls.category = Category.objects.create(name="Contract Category", slug="contract-category")
        cls.own_course = Course.objects.create(
            title="Own Draft",
            instructor=cls.instructor,
            category=cls.category,
            status=CourseStatus.DRAFT,
        )
        cls.public_course = Course.objects.create(
            title="Public Course",
            instructor=cls.other_instructor,
            category=cls.category,
            status=CourseStatus.PUBLISHED,
        )
        cls.module = Module.objects.create(course=cls.own_course, title="Module", order=1)
        cls.lesson = Lesson.objects.create(module=cls.module, title="Lesson", order=1)

    def test_instructor_mine_filter_returns_only_owned_courses(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.get("/api/v1/courses/?mine=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        results = payload.get("data", payload.get("results", payload)) if isinstance(payload, dict) else payload
        self.assertEqual([course["id"] for course in results], [self.own_course.id])

    def test_course_creation_idempotency_replays_same_course(self):
        self.client.force_authenticate(self.instructor)
        payload = {
            "title": "Idempotent Course",
            "category": self.category.id,
            "description": "Retry-safe creation contract.",
            "educational_stage": "secondary",
            "educational_grade": "secondary_1",
            "subject": "math",
            "price": "100.00",
            "is_free": False,
        }
        headers = {"HTTP_IDEMPOTENCY_KEY": "course-create-contract-001"}

        first = self.client.post("/api/v1/courses/", payload, format="json", **headers)
        second = self.client.post("/api/v1/courses/", payload, format="json", **headers)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(second.headers.get("Idempotency-Replayed"), "true")
        self.assertEqual(
            Course.objects.filter(
                instructor=self.instructor,
                creation_idempotency_key="course-create-contract-001",
            ).count(),
            1,
        )

    def test_course_creation_idempotency_uses_validated_payload_equivalence(self):
        self.client.force_authenticate(self.instructor)
        key = "course-create-contract-normalized-001"

        first = self.client.post(
            "/api/v1/courses/",
            {
                "title": "Validated Payload Course",
                "category": self.category.id,
                "price": "100.00",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        )
        second = self.client.post(
            "/api/v1/courses/",
            {
                "title": "Validated Payload Course",
                "category": str(self.category.id),
                "price": 100,
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(second.headers.get("Idempotency-Replayed"), "true")

    def test_course_creation_idempotency_rejects_same_key_for_different_request(self):
        self.client.force_authenticate(self.instructor)
        headers = {"HTTP_IDEMPOTENCY_KEY": "course-create-contract-002"}
        first_payload = {
            "title": "Original Idempotent Course",
            "category": self.category.id,
        }
        different_payload = {
            "title": "Different Idempotent Course",
            "category": self.category.id,
        }

        first = self.client.post("/api/v1/courses/", first_payload, format="json", **headers)
        second = self.client.post("/api/v1/courses/", different_payload, format="json", **headers)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT, second.data)
        self.assertEqual(
            Course.objects.filter(
                instructor=self.instructor,
                creation_idempotency_key="course-create-contract-002",
            ).count(),
            1,
        )

    def test_course_creation_idempotency_key_is_scoped_to_creator(self):
        payload = {
            "title": "Scoped Idempotent Course",
            "category": self.category.id,
        }
        headers = {"HTTP_IDEMPOTENCY_KEY": "course-create-contract-003"}

        self.client.force_authenticate(self.instructor)
        first = self.client.post("/api/v1/courses/", payload, format="json", **headers)

        self.client.force_authenticate(self.other_instructor)
        second = self.client.post("/api/v1/courses/", payload, format="json", **headers)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertNotEqual(first.data["id"], second.data["id"])

    def test_instructor_can_create_course_without_sending_instructor_id(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.post(
            "/api/v1/courses/",
            {
                "title": "Created From Instructor Dashboard",
                "category": self.category.id,
                "description": "A valid course description.",
                "short_description": "Short description",
                "educational_stage": "secondary",
                "educational_grade": "secondary_1",
                "subject": "math",
                "level": "beginner",
                "language": "ar",
                "price": "100.00",
                "is_free": False,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created = Course.objects.get(title="Created From Instructor Dashboard")
        self.assertEqual(created.instructor_id, self.instructor.id)

    def test_other_instructor_cannot_access_foreign_lesson_content(self):
        self.client.force_authenticate(self.other_instructor)
        response = self.client.get(f"/api/v1/courses/{self.own_course.id}/lessons/{self.lesson.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_super_admin_can_update_course(self):
        self.client.force_authenticate(self.super_admin)
        response = self.client.patch(
            f"/api/v1/courses/{self.own_course.id}/",
            {"title": "Super Admin Updated"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_unauthenticated_mine_filter_does_not_expose_courses(self):
        response = self.client.get("/api/v1/courses/?mine=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        results = payload.get("data", payload.get("results", payload)) if isinstance(payload, dict) else payload
        self.assertEqual(results, [])

    def test_curriculum_sync_reorders_and_creates_without_unique_conflict(self):
        self.client.force_authenticate(self.instructor)
        second_module = Module.objects.create(course=self.own_course, title="Second", order=2)
        second_lesson = Lesson.objects.create(module=second_module, title="Second Lesson", order=2)

        response = self.client.post(
            f"/api/v1/courses/{self.own_course.id}/curriculum/",
            {
                "modules": [
                    {
                        "id": second_module.id,
                        "title": "Second Updated",
                        "order": 0,
                        "lessons": [
                            {
                                "id": second_lesson.id,
                                "title": "Second Lesson Updated",
                                "type": "video",
                                "duration": "00:15:00",
                                "order": 0,
                                "is_free": True,
                            }
                        ],
                    },
                    {
                        "id": self.module.id,
                        "title": "First Updated",
                        "order": 1,
                        "lessons": [
                            {
                                "id": self.lesson.id,
                                "title": "First Lesson Updated",
                                "type": "article",
                                "duration": "00:05:00",
                                "order": 0,
                                "is_free": False,
                            }
                        ],
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.module.refresh_from_db()
        self.lesson.refresh_from_db()
        second_module.refresh_from_db()
        second_lesson.refresh_from_db()
        self.assertEqual(second_module.order, 0)
        self.assertEqual(self.module.order, 1)
        self.assertEqual(second_lesson.module_id, second_module.id)
        self.assertEqual(self.lesson.module_id, self.module.id)
        self.assertEqual(second_lesson.order, 0)
        self.assertEqual(self.lesson.order, 0)

    def test_curriculum_sync_can_move_lesson_out_of_deleted_module(self):
        self.client.force_authenticate(self.instructor)
        source_module = Module.objects.create(course=self.own_course, title="Source", order=2)
        moved_lesson = Lesson.objects.create(module=source_module, title="Moved Lesson", order=0)

        response = self.client.post(
            f"/api/v1/courses/{self.own_course.id}/curriculum/",
            {
                "modules": [
                    {
                        "id": self.module.id,
                        "title": "Destination",
                        "order": 0,
                        "lessons": [
                            {
                                "id": self.lesson.id,
                                "title": "Existing Lesson",
                                "type": "video",
                                "duration": "00:05:00",
                                "order": 0,
                                "is_free": False,
                            },
                            {
                                "id": moved_lesson.id,
                                "title": "Moved Lesson",
                                "type": "video",
                                "duration": "00:07:00",
                                "order": 1,
                                "is_free": True,
                            },
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        moved_lesson.refresh_from_db()
        self.assertEqual(moved_lesson.module_id, self.module.id)
        self.assertFalse(Module.objects.filter(pk=source_module.id).exists())
        self.assertEqual(moved_lesson.order, 1)

    def test_curriculum_sync_refuses_to_delete_lesson_with_assessment(self):
        self.client.force_authenticate(self.instructor)
        exam = Exam.objects.create(
            course=self.own_course,
            lesson=self.lesson,
            title="Lesson Quiz",
            kind=ExamKind.LESSON_QUIZ,
        )

        response = self.client.post(
            f"/api/v1/courses/{self.own_course.id}/curriculum/",
            {"modules": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn("curriculum", response.data.get("error", {}).get("errors", {}))
        self.assertTrue(Lesson.objects.filter(pk=self.lesson.id).exists())
        self.assertTrue(Module.objects.filter(pk=self.module.id).exists())
        self.assertTrue(Exam.objects.filter(pk=exam.id, lesson_id=self.lesson.id).exists())

    def test_curriculum_sync_refuses_to_delete_module_with_unit_assessment(self):
        self.client.force_authenticate(self.instructor)
        exam = Exam.objects.create(
            course=self.own_course,
            unit=self.module,
            title="Unit Exam",
            kind=ExamKind.UNIT_EXAM,
        )

        response = self.client.post(
            f"/api/v1/courses/{self.own_course.id}/curriculum/",
            {"modules": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn(
            "curriculum",
            response.data.get("error", {}).get("errors", {}),
        )
        self.assertTrue(Module.objects.filter(pk=self.module.id).exists())
        self.assertTrue(Lesson.objects.filter(pk=self.lesson.id).exists())
        self.assertTrue(Exam.objects.filter(pk=exam.id, unit_id=self.module.id).exists())

    def test_curriculum_sync_is_atomic_on_invalid_existing_id(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.post(
            f"/api/v1/courses/{self.own_course.id}/curriculum/",
            {
                "modules": [
                    {
                        "id": self.module.id,
                        "title": "Should Not Persist",
                        "order": 0,
                        "lessons": [
                            {
                                "id": 999999999,
                                "title": "Invalid Lesson",
                                "type": "video",
                                "duration": "00:01:00",
                                "order": 0,
                                "is_free": False,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.module.refresh_from_db()
        self.assertEqual(self.module.title, "Module")
        self.assertEqual(self.module.order, 1)

    def test_other_instructor_cannot_sync_foreign_course_curriculum(self):
        self.client.force_authenticate(self.other_instructor)
        response = self.client.post(
            f"/api/v1/courses/{self.own_course.id}/curriculum/",
            {"modules": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_direct_lesson_delete_refuses_assessment_dependency(self):
        self.client.force_authenticate(self.instructor)
        exam = Exam.objects.create(
            course=self.own_course,
            lesson=self.lesson,
            title="Direct Lesson Delete Guard",
            kind=ExamKind.LESSON_QUIZ,
        )

        response = self.client.delete(f"/api/v1/lessons/{self.lesson.id}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn("curriculum", response.data.get("error", {}).get("errors", {}))
        self.assertTrue(Lesson.objects.filter(pk=self.lesson.id).exists())
        self.assertTrue(Exam.objects.filter(pk=exam.id, lesson_id=self.lesson.id).exists())

    def test_direct_module_delete_refuses_assessment_dependency_through_child_lesson(self):
        self.client.force_authenticate(self.instructor)
        exam = Exam.objects.create(
            course=self.own_course,
            lesson=self.lesson,
            title="Module Child Lesson Delete Guard",
            kind=ExamKind.LESSON_QUIZ,
        )

        response = self.client.delete(f"/api/v1/modules/{self.module.id}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn("curriculum", response.data.get("error", {}).get("errors", {}))
        self.assertTrue(Module.objects.filter(pk=self.module.id).exists())
        self.assertTrue(Lesson.objects.filter(pk=self.lesson.id).exists())
        self.assertTrue(Exam.objects.filter(pk=exam.id, lesson_id=self.lesson.id).exists())

    def test_direct_module_delete_refuses_assessment_dependency(self):
        self.client.force_authenticate(self.instructor)
        exam = Exam.objects.create(
            course=self.own_course,
            unit=self.module,
            title="Direct Module Delete Guard",
            kind=ExamKind.UNIT_EXAM,
        )

        response = self.client.delete(f"/api/v1/modules/{self.module.id}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn("curriculum", response.data.get("error", {}).get("errors", {}))
        self.assertTrue(Module.objects.filter(pk=self.module.id).exists())
        self.assertTrue(Lesson.objects.filter(pk=self.lesson.id).exists())
        self.assertTrue(Exam.objects.filter(pk=exam.id, unit_id=self.module.id).exists())

    def test_direct_lesson_delete_succeeds_when_no_assessment_depends_on_it(self):
        self.client.force_authenticate(self.instructor)

        response = self.client.delete(f"/api/v1/lessons/{self.lesson.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT, response.data)
        self.assertFalse(Lesson.objects.filter(pk=self.lesson.id).exists())


    def test_course_creation_contract_sets_server_owned_fields_and_returns_created_resource(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.post(
            "/api/v1/courses/",
            {
                "title": "Server Owned Course Contract",
                "category": self.category.id,
                "status": "draft",
                "price": "150.00",
                "is_free": False,
                "instructor": self.other_instructor.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn("id", response.data)
        self.assertEqual(response.data["title"], "Server Owned Course Contract")
        self.assertEqual(response.data["status"], CourseStatus.DRAFT)

        created = Course.objects.get(pk=response.data["id"])
        self.assertEqual(created.instructor_id, self.instructor.id)
        self.assertEqual(created.category_id, self.category.id)
        self.assertEqual(created.status, CourseStatus.DRAFT)

    def test_course_creation_defaults_to_draft_when_status_is_omitted(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.post(
            "/api/v1/courses/",
            {
                "title": "Draft By Default",
                "category": self.category.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created = Course.objects.get(pk=response.data["id"])
        self.assertEqual(created.status, CourseStatus.DRAFT)

    def test_student_cannot_create_course(self):
        student = make_user("contract-student@example.com", UserRole.STUDENT)
        self.client.force_authenticate(student)

        response = self.client.post(
            "/api/v1/courses/",
            {
                "title": "Student Course",
                "category": self.category.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self.assertFalse(Course.objects.filter(title="Student Course").exists())

    def test_unauthenticated_user_cannot_create_course(self):
        response = self.client.post(
            "/api/v1/courses/",
            {
                "title": "Anonymous Course",
                "category": self.category.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, response.data)
        self.assertFalse(Course.objects.filter(title="Anonymous Course").exists())

    def test_course_creation_requires_category(self):
        self.client.force_authenticate(self.instructor)

        response = self.client.post(
            "/api/v1/courses/",
            {
                "title": "Missing Category",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertFalse(Course.objects.filter(title="Missing Category").exists())


    def test_module_creation_recovers_from_stale_or_conflicting_order(self):
        self.client.force_authenticate(self.instructor)
        Module.objects.create(course=self.own_course, title="Existing Third", order=3)

        response = self.client.post(
            "/api/v1/modules/",
            {
                "course": self.own_course.id,
                "title": "New Module",
                "order": 3,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created = Module.objects.get(pk=response.data["id"])
        self.assertEqual(created.order, 4)

    def test_lesson_creation_recovers_from_stale_or_conflicting_order(self):
        self.client.force_authenticate(self.instructor)
        Lesson.objects.create(module=self.module, title="Existing Third", order=3)

        response = self.client.post(
            "/api/v1/lessons/",
            {
                "module": self.module.id,
                "title": "New Lesson",
                "type": "video",
                "order": 3,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        created = Lesson.objects.get(pk=response.data["id"])
        self.assertEqual(created.order, 4)

class CourseGetLessonAccessTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        from apps.enrollments.models import Enrollment

        cls.instructor = make_user("course-inst@example.com", UserRole.INSTRUCTOR)
        cls.student = make_user("course-stud@example.com", UserRole.STUDENT)
        cls.other_student = make_user("course-other-stud@example.com", UserRole.STUDENT)
        cls.category = Category.objects.create(name="Access Cat", slug="access-cat")
        cls.course = Course.objects.create(
            title="Public React Course",
            instructor=cls.instructor,
            category=cls.category,
            status=CourseStatus.PUBLISHED,
        )
        cls.module = Module.objects.create(course=cls.course, title="Module 1", order=1)
        cls.free_lesson = Lesson.objects.create(module=cls.module, title="Free Preview", order=1, is_free=True)
        cls.paid_lesson = Lesson.objects.create(module=cls.module, title="Paid Lesson", order=2, is_free=False)

        cls.enrollment = Enrollment.objects.create(student=cls.student, course=cls.course)

    def test_free_lesson_accessible_by_anyone(self):
        response = self.client.get(f"/api/v1/courses/{self.course.id}/lessons/{self.free_lesson.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.free_lesson.id)

        self.client.force_authenticate(self.other_student)
        response = self.client.get(f"/api/v1/courses/{self.course.id}/lessons/{self.free_lesson.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_paid_lesson_forbidden_for_non_enrolled_student(self):
        self.client.force_authenticate(self.other_student)
        response = self.client.get(f"/api/v1/courses/{self.course.id}/lessons/{self.paid_lesson.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_paid_lesson_accessible_for_enrolled_student(self):
        self.client.force_authenticate(self.student)
        response = self.client.get(f"/api/v1/courses/{self.course.id}/lessons/{self.paid_lesson.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.paid_lesson.id)

    def test_paid_lesson_accessible_by_instructor(self):
        self.client.force_authenticate(self.instructor)
        response = self.client.get(f"/api/v1/courses/{self.course.id}/lessons/{self.paid_lesson.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

