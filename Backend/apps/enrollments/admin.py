from django.contrib import admin

from .models import Enrollment, LessonCompletion


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "enrolled_at", "completed_at")
    list_filter = ("course",)
    search_fields = ("student__email", "course__title")
    list_select_related = ("student", "course")


@admin.register(LessonCompletion)
class LessonCompletionAdmin(admin.ModelAdmin):
    list_display = ("enrollment", "lesson", "created_at")
    list_select_related = ("enrollment", "enrollment__student", "enrollment__course", "lesson")
