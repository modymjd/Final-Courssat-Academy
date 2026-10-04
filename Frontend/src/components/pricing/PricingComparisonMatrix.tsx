import React from "react";
import { Check, X, Sparkles, Shield, Video, Users, Award, BookOpen, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FeatureRow {
  name: string;
  starter: boolean | string;
  studentAllAccess: boolean | string;
  teacherPro: boolean | string;
  centerEnterprise: boolean | string;
}

interface CategoryGroup {
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  features: FeatureRow[];
}

const COMPARISON_DATA: CategoryGroup[] = [
  {
    category: "حماية المحتوى وبث الفيديو",
    icon: Video,
    features: [
      {
        name: "مشاهدة مشفرة عالية السرعة (Bunny Stream HLS)",
        starter: "محدودة",
        studentAllAccess: true,
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "علامة مائية ديناميكية متحركة برقم هاتف واسم الطالب",
        starter: false,
        studentAllAccess: true,
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "منع تشغيل حساب الطالب على أكثر من جهاز في نفس الوقت",
        starter: true,
        studentAllAccess: true,
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "ساعات فيديو مخصصة واستوديو رفع فائق الجودة",
        starter: false,
        studentAllAccess: true,
        teacherPro: "حتى 50 ساعة",
        centerEnterprise: "ساعات ممتدة مخصصة",
      },
    ],
  },
  {
    category: "التقييمات، الفلاش كاردز، وبنك الأسئلة",
    icon: BookOpen,
    features: [
      {
        name: "بطاقات الاستذكار التفاعلية بنظام التكرار المتباعد (Spaced Repetition)",
        starter: "نماذج مجانية",
        studentAllAccess: true,
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "بنك أسئلة واختبارات قياس مستوى مع تصحيح آلي فوري",
        starter: "محدود",
        studentAllAccess: true,
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "مؤقت التركيز وبومودورو مع تتبع الـ Streaks والتحصيل",
        starter: true,
        studentAllAccess: true,
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "شهادات إتمام إلكترونية معتمدة برمز تحقق QR",
        starter: false,
        studentAllAccess: true,
        teacherPro: true,
        centerEnterprise: true,
      },
    ],
  },
  {
    category: "إدارة الطلاب، المجموعات، والصلاحيات",
    icon: Users,
    features: [
      {
        name: "سعة الطلاب المسموح بها",
        starter: "شخصي",
        studentAllAccess: "شخصي",
        teacherPro: "20 إلى 250 طالب",
        centerEnterprise: "100 إلى 10,000+ طالب",
      },
      {
        name: "لوحة تحكم للمساعدين (Teaching Assistants)",
        starter: false,
        studentAllAccess: false,
        teacherPro: "حتى 3 مساعدين",
        centerEnterprise: "مساعدين غير محدودين",
      },
      {
        name: "توليد وطباعة حزم أكواد التفعيل بضغطة زر واحدة (PDF)",
        starter: false,
        studentAllAccess: false,
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "تسجيل حضور وغياب قاعات السنتر عبر مسح كود QR",
        starter: false,
        studentAllAccess: false,
        teacherPro: "يدوي",
        centerEnterprise: "مسح QR سريع بالقاعات",
      },
      {
        name: "إدارة فروع وسناتر متعددة تحت حساب مؤسسي موحد",
        starter: false,
        studentAllAccess: false,
        teacherPro: false,
        centerEnterprise: true,
      },
    ],
  },
  {
    category: "التقارير والدعم الفني",
    icon: Award,
    features: [
      {
        name: "تقارير تقدم ودرجات الطلاب مع إرسال لأولياء الأمور",
        starter: false,
        studentAllAccess: "تقرير ذاتي",
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "سحب أرباح مبيعات الكورسات عبر InstaPay والمحافظ",
        starter: false,
        studentAllAccess: false,
        teacherPro: true,
        centerEnterprise: true,
      },
      {
        name: "مدير حساب تقني مخصص ودعم عبر الواتساب على مدار الساعة",
        starter: false,
        studentAllAccess: "دعم فني عادي",
        teacherPro: "دعم ذو أولوية",
        centerEnterprise: "مدير حساب مخصص 24/7",
      },
    ],
  },
];

const renderCell = (val: boolean | string) => {
  if (typeof val === "boolean") {
    return val ? (
      <div className="flex justify-center">
        <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Check className="w-4 h-4" />
        </div>
      </div>
    ) : (
      <div className="flex justify-center">
        <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground/50 flex items-center justify-center">
          <X className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <span className="text-xs font-bold text-foreground inline-block px-2 py-0.5 rounded-md bg-muted/60">
      {val}
    </span>
  );
};

export const PricingComparisonMatrix: React.FC = () => {
  return (
    <div className="rounded-3xl border border-border bg-card shadow-lg overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-border text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>مقارنة شاملة وشفافة 100%</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-foreground">
          جدول مقارنة مزايا الخطط والخدمات
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
          اختر الخطة المناسبة لاحتياجاتك الأكاديمية واكتشف الفرق الدقيق بين الباقات
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-4 sm:p-5 text-sm font-black text-foreground w-2/5">
                الميزة / الخدمة
              </th>
              <th className="p-4 text-center text-xs sm:text-sm font-black text-foreground">
                الطالب (مجاني)
              </th>
              <th className="p-4 text-center text-xs sm:text-sm font-black text-primary bg-primary/5">
                الطالب (شامل)
              </th>
              <th className="p-4 text-center text-xs sm:text-sm font-black text-foreground">
                المعلم (Teacher Pro)
              </th>
              <th className="p-4 text-center text-xs sm:text-sm font-black text-foreground">
                السنتر (Enterprise)
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_DATA.map((group, idx) => {
              const Icon = group.icon;
              return (
                <React.Fragment key={idx}>
                  <tr className="bg-muted/60 border-y border-border">
                    <td colSpan={5} className="py-2.5 px-4 sm:px-5 font-black text-xs text-primary flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{group.category}</span>
                    </td>
                  </tr>
                  {group.features.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b border-border/60 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-4 sm:p-5 text-xs sm:text-sm font-bold text-foreground">
                        {row.name}
                      </td>
                      <td className="p-4 text-center">
                        {renderCell(row.starter)}
                      </td>
                      <td className="p-4 text-center bg-primary/5">
                        {renderCell(row.studentAllAccess)}
                      </td>
                      <td className="p-4 text-center">
                        {renderCell(row.teacherPro)}
                      </td>
                      <td className="p-4 text-center">
                        {renderCell(row.centerEnterprise)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PricingComparisonMatrix;
