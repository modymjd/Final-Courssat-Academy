import React from "react";
import { motion } from "framer-motion";
import { Cpu, ShieldCheck, Zap, Globe2, Layers, Code2 } from "lucide-react";

interface CompanySectionProps {
  name?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string | null;
}

export const CompanySection: React.FC<CompanySectionProps> = ({
  name = "",
  tagline = "",
  description = "",
  logoUrl = null,
}) => {
  if (!name && !tagline && !description) return null;
  const companyPillars = [
    {
      icon: Cpu,
      title: "ذكاء تقني متقدم",
      desc: "بناء أنظمة برمجية مرنة وقابلة للتوسع بأحدث تقنيات السحاب والذكاء الاصطناعي.",
    },
    {
      icon: ShieldCheck,
      title: "أمان وحماية حصرية",
      desc: "توفير حلول تشفير متطورة لمنع تسريب المحتوى وحماية حقوق الملكية الفكرية.",
    },
    {
      icon: Zap,
      title: "سرعة وأداء فائق",
      desc: "بنية تحتية سريعة جداً تضمن تجربة تعلّم واستجابة لحظية بدون انقطاع.",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-card/40 border-y border-border/60 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Logo / Visual Branding Column */}
          <motion.div
            className="lg:col-span-5 order-2 lg:order-1 flex justify-center"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative w-full max-w-md p-8 rounded-3xl glass shadow-xl border border-primary/20 space-y-6 text-center overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
              
              {/* Logo / Emblem */}
              <div className="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 p-0.5 shadow-lg flex items-center justify-center">
                <div className="w-full h-full bg-card rounded-[14px] flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={name}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  ) : (
                    <div className="relative">
                      <Layers className="w-12 h-12 text-primary animate-pulse" />
                      <Code2 className="w-6 h-6 text-emerald-500 absolute -bottom-1 -left-1" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-extrabold text-foreground tracking-wide">
                  {name}
                </h3>
                <p className="text-xs uppercase tracking-widest text-primary font-semibold mt-1">
                  Next-Gen Software & EdTech Engineering
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground leading-relaxed">
                "{tagline}"
              </div>

              <div className="flex items-center justify-center gap-4 text-xs font-semibold text-foreground/80 pt-2 border-t border-border/50">
                <span className="flex items-center gap-1">
                  <Globe2 className="w-4 h-4 text-primary" /> حلول عالمية
                </span>
                <span>•</span>
                <span>صناعة عربية 100%</span>
              </div>
            </div>
          </motion.div>

          {/* Text & Content Column */}
          <motion.div
            className="lg:col-span-7 order-1 lg:order-2 space-y-6 text-right"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold border border-border">
              <span>الشركة الأم والراعي التقني</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight">
              عن شركة <span className="gradient-text">{name}</span>
            </h2>

            <p className="text-xl font-medium text-primary/90 leading-snug">
              "{tagline}"
            </p>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              {description}
            </p>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              {companyPillars.map((pillar, idx) => {
                const IconComponent = pillar.icon;
                return (
                  <motion.div
                    key={idx}
                    className="p-4 rounded-xl bg-card border border-border shadow-xs hover:border-primary/40 transition-all duration-200"
                    whileHover={{ y: -4 }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <IconComponent className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-bold text-sm text-foreground mb-1">
                      {pillar.title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-normal">
                      {pillar.desc}
                    </p>
                  </motion.div>
                );
              })}
            </div>

          </motion.div>

        </div>

      </div>
    </section>
  );
};

export default CompanySection;
