import React from "react";
import { motion } from "framer-motion";
import { 
  GraduationCap, 
  Video, 
  Clock, 
  BookOpenCheck, 
  Sparkles, 
  Users, 
  Star, 
  CheckCircle2 
} from "lucide-react";

interface EduSmartSectionProps {
  name?: string;
  tagline?: string;
  description?: string;
}

export const EduSmartSection: React.FC<EduSmartSectionProps> = ({
  name = "",
  tagline = "",
  description = "",
}) => {
  if (!name && !tagline && !description) return null;
  const features = [
    {
      icon: Video,
      title: "دروس وفيديوهات تفاعلية",
      desc: "شرح مبسط ومباشر بجودة عالية مع خيارات التحكم في السرعة والمتابعة.",
    },
    {
      icon: Clock,
      title: "مؤقت بومودورو المدمج",
      desc: "أداة تنظيم الوقت والتركيز أثناء الاستذكار بأسلوب علمي ممتع.",
    },
    {
      icon: Sparkles,
      title: "بطاقات تكرار متباعد (Flashcards)",
      desc: "مراجعة الكلمات والمفاهيم الصعبة باستخدام الذكاء الاصطناعي لترسيخ المعلومات.",
    },
    {
      icon: BookOpenCheck,
      title: "حجوزات وتقييمات فورية",
      desc: "امتحانات رقمية ذات تصحيح فوري مع تحليل كامل ونقاط القوة والضعف.",
    },
  ];

  const stats = [
    {
      icon: Users,
      value: "500+",
      label: "طالب مسجل",
      subtext: "يعتمدون على المنصة يومياً",
    },
    {
      icon: GraduationCap,
      value: "1,200+",
      label: "كورس ومادة تعليمية",
      subtext: "تغطي مختلف المراحل والدورات",
    },
    {
      icon: Star,
      value: "98%",
      label: "نسبة رضا الطلاب",
      subtext: "بناءً على تقييمات الطلاب",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Block */}
        <motion.div
          className="text-center max-w-3xl mx-auto space-y-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
            <Sparkles className="w-4 h-4" />
            <span>المنصة التعليمية الذكية</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
            عن منصة <span className="gradient-text">{name}</span>
          </h2>

          <p className="text-xl font-bold text-primary">
            "{tagline}"
          </p>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {description}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={idx}
                className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-300 flex flex-col justify-between"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary/20 to-emerald-400/20 text-primary flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>ميزة مدمجة بالكامل</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Social Proof & Statistics Card */}
        <motion.div
          className="rounded-3xl gradient-cta p-8 sm:p-12 text-white shadow-xl relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-none" />

          <div className="relative z-10 space-y-8 text-center">
            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                أرقام نتشرّف بها في رحلة النجاح
              </h3>
              <p className="text-white/80 text-sm sm:text-base mt-2">
                ثقة مئات الطلاب وأولياء الأمور هي دافعنا الدائم للتطوير والمضي قدماً.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4 max-w-4xl mx-auto">
              {stats.map((st, idx) => {
                const StatIcon = st.icon;
                return (
                  <div key={idx} className="flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-1 shadow-inner">
                      <StatIcon className="w-6 h-6" />
                    </div>
                    <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                      {st.value}
                    </span>
                    <span className="text-base font-bold text-white/95">
                      {st.label}
                    </span>
                    <span className="text-xs text-white/75">
                      {st.subtext}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default EduSmartSection;
