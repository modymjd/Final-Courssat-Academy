import React, { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  Code2,
  Cpu,
  Calculator,
  Atom,
  Languages,
  Palette,
  Briefcase,
  Award,
  FileCheck,
  Gift,
  Sparkles,
  ArrowLeft,
  ChevronLeft,
  School,
  CreditCard,
  Info,
} from "lucide-react";

interface ExploreMegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const ExploreMegaMenu: React.FC<ExploreMegaMenuProps> = ({
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="absolute top-full start-0 mt-2 w-[calc(100vw-2rem)] max-w-5xl bg-card text-card-foreground border border-border/80 shadow-xl rounded-2xl overflow-hidden z-50 origin-top"
          dir="rtl"
        >
          {/* Subtle brand accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-teal-400 to-emerald-400" />

      {/* Main 4 Columns Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-card">
        {/* العمود الأول: التعليم الأساسي (الابتدائي والإعدادي) */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm pb-2 border-b border-border/60">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <GraduationCap size={17} />
            </div>
            <span>الابتدائي والإعدادي</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* المرحلة الابتدائية */}
            <div className="space-y-1.5">
              <Link
                to="/courses?educational_stage=primary"
                onClick={onClose}
                className="group flex items-center justify-between font-bold text-sm text-foreground hover:text-primary transition-colors"
              >
                <span>المرحلة الابتدائية (1 - 6)</span>
                <ChevronLeft size={14} className="text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-1" />
              </Link>
              <div className="ps-2 space-y-1">
                <Link
                  to="/courses?educational_stage=primary&educational_grade=primary_1"
                  onClick={onClose}
                  className="block py-1 px-2 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
                >
                  الصفوف الأولى (1-3) • Connect والرياضيات
                </Link>
                <Link
                  to="/courses?educational_stage=primary&educational_grade=primary_4"
                  onClick={onClose}
                  className="block py-1 px-2 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
                >
                  الصفوف العليا (4-6) • العلوم و ICT والمهارات
                </Link>
              </div>
            </div>

            {/* المرحلة الإعدادية */}
            <div className="pt-2.5 border-t border-border/40 space-y-1.5">
              <Link
                to="/courses?educational_stage=prep"
                onClick={onClose}
                className="group flex items-center justify-between font-bold text-sm text-foreground hover:text-primary transition-colors"
              >
                <span>المرحلة الإعدادية (1 - 3)</span>
                <ChevronLeft size={14} className="text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-1" />
              </Link>
              <div className="ps-2 space-y-1">
                <Link
                  to="/courses?educational_stage=prep&educational_grade=prep_3"
                  onClick={onClose}
                  className="block py-1 px-2 rounded-lg hover:bg-muted/70 text-primary font-semibold transition-colors"
                >
                  الصف الثالث الإعدادي (الشهادة) 🏆
                </Link>
                <Link
                  to="/courses?educational_stage=prep&subject=math"
                  onClick={onClose}
                  className="block py-1 px-2 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
                >
                  الرياضيات: جبر وإحصاء / هندسة
                </Link>
                <Link
                  to="/courses?educational_stage=prep&subject=social_studies"
                  onClick={onClose}
                  className="block py-1 px-2 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
                >
                  الدراسات: تاريخ / جغرافيا
                </Link>
                <Link
                  to="/courses?educational_stage=prep&subject=french"
                  onClick={onClose}
                  className="block py-1 px-2 rounded-lg hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
                >
                  اللغات الثانية (فرنسي، ألماني، إيطالي)
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* العمود الثاني: المرحلة الثانوية العامة */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm pb-2 border-b border-border/60">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BookOpen size={17} />
            </div>
            <span>المرحلة الثانوية العامة</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* الصف الأول الثانوي */}
            <div className="p-2 rounded-xl bg-muted/30 border border-border/50 space-y-1">
              <Link
                to="/courses?educational_stage=secondary&educational_grade=secondary_1"
                onClick={onClose}
                className="font-bold text-foreground hover:text-primary flex items-center justify-between"
              >
                <span>الصف الأول الثانوي (عام للكل)</span>
                <ChevronLeft size={13} className="text-muted-foreground" />
              </Link>
              <p className="text-[11px] text-muted-foreground">
                العلوم المتكاملة • الفلسفة • حساب مثلثات وهندسة
              </p>
            </div>

            {/* شُعب الثاني والثالث الثانوي */}
            <div className="space-y-1.5 pt-1">
              <span className="font-bold text-xs text-foreground block">
                تخصصات الصفين الثاني والثالث:
              </span>

              <Link
                to="/courses?educational_stage=secondary&educational_track=scientific_science"
                onClick={onClose}
                className="group flex items-start gap-2 p-2 rounded-xl hover:bg-muted/70 transition-colors"
              >
                <Sparkles size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-foreground group-hover:text-primary">شعبة علمي علوم</span>
                  <span className="text-[11px] text-muted-foreground">أحياء، كيمياء، فيزياء، جيولوجيا (3 ث)</span>
                </div>
              </Link>

              <Link
                to="/courses?educational_stage=secondary&educational_track=scientific_math"
                onClick={onClose}
                className="group flex items-start gap-2 p-2 rounded-xl hover:bg-muted/70 transition-colors"
              >
                <Calculator size={15} className="text-cyan-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-foreground group-hover:text-primary">شعبة علمي رياضة</span>
                  <span className="text-[11px] text-muted-foreground">رياضيات بحتة وتطبيقية، فيزياء، كيمياء</span>
                </div>
              </Link>

              <Link
                to="/courses?educational_stage=secondary&educational_track=literary"
                onClick={onClose}
                className="group flex items-start gap-2 p-2 rounded-xl hover:bg-muted/70 transition-colors"
              >
                <Languages size={15} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-foreground group-hover:text-primary">شعبة أدبي</span>
                  <span className="text-[11px] text-muted-foreground">تاريخ، جغرافيا، علم نفس، فلسفة</span>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* العمود الثالث: نظام البكالوريا المصرية */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm pb-2 border-b border-border/60">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Award size={17} />
            </div>
            <span>البكالوريا المصرية (المسار الجديد)</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* أولى بكالوريا تمهيدي */}
            <div className="p-2 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
              <Link
                to="/courses?educational_stage=baccalaureate&educational_grade=baccalaureate_1"
                onClick={onClose}
                className="font-bold text-primary flex items-center justify-between"
              >
                <span>أولى بكالوريا (تمهيدي)</span>
                <ChevronLeft size={13} className="text-primary" />
              </Link>
              <p className="text-[11px] text-muted-foreground">
                المواد الأساسية + اختيارية (رياضيات أو فيزياء)
              </p>
            </div>

            {/* مسارات 2 و 3 بكالوريا */}
            <div className="space-y-1 pt-1">
              <span className="font-bold text-xs text-foreground block">
                مسارات ثانية وثالثة بكالوريا:
              </span>

              <Link
                to="/courses?educational_stage=baccalaureate&educational_track=bac_medical"
                onClick={onClose}
                className="block p-1.5 rounded-lg hover:bg-muted/70 transition-colors"
              >
                <span className="font-bold text-foreground block">مسار الطب والعلوم الصحية 🩺</span>
                <span className="text-[11px] text-muted-foreground">أحياء + كيمياء + مواد مشتركة</span>
              </Link>

              <Link
                to="/courses?educational_stage=baccalaureate&educational_track=bac_engineering"
                onClick={onClose}
                className="block p-1.5 rounded-lg hover:bg-muted/70 transition-colors"
              >
                <span className="font-bold text-foreground block">مسار الهندسة والتكنولوجيا ⚙️</span>
                <span className="text-[11px] text-muted-foreground">رياضيات متقدمة + فيزياء + مواد مشتركة</span>
              </Link>

              <Link
                to="/courses?educational_stage=baccalaureate&educational_track=bac_business"
                onClick={onClose}
                className="block p-1.5 rounded-lg hover:bg-muted/70 transition-colors"
              >
                <span className="font-bold text-foreground block">مسار إدارة الأعمال والاقتصاد 📈</span>
                <span className="text-[11px] text-muted-foreground">اقتصاد + رياضيات + مواد مشتركة</span>
              </Link>

              <Link
                to="/courses?educational_stage=baccalaureate&educational_track=bac_humanities"
                onClick={onClose}
                className="block p-1.5 rounded-lg hover:bg-muted/70 transition-colors"
              >
                <span className="font-bold text-foreground block">مسار العلوم الإنسانية والأدبي 📚</span>
                <span className="text-[11px] text-muted-foreground">جغرافيا + إحصاء + مواد مشتركة</span>
              </Link>
            </div>
          </div>
        </div>

        {/* العمود الرابع: مقررات مميزة والشهادات */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm pb-2 border-b border-border/60">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sparkles size={17} />
            </div>
            <span>مقررات حديثة وأدوات المنصة</span>
          </div>

          <div className="space-y-2 text-xs">
            <Link
              to="/courses?subject=integrated_sciences"
              onClick={onClose}
              className="group flex items-start gap-2.5 p-2 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/60 transition-all"
            >
              <Atom size={16} className="text-cyan-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-foreground group-hover:text-primary">العلوم المتكاملة</span>
                <span className="text-[11px] text-muted-foreground">المنهج المطور لأولى ثانوي</span>
              </div>
            </Link>

            <Link
              to="/courses?subject=geology"
              onClick={onClose}
              className="group flex items-start gap-2.5 p-2 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/60 transition-all"
            >
              <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-foreground group-hover:text-primary">الجيولوجيا والعلوم البيئية</span>
                <span className="text-[11px] text-muted-foreground">الصف الثالث الثانوي علمي علوم</span>
              </div>
            </Link>

            <Link
              to="/verify-certificate"
              onClick={onClose}
              className="group flex items-start gap-2.5 p-2 rounded-xl border border-border/70 hover:border-primary/40 bg-muted/20 hover:bg-muted/60 transition-all"
            >
              <FileCheck size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-foreground group-hover:text-primary">التحقق من الشهادات</span>
                <span className="text-[11px] text-muted-foreground">فحص كود الاعتماد الرسمي فورياً</span>
              </div>
            </Link>

            <Link
              to="/courses?is_free=true"
              onClick={onClose}
              className="flex items-center gap-2 p-2 rounded-xl font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors"
            >
              <Gift size={15} />
              <span>محاضرات وشروحات مجانية بالكامل 🎁</span>
            </Link>
          </div>
        </div>
      </div>

      {/* الشريط السفلي الأنيق */}
      <div className="bg-muted/30 border-t border-border/70 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-bold text-foreground">لست متأكداً من أين تبدأ؟</span>
          <span className="hidden sm:inline">تصفح مسارات التعلم التفاعلية أو ابدأ رحلتك مجاناً الآن</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Link
            to="/courses?is_free=true"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/20 transition-colors"
          >
            تصفح الدورات المجانية 🎁
          </Link>
          <Link
            to="/courses"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>جميع الكورسات</span>
            <ArrowLeft size={13} />
          </Link>
        </div>
      </div>
    </motion.div>
  )}
</AnimatePresence>
  );
};

export default ExploreMegaMenu;
