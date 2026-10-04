from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from apps.assessments.models import Exam, ExamKind, ExamType, StudentExam, StudentExamStatus
from apps.courses.models import Category, Course, CourseStatus, Lesson, LessonType, Module, Video
from apps.courses.services.progression_service import (
    can_complete_lesson,
    get_course_missed_quizzes,
    is_lesson_completed,
    is_lesson_unlocked,
    is_unit_unlocked,
)
from apps.enrollments.models import Enrollment, LessonCompletion, LessonProgress

User = get_user_model()


class ProgressionServiceTests(TestCase):
    def setUp(self):
        self.instructor = User.objects.create_user(
            email="inst_prog@test.com", password="Password123!", role="instructor"
        )
        self.student = User.objects.create_user(
            email="stud_prog@test.com", password="Password123!", role="student"
        )
        self.category = Category.objects.create(name="Science", slug="science")
        self.course = Course.objects.create(
            title="Progression Course",
            instructor=self.instructor,
            category=self.category,
            status=CourseStatus.PUBLISHED,
            price=Decimal("100.00"),
            enforce_quiz_gate=True,
        )
        self.enrollment = Enrollment.objects.create(student=self.student, course=self.course)

        # Unit 1
        self.module_1 = Module.objects.create(course=self.course, title="Unit 1", order=1)
        self.video_1 = Video.objects.create(title="V1", uploader=self.instructor, duration_seconds=100)
        self.lesson_1 = Lesson.objects.create(
            module=self.module_1,
            title="Lesson 1.1",
            type=LessonType.VIDEO,
            duration="01:40",
            video=self.video_1,
            order=1,
        )
        self.lesson_2 = Lesson.objects.create(
            module=self.module_1,
            title="Lesson 1.2",
            type=LessonType.VIDEO,
            duration="01:40",
            video=self.video_1,
            order=2,
        )

        # Unit 2
        self.module_2 = Module.objects.create(course=self.course, title="Unit 2", order=2)
        self.lesson_3 = Lesson.objects.create(
            module=self.module_2,
            title="Lesson 2.1",
            type=LessonType.VIDEO,
            duration="01:40",
            video=self.video_1,
            order=1,
        )

        # Quizzes
        self.quiz_1 = Exam.objects.create(
            course=self.course,
            lesson=self.lesson_1,
            title="Quiz 1.1",
            kind=ExamKind.LESSON_QUIZ,
            exam_type=ExamType.EXAM,
            pass_threshold=70,
            is_published=True,
        )
        self.unit_1_exam = Exam.objects.create(
            course=self.course,
            unit=self.module_1,
            title="Unit 1 Exam",
            kind=ExamKind.UNIT_EXAM,
            exam_type=ExamType.EXAM,
            pass_threshold=70,
            is_published=True,
        )

    def test_is_lesson_completed(self):
        self.assertFalse(is_lesson_completed(self.enrollment, self.lesson_1))
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson_1)
        self.assertTrue(is_lesson_completed(self.enrollment, self.lesson_1))

    @override_settings(ENFORCE_WATCH_THRESHOLD=True)
    def test_can_complete_lesson_watch_threshold_and_quiz_gate(self):
        # 1. No watch progress -> fails watch threshold
        can_comp, reason = can_complete_lesson(self.enrollment, self.lesson_1)
        self.assertFalse(can_comp)
        self.assertIn("90%", reason)

        # 2. Watch 95% -> satisfies watch threshold, but quiz is not passed
        LessonProgress.objects.create(
            enrollment=self.enrollment,
            lesson=self.lesson_1,
            max_position_seconds=95,
        )
        can_comp, reason = can_complete_lesson(self.enrollment, self.lesson_1)
        self.assertFalse(can_comp)
        self.assertIn("كويز الدرس", reason)

        # 3. Pass the quiz -> now can complete
        StudentExam.objects.create(
            student=self.student,
            exam=self.quiz_1,
            score=Decimal("85.00"),
            is_passed=True,
            status=StudentExamStatus.GRADED,
        )
        can_comp, reason = can_complete_lesson(self.enrollment, self.lesson_1)
        self.assertTrue(can_comp)
        self.assertIsNone(reason)

    def test_quiz_gate_kill_switch(self):
        LessonProgress.objects.create(
            enrollment=self.enrollment,
            lesson=self.lesson_1,
            max_position_seconds=95,
        )
        # Without passing quiz, but with kill switch enabled -> allowed
        with override_settings(QUIZ_GATE_KILL_SWITCH=True):
            can_comp, reason = can_complete_lesson(self.enrollment, self.lesson_1)
            self.assertTrue(can_comp)
            self.assertIsNone(reason)

    def test_is_lesson_unlocked(self):
        # Lesson 1.1 is first lesson in Unit 1 -> unlocked
        unlocked, _ = is_lesson_unlocked(self.enrollment, self.lesson_1)
        self.assertTrue(unlocked)

        # Lesson 1.2 is locked until Lesson 1.1 is completed
        unlocked, reason = is_lesson_unlocked(self.enrollment, self.lesson_2)
        self.assertFalse(unlocked)
        self.assertIn("إكمال الدرس السابق", reason)

        # Complete Lesson 1.1 and pass its quiz
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson_1)
        StudentExam.objects.create(
            student=self.student,
            exam=self.quiz_1,
            score=Decimal("80.00"),
            is_passed=True,
            status=StudentExamStatus.GRADED,
        )

        unlocked, _ = is_lesson_unlocked(self.enrollment, self.lesson_2)
        self.assertTrue(unlocked)

    def test_is_unit_unlocked(self):
        # Unit 1 is first unit -> unlocked
        unlocked, _ = is_unit_unlocked(self.enrollment, self.module_1)
        self.assertTrue(unlocked)

        # Unit 2 is locked until Unit 1 lessons are completed and Unit 1 exam is passed
        unlocked, reason = is_unit_unlocked(self.enrollment, self.module_2)
        self.assertFalse(unlocked)
        self.assertIn("إكمال جميع دروس الوحدة السابقة", reason)

        # Complete all Unit 1 lessons
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson_1)
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson_2)

        # Lessons complete, but Unit Exam not passed
        unlocked, reason = is_unit_unlocked(self.enrollment, self.module_2)
        self.assertFalse(unlocked)
        self.assertIn("اجتياز امتحان الوحدة السابقة", reason)

        # Pass Unit Exam
        StudentExam.objects.create(
            student=self.student,
            exam=self.unit_1_exam,
            score=Decimal("90.00"),
            is_passed=True,
            status=StudentExamStatus.GRADED,
        )

        unlocked, _ = is_unit_unlocked(self.enrollment, self.module_2)
        self.assertTrue(unlocked)

    def test_get_course_missed_quizzes(self):
        # Mark lesson 1 completed without passing quiz 1
        LessonCompletion.objects.create(enrollment=self.enrollment, lesson=self.lesson_1)

        missed = get_course_missed_quizzes(self.enrollment)
        self.assertEqual(len(missed), 1)
        self.assertEqual(missed[0].id, self.quiz_1.id)

        # Pass quiz 1
        StudentExam.objects.create(
            student=self.student,
            exam=self.quiz_1,
            score=Decimal("80.00"),
            is_passed=True,
            status=StudentExamStatus.GRADED,
        )
        missed_after = get_course_missed_quizzes(self.enrollment)
        self.assertEqual(len(missed_after), 0)
