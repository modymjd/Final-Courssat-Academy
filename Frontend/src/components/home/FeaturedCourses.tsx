import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles, Play, Pause } from "lucide-react";
import CourseCard from "../course/CourseCard";
import { useFeaturedCourses } from "@/features/courses";
import type { Course } from "@/types/course";

/** عدد الكروت المرئية حسب الـ breakpoint */
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

const GAP = 24; // px — gap-6

const FeaturedCourses = () => {
  const { data: rawCourses, isLoading } = useFeaturedCourses({ sort: "popular", limit: 8 });

  const courses: Course[] = useMemo(() => {
    const list = Array.isArray(rawCourses) ? rawCourses : [];
    return list.slice(0, 8);
  }, [rawCourses]);

  const visibleCount = useVisibleCount();
  const maxIndex = Math.max(0, courses.length - visibleCount);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  const prev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((i) => Math.min(maxIndex, i + 1));
  }, [maxIndex]);

  // Reset index when courses load or visible count changes
  useEffect(() => {
    setCurrentIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  // Autoplay
  useEffect(() => {
    if (!isPlaying || maxIndex === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i >= maxIndex ? 0 : i + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, maxIndex]);

  // Scroll the track imperatively — works for both LTR/RTL DOM
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const itemWidth = track.offsetWidth / visibleCount;
    const offset = currentIndex * (itemWidth + GAP);
    // In RTL the DOM scroll direction is reversed — compensate
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
      className="py-16 bg-background relative overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="أبرز ٥ دورات تعليمية"
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
              <Sparkles size={14} />
              <span>الأعلى إقبالاً</span>
            </div>
            <h2 className="text-3xl font-bold mb-2">أبرز ٥ دورات تعليمية</h2>
            <p className="text-muted-foreground max-w-2xl">
              يتم تحديث القائمة تلقائياً بناءً على إقبال المتدربين وعدد المسجلين في الدورات
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {courses.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? "إيقاف التشغيل التلقائي للدورات" : "تشغيل التلقائي للدورات"}
                className="h-9 w-9 rounded-full"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </Button>
            )}
            {courses.length > visibleCount && (
              <>
                <Button
                  variant="outline" size="icon"
                  onClick={prev}
                  disabled={!canPrev}
                  aria-label="الدورة السابقة"
                  className="h-9 w-9 rounded-full"
                >
                  <ChevronRight size={16} />
                </Button>
                <Button
                  variant="outline" size="icon"
                  onClick={next}
                  disabled={!canNext}
                  aria-label="الدورة التالية"
                  className="h-9 w-9 rounded-full"
                >
                  <ChevronLeft size={16} />
                </Button>
              </>
            )}
            <Button asChild variant="outline" className="gap-1.5 h-9 px-4 text-sm">
              <Link to="/courses">
                عرض جميع الدورات
                <ArrowLeft size={14} />
              </Link>
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 bg-muted/60 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
            <p className="text-muted-foreground">لا تتوفر دورات مميزة حالياً</p>
          </div>
        ) : (
          <>
            {/* Scrollable track — hidden scrollbar, scrolled programmatically */}
            <div
              ref={trackRef}
              className="flex gap-6 overflow-hidden"
              style={{ scrollbarWidth: "none" }}
            >
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="shrink-0"
                  style={{ width: `calc((100% - ${(visibleCount - 1) * GAP}px) / ${visibleCount})` }}
                >
                  <CourseCard
                    id={course.id}
                    title={course.title}
                    instructor={course.instructor?.name || "مدرب معتمد"}
                    description={course.shortDescription || course.description}
                    image={course.image}
                    duration={course.duration}
                    level={course.level}
                    category={course.category?.name || "عام"}
                    price={course.price}
                    isFree={course.isFree}
                    educationalStage={course.educationalStage}
                    educationalGrade={course.educationalGrade}
                    educationalTrack={course.educationalTrack}
                    subject={course.subject}
                    subjectBranch={course.subjectBranch}
                  />
                </div>
              ))}
            </div>

            {/* Dot indicators */}
            {courses.length > visibleCount && (
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

export default FeaturedCourses;
