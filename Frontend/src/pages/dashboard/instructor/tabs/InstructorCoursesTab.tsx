import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useInstructorCourses } from "@/features/instructor";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Users,
  Star,
  Plus,
  Search,
  SlidersHorizontal,
  Edit,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import type { Course } from "@/types";

function resolveMediaUrl(src?: string | null): string {
  if (!src || !src.trim() || src === "/placeholder.svg") return "";
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("data:")) {
    return src;
  }
  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "")
    : "http://127.0.0.1:8000";
  return `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
}

export const InstructorCoursesTab: React.FC = () => {
  const { data: rawCourses, isLoading } = useInstructorCourses();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  const courses: Course[] = useMemo(() => {
    if (!rawCourses) return [];
    return Array.isArray(rawCourses) ? rawCourses : (rawCourses as any)?.results || [];
  }, [rawCourses]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch = (c.title || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "published"
          ? c.status === "published"
          : c.status !== "published";
      return matchSearch && matchStatus;
    });
  }, [courses, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = courses.length;
    const published = courses.filter((c) => c.status === "published").length;
    const drafts = total - published;
    return { total, published, drafts };
  }, [courses]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-full bg-muted/60 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 bg-muted/50 animate-pulse rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-border/70 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الكورس..."
            className="pr-10 rounded-2xl bg-muted/30 border-border/60 text-xs sm:text-sm focus-visible:ring-primary h-10"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/40 p-1 rounded-2xl border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                statusFilter === "all"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              الكل ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("published")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                statusFilter === "published"
                  ? "bg-card text-emerald-600 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              منشورة ({stats.published})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                statusFilter === "draft"
                  ? "bg-card text-amber-600 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              مسودات ({stats.drafts})
            </button>
          </div>

          <Button
            asChild
            className="gradient-cta text-white font-bold text-xs sm:text-sm rounded-2xl gap-1.5 shadow-sm"
          >
            <Link to="/instructor/courses/new">
              <Plus size={16} />
              <span>دورة جديدة</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Courses Cards Grid */}
      {filteredCourses.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-border/80 bg-card p-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} />
          </div>
          <h3 className="text-base font-bold text-foreground">لم يتم العثور على دورات</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-6">
            {searchQuery
              ? "لا توجد نتائج تطابق معايير البحث الخاصة بك. جرب كلمات بحث أخرى."
              : "لم تقم بإنشاء أي دورات تدريبية بعد. ابدأ الآن بإنشاء أول محتوى أكاديمي لك."}
          </p>
          <Button asChild className="gradient-cta text-white font-bold rounded-2xl text-xs sm:text-sm gap-1.5">
            <Link to="/instructor/courses/new">
              <Plus size={16} />
              <span>إنشاء أول كورس الآن</span>
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const imageUrl = resolveMediaUrl(course.image);
            const isPublished = course.status === "published";

            return (
              <Card
                key={course.id}
                className="group rounded-3xl border border-border/70 hover:border-primary/40 bg-card hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Cover */}
                  <div className="relative aspect-video w-full bg-muted/60 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-muted/40 text-muted-foreground p-4">
                        <BookOpen size={36} className="text-primary/40 mb-1" />
                        <span className="text-[11px] font-semibold text-muted-foreground/70">
                          لا توجد صورة غلاف
                        </span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <Badge
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm backdrop-blur-md ${
                          isPublished
                            ? "bg-emerald-500/90 text-white border-emerald-400"
                            : "bg-amber-500/90 text-white border-amber-400"
                        }`}
                      >
                        {isPublished ? "منشور 🟢" : "مسودة 📝"}
                      </Badge>
                    </div>

                    {/* Price tag */}
                    <div className="absolute bottom-3 left-3">
                      <Badge className="bg-background/90 text-foreground border-border/60 text-xs font-black px-2.5 py-0.5 rounded-xl shadow-sm backdrop-blur-md">
                        {course.isFree || !course.price ? "مجاني" : `${course.price} ج.م`}
                      </Badge>
                    </div>
                  </div>

                  {/* Course Info */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug line-clamp-2 min-h-[2.5rem]">
                      {course.title}
                    </h3>

                    {/* Metrics row */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-muted/30 rounded-2xl border border-border/40 text-center">
                      <div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Users size={12} className="text-blue-500" />
                          <span>الطلاب</span>
                        </div>
                        <p className="font-bold text-xs sm:text-sm text-foreground mt-0.5">
                          {course.studentCount ?? 0}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Layers size={12} className="text-purple-500" />
                          <span>الدروس</span>
                        </div>
                        <p className="font-bold text-xs sm:text-sm text-foreground mt-0.5">
                          {course.lessonCount ?? 0}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Star size={12} className="text-amber-500 fill-amber-500" />
                          <span>التقييم</span>
                        </div>
                        <p className="font-bold text-xs sm:text-sm text-foreground mt-0.5">
                          {course.rating ? Number(course.rating).toFixed(1) : "5.0"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 sm:p-5 pt-0 flex items-center gap-2 border-t border-border/40 mt-2">
                  <Button
                    asChild
                    className="flex-1 gradient-cta text-white font-bold text-xs rounded-xl gap-1.5 shadow-sm"
                  >
                    <Link to={`/instructor/courses/${course.id}/builder`}>
                      <Edit size={14} />
                      <span>تعديل وبناء المحتوى</span>
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className="rounded-xl border-border/80 hover:bg-muted/50 shrink-0"
                    title="معاينة صفحة الكورس"
                  >
                    <Link to={`/courses/${course.id}`} target="_blank">
                      <ExternalLink size={14} className="text-muted-foreground" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InstructorCoursesTab;
