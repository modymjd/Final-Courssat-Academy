from decimal import Decimal

from rest_framework import serializers

from apps.accounts.models import UserRole
from apps.common.serializers import FlexiCaseModelSerializer
from apps.courses.models import Course, Lesson, Module

from .image_paths import normalize_question_image_url
from .models import (
    Assignment,
    Exam,
    ExamKind,
    Grade,
    QuestionBankItem,
    StudentExam,
    StudentExamStatus,
)


class AssignmentSerializer(serializers.ModelSerializer):
    course_title = serializers.ReadOnlyField(source="course.title")

    class Meta:
        model = Assignment
        fields = ["id", "course", "course_title", "title", "description", "max_score", "due_date", "created_at"]

    def validate_course(self, course):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            return course
        if user.role != UserRole.INSTRUCTOR or course.instructor_id != user.id:
            raise serializers.ValidationError("لا يمكنك إنشاء أو تعديل تكليف خارج دوراتك.")
        return course

    def validate_max_score(self, value):
        if value <= 0:
            raise serializers.ValidationError("الدرجة النهائية يجب أن تكون أكبر من صفر.")
        return value


class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source="student.full_name")
    course_title = serializers.ReadOnlyField(source="course.title")

    class Meta:
        model = Grade
        fields = [
            "id", "student", "student_name", "course", "course_title", "assignment", "score", "max_score",
            "feedback", "graded_at", "graded_by",
        ]
        read_only_fields = ["graded_by", "graded_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        course = attrs.get("course", getattr(self.instance, "course", None))
        student = attrs.get("student", getattr(self.instance, "student", None))
        assignment = attrs.get("assignment", getattr(self.instance, "assignment", None))

        if student and student.role != UserRole.STUDENT:
            raise serializers.ValidationError({"student": "الدرجة يجب أن تكون مرتبطة بحساب طالب."})
        if course and user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            if user.role != UserRole.INSTRUCTOR or course.instructor_id != user.id:
                raise serializers.ValidationError({"course": "لا يمكنك تسجيل درجات خارج دوراتك."})

        if assignment:
            if course and assignment.course_id != course.id:
                raise serializers.ValidationError({"assignment": "التكليف لا ينتمي إلى الدورة المحددة."})
            if user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN) and assignment.course.instructor_id != user.id:
                raise serializers.ValidationError({"assignment": "لا يمكنك استخدام تكليف خارج دوراتك."})

        score = attrs.get("score", getattr(self.instance, "score", None))
        max_score = attrs.get("max_score", getattr(self.instance, "max_score", 100))
        if max_score is None or max_score <= 0:
            raise serializers.ValidationError({"max_score": "الدرجة النهائية يجب أن تكون أكبر من صفر."})
        if score is not None and (Decimal(str(score)) < 0 or Decimal(str(score)) > Decimal(str(max_score))):
            raise serializers.ValidationError({"score": "الدرجة يجب أن تكون بين صفر والدرجة النهائية."})
        return attrs


class QuestionBankItemSerializer(serializers.ModelSerializer):
    instructor_name = serializers.ReadOnlyField(source="instructor.full_name")
    category_name = serializers.ReadOnlyField(source="category.name")

    class Meta:
        model = QuestionBankItem
        fields = [
            "id", "instructor", "instructor_name", "category", "category_name", "question_text", "question_type",
            "image_url", "options_json", "correct_answer_json", "points", "difficulty", "explanation", "created_at",
            "educational_stage", "educational_grade", "educational_track", "subject", "subject_branch",
        ]
        read_only_fields = ["instructor", "created_at"]

    def validate_points(self, value):
        if value <= 0:
            raise serializers.ValidationError("نقاط السؤال يجب أن تكون أكبر من صفر.")
        return value

    def validate_image_url(self, value):
        return normalize_question_image_url(value)


class StudentQuestionSerializer(serializers.ModelSerializer):
    """Question representation safe for a student attempting an exam."""

    options_json = serializers.SerializerMethodField()

    class Meta:
        model = QuestionBankItem
        fields = ["id", "question_text", "image_url", "question_type", "options_json", "points", "order"]
        read_only_fields = fields

    def get_options_json(self, obj):
        raw_options = obj.options_json or []
        safe_options = []
        for idx, opt in enumerate(raw_options):
            if isinstance(opt, dict):
                safe_options.append(
                    {
                        "id": opt.get("id", idx + 1),
                        "text": opt.get("text", opt.get("label", "")),
                    }
                )
            elif isinstance(opt, str):
                safe_options.append({"id": idx + 1, "text": opt})
            else:
                safe_options.append(opt)
        return safe_options


class ExamSerializer(FlexiCaseModelSerializer):
    course = serializers.PrimaryKeyRelatedField(
        read_only=False,
        required=False,
        allow_null=True,
        queryset=Course.objects.all(),
    )
    lesson = serializers.PrimaryKeyRelatedField(
        read_only=False,
        required=False,
        allow_null=True,
        queryset=Lesson.objects.all(),
    )
    unit = serializers.PrimaryKeyRelatedField(
        read_only=False,
        required=False,
        allow_null=True,
        queryset=Module.objects.all(),
    )
    course_title = serializers.ReadOnlyField(source="course.title")
    lesson_title = serializers.ReadOnlyField(source="lesson.title")
    total_questions = serializers.SerializerMethodField()
    questions = serializers.SerializerMethodField()
    locked_until = serializers.SerializerMethodField()
    lockedUntil = serializers.SerializerMethodField()
    cooldown_seconds_remaining = serializers.SerializerMethodField()
    cooldownSecondsRemaining = serializers.SerializerMethodField()
    attempts_used = serializers.SerializerMethodField()
    attemptsUsed = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id", "kind", "course", "course_title", "lesson", "lesson_title", "unit", "title", "description", "instructions",
            "exam_type", "start_time", "end_time", "duration_minutes", "durationMinutes", "max_score",
            "pass_threshold", "passThreshold", "attempts_allowed", "shuffle_questions", "tab_switch_limit",
            "require_camera", "quiz_question_count", "cooldown_seconds", "is_published", "isPublished",
            "total_questions", "questions", "created_at",
            "educational_stage", "educational_grade", "educational_track", "subject", "subject_branch",
            "educationalStage", "educationalGrade", "educationalTrack", "subjectBranch",
            "locked_until", "lockedUntil", "cooldown_seconds_remaining", "cooldownSecondsRemaining",
            "attempts_used", "attemptsUsed",
        ]

    durationMinutes = serializers.IntegerField(source="duration_minutes", required=False)
    passThreshold = serializers.IntegerField(source="pass_threshold", required=False)
    isPublished = serializers.BooleanField(source="is_published", required=False)
    educationalStage = serializers.CharField(source="educational_stage", required=False)
    educationalGrade = serializers.CharField(source="educational_grade", required=False)
    educationalTrack = serializers.CharField(source="educational_track", required=False)
    subjectBranch = serializers.CharField(source="subject_branch", required=False)

    def get_locked_until(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        from django.utils import timezone

        from apps.assessments.models import StudentExam
        active_lockout = StudentExam.objects.filter(
            student=user, exam=obj, locked_until__gt=timezone.now()
        ).order_by("-locked_until").first()
        return active_lockout.locked_until if active_lockout else None

    def get_lockedUntil(self, obj):
        return self.get_locked_until(obj)

    def get_cooldown_seconds_remaining(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return 0
        from django.utils import timezone

        from apps.assessments.models import ExamKind, StudentExam, StudentExamStatus
        if obj.kind in (ExamKind.LESSON_QUIZ, ExamKind.IN_VIDEO_QUIZ):
            last_attempt = StudentExam.objects.filter(
                student=user, exam=obj, status__in=[StudentExamStatus.SUBMITTED, StudentExamStatus.GRADED]
            ).order_by("-completed_at").first()
            if last_attempt and last_attempt.completed_at and not last_attempt.is_passed:
                cooldown = obj.cooldown_seconds or 30
                elapsed = (timezone.now() - last_attempt.completed_at).total_seconds()
                if elapsed < cooldown:
                    return int(cooldown - elapsed)
        return 0

    def get_cooldownSecondsRemaining(self, obj):
        return self.get_cooldown_seconds_remaining(obj)

    def get_attempts_used(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return 0
        from apps.assessments.models import StudentExam
        return StudentExam.objects.filter(student=user, exam=obj).count()

    def get_attemptsUsed(self, obj):
        return self.get_attempts_used(obj)

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        course = attrs.get("course", getattr(self.instance, "course", None))
        lesson = attrs.get("lesson", getattr(self.instance, "lesson", None))
        unit = attrs.get("unit", getattr(self.instance, "unit", None))

        # Context is authoritative: a lesson/unit always determines its course.
        if lesson:
            lesson_course = lesson.module.course
            if course and lesson_course.id != course.id:
                raise serializers.ValidationError({"lesson": "الدرس لا ينتمي إلى الدورة المحددة."})
            course = lesson_course
            attrs["course"] = course
            attrs["unit"] = None
            attrs["kind"] = ExamKind.LESSON_QUIZ
        elif unit:
            if course and unit.course_id != course.id:
                raise serializers.ValidationError({"unit": "الوحدة لا تنتمي إلى الدورة المحددة."})
            course = unit.course
            attrs["course"] = course
            attrs["lesson"] = None
            attrs["kind"] = ExamKind.UNIT_EXAM
        elif course:
            attrs["kind"] = ExamKind.GENERAL_EXAM
        else:
            attrs["kind"] = attrs.get("kind", getattr(self.instance, "kind", ExamKind.GENERAL_EXAM))

        if course and user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            if user.role != UserRole.INSTRUCTOR or course.instructor_id != user.id:
                raise serializers.ValidationError({"course": "لا يمكنك إنشاء أو تعديل اختبار خارج دوراتك."})

        if lesson and user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            if lesson.module.course.instructor_id != user.id:
                raise serializers.ValidationError({"lesson": "لا يمكنك ربط الاختبار بدرس خارج دوراتك."})

        if unit and user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            if unit.course.instructor_id != user.id:
                raise serializers.ValidationError({"unit": "لا يمكنك ربط الاختبار بوحدة خارج دوراتك."})

        max_score = attrs.get("max_score", getattr(self.instance, "max_score", 100))
        pass_threshold = attrs.get("pass_threshold", getattr(self.instance, "pass_threshold", 50))
        attempts_allowed = attrs.get("attempts_allowed", getattr(self.instance, "attempts_allowed", 1))
        duration_minutes = attrs.get("duration_minutes", getattr(self.instance, "duration_minutes", 60))
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if max_score <= 0:
            raise serializers.ValidationError({"max_score": "الدرجة النهائية يجب أن تكون أكبر من صفر."})
        if not 0 <= pass_threshold <= 100:
            raise serializers.ValidationError({"pass_threshold": "نسبة النجاح يجب أن تكون بين 0 و100."})
        if attempts_allowed <= 0:
            raise serializers.ValidationError({"attempts_allowed": "يجب السماح بمحاولة واحدة على الأقل."})
        if duration_minutes <= 0:
            raise serializers.ValidationError({"duration_minutes": "مدة الاختبار يجب أن تكون أكبر من صفر."})
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({"end_time": "آخر موعد للتسليم يجب أن يكون بعد موعد بدء الإتاحة."})

        # Publishing is a go-live state, not merely a display flag. Reject an
        # empty assessment both on initial creation and when an existing draft
        # is published through the regular create/update endpoints. The
        # dedicated publish action enforces the same invariant.
        is_published = attrs.get(
            "is_published",
            getattr(self.instance, "is_published", False),
        )
        incoming_questions = request.data.get("questions")
        if is_published:
            if incoming_questions is not None:
                if not isinstance(incoming_questions, list) or not incoming_questions:
                    raise serializers.ValidationError(
                        {"questions": "لا يمكن نشر تقييم لا يحتوي على سؤال واحد على الأقل."}
                    )
            elif self.instance is None or not self.instance.questions.exists():
                raise serializers.ValidationError(
                    {"questions": "لا يمكن نشر تقييم لا يحتوي على سؤال واحد على الأقل."}
                )

        # Course-bound exams inherit the complete educational identity.
        academic_fields = [
            "educational_stage",
            "educational_grade",
            "educational_track",
            "subject",
            "subject_branch",
        ]

        if course:
            for field in academic_fields:
                attrs[field] = getattr(course, field, "") or ""
        else:
            stage = attrs.get(
                "educational_stage",
                getattr(self.instance, "educational_stage", "") if self.instance else "",
            )
            grade = attrs.get(
                "educational_grade",
                getattr(self.instance, "educational_grade", "") if self.instance else "",
            )
            track = attrs.get(
                "educational_track",
                getattr(self.instance, "educational_track", "") if self.instance else "",
            )
            subject = attrs.get(
                "subject",
                getattr(self.instance, "subject", "") if self.instance else "",
            )
            branch = attrs.get(
                "subject_branch",
                getattr(self.instance, "subject_branch", "") if self.instance else "",
            )

            if stage or grade or subject:
                from apps.courses.curriculum_service import validate_academic_targeting

                targeting_errors = validate_academic_targeting(
                    stage, grade, track, subject, branch, require_all=False
                )
                if targeting_errors:
                    raise serializers.ValidationError(targeting_errors)

        return attrs

    def get_total_questions(self, obj):
        return len(getattr(obj, "_prefetched_objects_cache", {}).get("questions", obj.questions.all()))

    def get_questions(self, obj):
        items = getattr(obj, "_prefetched_objects_cache", {}).get("questions")
        if items is None:
            items = obj.questions.all()
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated and user.role in (UserRole.STUDENT, UserRole.GUARDIAN):
            return StudentQuestionSerializer(items, many=True).data
        return QuestionBankItemSerializer(items, many=True).data

    def _save_questions(self, exam, questions_data, request_user):
        def parse_correct_flag(value):
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return value == 1
            if isinstance(value, str):
                return value.strip().casefold() in {"true", "1", "yes", "y", "صح", "صواب", "نعم"}
            return False

        def canonical_true_false(value):
            normalized = str(value or "").strip().casefold()
            if normalized in {"true", "1", "yes", "y", "صح", "صواب", "صحيح"}:
                return "صواب"
            if normalized in {"false", "0", "no", "n", "خطأ", "خطا", "خاطئ"}:
                return "خطأ"
            return ""

        total_points = Decimal("0.00")
        for idx, q in enumerate(questions_data if isinstance(questions_data, list) else []):
            if not isinstance(q, dict):
                raise serializers.ValidationError({"questions": "كل سؤال يجب أن يكون كائن بيانات صالحاً."})

            q_type = str(q.get("type", q.get("question_type", "MULTIPLE_CHOICE"))).upper()
            if q_type not in QuestionBankItem.QuestionType.values:
                raise serializers.ValidationError(
                    {"questions": f"نوع السؤال رقم {idx + 1} غير مدعوم."}
                )

            question_text = str(q.get("text", q.get("question_text", ""))).strip()
            if not question_text:
                raise serializers.ValidationError(
                    {"questions": f"نص السؤال رقم {idx + 1} مطلوب."}
                )

            raw_options = q.get("options", q.get("options_json", []))
            if raw_options is None:
                raw_options = []
            if not isinstance(raw_options, list):
                raise serializers.ValidationError(
                    {"questions": f"اختيارات السؤال رقم {idx + 1} يجب أن تكون قائمة."}
                )

            options = []
            for option in raw_options:
                if isinstance(option, dict):
                    option_text = str(option.get("text", option.get("label", ""))).strip()
                    option_is_correct = parse_correct_flag(
                        option.get("isCorrect", option.get("is_correct", False))
                    )
                    if option_text:
                        options.append({"text": option_text, "isCorrect": option_is_correct})
                elif str(option).strip():
                    options.append({"text": str(option).strip(), "isCorrect": False})

            correct_answer = q.get("correct_answer_json", q.get("correct_answer", {}))
            if isinstance(correct_answer, dict):
                correct_value = correct_answer.get(
                    "correct_option",
                    correct_answer.get("answer", correct_answer.get("value", "")),
                )
            else:
                correct_value = correct_answer

            if q_type == QuestionBankItem.QuestionType.MULTIPLE_CHOICE:
                if len(options) < 2:
                    raise serializers.ValidationError(
                        {"questions": f"السؤال رقم {idx + 1} يحتاج إلى خيارين على الأقل."}
                    )

                explicit_correct = [opt["text"] for opt in options if opt["isCorrect"]]
                if str(correct_value or "").strip():
                    matching = [
                        opt["text"]
                        for opt in options
                        if opt["text"].casefold() == str(correct_value).strip().casefold()
                    ]
                    if len(matching) != 1:
                        raise serializers.ValidationError(
                            {"questions": f"الإجابة الصحيحة للسؤال رقم {idx + 1} لا تطابق أي خيار."}
                        )
                    canonical_correct = matching[0]
                elif len(explicit_correct) == 1:
                    canonical_correct = explicit_correct[0]
                else:
                    raise serializers.ValidationError(
                        {"questions": f"حدد إجابة صحيحة واحدة فقط للسؤال رقم {idx + 1}."}
                    )

                options = [
                    {
                        "text": opt["text"],
                        "isCorrect": opt["text"].casefold() == canonical_correct.casefold(),
                    }
                    for opt in options
                ]
                correct_answer = {"correct_option": canonical_correct}

            elif q_type == QuestionBankItem.QuestionType.TRUE_FALSE:
                explicit_correct = [opt["text"] for opt in options if opt["isCorrect"]]
                canonical_correct = canonical_true_false(correct_value)
                if not canonical_correct and len(explicit_correct) == 1:
                    canonical_correct = canonical_true_false(explicit_correct[0])
                if not canonical_correct:
                    raise serializers.ValidationError(
                        {"questions": f"حدد صواب أو خطأ كإجابة صحيحة للسؤال رقم {idx + 1}."}
                    )
                options = [
                    {"text": "صواب", "isCorrect": canonical_correct == "صواب"},
                    {"text": "خطأ", "isCorrect": canonical_correct == "خطأ"},
                ]
                correct_answer = {"correct_option": canonical_correct}

            elif q_type == QuestionBankItem.QuestionType.ESSAY:
                options = []
                correct_answer = {}
            elif not isinstance(correct_answer, dict):
                correct_answer = {"correct_option": str(correct_answer)}

            points = Decimal(str(q.get("points", 5)))
            if points <= 0:
                raise serializers.ValidationError({"questions": f"نقاط السؤال رقم {idx + 1} يجب أن تكون أكبر من صفر."})
            total_points += points

            difficulty = str(q.get("difficulty", QuestionBankItem.Difficulty.MEDIUM)).upper()
            if difficulty not in QuestionBankItem.Difficulty.values:
                raise serializers.ValidationError(
                    {"questions": f"مستوى صعوبة السؤال رقم {idx + 1} غير صالح."}
                )

            QuestionBankItem.objects.create(
                exam=exam,
                instructor=request_user,
                question_text=question_text,
                image_url=normalize_question_image_url(q.get("image_url", q.get("imageUrl", ""))),
                question_type=q_type,
                options_json=options,
                correct_answer_json=correct_answer,
                explanation=str(q.get("explanation", "")),
                points=points,
                difficulty=difficulty,
                order=idx + 1,
                educational_stage=getattr(exam, 'educational_stage', ''),
                educational_grade=getattr(exam, 'educational_grade', ''),
                educational_track=getattr(exam, 'educational_track', ''),
                subject=getattr(exam, 'subject', ''),
                subject_branch=getattr(exam, 'subject_branch', ''),
            )

        if total_points > 0 and exam.max_score != int(total_points):
            exam.max_score = int(total_points)
            exam.save(update_fields=["max_score"])

    @staticmethod
    def _lock_target_context(validated_data):
        """
        Acquire curriculum locks before binding an assessment to lesson/unit.

        Deletion paths acquire locks in the same Module -> Lesson order, so an
        assessment cannot be created against curriculum content concurrently
        with a protected deletion.
        """
        from django.core.exceptions import ObjectDoesNotExist

        lesson = validated_data.get("lesson")
        unit = validated_data.get("unit")

        if lesson is not None:
            try:
                module = Module.objects.select_for_update().get(pk=lesson.module_id)
                locked_lesson = Lesson.objects.select_for_update().select_related("module__course").get(pk=lesson.pk)
            except ObjectDoesNotExist as exc:
                raise serializers.ValidationError(
                    {"lesson": "الدرس المحدد غير موجود أو تم حذفه."}
                ) from exc

            if locked_lesson.module_id != module.id:
                raise serializers.ValidationError(
                    {"lesson": "تغير ارتباط الدرس بالوحدة أثناء العملية. أعد المحاولة."}
                )

            validated_data["lesson"] = locked_lesson
            validated_data["unit"] = None
            validated_data["course"] = module.course
            return validated_data

        if unit is not None:
            try:
                locked_unit = Module.objects.select_for_update().select_related("course").get(pk=unit.pk)
            except ObjectDoesNotExist as exc:
                raise serializers.ValidationError(
                    {"unit": "الوحدة المحددة غير موجودة أو تم حذفها."}
                ) from exc

            validated_data["unit"] = locked_unit
            validated_data["lesson"] = None
            validated_data["course"] = locked_unit.course

        return validated_data

    def create(self, validated_data):
        from django.db import transaction

        request = self.context["request"]
        request_data = request.data
        questions_data = request_data.get("questions", [])

        if "durationMinutes" in request_data and "duration_minutes" not in validated_data:
            validated_data["duration_minutes"] = request_data["durationMinutes"]
        if "passThreshold" in request_data and "pass_threshold" not in validated_data:
            validated_data["pass_threshold"] = request_data["passThreshold"]
        if "examType" in request_data and "exam_type" not in validated_data:
            validated_data["exam_type"] = request_data["examType"]
        with transaction.atomic():
            validated_data = self._lock_target_context(validated_data)
            exam = Exam.objects.create(**validated_data)
            self._save_questions(exam, questions_data, request.user)
        return exam

    def update(self, instance, validated_data):
        from django.db import transaction

        request = self.context.get("request")
        request_data = request.data if request else {}
        questions_data = request_data.get("questions")

        if "durationMinutes" in request_data:
            validated_data["duration_minutes"] = request_data["durationMinutes"]
        if "passThreshold" in request_data:
            validated_data["pass_threshold"] = request_data["passThreshold"]
        if "examType" in request_data:
            validated_data["exam_type"] = request_data["examType"]
        with transaction.atomic():
            validated_data = self._lock_target_context(validated_data)
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if questions_data is not None and isinstance(questions_data, list):
                instance.questions.all().delete()
                request_user = (
                    request.user
                    if request and request.user.is_authenticated
                    else getattr(instance.course, "instructor", None)
                )
                self._save_questions(instance, questions_data, request_user)

        return instance


class StudentExamSerializer(serializers.ModelSerializer):
    exam_title = serializers.ReadOnlyField(source="exam.title")
    exam_description = serializers.ReadOnlyField(source="exam.description")
    exam_duration_minutes = serializers.ReadOnlyField(source="exam.duration_minutes")
    pass_threshold = serializers.ReadOnlyField(source="exam.pass_threshold")
    student_name = serializers.ReadOnlyField(source="student.full_name")
    student_email = serializers.ReadOnlyField(source="student.email")

    examTitle = serializers.ReadOnlyField(source="exam.title")
    examDescription = serializers.ReadOnlyField(source="exam.description")
    examDurationMinutes = serializers.ReadOnlyField(source="exam.duration_minutes")
    exam_id = serializers.ReadOnlyField(source="exam.id")
    examId = serializers.ReadOnlyField(source="exam.id")
    attempts_allowed = serializers.ReadOnlyField(source="exam.attempts_allowed")
    attemptsAllowed = serializers.ReadOnlyField(source="exam.attempts_allowed")
    max_score = serializers.SerializerMethodField()
    maxScore = serializers.SerializerMethodField()
    passThreshold = serializers.ReadOnlyField(source="exam.pass_threshold")
    attemptNumber = serializers.ReadOnlyField(source="attempt_number")
    is_passed = serializers.SerializerMethodField()
    isPassed = serializers.SerializerMethodField()
    startedAt = serializers.ReadOnlyField(source="started_at")
    completedAt = serializers.ReadOnlyField(source="completed_at")
    tabSwitchesCount = serializers.ReadOnlyField(source="tab_switches_count")
    instructorFeedback = serializers.ReadOnlyField(source="instructor_feedback")
    locked_until = serializers.ReadOnlyField()
    lockedUntil = serializers.ReadOnlyField(source="locked_until")
    questions_snapshot = serializers.ReadOnlyField(source="questions_snapshot_json")
    questions_snapshot_json = serializers.ReadOnlyField()
    answers = serializers.SerializerMethodField()

    class Meta:
        model = StudentExam
        fields = [
            "id", "student", "student_name", "student_email", "exam", "exam_id", "examId", "exam_title", "exam_description",
            "exam_duration_minutes", "max_score", "pass_threshold", "attempt_number", "attempts_allowed", "attemptsAllowed", "score", "is_passed",
            "status", "started_at", "completed_at", "tab_switches_count", "instructor_feedback", "created_at", "locked_until", "lockedUntil",
            "examTitle", "examDescription", "examDurationMinutes", "maxScore", "passThreshold",
            "attemptNumber", "isPassed", "startedAt", "completedAt", "tabSwitchesCount",
            "instructorFeedback", "answers", "questions_snapshot", "questions_snapshot_json",
        ]
        read_only_fields = [
            "id", "student", "attempt_number", "score", "status", "started_at", "completed_at", "locked_until",
            "created_at", "questions_snapshot", "questions_snapshot_json",
        ]

    def get_max_score(self, obj):
        if obj.exam:
            total_points = sum(q.points for q in obj.exam.questions.all())
            if total_points > 0:
                return float(total_points)
            return float(obj.exam.max_score)
        return 100.0

    def get_maxScore(self, obj):
        return self.get_max_score(obj)

    def get_is_passed(self, obj):
        if obj.status != StudentExamStatus.GRADED:
            return False
        if obj.exam:
            return bool(obj.is_passed)
        return bool(obj.is_passed)

    def get_isPassed(self, obj):
        return self.get_is_passed(obj)

    def get_answers(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        is_student = bool(user and getattr(user, "role", "") == UserRole.STUDENT)
        is_passed = self.get_is_passed(obj)

        # Snapshot-based question lookup if available
        snapshot_questions = {
            q["id"]: q
            for q in (obj.questions_snapshot_json or [])
            if isinstance(q, dict) and "id" in q
        }

        answers_qs = obj.answers.select_related("question").all()
        result = []
        for ans in answers_qs:
            q = ans.question
            snap_q = snapshot_questions.get(q.id) if snapshot_questions else None

            q_text = snap_q["question_text"] if snap_q else q.question_text
            q_image_url = snap_q.get("image_url", "") if snap_q else q.image_url
            q_type = snap_q["question_type"] if snap_q else q.question_type
            q_options = snap_q["options"] if snap_q else (q.options_json or [])
            q_points = float(snap_q["points"]) if snap_q else float(q.points)

            ts_start = snap_q.get("video_timestamp_start") if snap_q else getattr(q, "video_timestamp_start", None)
            ts_end = snap_q.get("video_timestamp_end") if snap_q else getattr(q, "video_timestamp_end", None)

            user_data = ans.answer_json or {}
            student_chosen = user_data.get("answer") if isinstance(user_data, dict) else user_data

            # CRITICAL SECURITY REQUIREMENT: When obj.is_passed is False and user is a student,
            # correct_answer and explanation MUST NOT be returned!
            if is_student and not is_passed:
                correct_val = None
                explanation = ""
            else:
                correct_data = q.correct_answer_json or {}
                correct_val = correct_data.get("correct_option") if isinstance(correct_data, dict) else correct_data
                explanation = q.explanation or ""

            item_data = {
                "id": ans.id,
                "question_id": q.id,
                "questionId": q.id,
                "question_text": q_text,
                "questionText": q_text,
                "image_url": q_image_url,
                "imageUrl": q_image_url,
                "question_type": q_type,
                "questionType": q_type,
                "options": q_options,
                "points_earned": float(ans.points_earned),
                "pointsEarned": float(ans.points_earned),
                "max_points": q_points,
                "maxPoints": q_points,
                "is_correct": bool(ans.points_earned >= q_points and q_points > 0),
                "isCorrect": bool(ans.points_earned >= q_points and q_points > 0),
                "student_answer": student_chosen,
                "studentAnswer": student_chosen,
                "correct_answer": correct_val,
                "correctAnswer": correct_val,
                "explanation": explanation,
            }

            if ts_start is not None:
                item_data["video_review_timestamps"] = {"start": ts_start, "end": ts_end}
                item_data["videoReviewTimestamps"] = {"start": ts_start, "end": ts_end}

            result.append(item_data)
        return result
