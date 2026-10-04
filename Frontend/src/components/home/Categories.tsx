import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, TrendingUp, BookOpen, Play, Pause } from "lucide-react";
import { useCategories } from "@/features/courses";
import type { Category } from "@/types/course";

/** صور Unsplash لكل فئة — مرتبطة بالـ icon name أو اسم الفئة */
const CATEGORY_IMAGES: Record<string, string> = {
  // بالـ icon name (اللي بييجي من الـ API)
  Globe:      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=75&fm=webp",
  Smartphone: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&q=75&fm=webp",
  BarChart3:  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=75&fm=webp",
  Palette:    "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=75&fm=webp",
  Shield:     "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=75&fm=webp",
  Briefcase:  "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=75&fm=webp",
  Brain:      "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=75&fm=webp",
  Network:    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=75&fm=webp",

  // بالاسم العربي للفئة (fallback لو الـ icon مش موجود)
  "برمجة":         "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=75&fm=webp",
  "تطوير الويب":   "https://images.unsplash.com/photo-1547658719-da2b51169166?w=400&q=75&fm=webp",
  "تطبيقات":       "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&q=75&fm=webp",
  "تصميم":         "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=75&fm=webp",
  "تسويق":         "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=75&fm=webp",
  "إدارة":         "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=75&fm=webp",
  "أعمال":         "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=75&fm=webp",
  "ذكاء اصطناعي":  "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=75&fm=webp",
  "أمن المعلومات": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=75&fm=webp",
  "شبكات":         "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=75&fm=webp",
  "رياضيات":       "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=75&fm=webp",
  "فيزياء":        "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&q=75&fm=webp",
  "كيمياء":        "https://images.unsplash.com/photo-1532094349884-543559921430?w=400&q=75&fm=webp",
  "أحياء":         "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&q=75&fm=webp",
  "لغة عربية":     "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=75&fm=webp",
  "لغة إنجليزية":  "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&q=75&fm=webp",
  "تاريخ":         "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&q=75&fm=webp",
  "جغرافيا":       "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=75&fm=webp",
  "اقتصاد":        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=75&fm=webp",
  "فلسفة":         "https://images.unsplash.com/photo-1509537257950-20f875b03669?w=400&q=75&fm=webp",
  "دين":           "https://images.unsplash.com/photo-1585314062604-1a357de8b000?w=400&q=75&fm=webp",
  "موسيقى":        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=75&fm=webp",
  "فنون":          "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=75&fm=webp",
  "صحة":           "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=75&fm=webp",
};

/** Fallbacks مرتبطة بكلمات مفتاحية في اسم الفئة */
const KEYWORD_IMAGES: Array<{ keyword: string; url: string }> = [
  { keyword: "برمج",   url: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=75&fm=webp" },
  { keyword: "تطوير",  url: "https://images.unsplash.com/photo-1547658719-da2b51169166?w=400&q=75&fm=webp" },
  { keyword: "تصميم",  url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=75&fm=webp" },
  { keyword: "تسويق",  url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=75&fm=webp" },
  { keyword: "إدار",   url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=75&fm=webp" },
  { keyword: "ذكاء",   url: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=75&fm=webp" },
  { keyword: "أمن",    url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=75&fm=webp" },
  { keyword: "شبك",    url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=75&fm=webp" },
  { keyword: "رياض",   url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=75&fm=webp" },
  { keyword: "فيزيا",  url: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&q=75&fm=webp" },
  { keyword: "كيميا",  url: "https://images.unsplash.com/photo-1532094349884-543559921430?w=400&q=75&fm=webp" },
  { keyword: "أحياء",  url: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&q=75&fm=webp" },
  { keyword: "لغة",    url: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&q=75&fm=webp" },
  { keyword: "موسيق",  url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=75&fm=webp" },
  { keyword: "فنون",   url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&q=75&fm=webp" },
  { keyword: "صح",     url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=75&fm=webp" },
];

/** الصورة الـ default لو ما اتعرفناش الفئة */
const DEFAULT_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=400&q=75&fm=webp";

function getCategoryImage(category: Category): string {
  // 1. بالـ icon name
  if (category.icon && CATEGORY_IMAGES[category.icon]) {
    return CATEGORY_IMAGES[category.icon];
  }
  // 2. بالاسم الكامل
  if (category.name && CATEGORY_IMAGES[category.name]) {
    return CATEGORY_IMAGES[category.name];
  }
  // 3. بكلمة مفتاحية في الاسم
  if (category.name) {
    for (const { keyword, url } of KEYWORD_IMAGES) {
      if (category.name.includes(keyword)) return url;
    }
  }
  // 4. fallback
  return DEFAULT_CATEGORY_IMAGE;
}

const GAP = 20; // px — gap-5

function useVisibleCount() {
  const getCount = () => {
    if (typeof window === "undefined") return 4;
    if (window.innerWidth >= 1024) return 5;
    if (window.innerWidth >= 768) return 4;
    if (window.innerWidth >= 640) return 3;
    return 2;
  };
  const [count, setCount] = useState(getCount);
  useEffect(() => {
    const handler = () => setCount(getCount());
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);
  return count;
}

const Categories = () => {
  const { data: rawCategories, isLoading } = useCategories({ sort: "popular", limit: 10 });

  const topCategories: Category[] = useMemo(() => {
    const list = Array.isArray(rawCategories) ? rawCategories : [];
    return list.slice(0, 10);
  }, [rawCategories]);

  const visibleCount = useVisibleCount();
  const maxIndex = Math.max(0, topCategories.length - visibleCount);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  const prev = useCallback(() => setCurrentIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setCurrentIndex((i) => Math.min(maxIndex, i + 1)), [maxIndex]);

  useEffect(() => {
    setCurrentIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  // Autoplay
  useEffect(() => {
    if (!isPlaying || maxIndex === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i >= maxIndex ? 0 : i + 1));
    }, 5500);
    return () => clearInterval(interval);
  }, [isPlaying, maxIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const itemWidth = track.offsetWidth / visibleCount;
    const offset = currentIndex * (itemWidth + GAP);
    const isRTL = document.documentElement.dir === "rtl" || document.body.dir === "rtl";
    if (typeof track.scrollTo === "function") {
      track.scrollTo({ left: isRTL ? -offset : offset, behavior: "smooth" });
    } else {
      track.scrollLeft = isRTL ? -offset : offset;
    }
  }, [currentIndex, visibleCount]);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < maxIndex;

  return (
    <section
      className="py-16 bg-muted/30 relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="أبرز ٥ تصنيفات"
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-3">
              <TrendingUp size={14} />
              <span>الأكثر متابعة</span>
            </div>
            <h2 className="text-3xl font-bold mb-2">تصفح أبرز التصنيفات</h2>
            <p className="text-muted-foreground max-w-2xl">
              اكتشف الدورات المناسبة لك عبر أكثر التصنيفات إقبالاً على المنصة
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {topCategories.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? "إيقاف التشغيل التلقائي للتصنيفات" : "تشغيل التلقائي للتصنيفات"}
                className="h-9 w-9 rounded-full"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </Button>
            )}
            {topCategories.length > visibleCount && (
              <>
                <Button
                  variant="outline" size="icon"
                  onClick={prev}
                  disabled={!canPrev}
                  aria-label="التصنيف السابق"
                  className="h-9 w-9 rounded-full"
                >
                  <ChevronRight size={16} />
                </Button>
                <Button
                  variant="outline" size="icon"
                  onClick={next}
                  disabled={!canNext}
                  aria-label="التصنيف التالي"
                  className="h-9 w-9 rounded-full"
                >
                  <ChevronLeft size={16} />
                </Button>
              </>
            )}
            <Button asChild variant="outline" className="h-9 px-4 text-sm shrink-0">
              <Link to="/courses">عرض جميع التصنيفات</Link>
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex gap-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="shrink-0 h-52 bg-muted animate-pulse rounded-2xl"
                style={{ width: `calc((100% - ${(visibleCount - 1) * GAP}px) / ${visibleCount})` }}
              />
            ))}
          </div>
        ) : topCategories.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-dashed">
            <p className="text-muted-foreground">لا تتوفر تصنيفات حالياً</p>
          </div>
        ) : (
          <>
            <div
              ref={trackRef}
              className="flex gap-5 overflow-hidden"
              style={{ scrollbarWidth: "none" }}
            >
              {topCategories.map((category) => {
                const imgUrl = getCategoryImage(category);
                return (
                  <div
                    key={category.id}
                    className="shrink-0"
                    style={{ width: `calc((100% - ${(visibleCount - 1) * GAP}px) / ${visibleCount})` }}
                  >
                    <Link to={`/category/${category.slug}`} className="block group">
                      <Card className="overflow-hidden border-border/60 hover:border-primary/40 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-card">
                        {/* صورة الفئة */}
                        <div className="relative h-36 overflow-hidden bg-muted">
                          <img
                            src={imgUrl}
                            alt={category.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_CATEGORY_IMAGE;
                            }}
                          />
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                          {/* عدد الدورات فوق الصورة */}
                          <span className="absolute bottom-2 end-2.5 text-[11px] font-bold text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md">
                            {category.courseCount || 0} دورة
                          </span>
                        </div>

                        {/* اسم الفئة */}
                        <div className="flex items-center gap-2 px-4 py-3">
                          <BookOpen size={14} className="text-primary shrink-0" />
                          <h3 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-1">
                            {category.name}
                          </h3>
                        </div>
                      </Card>
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Dot indicators */}
            {topCategories.length > visibleCount && (
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`الصفحة ${idx + 1}`}
                    aria-current={idx === currentIndex ? "true" : "false"}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? "w-8 bg-primary" : "w-2.5 bg-primary/20 hover:bg-primary/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default Categories;
