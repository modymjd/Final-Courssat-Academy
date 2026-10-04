from django.contrib import admin

from .models import LiveSession


@admin.register(LiveSession)
class LiveSessionAdmin(admin.ModelAdmin):
    list_display = ("title", "instructor", "course", "scheduled_at", "status")
    list_filter = ("status",)
