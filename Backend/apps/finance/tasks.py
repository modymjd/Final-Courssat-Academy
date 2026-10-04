import logging
from datetime import timedelta
from decimal import Decimal

try:
    from celery import shared_task
except ImportError:
    # Fallback decorator if Celery is not installed in local environment
    def shared_task(*args, **kwargs):
        def decorator(func):
            def delay(*fargs, **fkwargs):
                return func(*fargs, **fkwargs)

            func.delay = delay
            return func

        if len(args) == 1 and callable(args[0]):
            return decorator(args[0])
        return decorator


from django.db import transaction
from django.utils import timezone

from apps.notifications.models import Notification, NotificationType

from .models import (
    BillingCycleChoices,
    EscrowHolding,
    EscrowStatusChoices,
    Ledger,
    LedgerEntry,
    LedgerEntryType,
    OrderStatusChoices,
    PaymentMethod,
    PaymentTransaction,
    Subscription,
    SubscriptionStatusChoices,
    TransactionStatus,
    Wallet,
)
from .services import InvoiceGeneratorService

logger = logging.getLogger(__name__)


# ============================================================================
# KASHIER WEBHOOK CELERY TASK
# ============================================================================


@shared_task(bind=True, max_retries=5, default_retry_delay=10, autoretry_for=(Exception,), retry_backoff=True)
def process_kashier_webhook_task(self, payload: dict):
    """
    Celery background worker task for processing asynchronous Kashier webhooks.
    """
    from .services.kashier import KashierReconciliationService

    return KashierReconciliationService.reconcile_payment(payload)


# ============================================================================
# FAWRY WEBHOOK CELERY TASKS
# ============================================================================


@shared_task(bind=True, max_retries=5, default_retry_delay=10, autoretry_for=(Exception,), retry_backoff=True)
def process_fawry_webhook_task(self, payload: dict):
    """
    Celery task handling Fawry webhook execution with exponential backoff retries.
    """
    fawry_ref_num = str(payload.get("fawryRefNumber", ""))
    merchant_ref_num = str(payload.get("merchantRefNum", ""))
    order_status = str(payload.get("orderStatus", "")).upper()
    payment_amount = Decimal(str(payload.get("paymentAmount", "0.00")))

    sub_id = None
    if merchant_ref_num.startswith("FAW_SUB_"):
        parts = merchant_ref_num.split("_")
        if len(parts) >= 3 and parts[2].isdigit():
            sub_id = int(parts[2])

    if not sub_id:
        return {"status": "ignored", "reason": "invalid_merchant_ref"}

    with transaction.atomic():
        try:
            sub = Subscription.objects.select_for_update().get(pk=sub_id)
        except Subscription.DoesNotExist:
            return {"status": "error", "reason": "subscription_not_found"}

        txn, created = PaymentTransaction.objects.select_for_update().get_or_create(
            gateway_transaction_id=fawry_ref_num,
            defaults={
                "subscription": sub,
                "gateway": "fawry",
                "amount": payment_amount,
                "status": TransactionStatus.PAID if order_status in ("PAID", "SUCCESS") else TransactionStatus.PENDING,
                "raw_webhook_payload": payload,
            },
        )

        if not created and txn.status == TransactionStatus.PAID:
            return {"status": "already_processed"}

        if order_status in ("PAID", "SUCCESS"):
            txn.status = TransactionStatus.PAID
            txn.save(update_fields=["status", "updated_at"])

            sub.status = SubscriptionStatusChoices.ACTIVE
            duration_days = 365 if sub.billing_cycle == "yearly" else 30
            sub.current_period_end = timezone.now() + timedelta(days=duration_days)
            sub.grace_period_ends_at = None
            sub.dunning_attempt_count = 0
            sub.pre_due_notified = False
            sub.save(
                update_fields=[
                    "status",
                    "current_period_end",
                    "grace_period_ends_at",
                    "dunning_attempt_count",
                    "pre_due_notified",
                    "updated_at",
                ]
            )

            PaymentMethod.objects.filter(subscription=sub, is_active=True).update(is_active=False)
            PaymentMethod.objects.create(
                subscription=sub,
                gateway=PaymentMethod.GatewayChoices.FAWRY,
                gateway_ref=fawry_ref_num,
                payment_channel=PaymentMethod.ChannelChoices.CARD,
                is_active=True,
            )

            InvoiceGeneratorService.create_invoice_for_transaction(txn)
            return {"status": "success", "transaction_id": txn.id}
        elif order_status in ("EXPIRED", "CANCELLED", "FAILED"):
            txn.status = TransactionStatus.FAILED
            txn.save(update_fields=["status", "updated_at"])
            return {"status": "failed"}

    return {"status": "pending"}


# ============================================================================
# RECURRING HYBRID ENGINE & DUNNING TASKS (3-DAY GRACE PERIOD)
# ============================================================================


@shared_task
def process_recurring_subscription_debit_task():
    """
    Hourly scheduled task: identifies ACTIVE subscriptions reaching current_period_end
    and attempts tokenized auto-debit via Kashier.
    """
    from .services.kashier import KashierService

    now = timezone.now()
    due_subs = Subscription.objects.filter(
        status=SubscriptionStatusChoices.ACTIVE,
        auto_renew=True,
        current_period_end__lte=now,
    ).select_related("user", "plan")

    processed = 0
    renewed = 0
    failed_or_grace = 0

    for sub in due_subs:
        with transaction.atomic():
            sub = Subscription.objects.select_for_update().get(pk=sub.pk)
            # Re-verify condition under pessimistic row lock
            if sub.status != SubscriptionStatusChoices.ACTIVE or sub.current_period_end > now:
                continue

            active_pm = sub.payment_methods.filter(
                is_active=True,
                payment_channel=PaymentMethod.ChannelChoices.CARD,
            ).first()

            if active_pm and active_pm.gateway_ref:
                order_id = f"SUB-REN-{sub.id}-{int(now.timestamp())}"
                result = KashierService.charge_token(
                    card_token=active_pm.gateway_ref,
                    amount=sub.price_at_subscription,
                    currency=sub.currency_at_subscription,
                    merchant_order_id=order_id,
                    descriptor=f"EduSmart {sub.plan.name} Renewal",
                )

                if result.get("success"):
                    txn = PaymentTransaction.objects.create(
                        subscription=sub,
                        gateway=active_pm.gateway,
                        gateway_transaction_id=result.get("transaction_id", f"txn_{order_id}"),
                        amount=sub.price_at_subscription,
                        status=TransactionStatus.PAID,
                        raw_webhook_payload=result.get("raw_response", {}),
                    )
                    days_to_add = 365 if sub.billing_cycle == BillingCycleChoices.YEARLY else 30
                    sub.current_period_end = sub.current_period_end + timedelta(days=days_to_add)
                    sub.dunning_attempt_count = 0
                    sub.grace_period_ends_at = None
                    sub.pre_due_notified = False
                    sub.save(
                        update_fields=[
                            "current_period_end",
                            "dunning_attempt_count",
                            "grace_period_ends_at",
                            "pre_due_notified",
                            "updated_at",
                        ]
                    )

                    InvoiceGeneratorService.create_invoice_for_transaction(txn)
                    renewed += 1
                else:
                    # Move to past due with strict 3-day grace period
                    sub.status = SubscriptionStatusChoices.PAST_DUE
                    sub.grace_period_ends_at = sub.current_period_end + timedelta(days=3)
                    sub.dunning_attempt_count = 1
                    sub.last_dunning_attempt = now
                    sub.save(
                        update_fields=[
                            "status",
                            "grace_period_ends_at",
                            "dunning_attempt_count",
                            "last_dunning_attempt",
                            "updated_at",
                        ]
                    )

                    Notification.objects.create(
                        user=sub.user,
                        type=NotificationType.SYSTEM,
                        title="تعذر تجديد الاشتراك - بدأت فترة السماح",
                        message=f"تعذر خصم قيمة تجديد باقة {sub.plan.name}. لديك فترة سماح مدتها 3 أيام لتحديث وسيلة الدفع أو السداد.",
                        action_url=f"/pricing?renew_sub={sub.id}",
                    )
                    failed_or_grace += 1
            else:
                # No tokenized card (e.g. mobile wallet subscriber) -> Enter 3-Day Grace Period directly
                sub.status = SubscriptionStatusChoices.PAST_DUE
                sub.grace_period_ends_at = sub.current_period_end + timedelta(days=3)
                sub.dunning_attempt_count = 1
                sub.last_dunning_attempt = now
                sub.save(
                    update_fields=[
                        "status",
                        "grace_period_ends_at",
                        "dunning_attempt_count",
                        "last_dunning_attempt",
                        "updated_at",
                    ]
                )

                Notification.objects.create(
                    user=sub.user,
                    type=NotificationType.SYSTEM,
                    title="موعد تجديد الاشتراك - فترة سماح لمدة 3 أيام",
                    message=f"انتهت فترة اشتراك باقة {sub.plan.name}. يرجى السداد عبر الرابط السريع خلال 3 أيام لتجنب تعليق الحساب.",
                    action_url=f"/pricing?renew_sub={sub.id}",
                )
                failed_or_grace += 1

            processed += 1

    return {"processed": processed, "renewed": renewed, "failed_or_grace": failed_or_grace}


@shared_task
def send_pre_due_subscription_invoices_task():
    """
    Daily scheduled task: dispatches pre-due renewal notice and fast-pay links
    3 days before current_period_end.
    """
    now = timezone.now()
    threshold = now + timedelta(days=3)

    candidates = Subscription.objects.filter(
        status=SubscriptionStatusChoices.ACTIVE,
        current_period_end__lte=threshold,
        current_period_end__gt=now,
        pre_due_notified=False,
    ).select_related("user", "plan")

    notified = 0
    for sub in candidates:
        fast_pay_url = f"/pricing?renew_sub={sub.id}&amount={sub.price_at_subscription}"
        Notification.objects.create(
            user=sub.user,
            type=NotificationType.SYSTEM,
            title="تذكير: اقتراب موعد تجديد الاشتراك",
            message=f"سينتهي اشتراكك في باقة {sub.plan.name} بتاريخ {sub.current_period_end.strftime('%Y-%m-%d')}. اضغط للدفع الفوري ومتابعة الخدمة دون انقطاع.",
            action_url=fast_pay_url,
        )
        sub.pre_due_notified = True
        sub.save(update_fields=["pre_due_notified", "updated_at"])
        notified += 1

    return {"notified_count": notified}


@shared_task
def process_dunning_retries_task():
    """
    Scheduled task checking subscriptions past due, retrying card charges within 3-day grace period,
    and expiring subscriptions after 3 days.
    """
    from .services.kashier import KashierService

    now = timezone.now()

    # 1. Transition any ACTIVE subscriptions that slipped past due date to PAST_DUE
    overdue_active = Subscription.objects.filter(
        status=SubscriptionStatusChoices.ACTIVE,
        current_period_end__lt=now,
    )
    for sub in overdue_active:
        sub.status = SubscriptionStatusChoices.PAST_DUE
        if not sub.grace_period_ends_at:
            sub.grace_period_ends_at = sub.current_period_end + timedelta(days=3)
        sub.save(update_fields=["status", "grace_period_ends_at", "updated_at"])

    # 2. Strict 3-day Grace Period Expiration
    expired_subs = Subscription.objects.filter(
        status=SubscriptionStatusChoices.PAST_DUE,
        grace_period_ends_at__lte=now,
    ).select_related("user", "plan")

    # Fallback for legacy subs without grace_period_ends_at (3-day cutoff)
    legacy_cutoff = now - timedelta(days=3)
    legacy_expired = Subscription.objects.filter(
        status=SubscriptionStatusChoices.PAST_DUE,
        grace_period_ends_at__isnull=True,
        current_period_end__lte=legacy_cutoff,
    ).select_related("user", "plan")

    all_expired = list(expired_subs) + list(legacy_expired)
    expired_count = 0

    for sub in all_expired:
        with transaction.atomic():
            sub = Subscription.objects.select_for_update().get(pk=sub.pk)
            if sub.status == SubscriptionStatusChoices.PAST_DUE:
                sub.status = SubscriptionStatusChoices.EXPIRED
                sub.save(update_fields=["status", "updated_at"])

                # Deactivate payment methods
                sub.payment_methods.filter(is_active=True).update(is_active=False)

                Notification.objects.create(
                    user=sub.user,
                    type=NotificationType.SYSTEM,
                    title="تم تعليق الاشتراك لانتهاء فترة السماح",
                    message=f"انتهت فترة السماح لاشتراك {sub.plan.name} وتم تعليق المزايا الخاصة بالحساب. يرجى إعادة الاشتراك للاستعادة الفورية.",
                    action_url="/pricing",
                )
                expired_count += 1

    # 3. Dunning retries for PAST_DUE subscriptions inside 3-day grace period
    retry_subs = Subscription.objects.filter(
        status=SubscriptionStatusChoices.PAST_DUE,
        grace_period_ends_at__gt=now,
        dunning_attempt_count__lt=3,
        auto_renew=True,
    ).select_related("user", "plan")

    retried_success = 0
    for sub in retry_subs:
        if sub.last_dunning_attempt and (now - sub.last_dunning_attempt) < timedelta(hours=20):
            continue

        with transaction.atomic():
            sub = Subscription.objects.select_for_update().get(pk=sub.pk)
            active_pm = sub.payment_methods.filter(
                is_active=True,
                payment_channel=PaymentMethod.ChannelChoices.CARD,
            ).first()

            if active_pm and active_pm.gateway_ref:
                order_id = f"SUB-RETRY-{sub.id}-{sub.dunning_attempt_count + 1}-{int(now.timestamp())}"
                result = KashierService.charge_token(
                    card_token=active_pm.gateway_ref,
                    amount=sub.price_at_subscription,
                    currency=sub.currency_at_subscription,
                    merchant_order_id=order_id,
                )
                if result.get("success"):
                    txn = PaymentTransaction.objects.create(
                        subscription=sub,
                        gateway=active_pm.gateway,
                        gateway_transaction_id=result.get("transaction_id", f"txn_{order_id}"),
                        amount=sub.price_at_subscription,
                        status=TransactionStatus.PAID,
                        raw_webhook_payload=result.get("raw_response", {}),
                    )
                    days_to_add = 365 if sub.billing_cycle == BillingCycleChoices.YEARLY else 30
                    sub.status = SubscriptionStatusChoices.ACTIVE
                    sub.current_period_end = sub.current_period_end + timedelta(days=days_to_add)
                    sub.dunning_attempt_count = 0
                    sub.grace_period_ends_at = None
                    sub.pre_due_notified = False
                    sub.save(
                        update_fields=[
                            "status",
                            "current_period_end",
                            "dunning_attempt_count",
                            "grace_period_ends_at",
                            "pre_due_notified",
                            "updated_at",
                        ]
                    )

                    InvoiceGeneratorService.create_invoice_for_transaction(txn)
                    retried_success += 1
                else:
                    sub.dunning_attempt_count += 1
                    sub.last_dunning_attempt = now
                    sub.save(update_fields=["dunning_attempt_count", "last_dunning_attempt", "updated_at"])

    return {"expired_count": expired_count, "retried_success": retried_success}


@shared_task
def process_dunning_retries_and_grace_period_task():
    """Alias for process_dunning_retries_task."""
    return process_dunning_retries_task()


# ============================================================================
# 14-DAY ESCROW HOLDING SETTLEMENT ENGINE
# ============================================================================


@shared_task
def process_escrow_settlements_task():
    """
    Scheduled task releasing matured 14-day escrow holdings.
    Transitions funds from pending_balance to available_balance under row-level locking.
    Skips refunded orders and generates balanced double-entry ledger records.
    """
    now = timezone.now()
    matured_holdings = EscrowHolding.objects.filter(
        status=EscrowStatusChoices.HELD,
        mature_at__lte=now,
    ).select_related("wallet", "order")

    processed_count = 0
    total_settled_amount = Decimal("0.00")

    for holding_item in matured_holdings:
        with transaction.atomic():
            try:
                holding = EscrowHolding.objects.select_for_update().get(pk=holding_item.pk)
            except EscrowHolding.DoesNotExist:
                continue

            if holding.status != EscrowStatusChoices.HELD or holding.mature_at > now:
                continue

            # Skip if order was refunded
            if holding.order and holding.order.status == OrderStatusChoices.REFUNDED:
                holding.status = EscrowStatusChoices.REFUNDED
                holding.save(update_fields=["status", "updated_at"])
                continue

            wallet = Wallet.objects.select_for_update().get(pk=holding.wallet_id)
            release_amount = holding.amount

            # Ensure pending balance deduction does not go negative
            actual_deduct = min(wallet.pending_balance, release_amount)
            wallet.pending_balance = max(Decimal("0.00"), wallet.pending_balance - actual_deduct)
            wallet.available_balance += actual_deduct
            wallet.save(update_fields=["pending_balance", "available_balance", "updated_at"])

            # Create balanced ledger record
            ledger = Ledger.objects.create(
                reference_id=f"ESCROW_RELEASE_HOLDING_{holding.id}_{int(now.timestamp())}",
                description=f"Automatic 14-day escrow maturity release of {actual_deduct} EGP for Wallet #{wallet.id}",
            )
            LedgerEntry.objects.create(
                ledger=ledger,
                wallet=wallet,
                entry_type=LedgerEntryType.DEBIT,
                amount=actual_deduct,
            )
            LedgerEntry.objects.create(
                ledger=ledger,
                wallet=wallet,
                entry_type=LedgerEntryType.CREDIT,
                amount=actual_deduct,
            )

            holding.status = EscrowStatusChoices.RELEASED
            holding.settled_at = now
            holding.ledger = ledger
            holding.save(update_fields=["status", "settled_at", "ledger", "updated_at"])

            processed_count += 1
            total_settled_amount += actual_deduct

    return {"settled_count": processed_count, "total_settled_amount": str(total_settled_amount)}


@shared_task
def settle_escrow_balances_task():
    """Alias for process_escrow_settlements_task."""
    return process_escrow_settlements_task()
