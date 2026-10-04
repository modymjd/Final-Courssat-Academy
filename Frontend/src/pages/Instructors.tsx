import React, { useState, useMemo, useDeferredValue } from "react";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useInstructors } from "@/features/users";
import InstructorCard from "@/components/instructor/InstructorCard";
import InstructorCardSkeleton from "@/components/instructor/InstructorCardSkeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, RefreshCw, Award, Users, GraduationCap } from "lucide-react";
import type { Instructor } from "@/types/auth";

const Instructors: React.FC = () => {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [specialization, setSpecialization] = useState<string>("all");
  const [ordering, setOrdering] = useState<string>("-students_count");

  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { ordering };
    if (deferredSearch.trim()) {
      params.search = deferredSearch.trim();
    }
    if (specialization !== "all") {
      params.specialization = specialization;
    }
    return params;
  }, [ordering, deferredSearch, specialization]);

  const { data: instructorsData, isLoading, isError, refetch } = useInstructors(queryParams);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const instructorsList = useMemo<Instructor[]>(() => {
    if (Array.isArray(instructorsData)) return instructorsData;
    return (instructorsData as any)?.results || (instructorsData as any)?.data || [];
  }, [instructorsData]);

  return (
    <Layout>
      {/* Hero Header */}
      <div className="relative bg-gradient-to-b from-primary/10 via-primary/5 to-transparent py-16 px-4 border-b border-border/40">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 border border-primary/20">
            <GraduationCap size={16} /> نخبة المعلمين والخبراء المعتمدين
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground mb-4 tracking-tight">
            تعلم على يد أفضل المدربين والمعلمين
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            اكتشف نخبة من الأساتذة والخبراء المعتمدين على منصة كورسات. تصفح ملفاتهم، خبراتهم، وتقييمات الطلاب لهم لتخوض رحلة تعليمية متميزة.
          </p>

          {/* Search & Filter Bar */}
          <div className="bg-card p-3 sm:p-4 rounded-2xl shadow-xl border border-border/60 max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="relative sm:col-span-6">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                type="text"
                placeholder="ابحث باسم المدرب أو التخصص..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10 bg-background border-border/80 text-sm h-11 rounded-xl"
              />
            </div>

            {/* Specialization Filter */}
            <div className="sm:col-span-3">
              <Select value={specialization} onValueChange={setSpecialization}>
                <SelectTrigger className="h-11 rounded-xl text-sm bg-background border-border/80">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter size={16} />
                    <SelectValue placeholder="التخصص" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع التخصصات</SelectItem>
                  <SelectItem value="الفيزياء">الفيزياء والرياضيات</SelectItem>
                  <SelectItem value="البرمجة">البرمجة والتكنولوجيا</SelectItem>
                  <SelectItem value="اللغات">اللغات والآداب</SelectItem>
                  <SelectItem value="العلوم">العلوم الطبية والحيوية</SelectItem>
                  <SelectItem value="إدارة">إدارة الأعمال والأعمال</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordering Selector */}
            <div className="sm:col-span-3">
              <Select value={ordering} onValueChange={setOrdering}>
                <SelectTrigger className="h-11 rounded-xl text-sm bg-background border-border/80">
                  <SelectValue placeholder="الترتيب حسب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-students_count">الأكثر طلاباً</SelectItem>
                  <SelectItem value="-rating_avg">الأعلى تقييماً</SelectItem>
                  <SelectItem value="-courses_count">الأكثر دورات</SelectItem>
                  <SelectItem value="-created_at">الأحدث انضماماً</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Directory Grid Area */}
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Active Filters Bar & Count */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">دليل المدربين</h2>
            {!isLoading && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                {instructorsList.length} مدرب
              </span>
            )}
          </div>

          {(search || specialization !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setSpecialization("all");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              إعادة ضبط الفلاتر
            </Button>
          )}
        </div>

        {/* Loading Skeleton State */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <InstructorCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          /* Error State */
          <div className="text-center py-16 px-4 bg-destructive/5 rounded-2xl border border-destructive/20 max-w-lg mx-auto">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
              <RefreshCw size={24} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">حدث خطأ في تحميل المدربين</h3>
            <p className="text-sm text-muted-foreground mb-6">
              تعذر الاتصال بالخادم لجلب قائمة المدربين. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.
            </p>
            <Button onClick={() => refetch()} className="gap-2">
              <RefreshCw size={16} /> إعادة المحاولة
            </Button>
          </div>
        ) : instructorsList.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 px-4 bg-card rounded-2xl border border-border/60 max-w-md mx-auto">
            <div className="h-16 w-16 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">لم نجد أي مدرب مطابق</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              جرب البحث عن كلمات رئيسية أخرى أو تغيير تصفية التخصصات لعرض النتائج.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setSpecialization("all");
              }}
            >
              عرض جميع المدربين
            </Button>
          </div>
        ) : (
          /* Instructors Grid */
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 xxs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {instructorsList.map((instructor) => (
              <InstructorCard key={instructor.id} instructor={instructor} />
            ))}
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default Instructors;
