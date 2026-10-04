import time
from datetime import timedelta
from decimal import Decimal

import psutil
from django.core.cache import cache
from django.db import connection, models
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.models import User, UserRole
from apps.common.models import AuditLog
from apps.common.permissions import IsSuperAdmin
from apps.courses.models import Course
from apps.finance.models import Order, OrderStatusChoices, Transaction, TransactionStatusChoices


@api_view(["GET"])
@permission_classes([IsSuperAdmin])
def super_admin_overview(request):
    """
    Super Admin Dashboard Overview Endpoint.
    Gathers real system metrics, DB latency, online users, finance summaries, and critical alerts.
    """

    # 1. Server & System Health Metrics
    cpu_percent = psutil.cpu_percent(interval=None)
    memory_info = psutil.virtual_memory()
    ram_percent = memory_info.percent
    ram_used_gb = round(memory_info.used / (1024**3), 2)
    ram_total_gb = round(memory_info.total / (1024**3), 2)

    try:
        boot_time = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time)
    except Exception:
        uptime_seconds = 0

    # 2. Database Connection Health & Query Latency
    db_status = "healthy"
    db_latency_ms = 0.0
    try:
        start_time = time.perf_counter()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()
        db_latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # 3. Cache / Redis Worker Health & Latency
    cache_status = "healthy"
    cache_latency_ms = 0.0
    try:
        start_time = time.perf_counter()
        cache.set("super_admin_health_ping", "pong", timeout=5)
        val = cache.get("super_admin_health_ping")
        cache_latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        if val != "pong":
            cache_status = "degraded"
    except Exception as e:
        cache_status = f"unhealthy: {str(e)}"

    # 4. Active Users Online (Activity in the last 5 minutes)
    five_minutes_ago = timezone.now() - timedelta(minutes=5)
    online_users_count = User.objects.filter(last_login_at__gte=five_minutes_ago, is_active=True).count()

    # 5. Quick Summary Stats (Counts & Financial Aggregations)
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_students = User.objects.filter(role=UserRole.STUDENT, is_active=True).count()
    total_instructors = User.objects.filter(role=UserRole.INSTRUCTOR, is_active=True).count()
    total_courses = Course.objects.filter(status="published").count()

    completed_orders = Order.objects.filter(status=OrderStatusChoices.COMPLETED)

    revenue_today = completed_orders.filter(created_at__gte=today_start).aggregate(total=models.Sum("total"))[
        "total"
    ] or Decimal("0.00")
    revenue_week = completed_orders.filter(created_at__gte=week_start).aggregate(total=models.Sum("total"))[
        "total"
    ] or Decimal("0.00")
    revenue_month = completed_orders.filter(created_at__gte=month_start).aggregate(total=models.Sum("total"))[
        "total"
    ] or Decimal("0.00")
    revenue_total = completed_orders.aggregate(total=models.Sum("total"))["total"] or Decimal("0.00")

    # 6. Critical Security & Infrastructure Alerts
    twenty_four_hours_ago = now - timedelta(hours=24)

    alerts = []

    # Alert A: High Brute Force / Failed 2FA Attempts in last 24h
    failed_2fa_count = AuditLog.objects.filter(
        action_type="FAILED_2FA_ATTEMPT", created_at__gte=twenty_four_hours_ago
    ).count()

    if failed_2fa_count > 5:
        alerts.append(
            {
                "id": "brute_force_warning",
                "severity": "high" if failed_2fa_count > 15 else "medium",
                "title": "Brute Force Security Warning",
                "message": f"Detected {failed_2fa_count} failed 2FA authentication attempts in the last 24 hours.",
                "timestamp": now.isoformat(),
            }
        )

    # Alert B: Failed Payment Transactions Spike in last 24h
    failed_transactions_count = Transaction.objects.filter(
        status=TransactionStatusChoices.FAILED, created_at__gte=twenty_four_hours_ago
    ).count()

    if failed_transactions_count > 3:
        alerts.append(
            {
                "id": "failed_payment_spike",
                "severity": "high" if failed_transactions_count > 10 else "medium",
                "title": "Payment Gateway Failures",
                "message": f"Recorded {failed_transactions_count} failed transaction attempts in the last 24 hours.",
                "timestamp": now.isoformat(),
            }
        )

    # Alert C: High RAM or CPU Resource Pressure
    if ram_percent > 85:
        alerts.append(
            {
                "id": "high_ram_usage",
                "severity": "high",
                "title": "System Memory Exhaustion Warning",
                "message": f"Server RAM consumption is critical at {ram_percent}%.",
                "timestamp": now.isoformat(),
            }
        )

    if cpu_percent > 85:
        alerts.append(
            {
                "id": "high_cpu_usage",
                "severity": "medium",
                "title": "High CPU Utilization",
                "message": f"Server CPU load is currently at {cpu_percent}%.",
                "timestamp": now.isoformat(),
            }
        )

    # Response Object
    return Response(
        {
            "server": {
                "uptime_seconds": uptime_seconds,
                "cpu_percent": cpu_percent,
                "ram_percent": ram_percent,
                "ram_used_gb": ram_used_gb,
                "ram_total_gb": ram_total_gb,
                "database": {
                    "status": db_status,
                    "latency_ms": db_latency_ms,
                },
                "cache": {
                    "status": cache_status,
                    "latency_ms": cache_latency_ms,
                },
            },
            "analytics": {
                "online_users": online_users_count,
                "total_students": total_students,
                "total_instructors": total_instructors,
                "total_published_courses": total_courses,
                "revenue": {
                    "today": float(revenue_today),
                    "this_week": float(revenue_week),
                    "this_month": float(revenue_month),
                    "total_all_time": float(revenue_total),
                },
            },
            "alerts": alerts,
        },
        status=status.HTTP_200_OK,
    )
