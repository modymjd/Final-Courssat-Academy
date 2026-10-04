/**
 * Academic Dynamic Pricing Engine (Frontend Client Implementation)
 * Courssat Academy Platform
 *
 * Rules:
 * - Base rate: 100 students = 3,000 EGP/month (30 EGP/student).
 * - Monthly: 1 month, 0% discount.
 * - Term plan: Remaining months until end of Term (Term 1 = end of Dec, Term 2 = end of Jun), 10% discount.
 * - Full year: Remaining months until end of Jun, 15% discount.
 * - WhatsApp Support Contact: 01020335023 (+201020335023).
 */

export type PlanType = "monthly" | "term" | "full_year";

export interface PricingQuote {
  studentCount: number;
  studentTiers: number;
  monthlyBasePrice: number;
  studentUnitPrice: number;
  planType: PlanType;
  planTypeLabel: string;
  calculatedMonths: number;
  startMonth: number;
  startYear: number;
  endDate: string;
  grossAmount: number;
  discountPercentage: number;
  discountAmount: number;
  netTotal: number;
  currency: string;
}

export const SUPPORT_WHATSAPP_NUMBER = "01020335023";
export const SUPPORT_WHATSAPP_INTL = "201020335023";

export function getRemainingTermMonths(month: number): number {
  if ([8, 9, 10, 11, 12].includes(month)) {
    return 12 - month + 1;
  } else if ([2, 3, 4, 5, 6].includes(month)) {
    return 6 - month + 1;
  } else if (month === 1) {
    return 5;
  } else {
    // Month 7 (July)
    return 5;
  }
}

export function getRemainingYearMonths(month: number): number {
  if ([8, 9, 10, 11, 12].includes(month)) {
    return (12 - month + 1) + 6;
  } else if (month === 1) {
    return 6;
  } else if ([2, 3, 4, 5, 6].includes(month)) {
    return 6 - month + 1;
  } else {
    // Month 7 (July)
    return 11;
  }
}

export function getTargetEndDate(planType: PlanType, startDate: Date = new Date()): string {
  const month = startDate.getMonth() + 1;
  const year = startDate.getFullYear();

  if (planType === "monthly") {
    const nextMonth = new Date(year, startDate.getMonth() + 1, startDate.getDate());
    return nextMonth.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } else if (planType === "term") {
    if ([8, 9, 10, 11, 12].includes(month)) {
      return `31 ديسمبر ${year}`;
    } else {
      return `30 يونيو ${year}`;
    }
  } else {
    // full_year
    const targetYear = [7, 8, 9, 10, 11, 12].includes(month) ? year + 1 : year;
    return `30 يونيو ${targetYear}`;
  }
}

export function formatMonthsArabic(months: number): string {
  if (months === 1) return "شهر واحد";
  if (months === 2) return "شهران";
  if (months >= 3 && months <= 10) return `${months} أشهر`;
  return `${months} شهراً`;
}

export function getStudentUnitPrice(studentCount: number): number {
  const count = Math.max(1, Math.floor(studentCount || 100));
  if (count < 300) {
    return 30.0;
  } else if (count < 600) {
    return 25.0;
  } else {
    return 20.0;
  }
}

export function calculateMonthlyBasePrice(studentCount: number): { monthlyBasePrice: number; studentUnitPrice: number } {
  const count = Math.max(1, Math.floor(studentCount || 100));
  const unitPrice = getStudentUnitPrice(count);
  const rawPrice = count * unitPrice;

  let cappedPrice = rawPrice;
  if (count < 300) {
    cappedPrice = Math.min(rawPrice, 300 * 25.0);
  } else if (count < 600) {
    cappedPrice = Math.min(rawPrice, 600 * 20.0);
  } else {
    cappedPrice = rawPrice;
  }

  return {
    monthlyBasePrice: Math.round(cappedPrice * 100) / 100,
    studentUnitPrice: unitPrice,
  };
}

export function calculateAcademicQuote(
  studentCount: number,
  planType: PlanType = "term",
  startDate: Date = new Date()
): PricingQuote {
  const count = Math.max(1, Math.floor(studentCount || 100));
  const month = startDate.getMonth() + 1;
  const year = startDate.getFullYear();

  const studentTiers = Math.ceil(count / 100);
  const { monthlyBasePrice, studentUnitPrice } = calculateMonthlyBasePrice(count);

  let calculatedMonths = 1;
  let discountPercentage = 0;
  let planTypeLabel = "اشتراك شهري (تجديد شهري)";

  if (planType === "monthly") {
    calculatedMonths = 1;
    discountPercentage = 0;
    planTypeLabel = "اشتراك شهري (تجديد شهري)";
  } else if (planType === "term") {
    calculatedMonths = getRemainingTermMonths(month);
    discountPercentage = 10;
    const termName = [7, 8, 9, 10, 11, 12].includes(month) ? "الترم الأول" : "الترم الثاني";
    planTypeLabel = `اشتراك ${termName} (${formatMonthsArabic(calculatedMonths)} متبقية)`;
  } else {
    // full_year
    calculatedMonths = getRemainingYearMonths(month);
    discountPercentage = 15;
    planTypeLabel = `اشتراك العام الدراسي الكامل (${formatMonthsArabic(calculatedMonths)} شاملة)`;
  }

  const grossAmount = monthlyBasePrice * calculatedMonths;
  const discountAmount = (grossAmount * discountPercentage) / 100;
  const netTotal = grossAmount - discountAmount;
  const endDate = getTargetEndDate(planType, startDate);

  return {
    studentCount: count,
    studentTiers,
    monthlyBasePrice,
    studentUnitPrice,
    planType,
    planTypeLabel,
    calculatedMonths,
    startMonth: month,
    startYear: year,
    endDate,
    grossAmount,
    discountPercentage,
    discountAmount,
    netTotal,
    currency: "ج.م",
  };
}

export function generateWhatsAppQuoteUrl(
  institutionName: string,
  invoiceNumber: string,
  quote: PricingQuote
): string {
  const lines = [
    "🎓 *طلب تفعيل اشتراك سنتر تعليمي - منصة كورسات*",
    "---------------------------------------",
    `🏛 *اسم السنتر:* ${institutionName || "مركز تعليمي"}`,
    `🧾 *رقم الفاتورة المرجعي:* #${invoiceNumber}`,
    `👥 *السعة المطلوبة:* ${quote.studentCount} طالب (${quote.studentTiers} شريحة)`,
    `📅 *نوع الخطة:* ${quote.planTypeLabel}`,
    `⏳ *المدة:* ${quote.calculatedMonths} شهور (صالح حتى ${quote.endDate})`,
    "---------------------------------------",
    `💵 *السعر الأساسي:* ${quote.grossAmount.toLocaleString("en-US")} ج.م`,
  ];

  if (quote.discountPercentage > 0) {
    lines.push(`🎁 *الخصم الأكاديمي (${quote.discountPercentage}%):* -${quote.discountAmount.toLocaleString("en-US")} ج.م`);
  }

  lines.push(
    `💰 *الإجمالي النهائي للدفع:* *${quote.netTotal.toLocaleString("en-US")} جنيه مصري*`,
    "---------------------------------------",
    "💳 *وسيلة الدفع المفضلة:* (فودافون كاش / إنستاباي / تحويل بنكي)",
    "",
    "يرجى إرسال صورة إيصال التحويل مع هذه الرسالة لتأكيد التفعيل الفوري."
  );

  const text = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${SUPPORT_WHATSAPP_INTL}?text=${text}`;
}
