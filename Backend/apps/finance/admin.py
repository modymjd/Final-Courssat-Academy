from django.contrib import admin

from .models import (
    EscrowHolding,
    InstructorContract,
    Ledger,
    LedgerEntry,
    Order,
    OrderItem,
    Transaction,
    Wallet,
)


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "wallet_type",
        "available_balance",
        "pending_balance",
        "current_balance",
        "withdrawn_balance",
        "currency",
    ]
    list_filter = ["wallet_type", "currency"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(EscrowHolding)
class EscrowHoldingAdmin(admin.ModelAdmin):
    list_display = ["id", "wallet", "amount", "status", "mature_at", "settled_at", "created_at"]
    list_filter = ["status", "mature_at"]
    search_fields = ["wallet__user__email", "order__id"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Ledger)
class LedgerAdmin(admin.ModelAdmin):
    list_display = ["id", "reference_id", "description", "created_at"]
    search_fields = ["reference_id", "description"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ["id", "ledger", "wallet", "entry_type", "amount", "created_at"]
    list_filter = ["entry_type", "created_at"]
    search_fields = ["ledger__reference_id", "wallet__user__email"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(InstructorContract)
class InstructorContractAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "instructor",
        "revenue_model",
        "revenue_percentage",
        "minimum_guarantee",
        "is_active",
        "valid_from",
        "valid_to",
    ]
    list_filter = ["revenue_model", "is_active"]
    search_fields = ["instructor__email"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "student", "status", "total", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["student__email"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ["id", "order", "course", "price_at_purchase"]
    search_fields = ["order__id", "course__title"]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["id", "order", "gateway", "amount", "status", "gateway_reference", "idempotency_key", "created_at"]
    list_filter = ["status", "gateway", "created_at"]
    search_fields = ["order__id", "gateway_reference", "idempotency_key"]
    readonly_fields = ["created_at", "updated_at"]
