from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.assessments.models import Exam, QuestionBankItem, StudentExam, StudentExamStatus
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment

User = get_user_model()


class ExamAccessRegressionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Exam Access", slug="exam-access")
        self.instructor = User.objects.create_user(
            email="exam-instructor@test.local",
            password="Password123!",
            first_name="Exam",
            last_name="Instructor",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="exam-student@test.local",
            password="Password123!",
            first_name="Exam",
            last_name="Student",
            role="student",
            profile_completed=True,
        )
        self.other_student = User.objects.create_user(
            email="other-student@test.local",
            password="Password123!",
            first_name="Other",
            last_name="Student",
            role="student",
            profile_completed=True,
        )
        self.course = Course.objects.create(
            title="Restricted Course",
            category=self.category,
            instructor=self.instructor,
            status="published",
            price=Decimal("100.00"),
        )
        self.exam = Exam.objects.create(
            title="Restricted Exam",
            course=self.course,
            duration_minutes=30,
            max_score=10,
            attempts_allowed=1,
            is_published=True,
        )
        QuestionBankItem.objects.create(
            exam=self.exam,
            instructor=self.instructor,
            question_text="2 + 2 = ?",
            question_type=QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
            options_json=["3", "4"],
            correct_answer_json={"correct_option": "4"},
            points=Decimal("10.00"),
            order=1,
        )

    def test_unenrolled_student_cannot_start_course_exam(self):
        self.client.force_authenticate(user=self.other_student)

        response = self.client.post(f"/api/v1/exams/{self.exam.id}/start/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(StudentExam.objects.filter(student=self.other_student, exam=self.exam).exists())

    def test_enrolled_student_can_start_course_exam(self):
        Enrollment.objects.create(student=self.student, course=self.course)
        self.client.force_authenticate(user=self.student)

        response = self.client.post(f"/api/v1/exams/{self.exam.id}/start/")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            StudentExam.objects.get(student=self.student, exam=self.exam).status,
            StudentExamStatus.IN_PROGRESS,
        )

    def test_instructor_cannot_start_exam_as_student(self):
        Enrollment.objects.create(student=self.student, course=self.course)
        self.client.force_authenticate(user=self.instructor)

        response = self.client.post(f"/api/v1/exams/{self.exam.id}/start/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(StudentExam.objects.filter(student=self.instructor, exam=self.exam).exists())

    def test_instructor_cannot_submit_student_exam(self):
        Enrollment.objects.create(student=self.student, course=self.course)
        StudentExam.objects.create(
            student=self.student,
            exam=self.exam,
            attempt_number=1,
            status=StudentExamStatus.IN_PROGRESS,
        )
        self.client.force_authenticate(user=self.instructor)

        response = self.client.post(
            f"/api/v1/exams/{self.exam.id}/submit/",
            data={"answers": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            StudentExam.objects.get(student=self.student, exam=self.exam).status,
            StudentExamStatus.IN_PROGRESS,
        )

    def test_student_exam_list_does_not_expose_unenrolled_course_exam(self):
        self.client.force_authenticate(user=self.other_student)

        response = self.client.get("/api/v1/exams/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data
        items = payload.get("results", payload) if isinstance(payload, dict) else payload
        returned_ids = {item["id"] for item in items}
        self.assertNotIn(self.exam.id, returned_ids)
