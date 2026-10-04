from django.contrib import admin

from .models import ActivationCode, ActivationCodeBatch


class ActivationCodeInline(admin.TabularInline):
    model = ActivationCode
    extra = 0
    readonly_fields = ("code", "password", "status", "redeemed_by", "redeemed_at")
    can_delete = False


@admin.register(ActivationCodeBatch)
class ActivationCodeBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "batch_type", "created_by", "quantity", "price_per_code", "expires_at", "created_at")
    list_filter = ("batch_type", "created_at")
    search_fields = ("created_by__email", "created_by__first_name", "created_by__last_name")
    inlines = [ActivationCodeInline]


@admin.register(ActivationCode)
class ActivationCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "status", "batch_id", "redeemed_by", "redeemed_at", "is_expired")
    list_filter = ("status", "created_at")
    search_fields = ("code", "redeemed_by__email")
    readonly_fields = ("code", "password", "batch", "redeemed_by", "redeemed_at")
