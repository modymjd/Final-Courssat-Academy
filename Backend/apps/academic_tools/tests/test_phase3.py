import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.courses.models import Category, Course
from apps.assessments.models import Exam, StudentExam, QuestionBankItem

User = get_user_model()


@pytest.mark.django_db
class TestPhase3Backend:

    @pytest.fixture
    def setup_data(self):
        instructor1 = User.objects.create_user(
            email="inst1_p3@example.com",
            password="Password123!",
            role="instructor",
            first_name="Dr. Math",
        )
        instructor2 = User.objects.create_user(
            email="inst2_p3@example.com",
            password="Password123!",
            role="instructor",
            first_name="Dr. Physics",
        )
        student1 = User.objects.create_user(
            email="stud1_p3@example.com",
            password="Password123!",
            role="student",
            first_name="Charlie",
        )


        category = Category.objects.create(name="Science", slug="science")
        course1 = Course.objects.create(
            title="Calculus I",
            instructor=instructor1,
            category=category,
            status="published",
            price=300.00,
        )


        exam1 = Exam.objects.create(
            course=course1,
            title="Midterm Exam",
            description="Calculus Midterm",
            max_score=100,
            duration_minutes=90,
            tab_switch_limit=3,
        )

        attempt1 = StudentExam.objects.create(
            student=student1,
            exam=exam1,
            score=45.0,
            tab_switches_count=1,
            status="SUBMITTED",
        )

        return {
            "inst1": instructor1,
            "inst2": instructor2,
            "stud1": student1,
            "course1": course1,
            "exam1": exam1,
            "attempt1": attempt1,
        }

    def test_essay_manual_grading_and_feedback(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        payload = {
            "student_exam_id": setup_data["attempt1"].id,
            "score": 85.0,
            "feedback": "ممتاز! حل خطوة التكامل كان دقيقاً للغاية.",
        }
        res = client.post(f"/api/v1/exams/{setup_data['exam1'].id}/grade-essay/", payload)

        assert res.status_code == 200
        assert res.data["attempt"]["score"] == "85.00"

        setup_data["attempt1"].refresh_from_db()
        assert setup_data["attempt1"].status == "GRADED"
        assert setup_data["attempt1"].instructor_feedback == "ممتاز! حل خطوة التكامل كان دقيقاً للغاية."

    def test_exam_analytics_endpoint(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst1"])

        res = client.get(f"/api/v1/exams/{setup_data['exam1'].id}/analytics/")
        assert res.status_code == 200
        assert res.data["total_attempts"] == 1
        assert res.data["average_tab_switches"] == 1.0
        assert "most_missed_questions" in res.data
        assert "students_attempted" in res.data


    def test_exam_permission_isolation(self, setup_data):
        client = APIClient()
        client.force_authenticate(user=setup_data["inst2"])

        # Inst2 attempting to grade Inst1's exam
        payload = {
            "student_exam_id": setup_data["attempt1"].id,
            "score": 90.0,
            "feedback": "Unauthorized grade attempt",
        }
        res = client.post(f"/api/v1/exams/{setup_data['exam1'].id}/grade-essay/", payload)

        assert res.status_code in (400, 403)
