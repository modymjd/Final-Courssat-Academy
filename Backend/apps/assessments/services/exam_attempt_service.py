"""
Exam Attempt Service: Atomic Lifecycle, Idempotency, Snapshots, and Server-Side Grading.

Handles:
- Starting an exam with select_for_update and distributed locking.
- Enforcing 24-hour lockout state machine for unit exams (after 3 failures).
- Cooldown period enforcement between attempts (30s for quizzes).
- Taking immutable questions and correct answers snapshots (preventing answer leaks).
- Server-side auto-grading strictly against the exam snapshot.
- Automatic progression and completion triggering upon passing.
"""

from __future__ import annotations

import logging
import random
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.assessments.models import (
    Exam,
    ExamKind,
    ExamType,
    QuestionBankItem,
    StudentAnswer,
    StudentExam,
    StudentExamStatus,
)
from apps.common.services.redis_service import redis_lock

logger = logging.getLogger(__name__)


def start_exam(
    student: Any,
    exam: Exam,
    idempotency_key: str | None = None,
) -> StudentExam:
    """
    Atomically initiates an exam attempt for a student.

    Guarantees:
    - Idempotency: Duplicate calls with the same idempotency_key return the existing attempt.
    - Concurrency protection: Distributed lock prevents duplicate simultaneous attempts.
    - 24h Lockout enforcement: Unit exams enforce a 24-hour lockout after 3 failed attempts.
    - Cooldown enforcement: Quizzes enforce a 30s cooldown after failed attempts.
    - Question snapshotting: Pure questions (without correct answers) are snapshotted.
    - Server-side answer snapshot: Correct answers are sealed for server-only grading.

    Returns:
        StudentExam instance in IN_PROGRESS state.
    """
    lock_key = f"exam_start:{student.id}:{exam.id}"
    idem_key = idempotency_key.strip() if idempotency_key else str(uuid.uuid4())

    with redis_lock(lock_key, expire=10, timeout=5.0):
        with transaction.atomic():
            # 1. Idempotency Check
            existing_idem = StudentExam.objects.filter(
                student=student,
                exam=exam,
                idempotency_key=idem_key,
            ).first()
            if existing_idem:
                existing_idem._is_resumed = True  # type: ignore[attr-defined]
                return existing_idem

            # 2. Check for existing IN_PROGRESS attempt
            in_progress = (
                StudentExam.objects.select_for_update()
                .filter(student=student, exam=exam, status=StudentExamStatus.IN_PROGRESS)
                .order_by("-started_at")
                .first()
            )
            if in_progress:
                # If within duration window, return in-progress attempt
                duration = exam.duration_minutes or 60
                grace_period = timedelta(minutes=duration + 2)
                if in_progress.started_at and (timezone.now() - in_progress.started_at) <= grace_period:
                    in_progress._is_resumed = True  # type: ignore[attr-defined]
                    return in_progress
                else:
                    # Mark expired attempt as SUBMITTED with 0 score
                    in_progress.status = StudentExamStatus.SUBMITTED
                    in_progress.completed_at = timezone.now()
                    in_progress.score = Decimal("0.00")
                    in_progress.is_passed = False
                    in_progress.save(update_fields=["status", "completed_at", "score", "is_passed"])

            # 3. Check 24-Hour Lockout for Unit Exams
            active_lockout = (
                StudentExam.objects.filter(
                    student=student,
                    exam=exam,
                    locked_until__gt=timezone.now(),
                )
                .order_by("-locked_until")
                .first()
            )
            if active_lockout and active_lockout.locked_until:
                diff = active_lockout.locked_until - timezone.now()
                hours = int(diff.total_seconds() // 3600)
                minutes = int((diff.total_seconds() % 3600) // 60)
                raise ValidationError(
                    f"أنت في فترة حظر لمدة 24 ساعة بعد استنفاد محاولاتك. يرفع الحظر بعد {hours} ساعة و {minutes} دقيقة."
                )

            # 4. Check Cooldown between attempts for Quizzes
            if exam.kind in (ExamKind.LESSON_QUIZ, ExamKind.IN_VIDEO_QUIZ):
                last_attempt = (
                    StudentExam.objects.filter(
                        student=student,
                        exam=exam,
                        status__in=[StudentExamStatus.SUBMITTED, StudentExamStatus.GRADED],
                    )
                    .order_by("-completed_at")
                    .first()
                )
                if last_attempt and last_attempt.completed_at and not last_attempt.is_passed:
                    cooldown = exam.cooldown_seconds or 30
                    elapsed = (timezone.now() - last_attempt.completed_at).total_seconds()
                    if elapsed < cooldown:
                        remaining = int(cooldown - elapsed)
                        raise ValidationError(f"يرجى الانتظار {remaining} ثانية قبل إعادة المحاولة.")

            # 5. Enforce the instructor-configured attempt limit. Unit exams
            # use a renewable 24-hour lockout window; every other assessment
            # (including lesson assignments) has a hard configured limit.
            if exam.attempts_allowed:
                attempts_count = StudentExam.objects.filter(student=student, exam=exam).count()
                if exam.kind == ExamKind.UNIT_EXAM:
                    # Unit exam: 3 attempts per window; handled via locked_until
                    pass
                elif attempts_count >= exam.attempts_allowed:
                    raise ValidationError(
                        f"لقد استنفدت الحد الأقصى للمحاولات المسموح بها ({exam.attempts_allowed} محاولة)."
                    )

            # 6. Sample questions from Question Bank
            questions_pool = list(QuestionBankItem.objects.filter(exam=exam))
            if not questions_pool:
                raise ValidationError("لا يمكن بدء تقييم لا يحتوي على أسئلة.")

            if exam.kind in (ExamKind.LESSON_QUIZ, ExamKind.IN_VIDEO_QUIZ):
                target_count = exam.quiz_question_count or 5
                if exam.shuffle_questions and len(questions_pool) >= target_count:
                    selected_questions = random.sample(questions_pool, target_count)
                else:
                    selected_questions = list(questions_pool[:target_count])
            else:
                selected_questions = list(questions_pool)
                if exam.shuffle_questions:
                    random.shuffle(selected_questions)

            # 7. Build Snapshots
            questions_snapshot: list[dict[str, Any]] = []
            correct_answers_snapshot: dict[str, Any] = {}

            for idx, q in enumerate(selected_questions):
                options = q.options_json
                if exam.shuffle_questions and isinstance(options, list):
                    options = random.sample(options, len(options))

                # Never expose correctness flags in the attempt payload.
                safe_options = []
                for option_idx, option in enumerate(options if isinstance(options, list) else []):
                    if isinstance(option, dict):
                        safe_options.append(
                            {
                                "id": option.get("id", option_idx + 1),
                                "text": option.get("text", option.get("label", "")),
                            }
                        )
                    elif isinstance(option, str):
                        safe_options.append({"id": option_idx + 1, "text": option})

                # Question snapshot (NO correct answer!)
                question_snapshot = {
                    "id": q.id,
                    "question_text": q.question_text,
                    "image_url": q.image_url,
                    "question_type": q.question_type,
                    "options": safe_options,
                    "points": float(q.points),
                    "order": idx + 1,
                    "video_timestamp_start": q.video_timestamp_start,
                    "video_timestamp_end": q.video_timestamp_end,
                }
                if exam.exam_type == ExamType.PRACTICE:
                    question_snapshot["explanation"] = q.explanation
                questions_snapshot.append(question_snapshot)

                # Correct answers snapshot (Sealed on server for grading)
                correct_answers_snapshot[str(q.id)] = {
                    "correct_answer": q.correct_answer_json,
                    "points": float(q.points),
                    "question_type": q.question_type,
                    "explanation": q.explanation,
                }

            # 8. Create StudentExam
            attempt_number = StudentExam.objects.filter(student=student, exam=exam).count() + 1
            attempt = StudentExam.objects.create(
                student=student,
                exam=exam,
                attempt_number=attempt_number,
                idempotency_key=idem_key,
                status=StudentExamStatus.IN_PROGRESS,
                started_at=timezone.now(),
                questions_snapshot_json=questions_snapshot,
                correct_answers_snapshot_json=correct_answers_snapshot,
            )
            attempt._is_resumed = False  # type: ignore[attr-defined]

            return attempt


def submit_exam(
    attempt: StudentExam,
    answers_data: dict[str, Any] | list[dict[str, Any]],
    tab_switches: int = 0,
) -> StudentExam:
    """
    Submits and auto-grades an exam attempt server-side.

    - Compares answers strictly against correct_answers_snapshot_json.
    - Computes total score and verifies against exam.pass_threshold (default 70%).
    - Calculates next retry cooldown (30s for quizzes, 24h lockout on 3rd failure for unit exam).
    - Triggers progression updates if passed.

    Args:
        attempt: StudentExam instance.
        answers_data: Dict or list mapping question IDs to submitted answers.
        tab_switches: Number of tab switches recorded by the client proctoring.

    Returns:
        Updated and graded StudentExam instance.
    """
    with transaction.atomic():
        attempt = StudentExam.objects.select_for_update().get(id=attempt.id)

        # Idempotent: return if already graded or submitted
        if attempt.status in (StudentExamStatus.SUBMITTED, StudentExamStatus.GRADED):
            return attempt

        # Normalize answers_data into a dict keyed by str(question_id)
        normalized_answers: dict[str, Any] = {}
        if isinstance(answers_data, list):
            for item in answers_data:
                if isinstance(item, dict):
                    qid = str(item.get("question_id") or item.get("id"))
                    normalized_answers[qid] = item.get("answer") or item.get("selected_option") or item
        elif isinstance(answers_data, dict):
            for k, v in answers_data.items():
                normalized_answers[str(k)] = v

        correct_snapshot = attempt.correct_answers_snapshot_json or {}
        questions_snapshot = attempt.questions_snapshot_json or []

        total_points = Decimal("0.00")
        earned_points = Decimal("0.00")
        has_manual_questions = False

        for q_data in questions_snapshot:
            qid_str = str(q_data.get("id"))
            correct_info = correct_snapshot.get(qid_str, {})
            q_points = Decimal(str(correct_info.get("points", q_data.get("points", 5.0))))
            total_points += q_points

            user_ans = normalized_answers.get(qid_str)
            is_correct = False

            q_type = correct_info.get("question_type", q_data.get("question_type"))
            correct_ans_raw = correct_info.get("correct_answer")
            answer_is_graded = True

            # Extract the canonical submitted value without destroying structured answers.
            if isinstance(user_ans, dict):
                user_val = (
                    user_ans.get("value")
                    if "value" in user_ans
                    else user_ans.get("answer")
                    if "answer" in user_ans
                    else user_ans.get("text")
                    if "text" in user_ans
                    else user_ans
                )
            else:
                user_val = user_ans

            # Evaluate answer based on question type. Keep structured answer types
            # (matching) intact; scalar types use the canonical correct option/value.
            if isinstance(correct_ans_raw, dict):
                correct_val = (
                    correct_ans_raw.get("correct_option")
                    if "correct_option" in correct_ans_raw
                    else correct_ans_raw.get("value")
                    if "value" in correct_ans_raw
                    else correct_ans_raw.get("answer")
                    if "answer" in correct_ans_raw
                    else correct_ans_raw.get("text")
                    if "text" in correct_ans_raw
                    else correct_ans_raw
                )
            else:
                correct_val = correct_ans_raw

            if q_type == "ESSAY":
                has_manual_questions = True
                answer_is_graded = False
            elif q_type in ("MULTIPLE_CHOICE", "TRUE_FALSE"):
                if correct_val is not None and user_val is not None:
                    is_correct = str(correct_val).strip().lower() == str(user_val).strip().lower()

            elif q_type == "FILL_BLANK":
                accepted_answers = (
                    correct_ans_raw.get("accepted_answers")
                    if isinstance(correct_ans_raw, dict)
                    else correct_ans_raw
                )
                if isinstance(accepted_answers, list):
                    is_correct = str(user_val).strip().lower() in {
                        str(c).strip().lower() for c in accepted_answers
                    }
                elif correct_val is not None and user_val is not None:
                    is_correct = str(correct_val).strip().lower() == str(user_val).strip().lower()

            elif q_type == "MATCHING":
                if isinstance(correct_ans_raw, dict) and isinstance(user_val, dict):
                    def _normalize_matching(value: dict[str, Any]) -> dict[str, str]:
                        return {
                            str(key).lstrip("_").strip().lower(): str(val).strip().lower()
                            for key, val in value.items()
                        }

                    is_correct = _normalize_matching(correct_ans_raw) == _normalize_matching(user_val)

            points_for_q = q_points if is_correct else Decimal("0.00")
            earned_points += points_for_q

            # Create or update StudentAnswer record
            try:
                StudentAnswer.objects.update_or_create(
                    student_exam=attempt,
                    question_id=int(qid_str),
                    defaults={
                        "answer_json": user_ans if isinstance(user_ans, dict) else {"answer": user_ans},
                        "points_earned": points_for_q,
                        "is_graded": answer_is_graded,
                    },
                )
            except Exception as exc:
                logger.warning("Error recording StudentAnswer for question %s: %s", qid_str, exc)

        # Calculate final percentage and scaled score
        if total_points > Decimal("0.00"):
            score_percentage = (earned_points / total_points) * Decimal("100.00")
            max_s = Decimal(str(attempt.exam.max_score or 100))
            scaled_score = (earned_points / total_points) * max_s
        else:
            score_percentage = Decimal("0.00")
            scaled_score = Decimal("0.00")

        attempt.score = Decimal(str(round(scaled_score, 2)))
        pass_threshold = (
            attempt.exam.pass_threshold
            if attempt.exam.pass_threshold is not None
            else 70
        )
        attempt.is_passed = (
            not has_manual_questions
            and score_percentage >= Decimal(str(pass_threshold))
        )
        attempt.status = (
            StudentExamStatus.SUBMITTED
            if has_manual_questions
            else StudentExamStatus.GRADED
        )
        attempt.completed_at = timezone.now()
        attempt.tab_switches_count = tab_switches

        # 24h Lockout on 3rd failure for Unit Exams
        if (
            not has_manual_questions
            and not attempt.is_passed
            and attempt.exam.kind == ExamKind.UNIT_EXAM
        ):
            allowed = attempt.exam.attempts_allowed or 3
            if attempt.attempt_number % allowed == 0:
                attempt.locked_until = timezone.now() + timedelta(hours=24)

        attempt.save()

        # Trigger progression updates if passed
        if not has_manual_questions and attempt.is_passed:
            _handle_exam_passed_progression(attempt)

    return attempt


def _handle_exam_passed_progression(attempt: StudentExam) -> None:
    """
    Triggers progression and completion events when an exam or quiz is passed.
    """
    try:
        from apps.courses.models import Lesson
        from apps.enrollments.models import Enrollment, LessonCompletion

        # If it's a lesson quiz, check if the lesson can now be marked completed
        if attempt.exam.lesson_id and attempt.exam.course_id:
            enrollment = Enrollment.objects.filter(
                student=attempt.student,
                course_id=attempt.exam.course_id,
            ).first()

            if enrollment:
                lesson = Lesson.objects.filter(id=attempt.exam.lesson_id).first()
                if lesson:
                    from apps.courses.services.progression_service import can_complete_lesson
                    can_comp, _ = can_complete_lesson(enrollment, lesson)
                    if can_comp:
                        LessonCompletion.objects.get_or_create(
                            enrollment=enrollment,
                            lesson=lesson,
                        )
    except Exception as exc:
        logger.error("Error triggering progression update after exam pass: %s", exc)
