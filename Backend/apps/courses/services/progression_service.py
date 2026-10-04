"""
Progression Service: Authoritative Source of Truth for Lesson Completion and Progression Gates.

Encapsulates all business rules governing:
- Lesson completion prerequisites (watch threshold + lesson quiz pass).
- Lesson unlocking logic (previous lesson completion + previous quiz pass).
- Unit/Module unlocking logic (all previous unit lessons complete + unit exam pass).
- Identification of missed quizzes for a course enrollment.
- Respects the QUIZ_GATE_KILL_SWITCH emergency bypass setting.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from apps.assessments.models import Exam
    from apps.courses.models import Lesson, Module
    from apps.enrollments.models import Enrollment

logger = logging.getLogger(__name__)


def parse_duration_seconds(duration_str: str | None) -> int:
    """
    Parses duration strings like '01:40', '10:00', '1:23:45', or '100' into total seconds.
    """
    if not duration_str:
        return 0
    s = str(duration_str).strip()
    if not s:
        return 0
    if s.isdigit():
        return int(s)

    parts = s.split(":")
    try:
        if len(parts) == 3:
            h, m, sec = parts
            return int(h) * 3600 + int(m) * 60 + int(sec)
        elif len(parts) == 2:
            m, sec = parts
            return int(m) * 60 + int(sec)
    except (ValueError, TypeError):
        pass
    return 0


def is_lesson_completed(enrollment: Enrollment, lesson: Lesson) -> bool:
    """
    Returns True if the student has officially completed the given lesson.
    Optimized for prefetched querysets.
    """
    if hasattr(enrollment, "_prefetched_objects_cache") and "lesson_completions" in enrollment._prefetched_objects_cache:
        return any(c.lesson_id == lesson.id for c in enrollment.lesson_completions.all())

    from apps.enrollments.models import LessonCompletion
    return LessonCompletion.objects.filter(enrollment=enrollment, lesson=lesson).exists()


def can_complete_lesson(enrollment: Enrollment, lesson: Lesson) -> tuple[bool, str | None]:
    """
    Evaluates whether the student meets all requirements to complete the given lesson:
    1. Video watch threshold (>= 90% of duration watched).
    2. Mandatory lesson quiz passed (if quiz gating is enforced and active).

    Returns:
        tuple (can_complete: bool, rejection_reason: str | None)
    """
    from apps.assessments.models import Exam, ExamKind, StudentExam
    from apps.courses.models import LessonType
    from apps.enrollments.models import LessonProgress

    # 1. Watch Threshold Check
    enforce_watch = getattr(settings, "ENFORCE_WATCH_THRESHOLD", True)
    if enforce_watch and lesson.type == LessonType.VIDEO:
        video_duration = 0
        if lesson.video and getattr(lesson.video, "duration_seconds", 0) > 0:
            video_duration = lesson.video.duration_seconds
        elif lesson.duration:
            video_duration = parse_duration_seconds(lesson.duration)

        if video_duration > 0:
            progress = LessonProgress.objects.filter(enrollment=enrollment, lesson=lesson).first()
            max_pos = progress.max_position_seconds if progress else 0
            required_threshold = int(0.90 * video_duration)

            if max_pos < required_threshold:
                watched_pct = min(100, round((max_pos / video_duration) * 100))
                return (
                    False,
                    f"يجب إكمال مشاهدة 90% على الأقل من الدرس قبل إتمامه (شاهدت {watched_pct}%، المطلوب 90%).",
                )
        else:
            logger.warning(
                f"Lesson {lesson.id} has video type but no server duration recorded. Allowed completion without 90% check."
            )

    # 2. Lesson Quiz Gate Check
    kill_switch = getattr(settings, "QUIZ_GATE_KILL_SWITCH", False)
    enforce_gate = getattr(lesson.module.course, "enforce_quiz_gate", False) and not kill_switch

    if enforce_gate:
        quizzes = Exam.objects.filter(
            lesson=lesson,
            is_published=True,
            kind__in=[ExamKind.LESSON_QUIZ, ExamKind.IN_VIDEO_QUIZ],
        )
        for quiz in quizzes:
            passed = StudentExam.objects.filter(
                student=enrollment.student,
                exam=quiz,
                is_passed=True,
            ).exists()
            if not passed:
                return (
                    False,
                    f"يجب اجتياز كويز الدرس: {quiz.title} بنسبة {quiz.pass_threshold}% على الأقل قبل إتمام الدرس.",
                )

    return (True, None)


def is_lesson_unlocked(enrollment: Enrollment, lesson: Lesson) -> tuple[bool, str | None]:
    """
    Determines whether a lesson is unlocked for the student:
    - Free preview lessons are always unlocked.
    - Course instructors and platform staff have full access.
    - The lesson's unit/module must be unlocked.
    - All preceding lessons in the module must be completed, and their quizzes passed (if gated).

    Returns:
        tuple (is_unlocked: bool, lock_reason: str | None)
    """
    # 1. Free lessons are always unlocked
    if lesson.is_free:
        return (True, None)

    # 2. Instructor / Staff bypass
    user = enrollment.student
    course = lesson.module.course
    if user.is_staff or user.role in ("admin", "super_admin") or course.instructor_id == user.id:
        return (True, None)

    # 3. Check if parent module/unit is unlocked
    unit_unlocked, unit_reason = is_unit_unlocked(enrollment, lesson.module)
    if not unit_unlocked:
        return (False, unit_reason)

    # 4. Check preceding lessons in the same module
    prev_lessons = (
        lesson.module.lessons.filter(order__lt=lesson.order)
        .order_by("-order")
    )
    prev_lesson = prev_lessons.first()

    if prev_lesson:
        # Check completion of the immediately preceding lesson
        if not is_lesson_completed(enrollment, prev_lesson):
            return (False, f"يجب إكمال الدرس السابق: {prev_lesson.title}")

        # Check quiz gate on preceding lesson
        kill_switch = getattr(settings, "QUIZ_GATE_KILL_SWITCH", False)
        enforce_gate = getattr(course, "enforce_quiz_gate", False) and not kill_switch

        if enforce_gate:
            from apps.assessments.models import Exam, ExamKind, StudentExam
            prev_quizzes = Exam.objects.filter(
                lesson=prev_lesson,
                is_published=True,
                kind__in=[ExamKind.LESSON_QUIZ, ExamKind.IN_VIDEO_QUIZ],
            )
            for quiz in prev_quizzes:
                passed = StudentExam.objects.filter(
                    student=user,
                    exam=quiz,
                    is_passed=True,
                ).exists()
                if not passed:
                    return (
                        False,
                        f"يجب اجتياز كويز الدرس السابق: {prev_lesson.title} بنسبة {quiz.pass_threshold}% على الأقل",
                    )

    return (True, None)


def is_unit_unlocked(enrollment: Enrollment, module: Module) -> tuple[bool, str | None]:
    """
    Determines whether a module/unit is unlocked for the student:
    - First module is always unlocked.
    - Subsequent modules require completing all lessons of the preceding module.
    - If quiz gating is enabled, requires passing the preceding module's unit exam.

    Returns:
        tuple (is_unlocked: bool, lock_reason: str | None)
    """
    user = enrollment.student
    course = module.course

    # 1. Staff / Instructor bypass
    if user.is_staff or user.role in ("admin", "super_admin") or course.instructor_id == user.id:
        return (True, None)

    # 2. Check preceding modules
    prev_module = (
        course.modules.filter(order__lt=module.order)
        .order_by("-order")
        .first()
    )

    if not prev_module:
        # First module in the course is always unlocked
        return (True, None)

    from apps.enrollments.models import LessonCompletion

    # 3. Verify all lessons in previous module are completed
    prev_lessons = prev_module.lessons.all()
    prev_lesson_count = prev_lessons.count()
    if prev_lesson_count > 0:
        completed_count = LessonCompletion.objects.filter(
            enrollment=enrollment,
            lesson__in=prev_lessons,
        ).count()
        if completed_count < prev_lesson_count:
            return (False, f"يجب إكمال جميع دروس الوحدة السابقة: {prev_module.title}")

    # 4. Verify previous module unit exam
    kill_switch = getattr(settings, "QUIZ_GATE_KILL_SWITCH", False)
    enforce_gate = getattr(course, "enforce_quiz_gate", False) and not kill_switch

    if enforce_gate:
        from apps.assessments.models import Exam, ExamKind, StudentExam

        unit_exam = Exam.objects.filter(
            unit=prev_module,
            kind=ExamKind.UNIT_EXAM,
            is_published=True,
        ).first()

        if unit_exam:
            passed = StudentExam.objects.filter(
                student=user,
                exam=unit_exam,
                is_passed=True,
            ).exists()
            if not passed:
                return (
                    False,
                    f"يجب اجتياز امتحان الوحدة السابقة: {unit_exam.title} بنسبة {unit_exam.pass_threshold}% على الأقل",
                )

    return (True, None)


def get_course_missed_quizzes(enrollment: Enrollment) -> list[Exam]:
    """
    Returns a list of published exams (quizzes or unit exams) within the course that:
    - Belong to lessons or units the student has already started/completed.
    - The student has not yet passed.
    """
    from apps.assessments.models import Exam, StudentExam
    from apps.enrollments.models import LessonCompletion

    course = enrollment.course
    student = enrollment.student

    # Get completed lesson IDs
    completed_lesson_ids = set(
        LessonCompletion.objects.filter(enrollment=enrollment).values_list("lesson_id", flat=True)
    )

    # Get all published quizzes and exams for the course
    all_exams = Exam.objects.filter(
        course=course,
        is_published=True,
    ).select_related("lesson", "unit")

    # Get all exams the student has passed
    passed_exam_ids = set(
        StudentExam.objects.filter(
            student=student,
            exam__course=course,
            is_passed=True,
        ).values_list("exam_id", flat=True)
    )

    missed: list[Exam] = []
    for exam in all_exams:
        if exam.id in passed_exam_ids:
            continue

        # Check relevance: is it for a completed lesson or completed unit?
        if exam.lesson_id and exam.lesson_id in completed_lesson_ids:
            missed.append(exam)
        elif exam.unit_id and exam.unit:
            # Check if all lessons in the unit are completed
            unit_lesson_ids = set(exam.unit.lessons.values_list("id", flat=True))
            if unit_lesson_ids and unit_lesson_ids.issubset(completed_lesson_ids):
                missed.append(exam)

    return missed
