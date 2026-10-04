from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User, UserRole
from apps.common.permissions import IsInstructorOrAdmin
from apps.enrollments.models import Enrollment

from .filters import ExamFilter, QuestionBankItemFilter
from .models import (
    Assignment,
    Exam,
    ExamOverrideLog,
    Grade,
    QuestionBankItem,
    StudentAnswer,
    StudentExam,
    StudentExamStatus,
)
from .serializers import (
    AssignmentSerializer,
    ExamSerializer,
    GradeSerializer,
    QuestionBankItemSerializer,
    StudentExamSerializer,
)
from .services import exam_attempt_service


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.select_related("course")
    serializer_class = AssignmentSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsInstructorOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(self, "swagger_fake_view", False) or not user.is_authenticated:
            return qs.none()
        if user.role == "student":
            return qs.filter(course__enrollments__student=user).distinct()
        if user.role == "instructor":
            return qs.filter(course__instructor=user)
        return qs


class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.select_related("course", "student", "assignment")
    serializer_class = GradeSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsInstructorOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(self, "swagger_fake_view", False) or not user.is_authenticated:
            return qs.none()
        if user.role == "student":
            return qs.filter(student=user)
        if user.role == "instructor":
            return qs.filter(course__instructor=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(graded_by=self.request.user)


class ExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.select_related("course").prefetch_related("questions")
    serializer_class = ExamSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = ExamFilter

    def get_permissions(self):
        if self.action in ("list", "retrieve", "student", "start", "submit", "recommended"):
            return [IsAuthenticated()]
        return [IsInstructorOrAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if getattr(self, "swagger_fake_view", False) or not user.is_authenticated:
            return qs.none()
        if user.role == "student":
            student_profile = getattr(user, "student_profile", None)
            course_q = Q(course__enrollments__student=user, is_published=True)
            curriculum_q = Q(course__isnull=True, is_published=True)
            if student_profile:
                if student_profile.education_level:
                    curriculum_q &= (Q(educational_stage=student_profile.education_level) | Q(educational_stage=""))
                if student_profile.grade_level:
                    curriculum_q &= (Q(educational_grade=student_profile.grade_level) | Q(educational_grade=""))
                if student_profile.educational_track:
                    curriculum_q &= (Q(educational_track=student_profile.educational_track) | Q(educational_track=""))
            return qs.filter(course_q | curriculum_q).distinct()
        if user.role == "instructor":
            return qs.filter(Q(course__instructor=user) | Q(questions__instructor=user)).distinct()
        return qs

    def perform_create(self, serializer):
        exam = serializer.save()
        if exam.is_published:
            try:
                from .tasks import notify_exam_audience_task

                notify_exam_audience_task(exam.id)
            except Exception:
                pass

    def perform_update(self, serializer):
        was_published = serializer.instance.is_published
        exam = serializer.save()
        if exam.is_published and not was_published:
            try:
                from .tasks import notify_exam_audience_task

                notify_exam_audience_task(exam.id)
            except Exception:
                pass

    @action(detail=False, methods=["get"])
    def student(self, request):
        user = request.user
        if user.role != "student":
            return Response({"detail": "Only students can access this endpoint."}, status=403)

        attempts = (
            StudentExam.objects.filter(student=user)
            .select_related("exam")
            .prefetch_related("answers__question")
            .order_by("-created_at")
        )

        latest_param = request.query_params.get("latest", "true").lower()
        if latest_param in ("true", "1", "yes"):
            seen_exams = set()
            latest_ids = []
            for attempt in attempts:
                if attempt.exam_id not in seen_exams:
                    seen_exams.add(attempt.exam_id)
                    latest_ids.append(attempt.id)
            attempts = attempts.filter(id__in=latest_ids).order_by("-created_at")

        page = self.paginate_queryset(attempts)
        if page is not None:
            serializer = StudentExamSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = StudentExamSerializer(attempts, many=True)
        return Response({"results": serializer.data})


    @staticmethod
    def _evaluate_answer(question: QuestionBankItem, student_ans_data) -> tuple[Decimal, bool]:
        """
        Evaluates a student's answer against the correct answer in QuestionBankItem.
        Returns (points_earned, is_graded).
        """
        q_type = question.question_type
        points = Decimal(str(question.points))
        correct_data = question.correct_answer_json

        if q_type == QuestionBankItem.QuestionType.ESSAY:
            return Decimal("0.00"), False

        if not student_ans_data:
            return Decimal("0.00"), True

        ans = student_ans_data.get("answer") if isinstance(student_ans_data, dict) else student_ans_data

        if q_type == QuestionBankItem.QuestionType.MULTIPLE_CHOICE:
            correct_ans = correct_data.get("correct_option") if isinstance(correct_data, dict) else correct_data
            ans_str = str(ans).strip().lower()
            correct_ans_str = str(correct_ans).strip().lower() if correct_ans is not None else ""

            if correct_ans_str and ans_str == correct_ans_str:
                return points, True

            options = question.options_json if isinstance(question.options_json, list) else []

            # Check if student's answer directly matches any option's text
            matched_by_text = False
            for opt in options:
                opt_val = (opt.get("text") or opt.get("label") or "") if isinstance(opt, dict) else str(opt)
                opt_text = str(opt_val).strip().lower()
                if ans_str == opt_text:
                    matched_by_text = True
                    if (correct_ans_str and opt_text == correct_ans_str) or (isinstance(opt, dict) and (opt.get("isCorrect") or opt.get("is_correct"))):
                        return points, True
                    return Decimal("0.00"), True

            # If not matched by literal text, check for option ID
            if not matched_by_text:
                for _idx, opt in enumerate(options):
                    if isinstance(opt, dict):
                        opt_id = str(opt.get("id", "")).strip().lower()
                        opt_text = str(opt.get("text", opt.get("label", ""))).strip().lower()
                        opt_is_correct = bool(opt.get("isCorrect") or opt.get("is_correct"))
                        if opt_id and ans_str == opt_id:
                            if opt_is_correct or (correct_ans_str and opt_text == correct_ans_str):
                                return points, True

            return Decimal("0.00"), True

        if q_type == QuestionBankItem.QuestionType.TRUE_FALSE:
            correct_ans = correct_data.get("correct_option") if isinstance(correct_data, dict) else correct_data
            ans_str = str(ans).strip().lower()
            correct_ans_str = str(correct_ans).strip().lower() if correct_ans is not None else ""

            true_values = {"true", "1", "t", "yes", "y", "صحيح", "صواب", "صح"}
            false_values = {"false", "0", "f", "no", "n", "خاطئ", "خطأ", "خطا"}

            is_student_true = ans_str in true_values
            is_student_false = ans_str in false_values
            is_correct_true = correct_ans_str in true_values
            is_correct_false = correct_ans_str in false_values

            if not is_correct_true and not is_correct_false:
                options = question.options_json if isinstance(question.options_json, list) else []
                for opt in options:
                    if isinstance(opt, dict) and (opt.get("isCorrect") or opt.get("is_correct")):
                        text_val = str(opt.get("text", "")).strip().lower()
                        if text_val in true_values:
                            is_correct_true = True
                        elif text_val in false_values:
                            is_correct_false = True

            if (is_student_true and is_correct_true) or (is_student_false and is_correct_false):
                return points, True
            return Decimal("0.00"), True

        if q_type == QuestionBankItem.QuestionType.FILL_BLANK:
            correct_options = []
            if isinstance(correct_data, dict):
                raw = correct_data.get("accepted_answers", correct_data.get("answer", []))
                if isinstance(raw, list):
                    correct_options = [str(x).strip().lower() for x in raw]
                else:
                    correct_options = [str(raw).strip().lower()]
            elif isinstance(correct_data, list):
                correct_options = [str(x).strip().lower() for x in correct_data]
            else:
                correct_options = [str(correct_data).strip().lower()]

            if str(ans).strip().lower() in correct_options:
                return points, True
            return Decimal("0.00"), True

        if q_type == QuestionBankItem.QuestionType.MATCHING:
            if isinstance(ans, dict) and isinstance(correct_data, dict):
                total_pairs = len(correct_data)
                if total_pairs == 0:
                    return points, True
                correct_count = 0
                ans_lookup = {
                    str(k).lstrip("_").strip().lower(): str(v).strip().lower()
                    for k, v in ans.items()
                }
                for k, v in correct_data.items():
                    norm_k = str(k).lstrip("_").strip().lower()
                    if ans_lookup.get(norm_k) == str(v).strip().lower():
                        correct_count += 1
                ratio = Decimal(str(correct_count)) / Decimal(str(total_pairs))
                return (points * ratio).quantize(Decimal("0.01")), True
            return Decimal("0.00"), True

        return Decimal("0.00"), True

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        if request.user.role != "student":
            return Response(
                {"detail": "Only students can start an exam."},
                status=status.HTTP_403_FORBIDDEN,
            )

        exam = get_object_or_404(Exam, pk=pk)
        # Course access keeps the explicit 403 below. Standalone assessments
        # must still be visible to the student's curriculum-scoped queryset.
        if not exam.course_id and not self.get_queryset().filter(pk=exam.pk).exists():
            return Response({"detail": "هذا التقييم غير متاح لحسابك."}, status=status.HTTP_403_FORBIDDEN)
        if not exam.is_published:
            return Response({"detail": "هذا الاختبار غير متاح حالياً."}, status=status.HTTP_403_FORBIDDEN)

        if exam.course_id:
            enrollment = Enrollment.objects.filter(
                student=request.user,
                course_id=exam.course_id,
            ).first()
            if enrollment is None:
                return Response(
                    {"detail": "يجب التسجيل في الدورة أولاً لأداء هذا الاختبار."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if not enrollment.has_active_access:
                return Response(
                    {
                        "detail": "انتهت صلاحية اشتراكك في الدورة. جدد الاشتراك قبل أداء التقييم.",
                        "code": "subscription_expired",
                        "expired_at": enrollment.expires_at,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        now = timezone.now()
        if exam.start_time and now < exam.start_time:
            return Response(
                {"detail": f"لم يبدأ موعد الاختبار بعد. موعد البدء: {exam.start_time.strftime('%Y-%m-%d %H:%M')}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if exam.end_time and now > exam.end_time:
            return Response({"detail": "انتهت فترة أداء هذا الاختبار."}, status=status.HTTP_400_BAD_REQUEST)

        idempotency_key = request.headers.get("X-Idempotency-Key") or request.data.get("idempotency_key")

        try:
            attempt = exam_attempt_service.start_exam(
                student=request.user,
                exam=exam,
                idempotency_key=idempotency_key,
            )
        except ValidationError as exc:
            msg = exc.message if hasattr(exc, "message") else str(exc)
            return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "detail": "تم بدء محاولة الاختبار بنجاح.",
                "attempt": StudentExamSerializer(attempt, context={"request": request}).data,
                "started_at": attempt.started_at,
                "duration_minutes": exam.duration_minutes,
                "attempt_number": attempt.attempt_number,
                "attempts_allowed": exam.attempts_allowed,
            },
            status=status.HTTP_200_OK if getattr(attempt, "_is_resumed", False) else status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        if request.user.role != "student":
            return Response(
                {"detail": "Only students can submit an exam."},
                status=status.HTTP_403_FORBIDDEN,
            )

        exam = get_object_or_404(Exam, pk=pk)
        if exam.course_id:
            enrollment = Enrollment.objects.filter(
                student=request.user,
                course_id=exam.course_id,
            ).first()
            if enrollment is None:
                return Response(
                    {"detail": "يجب التسجيل في الدورة أولاً لتسليم هذا التقييم."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if not enrollment.has_active_access:
                return Response(
                    {
                        "detail": "انتهت صلاحية اشتراكك في الدورة. جدد الاشتراك قبل تسليم التقييم.",
                        "code": "subscription_expired",
                        "expired_at": enrollment.expires_at,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        if not exam.course_id and not self.get_queryset().filter(pk=exam.pk).exists():
            return Response({"detail": "هذا التقييم غير متاح لحسابك."}, status=status.HTTP_403_FORBIDDEN)
        attempt = (
            StudentExam.objects.filter(
                student=request.user,
                exam=exam,
                status=StudentExamStatus.IN_PROGRESS,
            )
            .order_by("-created_at")
            .first()
        )

        if not attempt:
            return Response(
                {"detail": "لم يتم العثور على محاولة جارية لهذا الاختبار."},
                status=status.HTTP_404_NOT_FOUND,
            )

        tab_switches = request.data.get(
            "tab_switches_count", request.data.get("tab_switches", 0)
        )
        try:
            tab_switches = max(0, int(tab_switches))
        except (ValueError, TypeError):
            tab_switches = 0

        submitted_answers = request.data.get("answers", [])

        attempt = exam_attempt_service.submit_exam(
            attempt=attempt,
            answers_data=submitted_answers,
            tab_switches=tab_switches,
        )

        try:
            from apps.analytics.streak_service import record_student_activity

            record_student_activity(
                request.user,
                minutes_spent=exam.duration_minutes or 30,
                quizzes_submitted=1,
            )
        except Exception:
            pass

        return Response(
            StudentExamSerializer(attempt, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="request-override")
    def request_override(self, request, pk=None):
        exam = self.get_object()
        user = request.user
        is_instructor = bool(
            user.role == UserRole.INSTRUCTOR and exam.course and exam.course.instructor_id == user.id
        )
        is_admin = bool(user.is_staff or user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN))
        if not (is_instructor or is_admin):
            return Response({"detail": "غير مصرح لك بمنح تجاوزات لهذا الاختبار."}, status=status.HTTP_403_FORBIDDEN)

        student_id = request.data.get("student_id")
        reason = str(request.data.get("reason", "")).strip()
        attempts_granted = int(request.data.get("attempts_granted", 1))

        if not student_id or not reason:
            return Response(
                {"detail": "يجب تحديد الطالب وسبب منح المحاولة الاستثنائية."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student = get_object_or_404(User, id=student_id)

        # Lift 24h lockout
        StudentExam.objects.filter(student=student, exam=exam, locked_until__isnull=False).update(locked_until=None)

        # Record override log
        ExamOverrideLog.objects.create(
            instructor=user,
            student=student,
            exam=exam,
            reason=reason,
            attempts_granted=attempts_granted,
        )

        return Response(
            {
                "status": "success",
                "message": f"تم منح الطالب {attempts_granted} محاولات إضافية ورفع الحظر بنجاح.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="attempts")
    def attempts(self, request, pk=None):
        """List all student attempts for this exam (Instructor / Admin view)."""
        exam = self.get_object()
        attempts_qs = StudentExam.objects.filter(exam=exam).select_related("student").order_by("-created_at")
        page = self.paginate_queryset(attempts_qs)
        if page is not None:
            serializer = StudentExamSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = StudentExamSerializer(attempts_qs, many=True, context={"request": request})
        return Response({"results": serializer.data})

    @action(detail=True, methods=["post"], url_path="grade-essay")
    @transaction.atomic
    def grade_essay(self, request, pk=None):
        visible_exam = self.get_object()
        exam = Exam.objects.select_for_update().get(pk=visible_exam.pk)

        student_exam_id = request.data.get("student_exam_id")
        attempt = get_object_or_404(
            StudentExam.objects.select_for_update(),
            pk=student_exam_id,
            exam=exam,
            status__in=[StudentExamStatus.SUBMITTED, StudentExamStatus.GRADED],
        )

        score = request.data.get("score")
        feedback = request.data.get("feedback", "")
        try:
            numeric_score = Decimal(str(score))
        except Exception:
            return Response(
                {"score": "يرجى إدخال درجة صحيحة."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attempt.score = min(
            Decimal(str(exam.max_score)),
            max(Decimal("0.00"), numeric_score),
        )
        threshold = exam.pass_threshold if exam.pass_threshold is not None else 50
        percentage = (
            (attempt.score / Decimal(str(max(exam.max_score, 1)))) * Decimal("100")
        )
        attempt.is_passed = percentage >= Decimal(str(threshold))
        attempt.instructor_feedback = feedback
        attempt.status = StudentExamStatus.GRADED
        attempt.graded_by = request.user
        attempt.completed_at = attempt.completed_at or timezone.now()
        attempt.save(
            update_fields=[
                "score",
                "is_passed",
                "instructor_feedback",
                "status",
                "graded_by",
                "completed_at",
                "updated_at",
            ]
        )
        StudentAnswer.objects.filter(
            student_exam=attempt,
            question__question_type=QuestionBankItem.QuestionType.ESSAY,
        ).update(is_graded=True)

        if attempt.is_passed:
            exam_attempt_service._handle_exam_passed_progression(attempt)

        try:
            from apps.notifications.tasks import send_telegram_exam_alert_task

            send_telegram_exam_alert_task.delay(attempt.id)
        except Exception:
            pass

        return Response(
            {
                "detail": "تم تصحيح ورصد الدرجة بنجاح.",
                "attempt": StudentExamSerializer(
                    attempt,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        """Toggle or explicitly set the published status of the exam."""
        exam = self.get_object()
        user = request.user
        if exam.course and exam.course.instructor != user and user.role not in ("admin", "super_admin"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        elif not exam.course and user.role not in ("admin", "super_admin"):
            first_q = exam.questions.first()
            if first_q and first_q.instructor_id != user.id:
                return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        def parse_boolean(value):
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return value == 1
            if isinstance(value, str):
                normalized = value.strip().casefold()
                if normalized in {"true", "1", "yes", "y", "on", "نعم"}:
                    return True
                if normalized in {"false", "0", "no", "n", "off", "لا"}:
                    return False
            raise ValueError

        if "is_published" in request.data:
            raw_published = request.data["is_published"]
        elif "isPublished" in request.data:
            raw_published = request.data["isPublished"]
        else:
            raw_published = None

        if raw_published is None:
            next_published = not exam.is_published
        else:
            try:
                next_published = parse_boolean(raw_published)
            except ValueError:
                return Response(
                    {"detail": "قيمة حالة النشر يجب أن تكون true أو false."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if next_published and not exam.questions.exists():
            return Response(
                {"detail": "لا يمكن نشر تقييم لا يحتوي على أسئلة."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exam.is_published = next_published

        exam.save(update_fields=["is_published", "updated_at"])
        if exam.is_published:
            try:
                from .tasks import notify_exam_audience_task

                notify_exam_audience_task(exam.id)
            except Exception:
                pass

        return Response(
            {
                "detail": "تم تحديث حالة نشر الامتحان بنجاح.",
                "id": exam.id,
                "is_published": exam.is_published,
                "isPublished": exam.is_published,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="analytics")
    def analytics(self, request, pk=None):
        exam = self.get_object()
        from django.db.models import Avg, Count

        agg = StudentExam.objects.filter(exam=exam).aggregate(
            total=Count("id"),
            avg_score=Avg("score"),
            avg_switches=Avg("tab_switches_count"),
            graded_count=Count("score"),
        )
        total_attempts = agg["total"] or 0
        avg_score = round(float(agg["avg_score"] or 0), 2)
        avg_tab_switches = round(float(agg["avg_switches"] or 0), 1)
        graded_attempts_count = agg["graded_count"] or 0

        questions = exam.questions.all()
        answers_qs = StudentAnswer.objects.filter(student_exam__exam=exam).select_related("question")
        answers_by_q = {}
        for answer in answers_qs:
            answers_by_q.setdefault(answer.question_id, []).append(answer)

        most_missed_questions = []
        for question in questions:
            question_answers = answers_by_q.get(question.id, [])
            total_q_answers = len(question_answers)
            incorrect_count = sum(1 for answer in question_answers if answer.points_earned < question.points)
            error_percent = (
                round((incorrect_count / max(total_q_answers, 1)) * 100, 1)
                if total_q_answers > 0
                else 0.0
            )
            most_missed_questions.append(
                {
                    "question_id": question.id,
                    "question_text": question.question_text,
                    "question_type": question.question_type,
                    "total_answers": total_q_answers,
                    "incorrect_count": incorrect_count,
                    "error_rate_percent": error_percent,
                    "explanation": question.explanation or "لا يوجد شرح متاح لهذا السؤال حالياً.",
                }
            )

        most_missed_questions.sort(key=lambda item: item["incorrect_count"], reverse=True)
        top_20_missed = most_missed_questions[:20]

        return Response(
            {
                "exam_id": exam.id,
                "exam_title": exam.title,
                "total_attempts": total_attempts,
                "students_attempted": total_attempts,
                "graded_attempts_count": graded_attempts_count,
                "average_score": avg_score,
                "max_score": exam.max_score,
                "average_tab_switches": avg_tab_switches,
                "most_missed_questions": top_20_missed,
            }
        )

    @action(detail=False, methods=["get"])
    def recommended(self, request):
        """Suggest exams matching the student's academic profile."""
        user = request.user
        if user.role != "student":
            return Response({"detail": "Only students can access recommendations."}, status=403)

        try:
            profile = user.student_profile
        except Exception:
            return Response({"results": []})

        stage = profile.education_level or ""
        grade = profile.grade_level or ""
        track = profile.educational_track or ""

        qs = self.get_queryset().filter(is_published=True)
        if stage:
            qs = qs.filter(educational_stage=stage)
        if grade:
            qs = qs.filter(educational_grade=grade)
        if track:
            qs = qs.filter(educational_track=track)

        qs = qs[:20]
        serializer = self.get_serializer(qs, many=True)
        return Response({"results": serializer.data})

class QuestionBankViewSet(viewsets.ModelViewSet):
    permission_classes = [IsInstructorOrAdmin]
    serializer_class = QuestionBankItemSerializer
    queryset = QuestionBankItem.objects.select_related("category", "instructor")
    filter_backends = [DjangoFilterBackend]
    filterset_class = QuestionBankItemFilter

    def get_queryset(self):
        user = self.request.user
        if getattr(self, "swagger_fake_view", False) or not user.is_authenticated:
            return QuestionBankItem.objects.none()
        if user.role == "admin" or user.role == "super_admin":
            return super().get_queryset()
        return super().get_queryset().filter(instructor=user)

    def perform_create(self, serializer):
        serializer.save(instructor=self.request.user)
