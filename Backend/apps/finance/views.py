import hashlib
import hmac
import logging
import uuid
from datetime import timedelta
from decimal import Decimal

from decouple import config
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Sum
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import generics, permissions, serializers, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsProfileCompleted
from apps.assessments.models import Exam
from apps.common.permissions import IsAdmin
from apps.courses.models import Course
from apps.enrollments.models import Enrollment

from .models import (
    Coupon,
    DetailedAuditLog,
    EscrowHolding,
    Ledger,
    LedgerEntry,
    LedgerEntryType,
    Order,
    OrderItem,
    OrderStatusChoices,
    PaymentGatewayConfig,
    PayoutRequest,
    PayoutStatusChoices,
    PlanTypeChoices,
    PricingChangeRequest,
    PricingPlan,
    Subscription,
    SubscriptionStatusChoices,
    Transaction,
    TransactionStatusChoices,
    Wallet,
    WalletTypeChoices,
)
from .serializers import (
    CheckoutSerializer,
    CouponSerializer,
    CouponValidateSerializer,
    EscrowHoldingSerializer,
    KashierCheckoutSessionSerializer,
    LedgerEntrySerializer,
    OrderSerializer,
    PayoutRequestSerializer,
    PricingChangeRequestSerializer,
    PricingPlanSerializer,
    SubscriptionCheckoutSerializer,
    WalletSerializer,
)
from .services import (
    CouponService,
    FawryService,
    KashierReconciliationService,
    KashierService,
    MakerCheckerService,
    PaymentProcessingError,
    deposit_to_wallet,
    get_center_wallet,
    get_instructor_wallet,
    get_platform_wallet,
    get_student_wallet,
    pay_with_balance,
    process_payment,
)
from .tasks import (
    process_fawry_webhook_task,
)

logger = logging.getLogger(__name__)


class CheckoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CheckoutSerializer

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        course_id = serializer.validated_data["course_id"]
        gateway_name = serializer.validated_data.get("gateway", "stripe")
        course = Course.objects.filter(pk=course_id, status="published").select_for_update().first()
        if not course:
            return Response(
                {"detail": "Course not found or not published."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if already enrolled
        if Enrollment.objects.filter(student=request.user, course=course).exists():
            return Response(
                {"detail": "You are already enrolled in this course."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_amount = Decimal(str(course.price))

        # Instant enrollment for free courses
        if total_amount == Decimal("0.00"):
            Enrollment.objects.get_or_create(student=request.user, course=course)
            return Response(
                {
                    "detail": "تم التسجيل في الدورة المجانية بنجاح.",
                    "is_free": True,
                    "enrolled": True,
                    "course_id": course.id,
                },
                status=status.HTTP_201_CREATED,
            )

        # Create Pending Order
        order = Order.objects.create(
            student=request.user,
            status=OrderStatusChoices.PENDING,
            subtotal=total_amount,
            total=total_amount,
        )

        OrderItem.objects.create(
            order=order,
            course=course,
            price_at_purchase=total_amount,
        )

        idempotency_key = f"order_{order.id}_{uuid.uuid4().hex[:12]}"
        txn = Transaction.objects.create(
            order=order,
            gateway=gateway_name,
            amount=total_amount,
            status=TransactionStatusChoices.INITIATED,
            idempotency_key=idempotency_key,
        )

        # Payment Gateway Checkout URL
        checkout_url = f"https://checkout.paymentgateway.com/pay/{txn.idempotency_key}"

        return Response(
            {
                "order_id": order.id,
                "transaction_id": txn.id,
                "total": str(order.total),
                "currency": "EGP",
                "checkout_url": checkout_url,
                "idempotency_key": txn.idempotency_key,
            },
            status=status.HTTP_201_CREATED,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def payment_webhook(request):
    """
    Idempotent payment webhook listener with HMAC signature verification.

    Fails closed: with no PAYMENT_WEBHOOK_SECRET configured or no/invalid
    signature, the request is rejected outright rather than skipping
    verification. (production.py additionally refuses to boot at all if
    this secret is unset, as defense in depth.)
    """
    webhook_secret = config("PAYMENT_WEBHOOK_SECRET", default="")
    signature = request.headers.get("X-Payment-Signature") or request.headers.get("Stripe-Signature")

    if not webhook_secret:
        logger.error("payment_webhook called but PAYMENT_WEBHOOK_SECRET is not configured")
        return Response({"detail": "Webhook not configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if not signature:
        return Response({"detail": "Missing signature header"}, status=status.HTTP_400_BAD_REQUEST)
    computed_sig = hmac.new(
        webhook_secret.encode("utf-8"),
        request.body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(computed_sig, signature):
        return Response({"detail": "Invalid webhook signature"}, status=status.HTTP_403_FORBIDDEN)

    event_data = request.data
    gateway_ref = event_data.get("gateway_reference") or event_data.get("idempotency_key")
    event_status = (event_data.get("status") or "").lower()

    if not gateway_ref:
        return Response({"detail": "gateway_reference required"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        try:
            txn = Transaction.objects.select_for_update().get(idempotency_key=gateway_ref)
        except Transaction.DoesNotExist:
            try:
                txn = Transaction.objects.select_for_update().get(gateway_reference=gateway_ref)
            except Transaction.DoesNotExist:
                return Response({"detail": "Transaction not found"}, status=status.HTTP_404_NOT_FOUND)

        # Idempotency check: if already processed, return 200 OK immediately
        if txn.status == TransactionStatusChoices.SUCCESS:
            return Response({"status": "already_processed"}, status=status.HTTP_200_OK)

        order = txn.order

        if event_status in ("success", "completed", "paid"):
            amount_to_pay = txn.amount if txn.amount > Decimal("0.00") else order.total
            process_payment(
                order=order,
                gateway_name=txn.gateway or "generic",
                gateway_ref=gateway_ref,
                amount_paid=amount_to_pay,
                idempotency_key=f"generic_wh_{order.id}_{gateway_ref or txn.id}",
            )

            # Auto-enroll student into purchased courses
            for item in order.items.all():
                Enrollment.objects.get_or_create(student=order.student, course=item.course)

            return Response({"status": "payment_completed"}, status=status.HTTP_200_OK)

        elif event_status in ("failed", "canceled"):
            txn.status = TransactionStatusChoices.FAILED
            txn.error_message = event_data.get("error_message", "Payment failed at gateway")
            txn.save(update_fields=["status", "error_message", "updated_at"])

            order.status = OrderStatusChoices.FAILED
            order.save(update_fields=["status", "updated_at"])

            return Response({"status": "payment_failed"}, status=status.HTTP_200_OK)

    return Response({"status": "ignored"}, status=status.HTTP_200_OK)


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return Order.objects.none()
        return Order.objects.filter(student=self.request.user).prefetch_related("items__course").order_by("-created_at")


class WalletViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = WalletSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return Wallet.objects.none()
        if getattr(self.request.user, "role", "") in ("admin", "super_admin"):
            return Wallet.objects.all()
        return Wallet.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="my-wallet")
    def my_wallet(self, request):
        role = getattr(request.user, "role", "student")
        if role == "instructor":
            wallet_type = WalletTypeChoices.INSTRUCTOR
        elif role == "student":
            wallet_type = WalletTypeChoices.STUDENT
        elif role == "center":
            wallet_type = WalletTypeChoices.CENTER
        else:
            wallet_type = WalletTypeChoices.PLATFORM

        wallet, _ = Wallet.objects.get_or_create(
            user=request.user,
            wallet_type=wallet_type,
            defaults={"currency": "EGP"},
        )
        return Response(WalletSerializer(wallet).data)

    @action(detail=False, methods=["get"], url_path="ledger")
    def ledger(self, request):
        """Returns paginated ledger history for the authenticated user's wallet(s)."""
        wallets = Wallet.objects.filter(user=request.user)
        if not wallets.exists():
            role = getattr(request.user, "role", "student")
            w_type = (
                WalletTypeChoices.INSTRUCTOR
                if role == "instructor"
                else (WalletTypeChoices.CENTER if role == "center" else WalletTypeChoices.STUDENT)
            )
            Wallet.objects.get_or_create(user=request.user, wallet_type=w_type, defaults={"currency": "EGP"})
            wallets = Wallet.objects.filter(user=request.user)

        entries = (
            LedgerEntry.objects.filter(wallet__in=wallets).select_related("ledger", "wallet").order_by("-created_at")
        )
        page = self.paginate_queryset(entries)
        if page is not None:
            serializer = LedgerEntrySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = LedgerEntrySerializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="entries")
    def entries(self, request, pk=None):
        """Returns paginated ledger entries for a specific wallet id."""
        wallet = self.get_object()
        if wallet.user != request.user and getattr(request.user, "role", "") not in ("admin", "super_admin"):
            return Response(
                {"detail": "You do not have permission to view this ledger."}, status=status.HTTP_403_FORBIDDEN
            )

        entries = LedgerEntry.objects.filter(wallet=wallet).select_related("ledger", "wallet").order_by("-created_at")
        page = self.paginate_queryset(entries)
        if page is not None:
            serializer = LedgerEntrySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = LedgerEntrySerializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="escrow")
    def escrow_holdings(self, request):
        """Returns escrow holdings breakdown for the authenticated user's wallet."""
        wallets = Wallet.objects.filter(user=request.user)
        holdings = (
            EscrowHolding.objects.filter(wallet__in=wallets)
            .select_related("order", "order_item", "wallet")
            .order_by("-created_at")
        )
        serializer = EscrowHoldingSerializer(holdings, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="pay-with-balance")
    def pay_with_balance_view(self, request):
        """Direct course or exam checkout deducted from student available balance."""
        course_id = request.data.get("course_id")
        if not course_id:
            return Response({"detail": "course_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            course = Course.objects.get(pk=course_id, status="published")
        except Course.DoesNotExist:
            return Response({"detail": "Course not found or not published."}, status=status.HTTP_404_NOT_FOUND)

        if Enrollment.objects.filter(student=request.user, course=course).exists():
            return Response({"detail": "You are already enrolled in this course."}, status=status.HTTP_400_BAD_REQUEST)

        coupon_code = request.data.get("coupon_code", "").strip().upper()
        base_price = Decimal(str(course.price))
        discount = Decimal("0.00")
        final_price = base_price

        if coupon_code:
            coupon_res = CouponService.validate_and_calculate(
                coupon_code=coupon_code,
                user=request.user,
                base_amount=base_price,
                item_type="course",
                item_obj=course,
            )
            if coupon_res.is_valid:
                discount = coupon_res.discount_amount
                final_price = coupon_res.final_price

        student_wallet = get_student_wallet(request.user)
        if student_wallet.available_balance < final_price:
            return Response({"detail": "رصيد المحفظة غير كافٍ لإتمام العملية."}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.create(
            student=request.user,
            status=OrderStatusChoices.PENDING,
            subtotal=base_price,
            discount_amount=discount,
            total=final_price,
        )
        OrderItem.objects.create(order=order, course=course, price_at_purchase=final_price)

        try:
            pay_with_balance(request.user, order)
        except PaymentProcessingError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        student_wallet.refresh_from_db()
        return Response(
            {
                "status": "paid_with_balance",
                "order_id": order.id,
                "course_id": course.id,
                "remaining_balance": str(student_wallet.available_balance),
                "enrolled": True,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="top-up")
    def top_up_wallet(self, request):
        """Top-up user wallet balance via Kashier or direct deposit."""
        amount_raw = request.data.get("amount")
        gateway = request.data.get("gateway", "kashier")
        try:
            amount = Decimal(str(amount_raw))
            if amount <= Decimal("0.00"):
                raise ValueError()
        except (ValueError, TypeError):
            return Response({"detail": "Amount must be a positive number."}, status=status.HTTP_400_BAD_REQUEST)

        role = getattr(request.user, "role", "student")
        if role == "instructor":
            wallet = get_instructor_wallet(request.user)
        elif role == "center":
            wallet = get_center_wallet(request.user)
        else:
            wallet = get_student_wallet(request.user)

        deposit_to_wallet(wallet, amount, gateway_name=gateway)
        wallet.refresh_from_db()
        return Response(
            {
                "status": "topup_completed",
                "wallet_id": wallet.id,
                "available_balance": str(wallet.available_balance),
                "current_balance": str(wallet.current_balance),
            },
            status=status.HTTP_201_CREATED,
        )


# ============================================================================
# PRICING, SUBSCRIPTION & DUAL PAYMENT WEBHOOK VIEWS
# ============================================================================


class PricingPlanListView(generics.ListAPIView):
    """
    Public API returning active pricing plans with features for the frontend pricing page.
    """

    permission_classes = [AllowAny]
    serializer_class = PricingPlanSerializer

    def get_queryset(self):
        return PricingPlan.objects.filter(is_active=True).prefetch_related("features").order_by("order", "id")


class CouponValidateView(generics.GenericAPIView):
    """
    AJAX Endpoint to validate coupon codes prior to checkout.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = CouponValidateSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data["code"].strip().upper()
        plan_id = serializer.validated_data["plan_id"]
        billing_cycle = serializer.validated_data["billing_cycle"]

        try:
            plan = PricingPlan.objects.get(pk=plan_id, is_active=True)
        except PricingPlan.DoesNotExist:
            return Response({"detail": "الخطة المطلوبة غير متاحة."}, status=status.HTTP_404_NOT_FOUND)

        base_price = plan.price_yearly if billing_cycle == "yearly" else plan.price_monthly

        calc_result = CouponService.validate_and_calculate(
            coupon_code=code,
            user=request.user,
            base_amount=base_price,
            item_type="plan",
            item_obj=plan,
        )

        if not calc_result.is_valid:
            return Response({"detail": calc_result.error_message}, status=status.HTTP_400_BAD_REQUEST)

        coupon = calc_result.coupon
        return Response(
            {
                "valid": True,
                "code": coupon.code if coupon else code,
                "discount_type": coupon.discount_type if coupon else "percent",
                "discount_value": str(coupon.discount_value) if coupon else "0.00",
                "discount_amount": str(calc_result.discount_amount),
                "original_price": str(base_price),
                "final_price": str(calc_result.final_price),
                "currency": plan.currency,
            },
            status=status.HTTP_200_OK,
        )


class SubscriptionCheckoutView(generics.GenericAPIView):
    """
    Subscription Checkout endpoint supporting Idempotency-Key headers and dual gateways (Paymob / Fawry).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = SubscriptionCheckoutSerializer

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        idempotency_key = request.headers.get("Idempotency-Key") or request.data.get("idempotency_key")
        if idempotency_key:
            cache_key = f"checkout_idempotency_{idempotency_key}"
            cached_res = cache.get(cache_key)
            if cached_res:
                return Response(cached_res, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        plan_id = serializer.validated_data["plan_id"]
        billing_cycle = serializer.validated_data["billing_cycle"]
        gateway = serializer.validated_data["payment_gateway"]
        coupon_code = serializer.validated_data.get("coupon_code", "").strip().upper()

        plan = PricingPlan.objects.filter(pk=plan_id, is_active=True).first()
        if not plan:
            return Response({"detail": "الخطة المطلوبة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

        base_price = plan.price_yearly if billing_cycle == "yearly" else plan.price_monthly
        discount_amount = Decimal("0.00")

        if coupon_code:
            try:
                coupon = Coupon.objects.get(code=coupon_code, is_active=True)
                if coupon.discount_type == Coupon.DiscountType.PERCENT:
                    discount_amount = (base_price * coupon.discount_value) / Decimal("100.00")
                    if coupon.maximum_discount and discount_amount > coupon.maximum_discount:
                        discount_amount = coupon.maximum_discount
                else:
                    discount_amount = coupon.discount_value
            except Coupon.DoesNotExist:
                pass

        final_price = max(Decimal("0.00"), base_price - discount_amount)
        period_days = 365 if billing_cycle == "yearly" else 30

        # Create or update subscription record with Price Snapshot
        subscription = Subscription.objects.create(
            user=request.user,
            plan=plan,
            price_at_subscription=final_price,
            currency_at_subscription=plan.currency,
            status=SubscriptionStatusChoices.TRIALING if plan.trial_days > 0 else SubscriptionStatusChoices.ACTIVE,
            billing_cycle=billing_cycle,
            current_period_end=timezone.now() + timedelta(days=period_days),
        )

        response_payload = {
            "subscription_id": subscription.id,
            "plan_name": plan.name,
            "billing_cycle": billing_cycle,
            "amount": str(final_price),
            "currency": plan.currency,
            "gateway": gateway,
        }

        if gateway == "fawry":
            fawry_details = FawryService.create_payatfawry_reference(subscription, final_price)
            response_payload["fawry_reference"] = fawry_details
        else:
            # Primary authoritative gateway: Kashier
            kashier_session = KashierService().create_checkout_session(
                resource_type="subscription",
                resource_id=subscription.id,
                user=request.user,
                amount=final_price,
            )
            response_payload["checkout_url"] = kashier_session["checkout_url"]
            response_payload["hash"] = kashier_session["hash"]
            response_payload["merchant_order_id"] = kashier_session["merchant_order_id"]

        if idempotency_key:
            cache.set(f"checkout_idempotency_{idempotency_key}", response_payload, 3600)

        return Response(response_payload, status=status.HTTP_201_CREATED)


class KashierCheckoutSessionView(generics.GenericAPIView):
    """
    Unified Kashier Checkout Session Generator supporting:
    - Single Course Purchases ('course')
    - Standalone Assessment / Exam Purchases ('exam')
    - SaaS Subscription Plans ('subscription')
    - Prepaid Digital Wallet Top-ups ('wallet_deposit')
    """

    permission_classes = [IsAuthenticated]
    serializer_class = KashierCheckoutSessionSerializer

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resource_type = serializer.validated_data["resource_type"]
        resource_id = serializer.validated_data["resource_id"]
        billing_cycle = serializer.validated_data.get("billing_cycle", "monthly")
        custom_amount = serializer.validated_data.get("amount")
        coupon_code = serializer.validated_data.get("coupon_code", "").strip().upper()
        return_url = serializer.validated_data.get("return_url")

        final_price = Decimal("0.00")
        merchant_order_id = None
        ts = int(timezone.now().timestamp())

        if resource_type == "course":
            try:
                course = Course.objects.select_for_update().get(pk=resource_id, status="published")
            except Course.DoesNotExist:
                return Response(
                    {"detail": "الدورة المطلوبة غير موجودة أو غير منشورة."}, status=status.HTTP_404_NOT_FOUND
                )

            if Enrollment.objects.filter(student=request.user, course=course).exists():
                return Response({"detail": "أنت مسجل بالفعل في هذه الدورة."}, status=status.HTTP_400_BAD_REQUEST)

            base_price = Decimal(str(course.price))
            coupon_res = CouponService.validate_and_calculate(
                coupon_code=coupon_code,
                user=request.user,
                base_amount=base_price,
                item_type="course",
                item_obj=course,
            )
            discount = coupon_res.discount_amount if coupon_res.is_valid else Decimal("0.00")
            final_price = coupon_res.final_price if coupon_res.is_valid else base_price

            order = Order.objects.create(
                student=request.user,
                status=OrderStatusChoices.PENDING,
                subtotal=base_price,
                discount_amount=discount,
                total=final_price,
            )
            OrderItem.objects.create(
                order=order,
                course=course,
                price_at_purchase=final_price,
            )
            merchant_order_id = f"CRS-{order.id}-{ts}"

            Transaction.objects.create(
                order=order,
                gateway="kashier",
                amount=final_price,
                status=TransactionStatusChoices.INITIATED,
                idempotency_key=merchant_order_id,
            )

        elif resource_type == "exam":
            try:
                exam = Exam.objects.select_for_update().get(pk=resource_id)
            except Exam.DoesNotExist:
                return Response({"detail": "الامتحان المطلوب غير موجود."}, status=status.HTTP_404_NOT_FOUND)

            base_price = Decimal("100.00")
            if exam.course and exam.course.price:
                base_price = Decimal(str(exam.course.price))

            final_price = base_price
            order = Order.objects.create(
                student=request.user,
                status=OrderStatusChoices.PENDING,
                subtotal=base_price,
                total=final_price,
            )
            if exam.course:
                OrderItem.objects.create(
                    order=order,
                    course=exam.course,
                    price_at_purchase=final_price,
                )
            merchant_order_id = f"EXM-{exam.id}-{request.user.id}-{ts}"

            Transaction.objects.create(
                order=order,
                gateway="kashier",
                amount=final_price,
                status=TransactionStatusChoices.INITIATED,
                idempotency_key=merchant_order_id,
            )

        elif resource_type == "subscription":
            try:
                plan = PricingPlan.objects.get(pk=resource_id, is_active=True)
            except PricingPlan.DoesNotExist:
                return Response({"detail": "الخطة المطلوبة غير موجودة."}, status=status.HTTP_404_NOT_FOUND)

            base_price = plan.price_yearly if billing_cycle == "yearly" else plan.price_monthly
            coupon_res = CouponService.validate_and_calculate(
                coupon_code=coupon_code,
                user=request.user,
                base_amount=base_price,
                item_type="plan",
                item_obj=plan,
            )
            discount = coupon_res.discount_amount if coupon_res.is_valid else Decimal("0.00")
            final_price = coupon_res.final_price if coupon_res.is_valid else base_price
            period_days = 365 if billing_cycle == "yearly" else 30

            sub = Subscription.objects.create(
                user=request.user,
                plan=plan,
                price_at_subscription=final_price,
                currency_at_subscription=plan.currency,
                status=SubscriptionStatusChoices.TRIALING if plan.trial_days > 0 else SubscriptionStatusChoices.ACTIVE,
                billing_cycle=billing_cycle,
                current_period_end=timezone.now() + timedelta(days=period_days),
            )
            merchant_order_id = f"SUB-{sub.id}-{ts}"

        elif resource_type == "wallet_deposit":
            if not custom_amount or Decimal(str(custom_amount)) <= Decimal("0.00"):
                return Response(
                    {"detail": "مبلغ الإيداع يجب أن يكون أكبر من الصفر."}, status=status.HTTP_400_BAD_REQUEST
                )

            final_price = Decimal(str(custom_amount)).quantize(Decimal("0.01"))
            user_role = getattr(request.user, "role", "")
            if user_role == "instructor":
                wallet = get_instructor_wallet(request.user)
            elif user_role in ("center", "center_admin"):
                wallet = get_center_wallet(request.user)
            else:
                wallet = get_student_wallet(request.user)
            merchant_order_id = f"WLT-{wallet.id}-{ts}"

        service = KashierService()
        session_data = service.create_checkout_session(
            resource_type=resource_type,
            resource_id=resource_id,
            user=request.user,
            amount=final_price,
            merchant_order_id=merchant_order_id,
            return_url=return_url,
        )

        return Response(session_data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def kashier_webhook_view(request):
    """
    Kashier Server-to-Server Webhook Processor:
    1. Validates HMAC-SHA256 signature using constant-time digest comparison.
    2. Enforces 100% idempotency against replay / duplicate payloads.
    3. Reconciles Order enrollment, Subscription activation, or Wallet balance credit.
    4. Returns HTTP 200 OK for valid/duplicate payloads, HTTP 403 for tampered signatures.
    """
    payload = request.data
    if not isinstance(payload, dict):
        return Response({"detail": "Invalid payload format."}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Cryptographic HMAC-SHA256 Verification
    if not KashierService.verify_signature(payload):
        return Response(
            {"detail": "Invalid Kashier HMAC-SHA256 signature."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # 2. Execute Idempotent Reconciliation
    result = KashierReconciliationService.reconcile_payment(payload)
    return Response(result, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def kashier_callback_view(request):
    """
    Kashier Client-Side Callback Redirect View:
    1. Receives browser GET redirect from Kashier checkout with query parameters.
    2. Validates HMAC-SHA256 signature over query parameters.
    3. Triggers synchronous idempotent reconciliation (instant unlock).
    4. Redirects student browser to the appropriate frontend page on Port 8080.
    """
    params = request.GET.dict()
    default_frontend = getattr(settings, "FRONTEND_URL", None) or ("https://courssat.online" if not getattr(settings, "DEBUG", True) else "http://localhost:8080")
    frontend_base = config("FRONTEND_BASE_URL", default=default_frontend).rstrip("/")

    # 1. Signature Verification
    if not KashierService.verify_signature(params):
        return HttpResponseRedirect(f"{frontend_base}/checkout/failed?reason=tampered_signature")

    # 2. Synchronous Reconciliation
    KashierReconciliationService.reconcile_payment(params)

    payment_status = (params.get("paymentStatus") or "").upper()
    merchant_order_id = params.get("merchantOrderId") or params.get("orderId") or ""
    transaction_id = params.get("transactionId") or params.get("orderReference") or ""

    if payment_status == "SUCCESS":
        if merchant_order_id.upper().startswith("SUB-") or merchant_order_id.lower().startswith("sub_"):
            clean_sub_id = merchant_order_id.replace("SUB-", "").replace("sub_", "").split("-")[0].split("_")[0]
            return HttpResponseRedirect(f"{frontend_base}/pricing/success?subscription_id={clean_sub_id}&status=active")
        elif (
            merchant_order_id.upper().startswith("WALLET-")
            or merchant_order_id.upper().startswith("TOPUP-")
            or merchant_order_id.upper().startswith("WLT-")
        ):
            amount = params.get("amount", "")
            return HttpResponseRedirect(f"{frontend_base}/student/wallet?status=topup_success&amount={amount}")
        else:
            clean_order_id = (
                merchant_order_id.replace("ORDER-", "")
                .replace("order_", "")
                .replace("CRS-", "")
                .replace("EXM-", "")
                .split("-")[0]
                .split("_")[0]
            )
            return HttpResponseRedirect(
                f"{frontend_base}/checkout/success?order_id={clean_order_id}&transaction_id={transaction_id}"
            )
    else:
        return HttpResponseRedirect(
            f"{frontend_base}/checkout/failed?reason={payment_status.lower()}&order_id={merchant_order_id}"
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kashier_order_status_view(request, merchant_order_id: str):
    """
    Kashier synchronous order status inquiry endpoint.
    """
    service = KashierService()
    result = service.get_order_status(merchant_order_id)
    return Response(result, status=status.HTTP_200_OK)



@api_view(["POST"])
@permission_classes([AllowAny])
def fawry_webhook_view(request):
    """
    Fawry Webhook Listener:
    1. Verifies SHA-256 signature using secureKey.
    2. Offloads execution to Celery process_fawry_webhook_task.
    3. Returns 200 OK immediately.
    """
    if not FawryService.verify_signature(request.data):
        return Response({"detail": "Invalid Fawry SHA-256 signature."}, status=status.HTTP_403_FORBIDDEN)

    process_fawry_webhook_task.delay(request.data)
    return Response({"status": "accepted"}, status=status.HTTP_200_OK)


# ============================================================================
# SUPER ADMIN PRICING & MAKER-CHECKER ENDPOINTS
# ============================================================================


class SuperAdminPricingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = PricingPlanSerializer
    queryset = PricingPlan.objects.all().prefetch_related("features").order_by("order", "id")

    def perform_create(self, serializer):
        plan = serializer.save()
        DetailedAuditLog.objects.create(
            actor=self.request.user if self.request.user.is_authenticated else None,
            action="PRICING_PLAN_CREATED",
            entity_type="PricingPlan",
            entity_id=plan.id,
            old_value={},
            new_value=serializer.data,
            reason="خطة أسعار جديدة أضيفت بواسطة المشرف العام",
        )

    def perform_update(self, serializer):
        plan = self.get_object()
        old_data = PricingPlanSerializer(plan).data
        updated_plan = serializer.save()
        DetailedAuditLog.objects.create(
            actor=self.request.user if self.request.user.is_authenticated else None,
            action="PRICING_PLAN_UPDATED",
            entity_type="PricingPlan",
            entity_id=updated_plan.id,
            old_value=old_data,
            new_value=serializer.data,
            reason="تعديل خطة أسعار بواسطة المشرف العام",
        )

    def perform_destroy(self, instance):
        old_data = PricingPlanSerializer(instance).data
        plan_id = instance.id
        instance.delete()
        DetailedAuditLog.objects.create(
            actor=self.request.user if self.request.user.is_authenticated else None,
            action="PRICING_PLAN_DELETED",
            entity_type="PricingPlan",
            entity_id=plan_id,
            old_value=old_data,
            new_value={},
            reason="حذف خطة أسعار بواسطة المشرف العام",
        )


class SuperAdminCouponViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = CouponSerializer
    queryset = Coupon.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        coupon = serializer.save()
        DetailedAuditLog.objects.create(
            actor=self.request.user if self.request.user.is_authenticated else None,
            action="COUPON_CREATED",
            entity_type="Coupon",
            entity_id=coupon.id,
            old_value={},
            new_value=serializer.data,
            reason="كوبون خصم جديد أضيف بواسطة المشرف العام",
        )

    def perform_update(self, serializer):
        coupon = self.get_object()
        old_data = CouponSerializer(coupon).data
        updated_coupon = serializer.save()
        DetailedAuditLog.objects.create(
            actor=self.request.user if self.request.user.is_authenticated else None,
            action="COUPON_UPDATED",
            entity_type="Coupon",
            entity_id=updated_coupon.id,
            old_value=old_data,
            new_value=serializer.data,
            reason="تعديل كوبون خصم بواسطة المشرف العام",
        )

    def perform_destroy(self, instance):
        old_data = CouponSerializer(instance).data
        coupon_id = instance.id
        instance.delete()
        DetailedAuditLog.objects.create(
            actor=self.request.user if self.request.user.is_authenticated else None,
            action="COUPON_DELETED",
            entity_type="Coupon",
            entity_id=coupon_id,
            old_value=old_data,
            new_value={},
            reason="حذف كوبون خصم بواسطة المشرف العام",
        )


class SuperAdminChangeRequestViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = PricingChangeRequestSerializer
    queryset = PricingChangeRequest.objects.all().order_by("-created_at")

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        try:
            req = MakerCheckerService.approve_change_request(pk, request.user)
            return Response({"status": "approved", "request_id": req.id}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        change_req = self.get_object()
        if change_req.status != PricingChangeRequest.Status.PENDING:
            return Response({"detail": "Request is not PENDING."}, status=status.HTTP_400_BAD_REQUEST)
        change_req.status = PricingChangeRequest.Status.REJECTED
        change_req.save()
        return Response({"status": "rejected"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAdmin])
def super_admin_mrr_stats(request):
    """
    Returns Monthly Recurring Revenue (MRR) and active subscription stats for Super Admin dashboard.
    """
    active_subs = Subscription.objects.filter(status=SubscriptionStatusChoices.ACTIVE).select_related("plan")
    total_active_count = active_subs.count()

    monthly_mrr = active_subs.filter(billing_cycle="monthly").aggregate(total=Sum("price_at_subscription"))[
        "total"
    ] or Decimal("0.00")
    yearly_rev = active_subs.filter(billing_cycle="yearly").aggregate(total=Sum("price_at_subscription"))[
        "total"
    ] or Decimal("0.00")
    yearly_mrr = yearly_rev / Decimal("12.00")
    mrr = monthly_mrr + yearly_mrr

    plan_counts = {}
    for item in active_subs.values("plan__name").annotate(count=Count("id")):
        plan_counts[item["plan__name"]] = item["count"]

    return Response(
        {
            "mrr": str(mrr.quantize(Decimal("0.01"))),
            "total_active_subscriptions": total_active_count,
            "plan_breakdown": plan_counts,
        },
        status=status.HTTP_200_OK,
    )


class InstructorEarningsView(generics.GenericAPIView):
    """
    Returns revenue, net payout, platform fee split, and transactions for the logged-in instructor.
    Enforces strict permission isolation (instructors can only view their own earnings).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if getattr(user, "role", "") != "instructor" and not (user.is_staff or user.is_superuser):
            return Response({"detail": "Instructor access required."}, status=status.HTTP_403_FORBIDDEN)

        courses = Course.objects.filter(instructor=user).prefetch_related("enrollments")
        course_ids = list(courses.values_list("id", flat=True))

        wallet, _ = Wallet.objects.get_or_create(
            user=user, wallet_type=WalletTypeChoices.INSTRUCTOR, defaults={"currency": "EGP"}
        )

        # Query completed paid order items for instructor courses
        completed_items = OrderItem.objects.filter(
            course_id__in=course_ids, order__status=OrderStatusChoices.COMPLETED
        ).select_related("course")

        gross_revenue = completed_items.aggregate(total=Sum("price_at_purchase"))["total"] or Decimal("0.00")

        # If orders are empty (e.g. legacy/demo enrollments), calculate based on course list prices
        if gross_revenue == Decimal("0.00"):
            for c in courses:
                if c.price and c.price > Decimal("0.00"):
                    gross_revenue += Decimal(str(c.enrollments.count())) * c.price

        platform_commission_pct = 20.0
        instructor_share_pct = 80.0

        net_earnings = float(wallet.current_balance)
        available_balance = float(wallet.available_balance)
        pending_payout = float(wallet.pending_balance)

        transactions = []
        for c in courses[:20]:
            c_items = [it for it in completed_items if it.course_id == c.id]
            c_gross = sum((it.price_at_purchase for it in c_items), Decimal("0.00"))
            if c_gross == Decimal("0.00") and c.price and c.price > Decimal("0.00"):
                c_gross = Decimal(str(c.enrollments.count())) * c.price
            c_net = c_gross * (Decimal(str(instructor_share_pct)) / Decimal("100.00"))
            transactions.append(
                {
                    "id": c.id,
                    "course_title": c.title,
                    "student_count": c.enrollments.count(),
                    "gross_amount": float(c_gross),
                    "net_amount": float(c_net),
                    "date": c.created_at,
                }
            )

        return Response(
            {
                "currency": "EGP",
                "gross_revenue": float(gross_revenue),
                "net_earnings": round(net_earnings, 2),
                "available_balance": round(available_balance, 2),
                "pending_payout": round(pending_payout, 2),
                "platform_commission_pct": platform_commission_pct,
                "instructor_share_pct": instructor_share_pct,
                "recent_transactions": transactions,
                "wallet_id": wallet.id,
            }
        )


class InstructorCouponViewSet(viewsets.ModelViewSet):
    """
    Instructor Coupon Management (List, Create, Update, Delete Coupons for instructor's courses).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = CouponSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Coupon.objects.none()
        if user.role == "instructor" or user.is_staff or user.role in ("admin", "super_admin"):
            return Coupon.objects.all().order_by("-created_at")
        return Coupon.objects.none()

    def perform_create(self, serializer):
        if (
            self.request.user.role != "instructor"
            and not self.request.user.is_staff
            and self.request.user.role not in ("admin", "super_admin")
        ):
            raise PermissionError("Instructor permissions required.")
        serializer.save()


# ============================================================================
# PAYOUT REQUEST VIEWSETS & MAKER-CHECKER WORKFLOWS
# ============================================================================


class PayoutRequestViewSet(viewsets.ModelViewSet):
    """
    Payout Request management for Instructors and Centers.
    Enforces minimum 500 EGP, verifies available balance, and places amount on hold.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = PayoutRequestSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return PayoutRequest.objects.none()
        if getattr(self.request.user, "role", "") in ("admin", "super_admin"):
            return PayoutRequest.objects.all().select_related("user", "wallet").order_by("-created_at")
        return (
            PayoutRequest.objects.filter(user=self.request.user)
            .select_related("user", "wallet")
            .order_by("-created_at")
        )

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        amount = serializer.validated_data["amount"]
        role = getattr(user, "role", "instructor")
        if role == "instructor":
            wallet = get_instructor_wallet(user)
        elif role == "center":
            wallet = get_center_wallet(user)
        else:
            wallet = get_student_wallet(user)

        # Re-fetch with row lock
        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
        if wallet.available_balance < amount:
            raise serializers.ValidationError("الرصيد المتاح غير كافٍ لإتمام طلب السحب.")

        # Deduct from available balance immediately to prevent double spending
        wallet.available_balance -= amount
        wallet.current_balance -= amount
        wallet.save(update_fields=["available_balance", "current_balance", "updated_at"])

        serializer.save(user=user, wallet=wallet, status=PayoutStatusChoices.PENDING)


class SuperAdminPayoutViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Super Admin Payout Approval Queue with Maker-Checker security governance.
    """

    permission_classes = [IsAdmin]
    serializer_class = PayoutRequestSerializer
    queryset = PayoutRequest.objects.all().select_related("user", "wallet").order_by("-created_at")

    @action(detail=True, methods=["post"], url_path="approve")
    @transaction.atomic
    def approve_payout(self, request, pk=None):
        payout = self.get_object()
        if payout.status != PayoutStatusChoices.PENDING:
            return Response({"detail": "طلب السحب ليس في حالة قيد المراجعة."}, status=status.HTTP_400_BAD_REQUEST)

        # Maker-Checker security enforcement
        if payout.user == request.user:
            return Response(
                {"detail": "انتهاك معايير الحوكمة المالية: لا يمكنك اعتماد طلب السحب الخاص بك."},
                status=status.HTTP_403_FORBIDDEN,
            )

        payout.status = PayoutStatusChoices.APPROVED
        payout.processed_by = request.user
        payout.processed_at = timezone.now()
        payout.admin_notes = request.data.get("admin_notes", payout.admin_notes)
        payout.save(update_fields=["status", "processed_by", "processed_at", "admin_notes", "updated_at"])

        return Response({"status": "approved", "payout_id": payout.id})

    @action(detail=True, methods=["post"], url_path="reject")
    @transaction.atomic
    def reject_payout(self, request, pk=None):
        payout = self.get_object()
        if payout.status != PayoutStatusChoices.PENDING:
            return Response({"detail": "طلب السحب ليس في حالة قيد المراجعة."}, status=status.HTTP_400_BAD_REQUEST)

        # Refund money back to user wallet available balance
        wallet = Wallet.objects.select_for_update().get(pk=payout.wallet_id)
        wallet.available_balance += payout.amount
        wallet.current_balance += payout.amount
        wallet.save(update_fields=["available_balance", "current_balance", "updated_at"])

        payout.status = PayoutStatusChoices.REJECTED
        payout.processed_by = request.user
        payout.processed_at = timezone.now()
        payout.admin_notes = request.data.get("admin_notes", "تم رفض طلب السحب من الإدارة")
        payout.save(update_fields=["status", "processed_by", "processed_at", "admin_notes", "updated_at"])

        return Response({"status": "rejected", "payout_id": payout.id})

    @action(detail=True, methods=["post"], url_path="disburse")
    @transaction.atomic
    def disburse_payout(self, request, pk=None):
        payout = self.get_object()
        if payout.status not in (PayoutStatusChoices.PENDING, PayoutStatusChoices.APPROVED):
            return Response({"detail": "طلب السحب يجب أن يكون معتمداً قبل التحويل."}, status=status.HTTP_400_BAD_REQUEST)

        txn_ref = request.data.get("transaction_reference", f"DISB-{uuid.uuid4().hex[:10].upper()}")

        # Double entry ledger record
        wallet = Wallet.objects.select_for_update().get(pk=payout.wallet_id)
        wallet.withdrawn_balance += payout.amount
        wallet.save(update_fields=["withdrawn_balance", "updated_at"])

        platform_wallet = Wallet.objects.select_for_update().get(id=get_platform_wallet().id)
        platform_wallet.available_balance -= payout.amount
        platform_wallet.current_balance -= payout.amount
        platform_wallet.save(update_fields=["available_balance", "current_balance", "updated_at"])

        ledger = Ledger.objects.create(
            reference_id=f"PAYOUT_{payout.id}_{txn_ref}",
            description=f"Payout disbursement to {payout.user.email} via {payout.get_channel_display()}",
        )
        LedgerEntry.objects.create(
            ledger=ledger,
            wallet=wallet,
            entry_type=LedgerEntryType.DEBIT,
            amount=payout.amount,
        )
        LedgerEntry.objects.create(
            ledger=ledger,
            wallet=platform_wallet,
            entry_type=LedgerEntryType.CREDIT,
            amount=payout.amount,
        )

        payout.status = PayoutStatusChoices.DISBURSED
        payout.transaction_reference = txn_ref
        payout.processed_by = request.user
        payout.processed_at = timezone.now()
        payout.save(update_fields=["status", "transaction_reference", "processed_by", "processed_at", "updated_at"])

        return Response({"status": "disbursed", "payout_id": payout.id, "transaction_reference": txn_ref})


# ============================================================================
# Dynamic Custom Center Plan Wizard Quote & Checkout Views
# ============================================================================


class CustomPlanQuoteView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        students_count = max(10, int(request.data.get("students_count", 50) or 50))
        instructors_count = max(1, int(request.data.get("instructors_count", 2) or 2))
        selected_features = request.data.get("features", [])
        if not isinstance(selected_features, list):
            selected_features = []

        billing_cycle = request.data.get("billing_cycle", "monthly")

        # Feature pricing dictionary
        feature_costs = {
            "question_bank": {"label": "بنك الأسئلة الموحد", "monthly_cost": 150},
            "auto_grading": {"label": "التصحيح التلقائي المتقدم", "monthly_cost": 150},
            "drm_watermark": {"label": "حماية الفيديو بالعلامة المائية الديناميكية", "monthly_cost": 200},
            "attendance_reports": {"label": "تقارير الحضور وQR Code", "monthly_cost": 100},
        }

        base_monthly = 400
        student_unit_price = 12
        students_cost = students_count * student_unit_price

        # First 2 instructors free in base, extra instructors 80 EGP each
        extra_instructors = max(0, instructors_count - 2)
        instructors_cost = extra_instructors * 80

        features_cost = sum(feature_costs[f]["monthly_cost"] for f in selected_features if f in feature_costs)

        total_monthly = base_monthly + students_cost + instructors_cost + features_cost
        yearly_raw = total_monthly * 12
        yearly_discounted = round(yearly_raw * Decimal("0.80"), 2)  # 20% discount
        yearly_savings = round(yearly_raw - yearly_discounted, 2)

        return Response(
            {
                "billing_cycle": billing_cycle,
                "students_count": students_count,
                "instructors_count": instructors_count,
                "selected_features": selected_features,
                "breakdown": {
                    "base_platform_fee": base_monthly,
                    "students_fee": students_cost,
                    "student_unit_price": student_unit_price,
                    "extra_instructors_fee": instructors_cost,
                    "features_fee": features_cost,
                },
                "pricing": {
                    "monthly_total": total_monthly,
                    "yearly_total": yearly_discounted,
                    "yearly_monthly_equivalent": round(yearly_discounted / 12, 2),
                    "yearly_savings": yearly_savings,
                    "discount_percentage": 20,
                },
                "currency": "EGP",
            }
        )


class CenterQuotaSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted]

    def get(self, request, *args, **kwargs):
        from apps.finance.services.quota_enforcement import CenterQuotaEnforcementService

        center_profile = getattr(request.user, "center_profile", None)
        if not center_profile:
            return Response({"detail": "هذا الحساب ليس مسجلاً كمركز تعليمي."}, status=status.HTTP_403_FORBIDDEN)

        quotas = CenterQuotaEnforcementService.get_center_quotas(center_profile)
        return Response(quotas)


class CustomPlanCheckoutView(APIView):
    permission_classes = [IsAuthenticated, IsProfileCompleted]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        center_profile = getattr(request.user, "center_profile", None)
        if not center_profile:
            return Response(
                {"detail": "الاشتراك المخصص متاح فقط للمراكز التعليمية والسناتر."}, status=status.HTTP_403_FORBIDDEN
            )

        students_count = max(10, int(request.data.get("students_count", 50) or 50))
        instructors_count = max(1, int(request.data.get("instructors_count", 2) or 2))
        selected_features = request.data.get("features", [])
        billing_cycle = request.data.get("billing_cycle", "monthly")

        # Find or create Custom Enterprise PricingPlan
        plan, _ = PricingPlan.objects.get_or_create(
            slug="center-custom-enterprise",
            defaults={
                "name": "باقة السنتر المخصصة (Enterprise Custom)",
                "plan_type": PlanTypeChoices.CUSTOM,
                "price_monthly": Decimal("999.00"),
                "price_yearly": Decimal("9590.00"),
                "max_students": 500,
                "max_instructors": 10,
                "video_hours_per_student": 12,
                "is_active": True,
            },
        )

        features_dict = {f: True for f in selected_features}
        days = 365 if billing_cycle == "yearly" else 30
        end_time = timezone.now() + timezone.timedelta(days=days)

        # Create or update subscription
        sub, _ = Subscription.objects.update_or_create(
            user=request.user,
            defaults={
                "plan": plan,
                "price_at_subscription": Decimal("1500.00"),
                "currency_at_subscription": "EGP",
                "status": SubscriptionStatusChoices.ACTIVE,
                "billing_cycle": billing_cycle,
                "current_period_end": end_time,
                "custom_quota_students": students_count,
                "custom_quota_instructors": instructors_count,
                "custom_features": features_dict,
                "auto_renew": True,
            },
        )

        return Response(
            {
                "detail": "تم تفعيل باقة السنتر المخصصة وحصص الموارد بنجاح.",
                "subscription_id": sub.id,
                "plan_name": plan.name,
                "students_quota": students_count,
                "instructors_quota": instructors_count,
                "current_period_end": end_time,
                "features": features_dict,
            },
            status=status.HTTP_201_CREATED,
        )


class GatewayStatusView(APIView):
    """
    Public API returning active electronic payment gateways status.
    If Kashier credentials are not yet configured by Super Admin,
    returns status="coming_soon" and is_enabled=False.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        config_obj = PaymentGatewayConfig.objects.filter(gateway_name="kashier").first()
        is_enabled = config_obj.is_enabled if config_obj else False
        mode = config_obj.mode if config_obj else "test"
        status_text = "active" if is_enabled else "coming_soon"
        message = (
            "الدفع الإلكتروني عبر البطاقات البنكية متاح الآن."
            if is_enabled
            else "الدفع الإلكتروني عبر البطاقات البنكية قيد التفعيل حالياً ومتاح قريباً بعد استكمال اعتماد الحساب."
        )
        return Response({
            "gateway": "kashier",
            "is_enabled": is_enabled,
            "status": status_text,
            "mode": mode,
            "display_name": "كاشيير (Kashier)",
            "message": message,
        })


class SuperAdminGatewayConfigView(APIView):
    """
    Super Admin endpoint to inspect and configure electronic payment gateway parameters.
    Allows toggling active status, changing operating mode (test / live),
    and updating merchant_id, api_key, and iframe_key.
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        config_obj, _ = PaymentGatewayConfig.objects.get_or_create(
            gateway_name="kashier",
            defaults={"display_name": "Kashier Payment Gateway", "is_active": False, "mode": "test"},
        )
        return Response({
            "id": config_obj.id,
            "gateway_name": config_obj.gateway_name,
            "display_name": config_obj.display_name,
            "is_active": config_obj.is_active,
            "mode": config_obj.mode,
            "merchant_id": config_obj.merchant_id,
            "api_key": config_obj.api_key,
            "iframe_key": config_obj.iframe_key,
            "is_enabled": config_obj.is_enabled,
            "updated_at": config_obj.updated_at,
        })

    def patch(self, request):
        config_obj, _ = PaymentGatewayConfig.objects.get_or_create(
            gateway_name="kashier",
            defaults={"display_name": "Kashier Payment Gateway", "is_active": False, "mode": "test"},
        )
        if "is_active" in request.data:
            config_obj.is_active = bool(request.data["is_active"])
        if "mode" in request.data:
            val = str(request.data["mode"]).strip().lower()
            if val in ["test", "live"]:
                config_obj.mode = val
        if "merchant_id" in request.data:
            config_obj.merchant_id = str(request.data["merchant_id"]).strip()
        if "api_key" in request.data:
            config_obj.api_key = str(request.data["api_key"]).strip()
        if "iframe_key" in request.data:
            config_obj.iframe_key = str(request.data["iframe_key"]).strip()
        config_obj.save()

        return Response({
            "message": "تم حفظ وتحديث إعدادات بوابة الدفع الإلكتروني بنجاح.",
            "config": {
                "id": config_obj.id,
                "gateway_name": config_obj.gateway_name,
                "display_name": config_obj.display_name,
                "is_active": config_obj.is_active,
                "mode": config_obj.mode,
                "merchant_id": config_obj.merchant_id,
                "api_key": config_obj.api_key,
                "iframe_key": config_obj.iframe_key,
                "is_enabled": config_obj.is_enabled,
                "updated_at": config_obj.updated_at,
            },
        })

