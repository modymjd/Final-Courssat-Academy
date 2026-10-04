import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel
from apps.courses.models import (
    Category,
    Course,
    CourseEducationalGrade,
    CourseEducationalStage,
    CourseEducationalTrack,
    CourseSubject,
    CourseSubjectBranch,
)


class ExamKind(models.TextChoices):
    LESSON_QUIZ = "LESSON_QUIZ", "كويز درس"
    UNIT_EXAM = "UNIT_EXAM", "امتحان نهاية وحدة"
    IN_VIDEO_QUIZ = "IN_VIDEO_QUIZ", "كويز تفاعلي داخل الفيديو"
    GENERAL_EXAM = "GENERAL_EXAM", "امتحان عام"


class Assignment(TimestampedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="assignments")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    max_score = models.PositiveIntegerField(default=100)
    due_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Grade(TimestampedModel):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="grades",
        limit_choices_to={"role": "student"},
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="grades")
    assignment = models.ForeignKey(Assignment, on_delete=models.SET_NULL, null=True, blank=True, related_name="grades")
    score = models.DecimalField(max_digits=6, decimal_places=2)
    max_score = models.PositiveIntegerField(default=100)
    feedback = models.TextField(blank=True)
    graded_at = models.DateTimeField(auto_now_add=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="grades_given",
    )

    class Meta:
        ordering = ["-graded_at"]

    @property
    def percentage(self):
        return round(float(self.score) / max(self.max_score, 1) * 100, 2)


class ExamType(models.TextChoices):
    EXAM = "EXAM", "امتحان تقييمي رسمي"
    PRACTICE = "PRACTICE", "مراجعة وتدريب تفاعلي (مع إظهار الشرح والبرهان)"
    ASSIGNMENT = "ASSIGNMENT", "واجب بنظام الأسئلة"


class Exam(TimestampedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name="exams")
    lesson = models.ForeignKey("courses.Lesson", on_delete=models.SET_NULL, null=True, blank=True, related_name="exams")

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    exam_type = models.CharField(max_length=20, choices=ExamType.choices, default=ExamType.EXAM)
    kind = models.CharField(max_length=30, choices=ExamKind.choices, default=ExamKind.GENERAL_EXAM, db_index=True)
    unit = models.ForeignKey("courses.Module", on_delete=models.SET_NULL, null=True, blank=True, related_name="unit_exams")
    video_checkpoint_seconds = models.PositiveIntegerField(null=True, blank=True)
    is_checkpoint_mandatory = models.BooleanField(default=False)
    quiz_question_count = models.PositiveIntegerField(default=5)
    cooldown_seconds = models.PositiveIntegerField(default=30)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    max_score = models.PositiveIntegerField(default=100)
    pass_threshold = models.PositiveIntegerField(default=70)
    attempts_allowed = models.PositiveIntegerField(default=1)
    shuffle_questions = models.BooleanField(default=True)
    tab_switch_limit = models.PositiveIntegerField(default=3)
    require_camera = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)

    educational_stage = models.CharField(
        max_length=20,
        choices=CourseEducationalStage.choices,
        blank=True,
        default="",
        db_index=True,
    )
    educational_grade = models.CharField(
        max_length=20,
        choices=CourseEducationalGrade.choices,
        blank=True,
        default="",
        db_index=True,
    )
    educational_track = models.CharField(
        max_length=30,
        choices=CourseEducationalTrack.choices,
        blank=True,
        default="",
        db_index=True,
    )
    subject = models.CharField(
        max_length=30,
        choices=CourseSubject.choices,
        blank=True,
        default="",
        db_index=True,
    )
    subject_branch = models.CharField(
        max_length=30,
        choices=CourseSubjectBranch.choices,
        blank=True,
        default="",
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["educational_stage", "educational_grade", "educational_track", "subject"]),
        ]

    def __str__(self):
        return self.title


class StudentExamStatus(models.TextChoices):
    IN_PROGRESS = "IN_PROGRESS", "قيد الحل"
    SUBMITTED = "SUBMITTED", "تم التسليم"
    GRADED = "GRADED", "تم التصحيح"


class StudentExam(TimestampedModel):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_exams",
        limit_choices_to={"role": "student"},
    )
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="attempts")
    attempt_number = models.PositiveIntegerField(default=1)
    score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_passed = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=StudentExamStatus.choices, default=StudentExamStatus.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True, null=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    tab_switches_count = models.PositiveIntegerField(default=0)
    integrity_log_json = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=128, blank=True, default="", db_index=True)
    questions_snapshot_json = models.JSONField(default=list, blank=True)
    correct_answers_snapshot_json = models.JSONField(default=dict, blank=True)
    attempt_window_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    locked_until = models.DateTimeField(null=True, blank=True)
    instructor_feedback = models.TextField(blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="graded_exams",
    )

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("student", "exam", "attempt_number")]

    def __str__(self):
        return f"{self.student} - {self.exam} ({self.status})"



class QuestionBankItem(TimestampedModel):
    class Difficulty(models.TextChoices):
        EASY = "EASY", "سهل"
        MEDIUM = "MEDIUM", "متوسط"
        HARD = "HARD", "صعب"

    class QuestionType(models.TextChoices):
        MULTIPLE_CHOICE = "MULTIPLE_CHOICE", "اختيار من متعدد"
        TRUE_FALSE = "TRUE_FALSE", "صواب أو خطأ"
        ESSAY = "ESSAY", "سؤال مقالي"
        MATCHING = "MATCHING", "توصيل"
        FILL_BLANK = "FILL_BLANK", "إكمال الفراغ"

    instructor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="question_bank")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="questions")
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, null=True, blank=True, related_name="questions")
    question_text = models.TextField()
    image_url = models.CharField(max_length=500, blank=True, default="")
    question_type = models.CharField(max_length=30, choices=QuestionType.choices, default=QuestionType.MULTIPLE_CHOICE)
    options_json = models.JSONField(default=list, blank=True)
    correct_answer_json = models.JSONField(default=dict, blank=True)
    points = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)
    order = models.PositiveIntegerField(default=0)
    difficulty = models.CharField(max_length=15, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    explanation = models.TextField(blank=True)
    video_timestamp_start = models.PositiveIntegerField(null=True, blank=True)
    video_timestamp_end = models.PositiveIntegerField(null=True, blank=True)

    educational_stage = models.CharField(
        max_length=20,
        choices=CourseEducationalStage.choices,
        blank=True,
        default="",
        db_index=True,
    )
    educational_grade = models.CharField(
        max_length=20,
        choices=CourseEducationalGrade.choices,
        blank=True,
        default="",
        db_index=True,
    )
    educational_track = models.CharField(
        max_length=30,
        choices=CourseEducationalTrack.choices,
        blank=True,
        default="",
        db_index=True,
    )
    subject = models.CharField(
        max_length=30,
        choices=CourseSubject.choices,
        blank=True,
        default="",
        db_index=True,
    )
    subject_branch = models.CharField(
        max_length=30,
        choices=CourseSubjectBranch.choices,
        blank=True,
        default="",
        db_index=True,
    )

    class Meta:
        ordering = ["order", "-created_at"]
        indexes = [
            models.Index(fields=["educational_stage", "educational_grade", "educational_track", "subject"]),
        ]

    def __str__(self):
        return f"Question<{self.id}: {self.question_text[:30]}>"


class StudentAnswer(TimestampedModel):
    student_exam = models.ForeignKey(StudentExam, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(QuestionBankItem, on_delete=models.CASCADE)
    answer_json = models.JSONField(default=dict)
    points_earned = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    is_graded = models.BooleanField(default=False)
    grader_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["id"]
        unique_together = [("student_exam", "question")]

    def __str__(self):
        return f"Answer for Question #{self.question_id} - Points: {self.points_earned}"


class ExamOverrideLog(TimestampedModel):
    instructor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="exam_overrides_granted")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exam_overrides_received")
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="overrides")
    reason = models.TextField()
    attempts_granted = models.PositiveIntegerField(default=3)

class AdminDisputeAuditLog(TimestampedModel):
    admin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="dispute_audits")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="disputes")
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="disputes")
    dispute_reason = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

class FileDownloadAuditLog(TimestampedModel):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="file_downloads")
    lesson_summary = models.ForeignKey("courses.LessonSummary", on_delete=models.CASCADE, related_name="downloads")
    trace_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

class StudentFileConsent(TimestampedModel):
    student = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="file_consent")
    agreed_at = models.DateTimeField(auto_now_add=True)
    terms_version = models.CharField(max_length=20, default="1.0")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
