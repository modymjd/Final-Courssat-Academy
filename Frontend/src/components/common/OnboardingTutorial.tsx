import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthContext';
import { useLocation } from 'react-router-dom';
import { logger } from '@/lib/logger';
import {
  BookOpen, Bell, User, Clock, FileText, CheckCircle2,
  Sparkles, ArrowLeft, ArrowRight, X, GraduationCap, Award, HelpCircle
} from 'lucide-react';

const CURRENT_TUTORIAL_VERSION = 5;
const LOCAL_STORAGE_KEY = `edusmart_tutorial_v${CURRENT_TUTORIAL_VERSION}_done`;

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  highlights?: string[];
}

export default function OnboardingTutorial() {
  const { user, updateUser, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const location = useLocation();

  const isInstructor = user?.role === 'instructor' || user?.role === 'admin';

  // 1. Comprehensive Student Guided Steps
  const studentSteps: TourStep[] = [
    {
      title: 'أهلاً بك في منصة كورسات التعليمية! 🎓',
      badge: 'الخطوة 1 من 5',
      icon: <GraduationCap className="w-8 h-8 text-primary" />,
      description: 'نرحب بك في البيئة التعليمية الذكية الأحدث! أعددنا لك هذه الجولة السريعة لشرح كافة أدوات وميزات المنصة لضمان رحلة تعلم ناجحة وممتعة.',
      highlights: [
        'واجهة عربية بسيطة وسلسة',
        'دعم التعلم بالتكرار المتباعد وفواصل التركيز',
        'متابعة مستمرة لتقدمك الأكاديمي',
      ],
    },
    {
      title: '📚 قائمة التنقل والكتالوج الرئيسي',
      badge: 'الخطوة 2 من 5',
      icon: <BookOpen className="w-8 h-8 text-indigo-500" />,
      description: 'من شريط التنقل العلوي، يمكنك الوصول الفوري إلى:',
      highlights: [
        'الدورات والمقررات: استكشاف واختيار الدورات التفاعلية.',
        'المدربون والخبراء: التعرف على نخبة المحاضرين.',
        'خطط الأسعار والاشتراكات: باقات الاشتراك المرنة.',
      ],
    },
    {
      title: '🔔 مركز التنبيهات والرسائل الموحد',
      badge: 'الخطوة 3 من 5',
      icon: <Bell className="w-8 h-8 text-amber-500" />,
      description: 'تم دمج جميع التنبيهات والرسائل في مركز واحد أعلى الشاشة:',
      highlights: [
        'تنبيهات المواعيد وتكليفات الدراسة فور صدورها.',
        'إشعارات نتائج الاختبارات والشهادات.',
        'المحادثات والرسائل المباشرة مع محاضري المقررات.',
      ],
    },
    {
      title: '👤 الملف الشخصي وإعدادات السمة',
      badge: 'الخطوة 4 من 5',
      icon: <User className="w-8 h-8 text-emerald-500" />,
      description: 'من خلال قائمة الحساب الشخصي يمكنك الانتقال إلى الإعدادات لتخصيص تجربتك:',
      highlights: [
        'تبديل السمة (الوضع الليلي / الفاتح) المريح للعين.',
        'تعديل البيانات الشخصية وكلمة المرور.',
        'إعادة هذه الجولة التعريفية في أي وقت.',
      ],
    },
    {
      title: '⚡ أدوات التعلم الذكي المتقدمة',
      badge: 'الخطوة 5 من 5',
      icon: <Sparkles className="w-8 h-8 text-purple-500" />,
      description: 'تتضمن لوحة تحكم الطالب مجموعة من أحدث أدوات الدراسة الفعالة:',
      highlights: [
        '⏱️ غرفة التركيز (Focus Mode): مؤقت البومودورو للمذاكرة الفعالة.',
        '📝 الدفتر الذكي: بطاقات المراجعة السريعة ونظام Spaced Repetition.',
        '📋 جدول التكليفات: لوحة متابعة الواجبات والاختبارات.',
      ],
    },
  ];

  // 2. Comprehensive Instructor Guided Steps
  const instructorSteps: TourStep[] = [
    {
      title: 'أهلاً بك يا دكتور / أستاذنا في كورسات! 👨‍🏫',
      badge: 'الخطوة 1 من 4',
      icon: <Award className="w-8 h-8 text-primary" />,
      description: 'يسعدنا انضمامك لإنشاء وإدارة أحدث المقررات التفاعلية. إليك نظرة سريعة على أدوات بيئة المحاضرين.',
      highlights: [
        'أدوات رفع وتشفير الفيديو وحماية المحتوى DRM',
        'بنك أسئلة متطور وتصنيف المستويات',
        'إحصائيات متقدمة ورصد نتائج الطلاب',
      ],
    },
    {
      title: '📌 شريط التنقل الإداري والمقررات',
      badge: 'الخطوة 2 من 4',
      icon: <BookOpen className="w-8 h-8 text-blue-500" />,
      description: 'يمكنك إنشاء وتعديل الدورات والوحدات والدروس بسهولة:',
      highlights: [
        'بناء الهيكل التعليمي وإضافة المرفقات والملفات.',
        'تحديد مجانية أو سعر الدورة وكوبونات الخصم.',
        'إدارة حالة النشر والمسودات.',
      ],
    },
    {
      title: '❓ بنك الأسئلة وباني الاختبارات',
      badge: 'الخطوة 3 من 4',
      icon: <HelpCircle className="w-8 h-8 text-teal-500" />,
      description: 'أدوات تقييم الطلاب المتكاملة:',
      highlights: [
        'إضافة أسئلة الاختيار من متعدد والأسئلة المقالية.',
        'تحديد أوقات الاختبارات وتكرار المحاولات.',
        'التصحيح التلقائي وتخزين الإجابات.',
      ],
    },
    {
      title: '📊 سجل درجات الطلاب والتحليلات',
      badge: 'الخطوة 4 من 4',
      icon: <FileText className="w-8 h-8 text-purple-500" />,
      description: 'متابعة شاملة لتقدم الطلاب وأرباح المقررات:',
      highlights: [
        'عرض نسب إكمال المقررات وسجل الحضور.',
        'تقييم وتصحيح التكليفات والواجبات.',
        'سجل الإيرادات وطلبات سحب المستحقات.',
      ],
    },
  ];

  const steps = isInstructor ? instructorSteps : studentSteps;
  const currentStep = steps[stepIndex] || steps[0];

  const finishTutorial = async () => {
    setIsOpen(false);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
    } catch {
      /* ignore storage error */
    }

    try {
      await updateUser({
        tutorialCompletedAt: new Date().toISOString(),
        tutorialVersion: CURRENT_TUTORIAL_VERSION,
      });
    } catch (error) {
      logger.error('Failed to update tutorial completion status:', error);
    }
  };

  useEffect(() => {
    // Listen for manual restart events from Settings page
    const handleReplayEvent = () => {
      setStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener('edusmart:start-tutorial', handleReplayEvent);
    return () => window.removeEventListener('edusmart:start-tutorial', handleReplayEvent);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Strict Rule: Never auto-start if completed in local storage or database
    try {
      const isDoneLocally = localStorage.getItem(LOCAL_STORAGE_KEY) === 'true';
      if (isDoneLocally) return;
    } catch {
      /* ignore storage error */
    }

    if ((user.tutorialVersion || 0) >= CURRENT_TUTORIAL_VERSION) return;

    if (location.pathname.includes('/dashboard') || location.pathname.includes('/student') || location.pathname.includes('/instructor')) {
      const timer = setTimeout(() => setIsOpen(true), 400);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, location.pathname]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md dir-rtl font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-right"
        >
          {/* Top Decorative Header */}
          <div className="p-6 pb-4 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-background border border-border/60 shadow-xs">
                {currentStep.icon}
              </div>
              <div>
                <span className="text-[11px] font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 block w-fit mb-1">
                  {currentStep.badge}
                </span>
                <h3 className="text-lg font-bold leading-snug">{currentStep.title}</h3>
              </div>
            </div>
            <button
              onClick={finishTutorial}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[60vh]">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentStep.description}
            </p>

            {currentStep.highlights && currentStep.highlights.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                {currentStep.highlights.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs font-medium text-foreground/90">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-5 bg-muted/30 border-t border-border/50 flex items-center justify-between">
            <button
              onClick={finishTutorial}
              className="text-xs text-muted-foreground hover:text-destructive font-medium transition-colors"
            >
              تخطي الجولة
            </button>

            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={() => setStepIndex(prev => prev - 1)}
                  className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <ArrowRight size={14} />
                  السابق
                </button>
              )}

              {stepIndex < steps.length - 1 ? (
                <button
                  onClick={() => setStepIndex(prev => prev + 1)}
                  className="px-5 py-2 rounded-xl gradient-cta text-white text-xs font-bold shadow-md hover:opacity-95 transition-opacity flex items-center gap-1.5"
                >
                  التالي
                  <ArrowLeft size={14} />
                </button>
              ) : (
                <button
                  onClick={finishTutorial}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
                >
                  ابدأ التعلم الآن 🎉
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
