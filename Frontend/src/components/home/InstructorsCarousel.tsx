import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Award, ChevronLeft, ChevronRight, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useInstructors } from "@/features/users";
import InstructorCard from "@/components/instructor/InstructorCard";
import InstructorCardSkeleton from "@/components/instructor/InstructorCardSkeleton";

const GAP = 20; // px — gap-5

function useVisibleCount() {
  const getCount = () => {
    if (typeof window === "undefined") return 3;
    if (window.innerWidth >= 1280) return 4;
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
  };
  const [count, setCount] = useState(getCount);
  useEffect(() => {
    const handler = () => setCount(getCount());
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);
  return count;
}

const InstructorsCarousel = () => {
  const { data, isLoading, isError, refetch } = useInstructors({
    ordering: "-students_count",
    limit: 12,
  });

  const instructorsList = useMemo<any[]>(() => {
    if (Array.isArray(data)) return data;
    const payload = data as { results?: any[]; data?: any[] } | undefined;
    return payload?.results ?? payload?.data ?? [];
  }, [data]);

  const visibleCount = useVisibleCount();
  const maxIndex = Math.max(0, instructorsList.length - visibleCount);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const prev = useCallback(() => setCurrentIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setCurrentIndex((i) => Math.min(maxIndex, i + 1)), [maxIndex]);

  useEffect(() => {
    setCurrentIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const itemWidth = track.offsetWidth / visibleCount;
    const offset = currentIndex * (itemWidth + GAP);
    const isRTL = document.documentElement.dir === "rtl" || document.body.dir === "rtl";
    track.scrollTo({ left: isRTL ? -offset : offset, behavior: "smooth" });
  }, [currentIndex, visibleCount]);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < maxIndex;

  return (
    <section className="py-14 sm:py-16 bg-background border-b border-border/50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-9">
          <div className="text-center sm:text-start max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
              <Award size={14} />
              <span>المعلمون على المنصة</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">تعلم من المعلمين والخبراء</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              بيانات المعلمين المعروضة هنا مأخوذة مباشرة من حساباتهم الحقيقية.
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {instructorsList.length > visibleCount && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={prev}
                  disabled={!canPrev}
                  aria-label="المعلم السابق"
                  className="h-10 w-10 rounded-full"
                >
                  <ChevronRight size={18} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={next}
                  disabled={!canNext}
                  aria-label="المعلم التالي"
                  className="h-10 w-10 rounded-full"
                >
                  <ChevronLeft size={18} />
                </Button>
              </>
            )}
            <Button asChild variant="outline" className="gap-1.5 h-10 px-4 text-sm">
              <Link to="/instructors">
                <LinkIcon size={14} />
                كل المعلمين
              </Link>
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex gap-5">
            {Array.from({ length: visibleCount }).map((_, i) => (
              <div
                key={i}
                className="shrink-0"
                style={{ width: `calc((100% - ${(visibleCount - 1) * GAP}px) / ${visibleCount})` }}
              >
                <InstructorCardSkeleton />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="max-w-xl mx-auto rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
            <p className="font-bold">تعذر تحميل بيانات المعلمين حاليًا.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-sm font-bold text-primary hover:underline"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : instructorsList.length === 0 ? (
          <div className="max-w-xl mx-auto rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            لا توجد بيانات لمعلمي المنصة حتى الآن.
          </div>
        ) : (
          <>
            {/* Carousel Track */}
            <div
              ref={trackRef}
              className="flex gap-5 overflow-hidden"
              style={{ scrollbarWidth: "none" }}
            >
              {instructorsList.map((instructor, index) => (
                <div
                  key={`${instructor.id}-${index}`}
                  className="shrink-0"
                  style={{
                    width: `calc((100% - ${(visibleCount - 1) * GAP}px) / ${visibleCount})`,
                  }}
                >
                  <InstructorCard instructor={instructor} actionText="عرض الملف" />
                </div>
              ))}
            </div>

            {/* Dot indicators */}
            {instructorsList.length > visibleCount && (
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`الصفحة ${idx + 1}`}
                    aria-current={idx === currentIndex ? "true" : "false"}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      idx === currentIndex
                        ? "w-8 bg-primary"
                        : "w-2.5 bg-primary/20 hover:bg-primary/40"
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

export default InstructorsCarousel;
