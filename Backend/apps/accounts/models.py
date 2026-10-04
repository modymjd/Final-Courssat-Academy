from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from apps.common.models import TimestampedModel


class UserRole(models.TextChoices):
    STUDENT = "student", "Student"
    INSTRUCTOR = "instructor", "Instructor"
    CENTER = "center", "Center"
    GUARDIAN = "guardian", "Guardian"
    ADMIN = "admin", "Admin"
    SUPER_ADMIN = "super_admin", "Super Admin"


class AuthProvider(models.TextChoices):
    EMAIL = "email", "Email"
    GOOGLE = "google", "Google"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.STUDENT)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimestampedModel):
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.STUDENT, db_index=True)
    auth_provider = models.CharField(
        max_length=20, choices=AuthProvider.choices, default=AuthProvider.EMAIL, db_index=True
    )
    profile_completed = models.BooleanField(default=True, db_index=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    phone = models.CharField(max_length=32, unique=True, null=True, blank=True, db_index=True)
    national_id = models.CharField(max_length=14, unique=True, null=True, blank=True, db_index=True)
    national_id_encrypted = models.CharField(max_length=255, blank=True, default="")
    national_id_hash = models.CharField(max_length=64, blank=True, null=True, unique=True, db_index=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=[("male", "ذكر"), ("female", "أنثى")], blank=True)
    governorate = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    bio = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    subscription_plan = models.CharField(max_length=50, default="FREE", db_index=True)
    organization = models.CharField(max_length=120, blank=True, default="", db_index=True)
    active_device_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    totp_secret = models.CharField(max_length=64, blank=True, default="")
    must_change_password = models.BooleanField(default=False, db_index=True)
    is_first_login = models.BooleanField(default=True, db_index=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    tutorial_completed_at = models.DateTimeField(null=True, blank=True)
    tutorial_version = models.IntegerField(default=0)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class StudentProfile(TimestampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    student_code = models.CharField(max_length=20, blank=True, null=True, unique=True, db_index=True)
    education_level = models.CharField(
        max_length=30,
        choices=[
            ("primary", "ابتدائي"),
            ("prep", "إعدادي"),
            ("secondary", "ثانوي"),
            ("baccalaureate", "بكالوريا مصرية"),
            ("university", "جامعي"),
        ],
        blank=True,
        default="",
        db_index=True,
    )
    school_name = models.CharField(max_length=150, blank=True)
    grade_level = models.CharField(max_length=80, blank=True, default="", db_index=True)
    educational_track = models.CharField(max_length=40, blank=True, default="", db_index=True)
    second_language = models.CharField(
        max_length=20,
        choices=[("french", "فرنسي"), ("german", "ألماني"), ("italian", "إيطالي"), ("spanish", "إسباني")],
        blank=True,
        default="",
    )
    religion = models.CharField(
        max_length=20,
        choices=[("islamic", "إسلامي"), ("christian", "مسيحي")],
        blank=True,
        default="",
    )
    university_name = models.CharField(max_length=150, blank=True)
    faculty_name = models.CharField(max_length=150, blank=True)
    study_streak = models.PositiveIntegerField(default=0)
    last_streak_date = models.DateField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.student_code:
            import secrets
            for _ in range(10):
                candidate = f"STU-{secrets.token_hex(3).upper()[:5]}"
                if not StudentProfile.objects.filter(student_code=candidate).exists():
                    self.student_code = candidate
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"StudentProfile<{self.user.email}>"


class GuardianProfile(TimestampedModel):
    guardian_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="linked_student_guardians"
    )
    student_profile = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name="guardians")
    full_name = models.CharField(max_length=150)
    relationship = models.CharField(
        max_length=30,
        choices=[("father", "أب"), ("mother", "أم"), ("guardian", "وصي")],
    )
    phone = models.CharField(max_length=20)
    national_id = models.CharField(max_length=14, blank=True, default="")

    def __str__(self):
        return f"Guardian<{self.full_name} for {self.student_profile.user.email}>"


class InstructorProfile(TimestampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="instructor_profile")
    teacher_uid = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    title = models.CharField(max_length=120, blank=True)
    specialization = models.CharField(max_length=120, blank=True)
    teaching_subject = models.CharField(max_length=50, blank=True)
    teaching_stages = models.JSONField(default=list, blank=True)
    teaching_grades = models.JSONField(default=list, blank=True)
    years_of_experience = models.PositiveIntegerField(default=0)
    qualification = models.CharField(max_length=150, blank=True)
    is_verified = models.BooleanField(default=False, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    _verification_changed: bool = False

    # Deprecated legacy fields (Superseded by live ORM subquery annotations in InstructorPublicViewSet)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    review_count = models.PositiveIntegerField(default=0)
    total_students = models.PositiveIntegerField(default=0)
    revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        if not self.teacher_uid:
            import secrets

            for _ in range(10):
                candidate = f"TCH-{secrets.token_hex(3).upper()[:5]}"
                if not InstructorProfile.objects.filter(teacher_uid=candidate).exists():
                    self.teacher_uid = candidate
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"InstructorProfile<{self.user.email} - {self.teacher_uid}>"


class CenterProfile(TimestampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="center_profile")
    institution_name = models.CharField(max_length=200)
    institution_type = models.CharField(
        max_length=30,
        choices=[
            ("center", "سنتر تعليمي"),
            ("college", "كلية"),
            ("university", "جامعة"),
            ("institute", "معهد"),
            ("academy", "أكاديمية"),
        ],
    )
    address = models.TextField(blank=True)
    logo = models.ImageField(upload_to="centers/logos/", null=True, blank=True)
    license_number = models.CharField(max_length=50, blank=True)
    website = models.URLField(blank=True)
    is_verified = models.BooleanField(default=False, db_index=True)

    instructors = models.ManyToManyField(
        User,
        blank=True,
        related_name="affiliated_centers",
        through="CenterInstructor",
        limit_choices_to={"role": "instructor"},
    )

    def __str__(self):
        return f"CenterProfile<{self.institution_name}>"


class CenterInstructor(TimestampedModel):
    center = models.ForeignKey(CenterProfile, on_delete=models.CASCADE, related_name="instructor_memberships")
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "instructor"})
    student_quota = models.PositiveIntegerField(default=0, help_text="0 means unconstrained or shared center quota")
    subject = models.CharField(max_length=150, blank=True)
    is_approved = models.BooleanField(default=True)
    joined_via_code = models.ForeignKey(
        "activation_codes.ActivationCode", null=True, blank=True, on_delete=models.SET_NULL
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("center", "instructor")


class CenterStudent(TimestampedModel):
    center = models.ForeignKey(CenterProfile, on_delete=models.CASCADE, related_name="student_memberships")
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "student"})
    joined_via_code = models.ForeignKey(
        "activation_codes.ActivationCode", null=True, blank=True, on_delete=models.SET_NULL
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("center", "student")


class InstructorStudent(TimestampedModel):
    instructor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="instructor_student_memberships",
        limit_choices_to={"role": "instructor"},
    )
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "student"})
    joined_via_code = models.ForeignKey(
        "activation_codes.ActivationCode", null=True, blank=True, on_delete=models.SET_NULL
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("instructor", "student")


class AdminProfile(TimestampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="admin_profile")
    permissions_list = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"AdminProfile<{self.user.email}>"


# ============================================================================
# Centralized Feature Permission & Entitlement Architecture Models
# ============================================================================


class FeatureCategory(TimestampedModel):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, db_index=True)

    class Meta:
        verbose_name_plural = "Feature Categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Feature(TimestampedModel):
    slug = models.SlugField(max_length=100, primary_key=True)
    display_name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        FeatureCategory, on_delete=models.CASCADE, related_name="features", null=True, blank=True
    )
    dependencies = models.JSONField(default=list, blank=True)
    is_enabled_by_default = models.BooleanField(default=True)
    quota_limit_key = models.CharField(max_length=80, blank=True)

    class Meta:
        ordering = ["slug"]

    def __str__(self):
        return f"{self.display_name} ({self.slug})"


class RoleFeaturePermission(TimestampedModel):
    role = models.CharField(max_length=50, choices=UserRole.choices, db_index=True)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="role_permissions")
    is_enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = ("role", "feature")

    def __str__(self):
        return f"RolePerm<{self.role}:{self.feature_id}={self.is_enabled}>"


class PlanFeaturePermission(TimestampedModel):
    plan_name = models.CharField(max_length=50, db_index=True)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="plan_permissions")
    is_enabled = models.BooleanField(default=True)
    quota_limits = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("plan_name", "feature")

    def __str__(self):
        return f"PlanPerm<{self.plan_name}:{self.feature_id}={self.is_enabled}>"


class OrganizationFeatureOverride(TimestampedModel):
    organization_name = models.CharField(max_length=120, db_index=True)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="org_overrides")
    is_enabled = models.BooleanField(default=True)
    custom_limits = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("organization_name", "feature")

    def __str__(self):
        return f"OrgOverride<{self.organization_name}:{self.feature_id}={self.is_enabled}>"


class UserFeatureOverride(TimestampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="feature_overrides")
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="user_overrides")
    is_enabled = models.BooleanField()
    custom_limits = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True)

    class Meta:
        unique_together = ("user", "feature")

    def __str__(self):
        return f"UserOverride<{self.user.email}:{self.feature_id}={self.is_enabled}>"


class PermissionAuditHistory(TimestampedModel):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_granted")
    target_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_received"
    )
    feature_slug = models.CharField(max_length=100, db_index=True)
    action = models.CharField(max_length=60, db_index=True)
    details_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PermAudit<{self.action}:{self.feature_slug} at {self.created_at}>"
