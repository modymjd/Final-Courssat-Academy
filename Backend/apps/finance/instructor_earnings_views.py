from collections import defaultdict
from decimal import Decimal

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    EscrowHolding,
    EscrowStatusChoices,
    OrderStatusChoices,
    Wallet,
    WalletTypeChoices,
)


class InstructorAuthoritativeEarningsView(generics.GenericAPIView):
    """Read instructor earnings from recorded financial allocations only.

    Enrollment counts and current course prices are deliberately not used as a
    substitute for a paid order. A missing allocation therefore produces zero,
    not a fabricated revenue estimate.
    """

    permission_classes = [IsAuthenticated]

    VALID_STATUSES = {EscrowStatusChoices.HELD, EscrowStatusChoices.RELEASED}

    def get(self, request):
        user = request.user
        if getattr(user, "role", "") != "instructor" and not (user.is_staff or user.is_superuser):
            return Response({"detail": "Instructor access required."}, status=status.HTTP_403_FORBIDDEN)

        holdings = (
            EscrowHolding.objects.filter(
                wallet__user=user,
                order__status=OrderStatusChoices.COMPLETED,
                order_item__isnull=False,
                status__in=self.VALID_STATUSES,
            )
            .select_related("order", "order_item__course", "order__student")
            .order_by("-order__created_at", "-id")
        )

        # An order item should represent one instructor allocation. Deduplicate
        # defensively so a historical duplicate escrow row cannot inflate figures.
        allocation_by_item = {}
        for holding in holdings:
            item_id = holding.order_item_id
            current = allocation_by_item.get(item_id)
            if current is None:
                allocation_by_item[item_id] = holding
            elif current.status == EscrowStatusChoices.HELD and holding.status == EscrowStatusChoices.RELEASED:
                allocation_by_item[item_id] = holding

        effective_holdings = list(allocation_by_item.values())
        gross_revenue = sum(
            (holding.order_item.price_at_purchase for holding in effective_holdings), Decimal("0.00")
        )
        net_earnings = sum((holding.amount for holding in effective_holdings), Decimal("0.00"))
        pending_earnings = sum(
            (holding.amount for holding in effective_holdings if holding.status == EscrowStatusChoices.HELD),
            Decimal("0.00"),
        )
        released_earnings = sum(
            (holding.amount for holding in effective_holdings if holding.status == EscrowStatusChoices.RELEASED),
            Decimal("0.00"),
        )

        by_course = defaultdict(
            lambda: {
                "students": set(),
                "gross": Decimal("0.00"),
                "net": Decimal("0.00"),
                "date": None,
                "title": "",
            }
        )
        for holding in effective_holdings:
            item = holding.order_item
            course = item.course
            entry = by_course[course.id]
            entry["title"] = course.title
            entry["students"].add(holding.order.student_id)
            entry["gross"] += item.price_at_purchase
            entry["net"] += holding.amount
            order_date = holding.order.created_at
            if entry["date"] is None or order_date > entry["date"]:
                entry["date"] = order_date

        recent_transactions = [
            {
                "id": course_id,
                "course_title": data["title"],
                "student_count": len(data["students"]),
                "gross_amount": float(data["gross"].quantize(Decimal("0.01"))),
                "net_amount": float(data["net"].quantize(Decimal("0.01"))),
                "date": data["date"],
            }
            for course_id, data in sorted(by_course.items(), key=lambda item: item[1]["date"], reverse=True)[:20]
        ]

        wallet = Wallet.objects.filter(user=user, wallet_type=WalletTypeChoices.INSTRUCTOR).first()
        available_balance = wallet.available_balance if wallet else Decimal("0.00")
        pending_payout = wallet.pending_balance if wallet else Decimal("0.00")

        commission = gross_revenue - net_earnings
        commission_pct = (commission / gross_revenue * Decimal("100")) if gross_revenue > 0 else None
        share_pct = (net_earnings / gross_revenue * Decimal("100")) if gross_revenue > 0 else None

        return Response(
            {
                "currency": wallet.currency if wallet else "EGP",
                "gross_revenue": float(gross_revenue.quantize(Decimal("0.01"))),
                "net_earnings": float(net_earnings.quantize(Decimal("0.01"))),
                "available_balance": float(available_balance.quantize(Decimal("0.01"))),
                "pending_payout": float(pending_payout.quantize(Decimal("0.01"))),
                "released_earnings": float(released_earnings.quantize(Decimal("0.01"))),
                "pending_earnings": float(pending_earnings.quantize(Decimal("0.01"))),
                "platform_commission_pct": (
                    float(commission_pct.quantize(Decimal("0.01"))) if commission_pct is not None else None
                ),
                "instructor_share_pct": (
                    float(share_pct.quantize(Decimal("0.01"))) if share_pct is not None else None
                ),
                "recent_transactions": recent_transactions,
                "wallet_id": wallet.id if wallet else None,
                "allocation_count": len(effective_holdings),
            }
        )
