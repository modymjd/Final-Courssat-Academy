import json
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.assessments.models import Exam, QuestionBankItem
from apps.assessments.services.question_import_service import (
    dry_run,
    import_questions,
    sanitize_plain_text,
)
from apps.courses.models import Category, Course

User = get_user_model()


class QuestionImportServiceTests(TestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email="inst_import@test.com", password="Password123!", role="instructor"
        )
        self.category = Category.objects.create(name="Math", slug="math")
        self.course = Course.objects.create(
            title="Algebra Course",
            instructor=self.instructor,
            category=self.category,
        )
        self.exam = Exam.objects.create(course=self.course, title="Algebra Exam")

    def test_sanitize_plain_text(self):
        dirty = "<script>alert('xss')</script><b>ما هي وحدة قياس القوة؟</b>"
        clean = sanitize_plain_text(dirty)
        self.assertEqual(clean, "ما هي وحدة قياس القوة؟")

    def test_dry_run_validation(self):
        # 1. Valid data
        valid_data = [
            {
                "question_text": "ما هي عاصمة مصر؟",
                "question_type": "MULTIPLE_CHOICE",
                "options": ["القاهرة", "الإسكندرية", "الجيزة"],
                "correct_answer": "القاهرة",
                "points": 5,
            },
            {
                "question_text": "الأرض كروية الشكل.",
                "question_type": "TRUE_FALSE",
                "options": ["صواب", "خطأ"],
                "correct_answer": "صواب",
                "points": 2,
            },
        ]
        res = dry_run(valid_data)
        self.assertTrue(res["is_valid"])
        self.assertEqual(res["total_scanned"], 2)
        self.assertEqual(res["valid_count"], 2)
        self.assertEqual(res["error_count"], 0)

        # 2. Invalid data: negative points + mismatched correct answer
        invalid_data = [
            {
                "question_text": "ما هو ناتج 5 * 5؟",
                "question_type": "MULTIPLE_CHOICE",
                "options": ["10", "20", "30"],
                "correct_answer": "25",  # Not in options
                "points": -5,  # Points <= 0
            }
        ]
        res_invalid = dry_run(invalid_data)
        self.assertFalse(res_invalid["is_valid"])
        self.assertEqual(res_invalid["error_count"], 2)
        fields = [err["field"] for err in res_invalid["errors"]]
        self.assertIn("points", fields)
        self.assertIn("correct_answer", fields)

    def test_import_questions_atomic(self):
        data = [
            {
                "question_text": "سؤال تجريبي رقم 1",
                "question_type": "MULTIPLE_CHOICE",
                "options": ["خيار أ", "خيار ب"],
                "correct_answer": "خيار أ",
                "points": 10,
            }
        ]
        created = import_questions(data, instructor=self.instructor, exam=self.exam)
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0].instructor, self.instructor)
        self.assertEqual(created[0].points, Decimal("10.00"))

        # Test failure rolls back
        invalid_data = [
            {
                "question_text": "سؤال غير صالح",
                "question_type": "MULTIPLE_CHOICE",
                "options": ["أ"],  # < 2 options
                "correct_answer": "أ",
                "points": 0,
            }
        ]
        with self.assertRaises(ValidationError):
            import_questions(invalid_data, instructor=self.instructor, exam=self.exam)



    def test_dry_run_treats_string_false_as_false(self):
        payload = [
            {
                "text": "2 + 2 = ؟",
                "type": "multiple_choice",
                "options": [
                    {"text": "4", "isCorrect": "true"},
                    {"text": "5", "isCorrect": "false"},
                ],
                "points": 5,
            }
        ]

        result = dry_run(payload)

        self.assertTrue(result["is_valid"])
        self.assertEqual(result["error_count"], 0)


    def test_dry_run_accepts_frontend_type_contract_and_essay(self):
        payload = {
            "title": "اختبار فيزياء",
            "questions": [
                {
                    "text": "ما وحدة قياس القوة؟",
                    "type": "multiple_choice",
                    "options": [
                        {"text": "نيوتن", "isCorrect": True},
                        {"text": "جول", "isCorrect": False},
                    ],
                    "points": 5,
                },
                {
                    "text": "القوة تساوي الكتلة مضروبة في التسارع.",
                    "type": "true_false",
                    "options": [
                        {"text": "صواب", "isCorrect": True},
                        {"text": "خطأ", "isCorrect": False},
                    ],
                    "points": 5,
                },
                {
                    "text": "اشرح قانون نيوتن الأول.",
                    "type": "essay",
                    "options": [],
                    "points": 10,
                },
            ],
        }

        result = dry_run(payload["questions"])

        self.assertTrue(result["is_valid"])
        self.assertEqual(result["total_scanned"], 3)
        self.assertEqual(result["valid_count"], 3)
        self.assertEqual(result["error_count"], 0)

class AiJsonQuestionImportContractTests(TestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email="ai-json-instructor@edusmart.test",
            password="Password123!",
            first_name="AI",
            last_name="Instructor",
            role="instructor",
            profile_completed=True,
        )

    def test_dry_run_accepts_ai_object_options_and_derives_correct_answer(self):
        payload = {
            "title": "مراجعة العلوم",
            "questions": [
                {
                    "text": "ما وحدة قياس القوة؟",
                    "type": "multiple_choice",
                    "options": [
                        {"text": "النيوتن", "isCorrect": True},
                        {"text": "الجول", "isCorrect": False},
                    ],
                    "points": 5,
                    "difficulty": "MEDIUM",
                    "explanation": "القوة تقاس بالنيوتن.",
                }
            ],
        }

        result = dry_run(payload["questions"])

        self.assertTrue(result["is_valid"])
        self.assertEqual(result["valid_count"], 1)
        self.assertEqual(result["error_count"], 0)

    def test_import_normalizes_correct_answer_to_grading_contract(self):
        payload = {
            "questions": [
                {
                    "question_text": "2 + 2 = ؟",
                    "question_type": "MULTIPLE_CHOICE",
                    "options": [
                        {"text": "3", "isCorrect": False},
                        {"text": "4", "isCorrect": True},
                    ],
                    "points": 5,
                    "difficulty": "EASY",
                }
            ]
        }

        imported = import_questions(
            payload["questions"],
            instructor=self.instructor,
        )

        self.assertEqual(len(imported), 1)
        self.assertEqual(imported[0].options_json, ["3", "4"])
        self.assertEqual(imported[0].correct_answer_json, {"correct_option": "4"})
