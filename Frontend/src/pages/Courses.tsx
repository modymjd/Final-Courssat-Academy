import { useState, useMemo, useDeferredValue, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CourseFilters from "@/components/course/CourseFilters";
import CourseGrid from "@/components/course/CourseGrid";
import CoursePagination from "@/components/course/CoursePagination";
import { useCourses, useCategories, LEVELS } from "@/features/courses";
import type { Course } from "@/types/course";
import { Filter, X, Sparkles, BookOpen } from "lucide-react";
import {
  STAGE_LABELS,
  GRADE_LABELS,
  TRACK_LABELS,
  SUBJECT_LABELS,
  BRANCH_LABELS,
} from "@/lib/curriculumData";

const Courses = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query params
  const urlSearch = searchParams.get("search") || "";
  const urlCategory = searchParams.get("category") || "all";
  const urlStage = searchParams.get("educational_stage") || "all";
  const urlGrade = searchParams.get("educational_grade") || "";
  const urlTrack = searchParams.get("educational_track") || "";
  const urlSubject = searchParams.get("subject") || "all";
  const urlBranch = searchParams.get("subject_branch") || "";
  const urlIsFree = searchParams.get("is_free") === "true";
  const urlSortBy = searchParams.get("sortBy") || (urlIsFree ? "free" : "all");

  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState(urlCategory);
  const [selectedStage, setSelectedStage] = useState(urlStage);
  const [selectedGrade, setSelectedGrade] = useState(urlGrade);
  const [selectedTrack, setSelectedTrack] = useState(urlTrack);
  const [selectedSubject, setSelectedSubject] = useState(urlSubject);
  const [selectedBranch, setSelectedBranch] = useState(urlBranch);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(urlSortBy);

  // Sync state when URL params change (e.g. user clicked in Header mega-menu)
  useEffect(() => {
    setSearchQuery(urlSearch);
    setSelectedCategory(urlCategory);
    setSelectedStage(urlStage);
    setSelectedGrade(urlGrade);
    setSelectedTrack(urlTrack);
    setSelectedSubject(urlSubject);
    setSelectedBranch(urlBranch);
    setSortBy(urlSortBy);
    setPage(1);
  }, [urlSearch, urlCategory, urlStage, urlGrade, urlTrack, urlSubject, urlBranch, urlSortBy]);

  // Update URL helper
  const updateUrlParam = (key: string, value: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!value || value === "all") {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams);
  };

  const removeFilter = (key: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(key);
    if (key === "educational_stage") {
      nextParams.delete("educational_grade");
      nextParams.delete("educational_track");
      nextParams.delete("subject_branch");
      setSelectedStage("all");
      setSelectedGrade("");
      setSelectedTrack("");
      setSelectedBranch("");
    } else if (key === "educational_grade") {
      nextParams.delete("educational_track");
      nextParams.delete("subject_branch");
      setSelectedGrade("");
      setSelectedTrack("");
      setSelectedBranch("");
    } else if (key === "educational_track") {
      setSelectedTrack("");
    } else if (key === "subject") {
      nextParams.delete("subject_branch");
      setSelectedSubject("all");
      setSelectedBranch("");
    } else if (key === "subject_branch") {
      setSelectedBranch("");
    } else if (key === "category") {
      setSelectedCategory("all");
    } else if (key === "search") {
      setSearchQuery("");
    } else if (key === "free") {
      nextParams.delete("is_free");
      if (sortBy === "free") setSortBy("all");
    }
    setSearchParams(nextParams);
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedStage("all");
    setSelectedGrade("");
    setSelectedTrack("");
    setSelectedSubject("all");
    setSelectedBranch("");
    setSortBy("all");
    setPage(1);
    setSearchParams(new URLSearchParams());
  };

  const filters = useMemo(() => {
    const f: Record<string, unknown> = {};
    if (deferredSearch.trim()) f.search = deferredSearch.trim();
    if (selectedCategory !== "all") f.category = selectedCategory;
    if (selectedStage !== "all") f.educational_stage = selectedStage;
    if (selectedGrade) f.educational_grade = selectedGrade;
    if (selectedTrack) f.educational_track = selectedTrack;
    if (selectedSubject !== "all") f.subject = selectedSubject;
    if (selectedBranch) f.subject_branch = selectedBranch;
    if (sortBy === "free" || urlIsFree) f.is_free = true;

    if (sortBy === "popular") f.ordering = "-rating";
    else if (sortBy === "trending") f.ordering = "-students_count";
    else if (sortBy === "new") f.ordering = "-created_at";
    return f;
  }, [
    deferredSearch,
    selectedCategory,
    selectedStage,
    selectedGrade,
    selectedTrack,
    selectedSubject,
    selectedBranch,
    sortBy,
    urlIsFree,
  ]);

  const { data: coursesResponse, isLoading: isCoursesLoading } = useCourses(filters, page, 12);
  const { data: categoriesData, isLoading: isCategoriesLoading } = useCategories();

  const categories = useMemo(() => {
    if (Array.isArray(categoriesData)) return categoriesData;
    if (categoriesData && typeof categoriesData === "object" && "results" in categoriesData) {
      return (categoriesData as any).results || [];
    }
    return [];
  }, [categoriesData]);

  const processedCourses: Course[] = useMemo(() => {
    if (Array.isArray(coursesResponse)) return coursesResponse;
    if (coursesResponse && typeof coursesResponse === "object") {
      return coursesResponse.data || [];
    }
    return [];
  }, [coursesResponse]);

  const totalPages = useMemo(() => {
    if (coursesResponse && typeof coursesResponse === "object") {
      if ("count" in coursesResponse && typeof coursesResponse.count === "number") {
        return Math.ceil(coursesResponse.count / 12) || 1;
      }
      if ("total" in coursesResponse && typeof coursesResponse.total === "number") {
        return Math.ceil(coursesResponse.total / 12) || 1;
      }
      if ("totalPages" in coursesResponse && typeof coursesResponse.totalPages === "number") {
        return coursesResponse.totalPages;
      }
    }
    return 1;
  }, [coursesResponse]);

  const hasActiveFilters = Boolean(
    (selectedStage && selectedStage !== "all") ||
      selectedGrade ||
      selectedTrack ||
      (selectedSubject && selectedSubject !== "all") ||
      selectedBranch ||
      (selectedCategory && selectedCategory !== "all") ||
      deferredSearch.trim() ||
      sortBy === "free" ||
      urlIsFree
  );

  // Dynamic header based on active filters
  const pageTitle = useMemo(() => {
    if (selectedBranch && BRANCH_LABELS[selectedBranch]) {
      const subjectName = selectedSubject !== "all" && SUBJECT_LABELS[selectedSubject] ? ` (${SUBJECT_LABELS[selectedSubject]})` : "";
      return `مقررات ${BRANCH_LABELS[selectedBranch]}${subjectName}`;
    }
    if (selectedTrack && TRACK_LABELS[selectedTrack]) {
      const gradeName = selectedGrade && GRADE_LABELS[selectedGrade] ? ` - ${GRADE_LABELS[selectedGrade]}` : "";
      return `مقررات شعبة ${TRACK_LABELS[selectedTrack]}${gradeName}`;
    }
    if (selectedGrade && GRADE_LABELS[selectedGrade]) {
      return `مقررات ${GRADE_LABELS[selectedGrade]}`;
    }
    if (selectedStage && selectedStage !== "all" && STAGE_LABELS[selectedStage]) {
      return `مقررات ${STAGE_LABELS[selectedStage]}`;
    }
    if (selectedSubject && selectedSubject !== "all" && SUBJECT_LABELS[selectedSubject]) {
      return `دورات ومقررات ${SUBJECT_LABELS[selectedSubject]}`;
    }
    if (selectedCategory && selectedCategory !== "all") {
      return `مسار ${selectedCategory}`;
    }
    if (sortBy === "free") {
      return "الدورات والمحاضرات المجانية";
    }
    return "استكشف المقررات والدورات التعليمية";
  }, [selectedBranch, selectedTrack, selectedGrade, selectedStage, selectedSubject, selectedCategory, sortBy]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 20 } },
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 sm:px-6">
        {/* Page Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs mb-3">
            <BookOpen size={14} />
            <span>الدليل الأكاديمي الشامل</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold mb-3 text-slate-900 dark:text-foreground tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-slate-600 dark:text-muted-foreground max-w-2xl mx-auto text-xs sm:text-sm leading-relaxed">
            تصفح المقررات الدراسية المعتمدة، المواد التخصصية، ومسارات المهارات المهنية مع نخبة من أفضل المعلمين والمحاضرين.
          </p>
        </motion.div>

        {/* Filter Controls */}
        <div className="mb-6">
          <CourseFilters
            searchQuery={searchQuery}
            setSearchQuery={(q) => {
              setSearchQuery(q);
              setPage(1);
              updateUrlParam("search", q.trim() || null);
            }}
            selectedCategory={selectedCategory}
            setSelectedCategory={(c) => {
              setSelectedCategory(c);
              setPage(1);
              updateUrlParam("category", c !== "all" ? c : null);
            }}
            selectedStage={selectedStage}
            setSelectedStage={(st) => {
              setSelectedStage(st);
              setSelectedGrade("");
              setSelectedTrack("");
              setSelectedBranch("");
              setPage(1);
              const nextParams = new URLSearchParams(searchParams);
              if (!st || st === "all") {
                nextParams.delete("educational_stage");
              } else {
                nextParams.set("educational_stage", st);
              }
              nextParams.delete("educational_grade");
              nextParams.delete("educational_track");
              nextParams.delete("subject_branch");
              setSearchParams(nextParams);
            }}
            selectedGrade={selectedGrade}
            setSelectedGrade={(gr) => {
              setSelectedGrade(gr);
              setSelectedTrack("");
              setSelectedBranch("");
              setPage(1);
              const nextParams = new URLSearchParams(searchParams);
              if (!gr) {
                nextParams.delete("educational_grade");
              } else {
                nextParams.set("educational_grade", gr);
              }
              nextParams.delete("educational_track");
              nextParams.delete("subject_branch");
              setSearchParams(nextParams);
            }}
            selectedTrack={selectedTrack}
            setSelectedTrack={(tr) => {
              setSelectedTrack(tr);
              setPage(1);
              updateUrlParam("educational_track", tr || null);
            }}
            selectedSubject={selectedSubject}
            setSelectedSubject={(sub) => {
              setSelectedSubject(sub);
              setSelectedBranch("");
              setPage(1);
              const nextParams = new URLSearchParams(searchParams);
              if (!sub || sub === "all") {
                nextParams.delete("subject");
              } else {
                nextParams.set("subject", sub);
              }
              nextParams.delete("subject_branch");
              setSearchParams(nextParams);
            }}
            selectedBranch={selectedBranch}
            setSelectedBranch={(br) => {
              setSelectedBranch(br);
              setPage(1);
              updateUrlParam("subject_branch", br || null);
            }}
            categories={categories}
            levels={LEVELS}
            onResetFilters={clearAllFilters}
          />

          {/* Active Filters Bar */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-muted/40 rounded-2xl border border-border/70 animate-in fade-in-50">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 ms-1">
                <Filter size={14} />
                <span>الفلاتر النشطة:</span>
              </span>

              {selectedStage && selectedStage !== "all" && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 rounded-xl text-xs bg-primary/10 text-primary border border-primary/20"
                >
                  <span>المرحلة: {STAGE_LABELS[selectedStage] || selectedStage}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter("educational_stage")}
                    className="hover:text-destructive"
                    aria-label="إزالة فلتر المرحلة"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}

              {selectedGrade && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 rounded-xl text-xs bg-primary/10 text-primary border border-primary/20"
                >
                  <span>الصف: {GRADE_LABELS[selectedGrade] || selectedGrade}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter("educational_grade")}
                    className="hover:text-destructive"
                    aria-label="إزالة فلتر الصف"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}

              {selectedTrack && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 rounded-xl text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                >
                  <span>الشعبة / المسار: {TRACK_LABELS[selectedTrack] || selectedTrack}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter("educational_track")}
                    className="hover:text-destructive"
                    aria-label="إزالة فلتر الشعبة"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}

              {selectedSubject && selectedSubject !== "all" && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 rounded-xl text-xs bg-primary/10 text-primary border border-primary/20"
                >
                  <span>المادة: {SUBJECT_LABELS[selectedSubject] || selectedSubject}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter("subject")}
                    className="hover:text-destructive"
                    aria-label="إزالة فلتر المادة"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}

              {selectedBranch && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 rounded-xl text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                >
                  <span>الفرع: {BRANCH_LABELS[selectedBranch] || selectedBranch}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter("subject_branch")}
                    className="hover:text-destructive"
                    aria-label="إزالة فلتر الفرع"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}

              {selectedCategory && selectedCategory !== "all" && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 rounded-xl text-xs bg-primary/10 text-primary border border-primary/20"
                >
                  <span>التصنيف: {selectedCategory}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter("category")}
                    className="hover:text-destructive"
                    aria-label="إزالة فلتر التصنيف"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}

              {(sortBy === "free" || urlIsFree) && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 rounded-xl text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                >
                  <span>دورات ومحاضرات مجانية 🎁</span>
                  <button
                    type="button"
                    onClick={() => removeFilter("free")}
                    className="hover:text-destructive"
                    aria-label="إزالة فلتر المجانية"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}

              {deferredSearch.trim() && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 rounded-xl text-xs bg-card text-foreground border border-border"
                >
                  <span>بحث: "{deferredSearch.trim()}"</span>
                  <button
                    type="button"
                    onClick={() => removeFilter("search")}
                    className="hover:text-destructive"
                    aria-label="إزالة كلمة البحث"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs text-destructive hover:text-destructive/80 font-bold h-7 px-2 rounded-lg ms-auto"
              >
                مسح كافة الفلاتر
              </Button>
            </div>
          )}

          {/* Sort Tabs */}
          <Tabs
            value={sortBy}
            onValueChange={(val) => {
              setSortBy(val);
              setPage(1);
              updateUrlParam("sortBy", val !== "all" ? val : null);
              if (val === "free") {
                updateUrlParam("is_free", "true");
              } else {
                updateUrlParam("is_free", null);
              }
            }}
            className="w-full"
          >
            <TabsList className="mb-6 grid grid-cols-3 sm:grid-cols-5 h-11 bg-slate-100 dark:bg-muted p-1 rounded-2xl border border-slate-200/80 dark:border-border/80">
              <TabsTrigger value="all" className="rounded-xl font-bold text-xs sm:text-sm">
                الكل
              </TabsTrigger>
              <TabsTrigger value="popular" className="rounded-xl font-bold text-xs sm:text-sm">
                الأكثر شعبية
              </TabsTrigger>
              <TabsTrigger value="new" className="rounded-xl font-bold text-xs sm:text-sm">
                الأحدث
              </TabsTrigger>
              <TabsTrigger value="trending" className="rounded-xl font-bold text-xs sm:text-sm">
                الرائجة
              </TabsTrigger>
              <TabsTrigger value="free" className="rounded-xl font-bold text-xs sm:text-sm">
                المجانية 🎁
              </TabsTrigger>
            </TabsList>

            <TabsContent value={sortBy}>
              <CourseGrid
                courses={processedCourses}
                isLoading={isCoursesLoading || isCategoriesLoading}
                itemVariants={itemVariants}
                containerVariants={containerVariants}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <CoursePagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </Layout>
  );
};

export default Courses;
