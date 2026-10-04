import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Award, BookOpen, GraduationCap, LayoutDashboard, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePlatformTheme } from "@/hooks/usePlatformTheme";
import { useAuth } from "@/features/auth";


const SLIDES = [
  {
    badge: "أكثر من ١٠٠٠ دورة تعليمية",
    badgeIcon: Sparkles,
    heading: "استكشف عالم التعلم الإلكتروني",
    highlight: "كورسات",
    description:
      "آلاف الدورات التفاعلية في مختلف المجالات. تعلم بطريقتك الخاصة، في أي وقت وأي مكان.",
    cta: { label: "تصفح الدورات", to: "/courses", icon: GraduationCap },
    accent: "bg-primary/15",
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1280&q=75&fm=webp",
  },
  {
    badge: "مدربون معتمدون",
    badgeIcon: Award,
    heading: "تعلّم على يد أفضل",
    highlight: "الخبراء",
    description:
      "نخبة من المدربين المعتمدين في البرمجة والتصميم والتسويق والمزيد. احصل على شهادات معترف بها.",
    cta: { label: "تعرّف على المدربين", to: "/instructors", icon: Users },
    accent: "bg-achievement/15",
    image:
      "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1280&q=75&fm=webp",
  },
  {
    badge: "مسارات تعليمية متكاملة",
    badgeIcon: BookOpen,
    heading: "ابنِ مسيرتك المهنية مع",
    highlight: "مساراتنا",
    description:
      "مسارات تعليمية مصممة بعناية تأخذك من المبتدئ إلى المحترف خطوة بخطوة مع مشاريع تطبيقية.",
    cta: { label: "استكشف المسارات", to: "/courses", icon: GraduationCap },
    accent: "bg-primary/15",
    image:
      "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=1280&q=75&fm=webp",
  },
];

const INTERVAL = 6000;

const Hero = () => {
  const { user, isAuthenticated } = useAuth();
  const { data: themeData } = usePlatformTheme();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);

  const dashboardUrl = user?.role === "center"
    ? "/center/dashboard"
    : user?.role === "instructor"
    ? "/instructor/dashboard"
    : user?.role === "admin" || user?.role === "super_admin"
    ? "/admin/dashboard"
    : "/dashboard";

  const dashboardLabel = user?.role === "center"
    ? "لوحة تحكم السنتر"
    : user?.role === "instructor"
    ? "لوحة تحكم المحاضر"
    : user?.role === "admin" || user?.role === "super_admin"
    ? "لوحة الإدارة"
    : "متابعة دراستي";

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeSlides = useMemo(() => {
    const slides = SLIDES.map((s) => ({ ...s }));
    if (themeData) {
      if (themeData.hero_title) {
        slides[0].heading = themeData.hero_title;
        slides[0].highlight = "";
      }
      if (themeData.hero_subtitle) {
        slides[0].description = themeData.hero_subtitle;
      }
      if (themeData.heroBannerUrl) {
        slides[0].image = themeData.heroBannerUrl;
      }
    }
    return slides;
  }, [themeData]);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % activeSlides.length);
  }, [activeSlides.length]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, INTERVAL);
    return () => clearInterval(id);
  }, [paused, next]);

  const slide = activeSlides[current];
  const BadgeIcon = slide.badgeIcon;


  return (
    <section
      className="relative h-[420px] sm:h-[480px] lg:h-[560px] overflow-hidden bg-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background images — rendered as native img elements so browser preload scanner detects LCP image immediately */}
      {SLIDES.map((s, i) => (
        <img
          key={i}
          src={s.image}
          alt=""
          fetchPriority={i === 0 ? "high" : "low"}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            i === current ? "opacity-50" : "opacity-0"
          }`}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-foreground/55 via-foreground/45 to-foreground/65 z-10" />

      {mounted && (
        <div
          key={`blob-${current}`}
          className={`absolute top-20 end-10 w-72 h-72 rounded-full ${slide.accent} blur-3xl z-[5] animate-fade-in duration-700`}
        />
      )}
      <div className="absolute bottom-10 start-10 w-56 h-56 rounded-full bg-achievement/10 blur-3xl z-[5]" />

      <div className="container mx-auto px-4 h-full z-20 relative">
        <div className="flex flex-col justify-center items-center h-full text-center py-12 sm:py-16 lg:py-20">
          <div className="relative">
            <div
              key={current}
              className="flex flex-col items-center animate-slide-down duration-500"
            >
              <div className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground rounded-full px-3 py-1 sm:px-4 sm:py-1.5 mb-4 sm:mb-6 text-xs sm:text-sm font-medium backdrop-blur-sm border border-primary/30">
                <BadgeIcon size={14} />
                {slide.badge}
              </div>

              <h1 className="text-xl xxs:text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-primary-foreground mb-3 sm:mb-5 max-w-4xl leading-tight px-1 xxs:px-2">
                {slide.heading}{" "}
                <span className="text-primary">{slide.highlight}</span>
              </h1>

              <p className="text-xs xxs:text-sm sm:text-base md:text-lg lg:text-xl text-primary-foreground/80 mb-5 sm:mb-8 max-w-2xl leading-relaxed px-2 xxs:px-4">
                {slide.description}
              </p>

              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                {isAuthenticated ? (
                  <>
                    <Button asChild size="default" className="text-xs xs:text-sm sm:text-base px-3 xs:px-6 gap-1.5 sm:gap-2 h-9 sm:h-11 font-bold outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 select-none">
                      <Link to={dashboardUrl}>
                        <LayoutDashboard size={16} className="sm:w-[18px] sm:h-[18px]" />
                        <span>{dashboardLabel}</span>
                        <ArrowLeft size={13} className="sm:w-4 sm:h-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="default"
                      className="text-xs xs:text-sm sm:text-base px-3 xs:px-6 h-9 sm:h-11 bg-primary-foreground/10 border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/25 hover:text-primary-foreground font-semibold outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 select-none transition-colors"
                    >
                      <Link to="/courses">تصفح الدورات والمقررات</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="default" className="text-xs xs:text-sm sm:text-base px-3 xs:px-6 gap-1.5 sm:gap-2 h-9 sm:h-11 font-bold outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 select-none">
                      <Link to={slide.cta.to}>
                        <slide.cta.icon size={15} className="sm:w-[18px] sm:h-[18px]" />
                        <span>{slide.cta.label}</span>
                        <ArrowLeft size={13} className="sm:w-4 sm:h-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="default"
                      className="text-xs xs:text-sm sm:text-base px-3 xs:px-6 h-9 sm:h-11 bg-primary-foreground/10 border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/25 hover:text-primary-foreground font-semibold outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 select-none transition-colors"
                    >
                      <Link to="/register">انضم الآن مجاناً</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6 sm:mt-10">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`الانتقال إلى الشريحة ${i + 1}`}
                className="relative p-1"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    i === current
                      ? "w-8 h-2 bg-primary"
                      : "w-2 h-2 bg-primary-foreground/40 hover:bg-primary-foreground/60"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
