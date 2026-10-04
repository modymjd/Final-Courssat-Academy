import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FounderHeroProps {
  name?: string;
  title?: string;
  quote?: string;
  photoUrl?: string | null;
}

export const FounderHero: React.FC<FounderHeroProps> = ({
  name = "",
  title = "",
  quote = "",
  photoUrl = null,
}) => {
  if (!name && !title && !quote) return null;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative overflow-hidden py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Background Decorative Lighting */}
      <div className="absolute top-10 right-10 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute bottom-10 left-10 -z-10 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl opacity-50 pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text & Message Column */}
          <motion.div
            className="lg:col-span-7 flex flex-col items-start text-right space-y-6"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold shadow-xs">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span>رؤية وتأسيس المنصة</span>
            </div>

            {/* Founder Name & Title */}
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
                {name}
              </h1>
              <p className="mt-2 text-lg sm:text-xl font-medium text-primary gradient-text">
                {title}
              </p>
            </div>

            {/* Founder Quote Card */}
            <motion.div
              className="relative p-6 sm:p-8 rounded-2xl bg-card/80 backdrop-blur-md border border-border shadow-md text-foreground/90 space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="absolute -top-4 right-6 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                كلمة المؤسس
              </div>
              <p className="text-base sm:text-lg leading-relaxed text-muted-foreground pt-1">
                "{quote}"
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-border/60 text-xs text-muted-foreground font-medium">
                <span>الرؤية الاستراتيجية للتعلم الذكي</span>
                <span>— {name}</span>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
              <Button
                size="lg"
                className="gradient-cta text-white font-bold px-8 shadow-md hover:shadow-lg transition-all duration-200 gap-2 cursor-pointer"
                onClick={() => scrollToSection("contact-section")}
              >
                <MessageCircle className="w-5 h-5" />
                <span>تواصل معايا</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="border-primary/30 hover:bg-primary/10 text-foreground font-semibold px-6 transition-all duration-200 gap-2 cursor-pointer"
                onClick={() => scrollToSection("partnership-timeline")}
              >
                <span>شوف رحلتنا</span>
                <ArrowLeft className="w-4 h-4 rtl:rotate-0" />
              </Button>
            </div>

          </motion.div>

          {/* Founder Image Column */}
          <motion.div
            className="lg:col-span-5 flex justify-center lg:justify-end"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          >
            <div className="relative group max-w-sm sm:max-w-md w-full">
              {/* Outer Glow Halo */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-primary via-emerald-500 to-amber-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-60 transition duration-500" />

              {/* Main Image Container */}
              <div className="relative rounded-3xl overflow-hidden bg-card border border-border shadow-xl p-3">
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-card aspect-[4/5] flex items-center justify-center">
                  
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={name}
                      loading="lazy"
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    /* Fallback High Quality Founder Portrait SVG Illustration */
                    <svg
                      className="w-full h-full object-cover text-primary/40"
                      viewBox="0 0 400 500"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-label={`${name} - Founder Portrait`}
                      role="img"
                    >
                      <defs>
                        <linearGradient id="founder-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.9" />
                        </linearGradient>
                        <linearGradient id="suit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="hsl(var(--primary))" />
                          <stop offset="100%" stopColor="hsl(var(--foreground))" />
                        </linearGradient>
                      </defs>
                      <rect width="400" height="500" fill="url(#founder-bg)" />
                      <circle cx="200" cy="180" r="140" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="6 6" opacity="0.3" />
                      <circle cx="200" cy="180" r="110" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.2" />
                      <g transform="translate(50, 40)">
                        <path d="M 150 70 C 185 70 210 95 210 135 C 210 175 185 200 150 200 C 115 200 90 175 90 135 C 90 95 115 70 150 70 Z" fill="hsl(var(--primary))" opacity="0.85" />
                        <path d="M 105 115 C 105 90 130 80 150 80 C 170 80 195 90 195 115 Z" fill="hsl(var(--foreground))" opacity="0.9" />
                        <rect x="115" y="125" width="28" height="18" rx="4" stroke="hsl(var(--background))" strokeWidth="3" fill="none" />
                        <rect x="157" y="125" width="28" height="18" rx="4" stroke="hsl(var(--background))" strokeWidth="3" fill="none" />
                        <line x1="143" y1="134" x2="157" y2="134" stroke="hsl(var(--background))" strokeWidth="3" />
                        <path d="M 40 370 C 40 260 90 230 150 230 C 210 230 260 260 260 370 Z" fill="url(#suit-grad)" />
                        <polygon points="135,230 165,230 150,300" fill="hsl(var(--background))" />
                        <polygon points="146,230 154,230 152,350 148,350" fill="hsl(var(--achievement))" />
                      </g>
                    </svg>
                  )}

                  {/* Overlaid Badge Tag */}
                  <div className="absolute bottom-4 right-4 left-4 bg-background/90 backdrop-blur-md p-3 rounded-xl border border-border/80 text-center shadow-lg">
                    <p className="text-sm font-bold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{title}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default FounderHero;
