from django.contrib import admin

from .models import Assignment, Grade


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "max_score", "due_date")
    list_select_related = ("course",)


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "assignment", "score", "graded_at")
    list_select_related = ("student", "course", "assignment")
    list_filter = ("course",)
