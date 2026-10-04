import uuid
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import CenterProfile, UserRole
from apps.courses.models import Category, Course
from apps.enrollments.models import Enrollment
from apps.finance.models import (
    EscrowHolding,
    EscrowStatusChoices,
    InstructorContract,
    Ledger,
    LedgerEntry,
    LedgerEntryType,
    Order,
    OrderItem,
    OrderStatusChoices,
    RevenueModelChoices,
    Transaction,
    TransactionStatusChoices,
    Wallet,
    WalletTypeChoices,
)
from apps.finance.services import (
    PaymentProcessingError,
    calculate_revenue_splits,
    deposit_to_wallet,
    get_center_wallet,
    get_instructor_wallet,
    get_platform_wallet,
    get_student_wallet,
    pay_with_balance,
    process_payment,
)
from apps.finance.tasks import (
    process_escrow_settlements_task,
    settle_escrow_balances_task,
)
from apps.finance.tests.helpers import (
    FinancialDataFactory,
    LedgerTestHelper,
)

User = get_user_model()


@pytest.mark.django_db
class TestMultiWalletArchitecture:
    """
    Unit and integration tests for Multi-Wallet Architecture:
    - WalletTypeChoices (student, center, instructor, platform)
    - Balance non-negative CheckConstraints
    - Helper provisioning functions in services.py
    """

    def test_wallet_type_choices_supported(self):
        assert WalletTypeChoices.STUDENT == "student"
        assert WalletTypeChoices.CENTER == "center"
        assert WalletTypeChoices.INSTRUCTOR == "instructor"
        assert WalletTypeChoices.PLATFORM == "platform"

    def test_get_student_wallet_helper(self):
        student = FinancialDataFactory.create_student("stud_wallet_test@edusmart.com")
        wallet = get_student_wallet(student)
        assert wallet.user == student
        assert wallet.wallet_type == WalletTypeChoices.STUDENT
        assert wallet.currency == "EGP"
        assert wallet.available_balance == Decimal("0.00")
        assert wallet.pending_balance == Decimal("0.00")
        assert wallet.current_balance == Decimal("0.00")

        # Calling again returns same wallet
        wallet_again = get_student_wallet(student)
        assert wallet_again.id == wallet.id

    def test_get_center_wallet_helper(self):
        center_user = FinancialDataFactory.create_center_admin("center_wallet_test@edusmart.com")
        center_profile = center_user.center_profile

        # From user
        wallet1 = get_center_wallet(center_user)
        assert wallet1.user == center_user
        assert wallet1.wallet_type == WalletTypeChoices.CENTER

        # From profile
        wallet2 = get_center_wallet(center_profile)
        assert wallet2.id == wallet1.id

    def test_get_instructor_wallet_helper(self):
        instructor = FinancialDataFactory.create_instructor("instr_wallet_test@edusmart.com")
        wallet = get_instructor_wallet(instructor)
        assert wallet.user == instructor
        assert wallet.wallet_type == WalletTypeChoices.INSTRUCTOR

    def test_get_platform_wallet_helper(self):
        p_wallet1 = get_platform_wallet()
        assert p_wallet1.wallet_type == WalletTypeChoices.PLATFORM
        assert p_wallet1.user is None

        p_wallet2 = get_platform_wallet()
        assert p_wallet2.id == p_wallet1.id

    def test_wallet_non_negative_balance_constraints(self):
        student = FinancialDataFactory.create_student("constraint_test@edusmart.com")
        wallet = get_student_wallet(student)

        # Available balance < 0 must fail CheckConstraint
        with pytest.raises((IntegrityError, Exception)):
            with transaction.atomic():
                wallet.available_balance = Decimal("-10.00")
                wallet.save()

        wallet.refresh_from_db()
        assert wallet.available_balance >= Decimal("0.00")

        # Current balance < 0 must fail
        with pytest.raises((IntegrityError, Exception)):
            with transaction.atomic():
                wallet.current_balance = Decimal("-50.00")
                wallet.save()

        wallet.refresh_from_db()
        assert wallet.current_balance >= Decimal("0.00")

        # Pending balance < 0 must fail
        with pytest.raises((IntegrityError, Exception)):
            with transaction.atomic():
                wallet.pending_balance = Decimal("-5.00")
                wallet.save()

        wallet.refresh_from_db()
        assert wallet.pending_balance >= Decimal("0.00")

        # Withdrawn balance < 0 must fail
        with pytest.raises((IntegrityError, Exception)):
            with transaction.atomic():
                wallet.withdrawn_balance = Decimal("-100.00")
                wallet.save()


@pytest.mark.django_db
class TestDoubleEntryFinancialLedger:
    """
    Verifies double-entry ledger invariants across all financial operations:
    - sum(debits) == sum(credits) for each Ledger transaction
    - Pessimistic locking (select_for_update) inside atomic transactions
    """

    def setup_method(self):
        self.student = FinancialDataFactory.create_student("de_student@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("de_instructor@edusmart.com", revenue_percentage=Decimal("80.00"))
        self.course = FinancialDataFactory.create_course(instructor=self.instructor, price=Decimal("600.00"), title="Double Entry Physics")

    def test_course_purchase_double_entry_balance(self):
        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("600.00"),
            total=Decimal("600.00"),
        )
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("600.00"))

        idemp_key = f"de_test_order_{order.id}_{uuid.uuid4().hex[:6]}"
        txn = process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref="kashier_txn_600",
            amount_paid=Decimal("600.00"),
            idempotency_key=idemp_key,
        )

        assert txn.status == TransactionStatusChoices.SUCCESS
        order.refresh_from_db()
        assert order.status == OrderStatusChoices.COMPLETED

        # Check Ledger invariant
        ledger = Ledger.objects.get(reference_id=f"ORDER_{order.id}_PAYMENT")
        LedgerTestHelper.assert_ledger_balanced(ledger)

        # Platform Wallet: gets 600 - 480 instructor cut = 120 net
        platform_wallet = get_platform_wallet()
        LedgerTestHelper.assert_wallet_balances(
            platform_wallet,
            current=Decimal("120.00"),
            available=Decimal("120.00"),
        )

        # Instructor Wallet: credited 480 pending
        instructor_wallet = get_instructor_wallet(self.instructor)
        LedgerTestHelper.assert_wallet_balances(
            instructor_wallet,
            current=Decimal("480.00"),
            pending=Decimal("480.00"),
            available=Decimal("0.00"),
        )

        # EscrowHolding created
        holding = EscrowHolding.objects.get(order=order)
        assert holding.amount == Decimal("480.00")
        assert holding.status == EscrowStatusChoices.HELD
        assert holding.wallet == instructor_wallet

    def test_multi_item_order_multiple_instructors_double_entry(self):
        instructor_2 = FinancialDataFactory.create_instructor("de_instructor_2@edusmart.com", revenue_percentage=Decimal("70.00"))
        course_2 = FinancialDataFactory.create_course(instructor=instructor_2, price=Decimal("400.00"), title="Double Entry Chemistry")

        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("1000.00"),
            total=Decimal("1000.00"),
        )
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("600.00"))  # 80% = 480
        OrderItem.objects.create(order=order, course=course_2, price_at_purchase=Decimal("400.00"))     # 70% = 280

        idemp_key = f"multi_item_order_{order.id}_{uuid.uuid4().hex[:6]}"
        process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref="kashier_multi_1000",
            amount_paid=Decimal("1000.00"),
            idempotency_key=idemp_key,
        )

        ledger = Ledger.objects.get(reference_id=f"ORDER_{order.id}_PAYMENT")
        LedgerTestHelper.assert_ledger_balanced(ledger)

        # Total platform net = 1000 - 480 - 280 = 240
        platform_wallet = get_platform_wallet()
        assert platform_wallet.available_balance == Decimal("240.00")

        # Instructor 1 pending = 480
        w1 = get_instructor_wallet(self.instructor)
        assert w1.pending_balance == Decimal("480.00")

        # Instructor 2 pending = 280
        w2 = get_instructor_wallet(instructor_2)
        assert w2.pending_balance == Decimal("280.00")

        # Two escrow holdings created
        holdings = EscrowHolding.objects.filter(order=order)
        assert holdings.count() == 2

    def test_direct_wallet_deposit_double_entry(self):
        student_wallet = get_student_wallet(self.student)
        assert student_wallet.available_balance == Decimal("0.00")

        ledger = deposit_to_wallet(student_wallet, Decimal("350.00"), gateway_name="vodafone_cash")
        LedgerTestHelper.assert_ledger_balanced(ledger)

        student_wallet.refresh_from_db()
        assert student_wallet.available_balance == Decimal("350.00")
        assert student_wallet.current_balance == Decimal("350.00")

    def test_pay_with_balance_double_entry(self):
        student_wallet = get_student_wallet(self.student)
        deposit_to_wallet(student_wallet, Decimal("800.00"))

        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("600.00"),
            total=Decimal("600.00"),
        )
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("600.00"))

        txn = pay_with_balance(self.student, order)
        assert txn.status == TransactionStatusChoices.SUCCESS

        ledger = Ledger.objects.get(reference_id=f"WALLET_PAY_{order.id}")
        LedgerTestHelper.assert_ledger_balanced(ledger)

        # Student remaining: 800 - 600 = 200
        student_wallet.refresh_from_db()
        assert student_wallet.available_balance == Decimal("200.00")

        # Instructor pending: 480
        instructor_wallet = get_instructor_wallet(self.instructor)
        assert instructor_wallet.pending_balance == Decimal("480.00")

        # Student enrolled
        assert Enrollment.objects.filter(student=self.student, course=self.course).exists()

    def test_pay_with_balance_insufficient_funds_rejected(self):
        student_wallet = get_student_wallet(self.student)
        deposit_to_wallet(student_wallet, Decimal("100.00"))

        order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("600.00"),
            total=Decimal("600.00"),
        )
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("600.00"))

        with pytest.raises(PaymentProcessingError):
            pay_with_balance(self.student, order)

        student_wallet.refresh_from_db()
        assert student_wallet.available_balance == Decimal("100.00")


@pytest.mark.django_db
class TestInstructorContractRevenueSplits:
    """
    Tests revenue split calculations across contract models:
    - PERCENTAGE
    - FIXED_FEE
    - HYBRID
    - Fallback 80/20 for uncontracted or expired agreements
    """

    def setup_method(self):
        self.student = FinancialDataFactory.create_student("split_student@edusmart.com")

    def test_percentage_contract_split(self):
        instructor = FinancialDataFactory.create_instructor("pct_instr@edusmart.com", revenue_percentage=Decimal("75.00"))
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("400.00"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("400.00"), total=Decimal("400.00"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("400.00"))

        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("300.00")

    def test_fixed_fee_contract_split(self):
        instructor = User.objects.create_user(
            email="fixed_instr@edusmart.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.FIXED_FEE,
            minimum_guarantee=Decimal("150.00"),
            is_active=True,
        )
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("500.00"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("500.00"), total=Decimal("500.00"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("500.00"))

        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("150.00")

    def test_hybrid_contract_split(self):
        instructor = User.objects.create_user(
            email="hybrid_instr@edusmart.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.HYBRID,
            revenue_percentage=Decimal("60.00"),
            minimum_guarantee=Decimal("200.00"),
            is_active=True,
        )
        course_low = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("250.00"))
        course_high = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("500.00"))

        # For low course: 60% of 250 = 150 < guarantee 200 -> cut is 200
        order_low = Order.objects.create(student=self.student, subtotal=Decimal("250.00"), total=Decimal("250.00"))
        OrderItem.objects.create(order=order_low, course=course_low, price_at_purchase=Decimal("250.00"))
        splits_low = calculate_revenue_splits(order_low)
        assert splits_low[instructor.id]["amount"] == Decimal("200.00")

        # For high course: 60% of 500 = 300 > guarantee 200 -> cut is 300
        order_high = Order.objects.create(student=self.student, subtotal=Decimal("500.00"), total=Decimal("500.00"))
        OrderItem.objects.create(order=order_high, course=course_high, price_at_purchase=Decimal("500.00"))
        splits_high = calculate_revenue_splits(order_high)
        assert splits_high[instructor.id]["amount"] == Decimal("300.00")

    def test_uncontracted_or_expired_fallback_split(self):
        # Instructor with expired contract
        instructor = User.objects.create_user(
            email="expired_instr@edusmart.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.PERCENTAGE,
            revenue_percentage=Decimal("90.00"),
            valid_to=timezone.now().date() - timedelta(days=1),
            is_active=True,
        )
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("500.00"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("500.00"), total=Decimal("500.00"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("500.00"))

        # Falls back to default 80% (400 EGP) instead of expired 90% (450 EGP)
        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("400.00")

    def test_fixed_fee_contract_capped_at_purchase_price(self):
        instructor = User.objects.create_user(
            email="fixed_cap_instr@edusmart.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.FIXED_FEE,
            minimum_guarantee=Decimal("500.00"),
            is_active=True,
        )
        # Course price is 300 EGP, guarantee is 500 EGP -> cut must be capped at 300.00 EGP
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("300.00"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("300.00"), total=Decimal("300.00"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("300.00"))

        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("300.00")

    def test_fixed_fee_contract_zero_guarantee_fallback(self):
        instructor = User.objects.create_user(
            email="fixed_zero_instr@edusmart.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.FIXED_FEE,
            minimum_guarantee=Decimal("0.00"),
            is_active=True,
        )
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("400.00"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("400.00"), total=Decimal("400.00"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("400.00"))

        # Zero guarantee falls back to 80% default (320 EGP)
        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("320.00")

    def test_hybrid_contract_capped_at_purchase_price(self):
        instructor = User.objects.create_user(
            email="hybrid_cap_instr@edusmart.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.HYBRID,
            revenue_percentage=Decimal("50.00"),
            minimum_guarantee=Decimal("300.00"),
            is_active=True,
        )
        # Course price 200 EGP < guarantee 300 EGP -> cut capped at 200 EGP
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("200.00"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("200.00"), total=Decimal("200.00"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("200.00"))

        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("200.00")

    def test_inactive_contract_fallback_split(self):
        instructor = User.objects.create_user(
            email="inactive_instr@edusmart.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.PERCENTAGE,
            revenue_percentage=Decimal("95.00"),
            is_active=False,
        )
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("500.00"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("500.00"), total=Decimal("500.00"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("500.00"))

        # Inactive contract falls back to 80% (400 EGP)
        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("400.00")

    def test_future_contract_fallback_split(self):
        instructor = User.objects.create_user(
            email="future_instr@edusmart.com",
            password="Password123!",
            role=UserRole.INSTRUCTOR,
        )
        InstructorContract.objects.create(
            instructor=instructor,
            revenue_model=RevenueModelChoices.PERCENTAGE,
            revenue_percentage=Decimal("90.00"),
            valid_from=timezone.now().date() + timedelta(days=30),
            is_active=True,
        )
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("500.00"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("500.00"), total=Decimal("500.00"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("500.00"))

        # Future contract not yet valid -> falls back to 80% (400 EGP)
        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("400.00")

    def test_fractional_decimal_percentage_rounding(self):
        instructor = FinancialDataFactory.create_instructor("fraction_instr@edusmart.com", revenue_percentage=Decimal("73.50"))
        course = FinancialDataFactory.create_course(instructor=instructor, price=Decimal("199.99"))

        order = Order.objects.create(student=self.student, subtotal=Decimal("199.99"), total=Decimal("199.99"))
        OrderItem.objects.create(order=order, course=course, price_at_purchase=Decimal("199.99"))

        # 199.99 * 0.735 = 146.99265 -> ROUND_HALF_UP -> 146.99
        splits = calculate_revenue_splits(order)
        assert splits[instructor.id]["amount"] == Decimal("146.99")



@pytest.mark.django_db
class TestEscrowHoldingAndSettlementTask:
    """
    Tests 14-Day Escrow Holding Engine:
    - Holding creation on sale
    - Non-release before maturity (14 days)
    - Release and wallet fund transition after maturity
    - Skipping of refunded orders
    - Celery task execution
    """

    def setup_method(self):
        self.student = FinancialDataFactory.create_student("escrow_student@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("escrow_instructor@edusmart.com", revenue_percentage=Decimal("80.00"))
        self.course = FinancialDataFactory.create_course(instructor=self.instructor, price=Decimal("1000.00"))

        self.order = Order.objects.create(
            student=self.student,
            status=OrderStatusChoices.PENDING,
            subtotal=Decimal("1000.00"),
            total=Decimal("1000.00"),
        )
        self.item = OrderItem.objects.create(order=self.order, course=self.course, price_at_purchase=Decimal("1000.00"))

        process_payment(
            order=self.order,
            gateway_name="kashier",
            gateway_ref="kashier_escrow_1000",
            amount_paid=Decimal("1000.00"),
            idempotency_key=f"escrow_key_{uuid.uuid4().hex[:6]}",
        )

        self.instructor_wallet = get_instructor_wallet(self.instructor)

    def test_escrow_holding_created_with_14_day_maturity(self):
        holding = EscrowHolding.objects.get(order=self.order)
        assert holding.status == EscrowStatusChoices.HELD
        assert holding.amount == Decimal("800.00")
        assert holding.mature_at > timezone.now() + timedelta(days=13)
        assert holding.wallet == self.instructor_wallet

        # Wallet balances before maturity
        LedgerTestHelper.assert_wallet_balances(
            self.instructor_wallet,
            current=Decimal("800.00"),
            pending=Decimal("800.00"),
            available=Decimal("0.00"),
        )

    def test_escrow_task_does_not_settle_unmatured_holdings(self):
        res = process_escrow_settlements_task()
        assert res["settled_count"] == 0

        holding = EscrowHolding.objects.get(order=self.order)
        assert holding.status == EscrowStatusChoices.HELD

        self.instructor_wallet.refresh_from_db()
        assert self.instructor_wallet.pending_balance == Decimal("800.00")
        assert self.instructor_wallet.available_balance == Decimal("0.00")

    def test_escrow_task_settles_matured_holdings(self):
        holding = EscrowHolding.objects.get(order=self.order)
        # Advance maturity date to past
        holding.mature_at = timezone.now() - timedelta(minutes=10)
        holding.save(update_fields=["mature_at"])

        res = process_escrow_settlements_task()
        assert res["settled_count"] >= 1
        assert Decimal(res["total_settled_amount"]) >= Decimal("800.00")

        holding.refresh_from_db()
        assert holding.status == EscrowStatusChoices.RELEASED
        assert holding.settled_at is not None
        assert holding.ledger is not None

        # Ledger invariant on escrow release
        LedgerTestHelper.assert_ledger_balanced(holding.ledger)

        # Funds transitioned to available_balance
        self.instructor_wallet.refresh_from_db()
        LedgerTestHelper.assert_wallet_balances(
            self.instructor_wallet,
            current=Decimal("800.00"),
            pending=Decimal("0.00"),
            available=Decimal("800.00"),
        )

    def test_escrow_task_skips_refunded_orders(self):
        holding = EscrowHolding.objects.get(order=self.order)
        holding.mature_at = timezone.now() - timedelta(minutes=10)
        holding.save(update_fields=["mature_at"])

        # Mark order refunded
        self.order.status = OrderStatusChoices.REFUNDED
        self.order.save(update_fields=["status"])

        res = process_escrow_settlements_task()
        assert res["settled_count"] == 0

        holding.refresh_from_db()
        assert holding.status == EscrowStatusChoices.REFUNDED

        # Available balance was NOT credited
        self.instructor_wallet.refresh_from_db()
        assert self.instructor_wallet.available_balance == Decimal("0.00")

    def test_settle_escrow_balances_task_alias(self):
        holding = EscrowHolding.objects.get(order=self.order)
        holding.mature_at = timezone.now() - timedelta(minutes=10)
        holding.save(update_fields=["mature_at"])

        res = settle_escrow_balances_task()
        assert res["settled_count"] >= 1

    def test_escrow_holding_exact_14_day_duration(self):
        holding = EscrowHolding.objects.get(order=self.order)
        # Verify delta between mature_at and created_at is exactly 14 days (within 2 seconds)
        delta = holding.mature_at - holding.created_at
        assert abs(delta.total_seconds() - 14 * 86400) < 2
        assert holding.status == EscrowStatusChoices.HELD

    def test_multi_item_same_instructor_escrow_holdings(self):
        course_extra = FinancialDataFactory.create_course(instructor=self.instructor, price=Decimal("500.00"), title="Physics Lab")
        order = Order.objects.create(student=self.student, status=OrderStatusChoices.PENDING, subtotal=Decimal("1500.00"), total=Decimal("1500.00"))
        OrderItem.objects.create(order=order, course=self.course, price_at_purchase=Decimal("1000.00"))  # 800
        OrderItem.objects.create(order=order, course=course_extra, price_at_purchase=Decimal("500.00"))   # 400

        process_payment(
            order=order,
            gateway_name="kashier",
            gateway_ref="kashier_multi_same_instr",
            amount_paid=Decimal("1500.00"),
            idempotency_key=f"multi_same_{uuid.uuid4().hex[:6]}",
        )

        holdings = EscrowHolding.objects.filter(order=order)
        assert holdings.count() == 2
        assert set(h.amount for h in holdings) == {Decimal("800.00"), Decimal("400.00")}
        assert all(h.status == EscrowStatusChoices.HELD for h in holdings)

    def test_escrow_task_idempotency_multiple_executions(self):
        holding = EscrowHolding.objects.get(order=self.order)
        holding.mature_at = timezone.now() - timedelta(minutes=10)
        holding.save(update_fields=["mature_at"])

        # First run: settles
        res1 = process_escrow_settlements_task()
        assert res1["settled_count"] >= 1

        self.instructor_wallet.refresh_from_db()
        avail_after_first = self.instructor_wallet.available_balance

        # Second run: does not re-settle or double credit
        res2 = process_escrow_settlements_task()
        assert res2["settled_count"] == 0

        self.instructor_wallet.refresh_from_db()
        assert self.instructor_wallet.available_balance == avail_after_first

    def test_escrow_release_preserves_wallet_non_negative_invariants(self):
        holding = EscrowHolding.objects.get(order=self.order)
        holding.mature_at = timezone.now() - timedelta(minutes=10)
        holding.save(update_fields=["mature_at"])

        # Artificially simulate partial clawback on pending balance
        self.instructor_wallet.pending_balance = Decimal("200.00")
        self.instructor_wallet.save(update_fields=["pending_balance"])

        res = process_escrow_settlements_task()
        assert res["settled_count"] >= 1

        self.instructor_wallet.refresh_from_db()
        assert self.instructor_wallet.pending_balance == Decimal("0.00")
        assert self.instructor_wallet.available_balance == Decimal("200.00")

    def test_premature_execution_defense_boundary(self):
        holding = EscrowHolding.objects.get(order=self.order)
        # Set mature_at to 5 seconds in future
        holding.mature_at = timezone.now() + timedelta(seconds=5)
        holding.save(update_fields=["mature_at"])

        res = process_escrow_settlements_task()
        assert res["settled_count"] == 0

        holding.refresh_from_db()
        assert holding.status == EscrowStatusChoices.HELD
        assert holding.settled_at is None



@pytest.mark.django_db
class TestWalletAPIEndpoints:
    """
    REST API verification for Wallet endpoints:
    - GET /api/v1/finance/wallets/my-wallet/
    - GET /api/v1/finance/wallets/ledger/
    - GET /api/v1/finance/wallets/<id>/entries/
    - POST /api/v1/finance/wallets/pay-with-balance/
    - POST /api/v1/finance/wallets/top-up/
    - GET /api/v1/finance/wallets/escrow/
    """

    def setup_method(self):
        self.client = APIClient()
        self.student = FinancialDataFactory.create_student("api_student@edusmart.com")
        self.instructor = FinancialDataFactory.create_instructor("api_instructor@edusmart.com", revenue_percentage=Decimal("80.00"))
        self.center_user = FinancialDataFactory.create_center_admin("api_center@edusmart.com")
        self.super_admin = FinancialDataFactory.create_super_admin("api_admin@edusmart.com")

        self.course = FinancialDataFactory.create_course(instructor=self.instructor, price=Decimal("300.00"))

    def test_my_wallet_endpoint_for_student(self):
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:user-wallets-my-wallet")
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["wallet_type"] == "student"
        assert res.data["currency"] == "EGP"
        assert Decimal(res.data["available_balance"]) == Decimal("0.00")

    def test_my_wallet_endpoint_for_instructor(self):
        self.client.force_authenticate(user=self.instructor)
        url = reverse("v1:user-wallets-my-wallet")
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["wallet_type"] == "instructor"

    def test_my_wallet_endpoint_for_center(self):
        self.client.force_authenticate(user=self.center_user)
        url = reverse("v1:user-wallets-my-wallet")
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["wallet_type"] == "center"

    def test_wallet_top_up_api_endpoint(self):
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:user-wallets-top-up-wallet")
        res = self.client.post(url, {"amount": "500.00", "gateway": "vodafone_cash"})
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["status"] == "checkout_created"
        assert Decimal(res.data["amount"]) == Decimal("500.00")
        assert "checkout_url" in res.data

    def test_wallet_pay_with_balance_api_endpoint(self):
        student_wallet = get_student_wallet(self.student)
        deposit_to_wallet(student_wallet, Decimal("600.00"))

        self.client.force_authenticate(user=self.student)
        url = reverse("v1:user-wallets-pay-with-balance-view")
        res = self.client.post(url, {"course_id": self.course.id})

        assert res.status_code == status.HTTP_200_OK
        assert res.data["status"] == "paid_with_balance"
        assert Decimal(res.data["remaining_balance"]) == Decimal("300.00")
        assert res.data["enrolled"] is True

        assert Enrollment.objects.filter(student=self.student, course=self.course).exists()

    def test_wallet_ledger_endpoint(self):
        student_wallet = get_student_wallet(self.student)
        deposit_to_wallet(student_wallet, Decimal("400.00"))

        self.client.force_authenticate(user=self.student)
        url = reverse("v1:user-wallets-ledger")
        res = self.client.get(url)

        assert res.status_code == status.HTTP_200_OK
        results = res.data.get("results", res.data)
        assert len(results) >= 1
        assert any(entry["entry_type"] == "credit" for entry in results)

    def test_wallet_entries_by_id_endpoint_and_permissions(self):
        student_wallet = get_student_wallet(self.student)
        deposit_to_wallet(student_wallet, Decimal("200.00"))

        # Owner can access
        self.client.force_authenticate(user=self.student)
        url = reverse("v1:user-wallets-entries", kwargs={"pk": student_wallet.id})
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK

        # Another student gets 403 or 404
        other_student = FinancialDataFactory.create_student("other_stud@edusmart.com")
        self.client.force_authenticate(user=other_student)
        res2 = self.client.get(url)
        assert res2.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

        # Super admin can access
        self.client.force_authenticate(user=self.super_admin)
        res3 = self.client.get(url)
        assert res3.status_code == status.HTTP_200_OK

    def test_instructor_earnings_returns_true_zero_database_balances_for_new_instructor(self):
        """
        Verifies InstructorEarningsView returns true 0.00 database wallet balances
        without synthetic 85%/15% fallback overrides (Constitution Rule 12 & M2 Integrity).
        """
        new_instructor = FinancialDataFactory.create_instructor("fresh_instr@edusmart.com")
        self.client.force_authenticate(user=new_instructor)

        url = reverse("v1:finance-instructor-earnings")
        res = self.client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert res.data["currency"] == "EGP"
        assert res.data["net_earnings"] == 0.0
        assert res.data["available_balance"] == 0.0
        assert res.data["pending_payout"] == 0.0
