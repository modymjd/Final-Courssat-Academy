import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, SlidersHorizontal, Layers, BookOpen, GraduationCap, Compass } from "lucide-react";
import type { Category } from "@/types/course";
import {
  STAGE_LABELS,
  GRADE_LABELS,
  TRACK_LABELS,
  SUBJECT_LABELS,
  BRANCH_LABELS,
  getGradesForStage,
  getTracksForGrade,
  getSubjectsForTarget,
  getBranchesForSubject,
} from "@/lib/curriculumData";
import type { EducationalStage } from "@/types/curriculum";

interface CourseFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedStage?: string;
  setSelectedStage?: (stage: string) => void;
  selectedGrade?: string;
  setSelectedGrade?: (grade: string) => void;
  selectedTrack?: string;
  setSelectedTrack?: (track: string) => void;
  selectedSubject?: string;
  setSelectedSubject?: (subject: string) => void;
  selectedBranch?: string;
  setSelectedBranch?: (branch: string) => void;
  categories: Category[];
  levels: { label: string; value: string }[];
  onResetFilters?: () => void;
}

const CourseFilters: React.FC<CourseFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedStage = "all",
  setSelectedStage,
  selectedGrade = "",
  setSelectedGrade,
  selectedTrack = "",
  setSelectedTrack,
  selectedSubject = "all",
  setSelectedSubject,
  selectedBranch = "",
  setSelectedBranch,
  categories,
  levels,
  onResetFilters,
}) => {
  const stageGrades = selectedStage && selectedStage !== "all" ? getGradesForStage(selectedStage) : [];
  const gradeTracks = selectedStage && selectedGrade ? getTracksForGrade(selectedStage, selectedGrade) : [];
  const availableSubjects = getSubjectsForTarget(
    selectedStage !== "all" ? selectedStage : undefined,
    selectedGrade || undefined,
    selectedTrack || undefined
  );
  const availableBranches = getBranchesForSubject(
    selectedStage !== "all" ? selectedStage : undefined,
    selectedGrade || undefined,
    selectedSubject !== "all" ? selectedSubject : undefined
  );

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      <div className="relative flex-grow">
        <Search
          className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-muted-foreground pointer-events-none"
          size={18}
        />
        <Input
          placeholder="البحث عن مادة، مرحلة، شعبة، أو دورة تعليمية..."
          className="pe-10 h-11 bg-slate-50/90 dark:bg-card focus-visible:bg-white border-slate-200 dark:border-border/80 rounded-xl shadow-2xs text-sm font-medium"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value)}>
          <SelectTrigger className="w-full md:w-[220px] h-11 bg-slate-50/90 dark:bg-card border-slate-200 dark:border-border/80 rounded-xl shadow-2xs text-sm font-semibold text-slate-800 dark:text-foreground">
            <SelectValue placeholder="جميع التصنيفات" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 dark:border-border">
            <SelectItem value="all">جميع التصنيفات (الكل)</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.name}>
                {category.name} ({category.courseCount ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl border-slate-200 dark:border-border/80 bg-slate-50/90 dark:bg-card hover:bg-slate-100 dark:hover:bg-muted/50 text-slate-700 dark:text-foreground shadow-2xs relative"
              aria-label="تصفية متقدمة"
            >
              <SlidersHorizontal size={18} />
              {(selectedStage !== "all" || selectedGrade || selectedTrack || selectedSubject !== "all") && (
                <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-primary rounded-full" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto w-full sm:max-w-md" dir="rtl">
            <SheetHeader className="text-right">
              <SheetTitle className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-primary" />
                <span>تصفية المنظومة التعليمية</span>
              </SheetTitle>
              <SheetDescription>
                حدد المرحلة، الصف، الشُعبة، والمادة بدقة للوصول للمحتوى المعتمد رسمياً
              </SheetDescription>
            </SheetHeader>

            <div className="py-4">
              <Accordion
                type="multiple"
                defaultValue={["stages", "grades", "tracks", "subjects", "branches"]}
                className="w-full"
              >
                {/* 1. المرحلة الدراسية */}
                {setSelectedStage && (
                  <AccordionItem value="stages">
                    <AccordionTrigger className="font-bold text-sm flex items-center gap-2">
                      <GraduationCap size={16} className="text-primary" />
                      <span>1. المرحلة الدراسية</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pe-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="stage-filter"
                            id="stage-filter-all"
                            checked={selectedStage === "all"}
                            onChange={() => {
                              setSelectedStage("all");
                              setSelectedGrade?.("");
                              setSelectedTrack?.("");
                              setSelectedSubject?.("all");
                              setSelectedBranch?.("");
                            }}
                            className="w-4 h-4 text-primary"
                          />
                          <label htmlFor="stage-filter-all" className="text-sm font-medium cursor-pointer">
                            جميع المراحل الدراسية
                          </label>
                        </div>
                        {(Object.keys(STAGE_LABELS) as EducationalStage[]).map((st) => (
                          <div key={st} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="stage-filter"
                              id={`stage-filter-${st}`}
                              checked={selectedStage === st}
                              onChange={() => {
                                setSelectedStage(st);
                                setSelectedGrade?.("");
                                setSelectedTrack?.("");
                                setSelectedSubject?.("all");
                                setSelectedBranch?.("");
                              }}
                              className="w-4 h-4 text-primary"
                            />
                            <label htmlFor={`stage-filter-${st}`} className="text-sm font-medium cursor-pointer">
                              {STAGE_LABELS[st]}
                            </label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 2. الصف الدراسي */}
                {setSelectedGrade && stageGrades.length > 0 && (
                  <AccordionItem value="grades">
                    <AccordionTrigger className="font-bold text-sm flex items-center gap-2">
                      <Layers size={16} className="text-primary" />
                      <span>2. الصف الدراسي</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pe-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="grade-filter"
                            id="grade-filter-all"
                            checked={!selectedGrade}
                            onChange={() => {
                              setSelectedGrade("");
                              setSelectedTrack?.("");
                              setSelectedBranch?.("");
                            }}
                            className="w-4 h-4 text-primary"
                          />
                          <label htmlFor="grade-filter-all" className="text-sm font-medium cursor-pointer">
                            جميع صفوف المرحلة
                          </label>
                        </div>
                        {stageGrades.map((gr) => (
                          <div key={gr.id} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="grade-filter"
                              id={`grade-filter-${gr.id}`}
                              checked={selectedGrade === gr.id}
                              onChange={() => {
                                setSelectedGrade(gr.id);
                                setSelectedTrack?.("");
                                setSelectedBranch?.("");
                              }}
                              className="w-4 h-4 text-primary"
                            />
                            <label htmlFor={`grade-filter-${gr.id}`} className="text-sm font-medium cursor-pointer">
                              {gr.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 3. الشعبة / المسار (تظهر فقط عند الحاجة) */}
                {setSelectedTrack && gradeTracks.length > 0 && (
                  <AccordionItem value="tracks">
                    <AccordionTrigger className="font-bold text-sm flex items-center gap-2 text-primary">
                      <Compass size={16} />
                      <span>3. الشُعبة أو المسار التخصصي</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pe-1 bg-primary/5 p-2.5 rounded-xl border border-primary/20">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="track-filter"
                            id="track-filter-all"
                            checked={!selectedTrack}
                            onChange={() => setSelectedTrack("")}
                            className="w-4 h-4 text-primary"
                          />
                          <label htmlFor="track-filter-all" className="text-sm font-bold cursor-pointer">
                            جميع الشُعب / المسارات
                          </label>
                        </div>
                        {gradeTracks.map((tr) => (
                          <div key={tr.id} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="track-filter"
                              id={`track-filter-${tr.id}`}
                              checked={selectedTrack === tr.id}
                              onChange={() => setSelectedTrack(tr.id)}
                              className="w-4 h-4 text-primary"
                            />
                            <label htmlFor={`track-filter-${tr.id}`} className="text-sm font-semibold cursor-pointer">
                              {tr.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 4. المواد الدراسية */}
                {setSelectedSubject && (
                  <AccordionItem value="subjects">
                    <AccordionTrigger className="font-bold text-sm flex items-center gap-2">
                      <BookOpen size={16} className="text-primary" />
                      <span>4. المادة الدراسية</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pe-1 max-h-56 overflow-y-auto">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="subject-filter"
                            id="subject-filter-all"
                            checked={selectedSubject === "all"}
                            onChange={() => {
                              setSelectedSubject("all");
                              setSelectedBranch?.("");
                            }}
                            className="w-4 h-4 text-primary"
                          />
                          <label htmlFor="subject-filter-all" className="text-sm font-medium cursor-pointer">
                            جميع المواد الدراسية
                          </label>
                        </div>
                        {availableSubjects.map((subId) => (
                          <div key={subId} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="subject-filter"
                              id={`subject-filter-${subId}`}
                              checked={selectedSubject === subId}
                              onChange={() => {
                                setSelectedSubject(subId);
                                setSelectedBranch?.("");
                              }}
                              className="w-4 h-4 text-primary"
                            />
                            <label htmlFor={`subject-filter-${subId}`} className="text-sm font-medium cursor-pointer">
                              {SUBJECT_LABELS[subId] || subId}
                            </label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 5. فروع المادة (تظهر عند وجود فروع) */}
                {setSelectedBranch && availableBranches.length > 0 && (
                  <AccordionItem value="branches">
                    <AccordionTrigger className="font-bold text-sm text-teal-600 dark:text-teal-400">
                      <span>5. فرع المادة المحدد</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pe-1 bg-teal-500/10 p-2.5 rounded-xl border border-teal-500/20">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="branch-filter"
                            id="branch-filter-all"
                            checked={!selectedBranch}
                            onChange={() => setSelectedBranch("")}
                            className="w-4 h-4 text-primary"
                          />
                          <label htmlFor="branch-filter-all" className="text-sm font-medium cursor-pointer">
                            كامل المنهج (جميع الفروع)
                          </label>
                        </div>
                        {availableBranches.map((br) => (
                          <div key={br.id} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="branch-filter"
                              id={`branch-filter-${br.id}`}
                              checked={selectedBranch === br.id}
                              onChange={() => setSelectedBranch(br.id)}
                              className="w-4 h-4 text-primary"
                            />
                            <label htmlFor={`branch-filter-${br.id}`} className="text-sm font-semibold cursor-pointer">
                              {br.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1 rounded-xl font-bold text-xs"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedStage?.("all");
                  setSelectedGrade?.("");
                  setSelectedTrack?.("");
                  setSelectedSubject?.("all");
                  setSelectedBranch?.("");
                  onResetFilters?.();
                }}
              >
                إعادة ضبط جميع الفلاتر
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default CourseFilters;
