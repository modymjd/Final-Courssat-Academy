import math
from datetime import date
from typing import Literal, TypedDict


class PricingBreakdown(TypedDict):
    student_count: int
    student_tiers: int
    monthly_base_price: float
    student_unit_price: float
    plan_type: str
    plan_type_label: str
    calculated_months: int
    start_month: int
    start_year: int
    end_date: str
    gross_amount: float
    discount_percentage: int
    discount_amount: float
    net_total: float
    currency: str


class AcademicPricingEngine:
    """Academic Dynamic Pricing Engine for Courssat Academy Platform.

    Academic Calendar:
    - Academic Year: August (Month 8) -> June (Month 6 of following year) = 11 months total.
    - Term 1: August (Month 8) -> December (Month 12) = up to 5 months.
    - Term 2: February (Month 2) -> June (Month 6) = up to 5 months.
    - January / July: Transition months.

    Pricing Tiers:
    - Base Rate: Every 100 students = 3,000 EGP / month (30 EGP / student within tier).
    - Monthly Base Price = ceil(students / 100) * 3000.

    Discounts:
    - Monthly: 0% discount (1 month).
    - Term Plan: 10% discount (remaining months of the term).
    - Full Academic Year: 15% discount (remaining months until end of June).
    """

    PRICE_PER_100_STUDENTS_MONTHLY = 3000.0
    STUDENTS_PER_TIER = 100

    @classmethod
    def get_remaining_term_months(cls, month: int) -> int:
        """
        Calculates remaining months for the active academic term.
        - Term 1: Months 8 to 12 (Aug -> Dec)
        - Term 2: Months 2 to 6 (Feb -> Jun)
        - Months 1, 7 handled gracefully.
        """
        if month in [8, 9, 10, 11, 12]:
            # Term 1: August (5), September (4), October (3), November (2), December (1)
            return 12 - month + 1
        elif month in [2, 3, 4, 5, 6]:
            # Term 2: February (5), March (4), April (3), May (2), June (1)
            return 6 - month + 1
        elif month == 1:
            # January: 1 month transition or prep for Term 2 (5 months)
            return 5
        else:  # month == 7 (July)
            # July: Early registration for Term 1 (5 months)
            return 5

    @classmethod
    def get_remaining_year_months(cls, month: int) -> int:
        """
        Calculates remaining months until the end of the academic year (end of June).
        """
        if month in [8, 9, 10, 11, 12]:
            # From Aug (11) down to Dec (7)
            # Months remaining = (12 - month + 1) in current year + 6 months in next year
            return (12 - month + 1) + 6
        elif month == 1:
            return 6  # Jan to Jun = 6 months
        elif month in [2, 3, 4, 5, 6]:
            # Feb (5) down to Jun (1)
            return 6 - month + 1
        else:  # month == 7 (July)
            # July: Early bird for upcoming full academic year (11 months)
            return 11

    @classmethod
    def get_target_end_date(cls, plan_type: str, start_d: date) -> date:
        """
        Calculates the exact calendar end date for the plan.
        """
        month = start_d.month
        year = start_d.year

        if plan_type == "monthly":
            # 30 days or next month same day
            if month == 12:
                return date(year + 1, 1, min(start_d.day, 28))
            else:
                return date(year, month + 1, min(start_d.day, 28))

        elif plan_type == "term":
            if month in [8, 9, 10, 11, 12]:
                # End of Term 1 -> December 31
                return date(year, 12, 31)
            elif month in [2, 3, 4, 5, 6]:
                # End of Term 2 -> June 30
                return date(year, 6, 30)
            elif month == 1:
                # End of Term 2 -> June 30
                return date(year, 6, 30)
            else:  # month == 7
                # Prep for Term 1 -> Dec 31
                return date(year, 12, 31)

        else:  # full_year
            if month in [7, 8, 9, 10, 11, 12]:
                # Next year June 30
                return date(year + 1, 6, 30)
            else:
                # Current year June 30
                return date(year, 6, 30)

    @classmethod
    def get_student_unit_price(cls, student_count: int) -> float:
        """
        Volume-tiered student unit price:
        - Less than 300 students: 30 EGP / student (e.g., 100 students = 3,000 EGP / month)
        - 300 to 599 students: 25 EGP / student (e.g., 300 students = 7,500 EGP / month)
        - 600+ students: 20 EGP / student (e.g., 600 students = 12,000 EGP / month)
        """
        count = max(1, int(student_count))
        if count < 300:
            return 30.0
        elif count < 600:
            return 25.0
        else:
            return 20.0

    @classmethod
    def calculate_monthly_base_price(cls, student_count: int) -> tuple[float, float]:
        """
        Calculates the monthly base price and unit price using volume tiers.
        Smooths pricing so a group count close to a threshold never pays more than
        the next tier's entry price (e.g. 280 students capped at 300*25 = 7500 EGP).
        """
        count = max(1, int(student_count))
        unit_price = cls.get_student_unit_price(count)
        raw_price = count * unit_price

        if count < 300:
            capped_price = min(raw_price, 300 * 25.0)
        elif count < 600:
            capped_price = min(raw_price, 600 * 20.0)
        else:
            capped_price = raw_price

        return round(capped_price, 2), unit_price

    @classmethod
    def calculate_quote(
        cls,
        student_count: int,
        plan_type: Literal["monthly", "term", "full_year"] = "term",
        start_date: date | None = None,
    ) -> PricingBreakdown:
        if start_date is None:
            start_date = date.today()

        count = max(1, int(student_count))
        month = start_date.month
        year = start_date.year

        # Calculate student tiers (every 100 students = 1 tier)
        student_tiers = math.ceil(count / cls.STUDENTS_PER_TIER)
        monthly_base_price, student_unit_price = cls.calculate_monthly_base_price(count)

        if plan_type == "monthly":
            calculated_months = 1
            discount_percentage = 0
            plan_label = "اشتراك شهري (تجديد شهري)"
        elif plan_type == "term":
            calculated_months = cls.get_remaining_term_months(month)
            discount_percentage = 10
            term_name = "الترم الأول" if month in [7, 8, 9, 10, 11, 12] else "الترم الثاني"
            plan_label = f"اشتراك {term_name} ({calculated_months} شهور متبقية)"
        else:  # full_year
            calculated_months = cls.get_remaining_year_months(month)
            discount_percentage = 15
            plan_label = f"اشتراك العام الدراسي الكامل ({calculated_months} شهور متبقية)"

        gross_amount = monthly_base_price * calculated_months
        discount_amount = (gross_amount * discount_percentage) / 100.0
        net_total = gross_amount - discount_amount
        end_date = cls.get_target_end_date(plan_type, start_date)

        return {
            "student_count": count,
            "student_tiers": student_tiers,
            "monthly_base_price": round(monthly_base_price, 2),
            "student_unit_price": student_unit_price,
            "plan_type": plan_type,
            "plan_type_label": plan_label,
            "calculated_months": calculated_months,
            "start_month": month,
            "start_year": year,
            "end_date": end_date.isoformat(),
            "gross_amount": round(gross_amount, 2),
            "discount_percentage": discount_percentage,
            "discount_amount": round(discount_amount, 2),
            "net_total": round(net_total, 2),
            "currency": "EGP",
        }

    @classmethod
    def generate_whatsapp_message(
        cls,
        institution_name: str,
        invoice_number: str,
        quote: PricingBreakdown,
        contact_phone: str = "",
    ) -> str:
        """
        Formats the official customer quotation message for direct WhatsApp sending.
        """
        lines = [
            "🎓 *طلب تفعيل اشتراك سنتر تعليمي - منصة كورسات*",
            "---------------------------------------",
            f"🏛 *اسم السنتر:* {institution_name}",
            f"🧾 *رقم الفاتورة المرجعي:* `#{invoice_number}`",
            f"👥 *سعة الطلاب:* {quote['student_count']} طالب ({quote['student_tiers']} شرائح)",
            f"📅 *نوع الخطة:* {quote['plan_type_label']}",
            f"⏳ *المدة المحسوبة:* {quote['calculated_months']} شهور (حتى {quote['end_date']})",
            "---------------------------------------",
            f"💵 *السعر الأساسي:* {quote['gross_amount']:,.2f} ج.م",
        ]

        if quote["discount_percentage"] > 0:
            lines.append(f"🎁 *قيمة الخصم ({quote['discount_percentage']}%):* -{quote['discount_amount']:,.2f} ج.م")

        lines.extend(
            [
                f"💰 *الإجمالي الصافي للدفع:* *{quote['net_total']:,.2f} جنيه مصري*",
                "---------------------------------------",
                "💳 *طرق الدفع والتحويل المعتمدة:*",
                "1️⃣ تحويل فودافون كاش / اتصالات كاش",
                "2️⃣ تحويل فوري عبر تطبيق إنستاباي (InstaPay)",
                "3️⃣ إيداع بنكي مباشر",
                "",
                "يرجى إرسال صورة إيصال التحويل مع هذه الرسالة للتفعيل الفوري لحساب السنتر.",
            ]
        )

        return "\n".join(lines)
