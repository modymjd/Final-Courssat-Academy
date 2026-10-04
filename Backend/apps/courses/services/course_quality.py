"""Server-side quality gates for publishing courses.

This module is the authoritative structural readiness check for moving a
course from draft to published. It intentionally does not enforce optional
learning-policy gates such as quiz requirements; those remain governed by
the progression service and the course's quiz-gate setting.
"""

from __future__ import annotations

from collections.abc import Mapping

from django.db.models import Count

from ..models import Course, LessonType, VideoStatus


def validate_course_publish_quality(course: Course) -> dict[str, list[str]]:
    """Return blocking publish errors keyed by stable field/category names."""
    errors: dict[str, list[str]] = {}

    modules = list(course.modules.prefetch_related("lessons").all())
    if not modules:
        errors["curriculum"] = ["يجب أن تحتوي الدورة على وحدة واحدة على الأقل قبل النشر."]
        return errors

    module_lessons = {module.id: list(module.lessons.all()) for module in modules}
    empty_modules = [module.title for module in modules if not module_lessons[module.id]]
    if empty_modules:
        errors["curriculum"] = [
            "كل وحدة يجب أن تحتوي على درس واحد على الأقل قبل النشر."
        ]
        errors["empty_modules"] = empty_modules

    video_errors: list[str] = []
    content_errors: list[str] = []
    assessment_errors: list[str] = []

    for module in modules:
        for lesson in module_lessons[module.id]:
            if lesson.video_id:
                if not lesson.video or lesson.video.status != VideoStatus.READY:
                    video_errors.append(
                        f'الفيديو المرتبط بالدرس "{lesson.title}" لم يصبح جاهزًا للعرض بعد.'
                    )

            if lesson.type == LessonType.VIDEO and not lesson.video_id:
                video_errors.append(
                    f'الدرس المرئي "{lesson.title}" لا يحتوي على فيديو مرتبط.'
                )

            if lesson.type == LessonType.ARTICLE and not lesson.content.strip():
                content_errors.append(
                    f'الدرس النصي "{lesson.title}" لا يحتوي على محتوى.'
                )

            if lesson.type == LessonType.ASSIGNMENT and not lesson.content.strip():
                content_errors.append(
                    f'درس الواجب "{lesson.title}" لا يحتوي على تعليمات أو محتوى.'
                )

            if lesson.type == LessonType.QUIZ:
                from apps.assessments.models import Exam

                has_published_quiz = Exam.objects.filter(
                    lesson=lesson,
                    is_published=True,
                    kind__in=("LESSON_QUIZ", "IN_VIDEO_QUIZ"),
                ).annotate(question_count=Count("questions")).filter(question_count__gt=0).exists()
                if not has_published_quiz:
                    assessment_errors.append(
                        f'درس الاختبار "{lesson.title}" لا يحتوي على اختبار منشور.'
                    )

    if video_errors:
        errors["videos"] = video_errors
    if content_errors:
        errors["content"] = content_errors
    if assessment_errors:
        errors["assessments"] = assessment_errors

    return errors


def flatten_quality_errors(errors: Mapping[str, list[str]]) -> list[str]:
    """Return deterministic, human-readable messages for API consumers."""
    return [message for messages in errors.values() for message in messages]
