from django.conf import settings
from django.db import models, transaction
from django.utils.text import slugify

from apps.common.models import TimestampedModel


class Category(TimestampedModel):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, db_index=True)
    icon = models.CharField(max_length=64, blank=True, help_text="lucide-react icon name")
    color = models.CharField(max_length=40, blank=True, help_text="Tailwind bg-* class")

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class CourseLevel(models.TextChoices):
    BEGINNER = "beginner", "Beginner"
    INTERMEDIATE = "intermediate", "Intermediate"
    ADVANCED = "advanced", "Advanced"


class CourseEducationalStage(models.TextChoices):
    PRIMARY = "primary", "ابتدائي"
    PREPARATORY = "prep", "إعدادي"
    SECONDARY = "secondary", "ثانوي"
    BACCALAUREATE = "baccalaureate", "البكالوريا المصرية"
    UNIVERSITY = "university", "جامعة"


class CourseEducationalGrade(models.TextChoices):
    PRIMARY_1 = "primary_1", "الصف الأول الابتدائي"
    PRIMARY_2 = "primary_2", "الصف الثاني الابتدائي"
    PRIMARY_3 = "primary_3", "الصف الثالث الابتدائي"
    PRIMARY_4 = "primary_4", "الصف الرابع الابتدائي"
    PRIMARY_5 = "primary_5", "الصف الخامس الابتدائي"
    PRIMARY_6 = "primary_6", "الصف السادس الابتدائي"
    PREP_1 = "prep_1", "الصف الأول الإعدادي"
    PREP_2 = "prep_2", "الصف الثاني الإعدادي"
    PREP_3 = "prep_3", "الصف الثالث الإعدادي"
    SECONDARY_1 = "secondary_1", "الصف الأول الثانوي"
    SECONDARY_2 = "secondary_2", "الصف الثاني الثانوي"
    SECONDARY_3 = "secondary_3", "الصف الثالث الثانوي"
    BACCALAUREATE_1 = "baccalaureate_1", "الصف الأول بكالوريا (تمهيدي)"
    BACCALAUREATE_2 = "baccalaureate_2", "الصف الثاني بكالوريا"
    BACCALAUREATE_3 = "baccalaureate_3", "الصف الثالث بكالوريا"
    UNIVERSITY = "university", "جامعة"


class CourseEducationalTrack(models.TextChoices):
    SCIENTIFIC_SCIENCE = "scientific_science", "علمي علوم"
    SCIENTIFIC_MATH = "scientific_math", "علمي رياضة"
    LITERARY = "literary", "أدبي"
    BAC_MEDICAL = "bac_medical", "مسار الطب"
    BAC_ENGINEERING = "bac_engineering", "مسار الهندسة"
    BAC_BUSINESS = "bac_business", "مسار الأعمال"
    BAC_HUMANITIES = "bac_humanities", "مسار الأدبي"
    GENERAL = "general", "عام"


class CourseSubject(models.TextChoices):
    ARABIC = "arabic", "اللغة العربية"
    ENGLISH = "english", "اللغة الإنجليزية"
    ENGLISH_CONNECT = "english_connect", "اللغة الإنجليزية (Connect)"
    SECOND_FOREIGN_LANG = "second_foreign_lang", "اللغة الأجنبية الثانية"
    FRENCH = "french", "اللغة الفرنسية"
    GERMAN = "german", "اللغة الألمانية"
    ITALIAN = "italian", "اللغة الإيطالية"
    SPANISH = "spanish", "اللغة الإسبانية"
    MATH = "math", "الرياضيات"
    PURE_MATH = "pure_math", "الرياضيات البحتة"
    APPLIED_MATH = "applied_math", "الرياضيات التطبيقية"
    ADVANCED_MATH = "advanced_math", "الرياضيات المتقدمة"
    SCIENCE = "science", "العلوم"
    INTEGRATED_SCIENCES = "integrated_sciences", "العلوم المتكاملة"
    PHYSICS = "physics", "الفيزياء"
    CHEMISTRY = "chemistry", "الكيمياء"
    BIOLOGY = "biology", "الأحياء"
    GEOLOGY = "geology", "الجيولوجيا والعلوم البيئية"
    SOCIAL_STUDIES = "social_studies", "الدراسات الاجتماعية"
    HISTORY = "history", "التاريخ"
    EGYPTIAN_HISTORY = "egyptian_history", "التاريخ المصري"
    GEOGRAPHY = "geography", "الجغرافيا"
    PHILOSOPHY_LOGIC = "philosophy_logic", "الفلسفة والمنطق"
    PSYCHOLOGY_SOCIOLOGY = "psychology_sociology", "علم النفس والاجتماع"
    ECONOMICS = "economics", "الاقتصاد"
    STATISTICS = "statistics", "الإحصاء"
    ICT = "ict", "تكنولوجيا المعلومات والاتصالات (ICT)"
    VOCATIONAL_SKILLS = "vocational_skills", "المهارات المهنية"
    RELIGIOUS_EDUCATION = "religious_education", "التربية الدينية"
    ISLAMIC_RELIGION = "islamic_religion", "التربية الدينية الإسلامية"
    CHRISTIAN_RELIGION = "christian_religion", "التربية الدينية المسيحية"
    COMPUTER = "computer", "الحاسب الآلي"
    OTHER = "other", "أخرى"


class CourseSubjectBranch(models.TextChoices):
    ALGEBRA_STATS = "algebra_stats", "جبر وإحصاء"
    GEOMETRY = "geometry", "هندسة"
    ALGEBRA_TRIG = "algebra_trig", "جبر وحساب مثلثات"
    ANALYTIC_GEOM = "analytic_geom", "هندسة تحليلية"
    HISTORY = "history", "تاريخ"
    GEOGRAPHY = "geography", "جغرافيا"
    ELECTIVE_MATH = "elective_math", "مادة اختيارية: رياضيات"
    ELECTIVE_PHYSICS = "elective_physics", "مادة اختيارية: فيزياء"
    GENERAL = "general", "عام"


class CourseStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class Course(TimestampedModel):
    title = models.CharField(max_length=200)
    short_description = models.CharField(max_length=280, blank=True)
    description = models.TextField(blank=True)
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="taught_courses",
        limit_choices_to={"role": "instructor"},
    )
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="courses")
    image = models.ImageField(upload_to="courses/", null=True, blank=True)
    image_url = models.URLField(blank=True, help_text="External image if no upload")

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

    duration = models.CharField(max_length=40, blank=True, help_text='e.g. "32 hours"')
    level = models.CharField(max_length=20, choices=CourseLevel.choices, default=CourseLevel.BEGINNER, db_index=True)
    language = models.CharField(max_length=20, default="ar")

    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_free = models.BooleanField(default=False, db_index=True)

    status = models.CharField(max_length=20, choices=CourseStatus.choices, default=CourseStatus.DRAFT, db_index=True)

    # Optional client-supplied key used only to make course creation retry-safe.
    # NULL means the request did not opt into idempotent creation.
    creation_idempotency_key = models.CharField(
        max_length=128,
        blank=True,
        default="",
        editable=False,
        db_index=True,
    )
    creation_request_hash = models.CharField(
        max_length=64,
        blank=True,
        default="",
        editable=False,
    )

    requirements = models.JSONField(default=list, blank=True)
    objectives = models.JSONField(default=list, blank=True)
    enforce_quiz_gate = models.BooleanField(default=False, help_text="Require passing quizzes and unit exams to unlock next lessons")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["instructor", "creation_idempotency_key"],
                condition=~models.Q(creation_idempotency_key=""),
                name="courses_course_instructor_creation_idempotency_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["category", "status"]),
            models.Index(fields=["educational_stage", "educational_grade", "educational_track", "subject", "status"]),
            models.Index(fields=["educational_stage", "educational_grade", "subject", "status"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def lesson_count(self):
        return Lesson.objects.filter(module__course=self).count()

    @property
    def student_count(self):
        return self.enrollments.count()

    @property
    def rating(self):
        agg = self.reviews.aggregate(avg=models.Avg("rating"))
        return round(float(agg["avg"] or 0), 2)

    @property
    def review_count(self):
        return self.reviews.count()


class VideoStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class Video(TimestampedModel):
    title = models.CharField(max_length=255)
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_videos",
    )
    status = models.CharField(
        max_length=20,
        choices=VideoStatus.choices,
        default=VideoStatus.PENDING,
        db_index=True,
    )
    duration_seconds = models.PositiveIntegerField(default=0)
    file_size_bytes = models.BigIntegerField(default=0)
    resolutions = models.JSONField(default=list, blank=True)
    hls_master_playlist = models.CharField(max_length=500, blank=True)
    raw_file_path = models.CharField(max_length=500, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["uploader", "status"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"


class Module(TimestampedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    # Drip Content & Visibility
    is_published = models.BooleanField(default=True, db_index=True)
    available_from = models.DateTimeField(null=True, blank=True, db_index=True, help_text="For scheduled content drops")

    class Meta:
        ordering = ["order", "id"]
        unique_together = [("course", "order")]

    def save(self, *args, **kwargs):
        if not self.pk:
            return super().save(*args, **kwargs)

        with transaction.atomic():
            # All module order mutations use Course -> Module locking so module
            # create, update/reorder, and curriculum synchronization serialize
            # against the same parent lock. Read current state only after the
            # lock is held; otherwise concurrent updates could act on stale order.
            Course.objects.select_for_update(of=("self",)).get(pk=self.course_id)
            current = type(self).objects.filter(pk=self.pk).values("course_id", "order").first()
            if not current or current["course_id"] != self.course_id or current["order"] == self.order:
                return super().save(*args, **kwargs)

            siblings = type(self).objects.select_for_update().filter(course_id=self.course_id)
            target = siblings.exclude(pk=self.pk).filter(order=self.order).first()
            if target is None:
                return super().save(*args, **kwargs)

            transient_order = (siblings.aggregate(max_order=models.Max("order"))["max_order"] or 0) + 1
            siblings.filter(pk=target.pk).update(order=transient_order)
            super().save(*args, **kwargs)
            siblings.filter(pk=target.pk).update(order=current["order"])

    def __str__(self):
        return f"{self.course.title} / {self.title}"


class LessonType(models.TextChoices):
    VIDEO = "video", "Video"
    ARTICLE = "article", "Article"
    QUIZ = "quiz", "Quiz"
    ASSIGNMENT = "assignment", "Assignment"


class Lesson(TimestampedModel):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=LessonType.choices, default=LessonType.VIDEO)
    duration = models.CharField(max_length=20, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_free = models.BooleanField(default=False)
    video = models.ForeignKey(Video, on_delete=models.SET_NULL, null=True, blank=True, related_name="lessons")
    video_url = models.URLField(blank=True)
    content = models.TextField(blank=True)

    # Drip Content & Visibility
    is_published = models.BooleanField(default=True, db_index=True)
    available_from = models.DateTimeField(null=True, blank=True, db_index=True, help_text="For scheduled content drops")

    class Meta:
        ordering = ["order", "id"]
        unique_together = [("module", "order")]

    def save(self, *args, **kwargs):
        if not self.pk:
            return super().save(*args, **kwargs)

        with transaction.atomic():
            # All lesson order mutations use Module -> Lesson locking so lesson
            # create, update/reorder, deletion, and assessment binding share one
            # deterministic lock hierarchy. Read current state only after the
            # lock is held so concurrent updates cannot act on stale order.
            Module.objects.select_for_update(of=("self",)).get(pk=self.module_id)
            current = type(self).objects.filter(pk=self.pk).values("module_id", "order").first()
            if not current or current["module_id"] != self.module_id or current["order"] == self.order:
                return super().save(*args, **kwargs)

            siblings = type(self).objects.select_for_update().filter(module_id=self.module_id)
            target = siblings.exclude(pk=self.pk).filter(order=self.order).first()
            if target is None:
                return super().save(*args, **kwargs)

            transient_order = (siblings.aggregate(max_order=models.Max("order"))["max_order"] or 0) + 1
            siblings.filter(pk=target.pk).update(order=transient_order)
            super().save(*args, **kwargs)
            siblings.filter(pk=target.pk).update(order=current["order"])

    def __str__(self):
        return self.title


class LessonSummary(TimestampedModel):
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name="summary")
    content = models.TextField(blank=True, help_text="Sanitized rich text content")
    attachment = models.FileField(upload_to="lesson_summaries/", null=True, blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Summary for {self.lesson.title}"


class Review(TimestampedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="reviews")
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)

    class Meta:
        unique_together = [("course", "student")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Review<{self.course_id}, {self.student_id}, {self.rating}>"
