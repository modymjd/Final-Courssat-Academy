from django.core.exceptions import ValidationError
from django.db import models


def validate_image_file(file_obj):
    """
    Validate uploaded image files to ensure max size 5MB and allowed formats.
    """
    if not file_obj:
        return

    max_size = 5 * 1024 * 1024  # 5MB
    if file_obj.size > max_size:
        raise ValidationError("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.")

    ext = file_obj.name.split(".")[-1].lower() if "." in file_obj.name else ""
    valid_extensions = ["jpg", "jpeg", "png", "webp"]
    if ext not in valid_extensions:
        raise ValidationError("صيغة الصورة غير مدعومة. الصيغ المسموحة: JPG, JPEG, PNG, WEBP.")


class AboutPageContent(models.Model):
    """Singleton model managing content for the About Us page."""

    # Founder Section
    founder_name = models.CharField(max_length=150, blank=True, default="")
    founder_title = models.CharField(max_length=200, blank=True, default="")
    founder_photo = models.ImageField(
        upload_to="about/founder/",
        blank=True,
        null=True,
        validators=[validate_image_file],
    )
    founder_quote = models.TextField(blank=True, default="")

    # Company Section
    company_name = models.CharField(max_length=150, blank=True, default="")
    company_tagline = models.CharField(max_length=250, blank=True, default="")
    company_description = models.TextField(blank=True, default="")
    company_logo = models.ImageField(
        upload_to="about/company/",
        blank=True,
        null=True,
        validators=[validate_image_file],
    )

    # Platform Section
    platform_name = models.CharField(max_length=150, blank=True, default="")
    platform_tagline = models.CharField(max_length=250, blank=True, default="")
    platform_description = models.TextField(blank=True, default="")

    # Contact & Social Links
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=30, blank=True, default="")
    facebook_url = models.URLField(blank=True, default="")
    instagram_url = models.URLField(blank=True, default="")
    linkedin_url = models.URLField(blank=True, default="")
    youtube_url = models.URLField(blank=True, default="")
    twitter_url = models.URLField(blank=True, default="")

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "About Page Content"
        verbose_name_plural = "About Page Content"

    def __str__(self) -> str:
        return f"{self.platform_name} - About Page Content"

    def save(self, *args, **kwargs):
        self.pk = 1  # Force Singleton Pattern
        super().save(*args, **kwargs)

    @classmethod
    def get_content(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class TeamMember(models.Model):
    """Team member entries for the About page."""

    about_page = models.ForeignKey(
        AboutPageContent,
        related_name="team_members",
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=150)
    quote = models.CharField(max_length=300, blank=True, default="")
    photo = models.ImageField(
        upload_to="about/team/",
        blank=True,
        null=True,
        validators=[validate_image_file],
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Team Member"
        verbose_name_plural = "Team Members"

    def __str__(self):
        return f"{self.name} - {self.role}"


class Partnership(models.Model):
    """Partnership timeline entries for the About page."""

    about_page = models.ForeignKey(
        AboutPageContent,
        related_name="partnerships",
        on_delete=models.CASCADE,
    )
    partner_name = models.CharField(max_length=150)
    date = models.DateField()
    description = models.TextField()
    photo = models.ImageField(
        upload_to="about/partners/",
        blank=True,
        null=True,
        validators=[validate_image_file],
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Partnership"
        verbose_name_plural = "Partnerships"

    def __str__(self):
        return f"{self.partner_name} ({self.date})"
