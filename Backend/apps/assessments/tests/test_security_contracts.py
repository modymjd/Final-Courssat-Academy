from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.assessments.models import Assignment, Exam, Grade, QuestionBankItem
from apps.assessments.serializers import AssignmentSerializer, ExamSerializer, GradeSerializer
from apps.accounts.models import User
from apps.courses.models import Category, Course


class AssessmentSerializerSecurityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.category = Category.objects.create(name="Security", slug="security")
        self.instructor = User.objects.create_user(
            email="owner@example.test",
            password="Password123!",
            first_name="Owner",
            last_name="Instructor",
            role="instructor",
            profile_completed=True,
        )
        self.other_instructor = User.objects.create_user(
            email="other@example.test",
            password="Password123!",
            first_name="Other",
            last_name="Instructor",
            role="instructor",
            profile_completed=True,
        )
        self.student = User.objects.create_user(
            email="student@example.test",
            password="Password123!",
            first_name="Student",
            last_name="Test",
            role="student",
            profile_completed=True,
        )
        self.course = Course.objects.create(
            title="Owned Course",
            category=self.category,
            instructor=self.instructor,
            status="published",
        )
        self.other_course = Course.objects.create(
            title="Other Course",
            category=self.category,
            instructor=self.other_instructor,
            status="published",
        )

    def request(self, user):
        request = self.factory.post("/api/v1/test/")
        request.user = user
        return request

    def test_instructor_cannot_create_assignment_for_other_course(self):
        serializer = AssignmentSerializer(
            data={"course": self.other_course.pk, "title": "Unauthorized", "max_score": 100},
            context={"request": self.request(self.instructor)},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("course", serializer.errors)

    def test_instructor_cannot_grade_student_in_other_course(self):
        assignment = Assignment.objects.create(course=self.other_course, title="Other Assignment", max_score=100)
        serializer = GradeSerializer(
            data={
                "student": self.student.pk,
                "course": self.course.pk,
                "assignment": assignment.pk,
                "score": "80.00",
                "max_score": 100,
            },
            context={"request": self.request(self.instructor)},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("assignment", serializer.errors)

    def test_instructor_cannot_create_exam_for_other_course(self):
        serializer = ExamSerializer(
            data={
                "course": self.other_course.pk,
                "title": "Unauthorized Exam",
                "max_score": 100,
                "pass_threshold": 50,
                "attempts_allowed": 1,
                "duration_minutes": 30,
            },
            context={"request": self.request(self.instructor)},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("course", serializer.errors)

    def test_student_exam_representation_does_not_expose_answer_key(self):
        exam = Exam.objects.create(course=self.course, title="Protected Exam", max_score=10, is_published=True)
        question = QuestionBankItem.objects.create(
            exam=exam,
            instructor=self.instructor,
            question_text="2 + 2?",
            question_type=QuestionBankItem.QuestionType.MULTIPLE_CHOICE,
            options_json=["3", "4"],
            correct_answer_json={"correct_option": "4"},
            points=Decimal("10.00"),
        )
        request = self.factory.get(f"/api/v1/exams/{exam.pk}/")
        request.user = self.student
        data = ExamSerializer(exam, context={"request": request}).data
        serialized_question = data["questions"][0]
        self.assertEqual(serialized_question["id"], question.id)
        self.assertNotIn("correct_answer_json", serialized_question)
        self.assertNotIn("explanation", serialized_question)
