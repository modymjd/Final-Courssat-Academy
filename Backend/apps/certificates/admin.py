from django.contrib import admin

from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("student", "course", "grade", "serial", "issued_at")
    list_select_related = ("student", "course")
    search_fields = ("student__email", "course__title", "serial")
    list_filter = ("course",)
