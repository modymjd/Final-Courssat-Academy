from django.contrib import admin

from apps.academic_tools.models import AcademicTask


@admin.register(AcademicTask)
class AcademicTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "priority", "status", "task_type", "due_date", "created_at")
    list_filter = ("priority", "status", "task_type", "created_at")
    search_fields = ("title", "description", "user__email", "user__first_name")
