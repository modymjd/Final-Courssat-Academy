import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import InstructorCardSkeleton from "@/components/instructor/InstructorCardSkeleton";

/**
 * NavbarSkeleton - يحاكي شريط التنقل العلوي للمنصة
 */
export const NavbarSkeleton: React.FC = () => {
  return (
    <header className="bg-background/85 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 transition-all shadow-2xs">
      <div className="container mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Logo & Explore */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="w-24 h-7 rounded-md" />
          </div>
          <Skeleton className="hidden md:block w-28 h-9 rounded-xl" />
        </div>

        {/* Search Bar Skeleton */}
        <div className="hidden lg:block flex-1 max-w-md mx-4">
          <Skeleton className="w-full h-10 rounded-full" />
        </div>

        {/* Actions / User profile buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <Skeleton className="hidden sm:block w-20 h-9 rounded-xl" />
          <Skeleton className="w-24 h-9 rounded-xl" />
        </div>
      </div>
    </header>
  );
};

/**
 * HeroSkeleton - يحاكي قسم البانر التفاعلي الرئيسي (Hero Section)
 */
export const HeroSkeleton: React.FC = () => {
  return (
    <section
      className="relative h-[420px] sm:h-[480px] lg:h-[560px] overflow-hidden bg-muted/40 flex items-center justify-center border-b border-border/40"
      aria-label="جاري تحميل البانر الرئيسي"
    >
      <div className="container mx-auto px-4 h-full z-20 relative flex flex-col justify-center items-center text-center py-12 sm:py-16">
        {/* Badge Pill Skeleton */}
        <Skeleton className="h-8 w-48 rounded-full mb-6" />

        {/* Headline Skeleton */}
        <Skeleton className="h-10 sm:h-14 w-3/4 max-w-2xl rounded-xl mb-4" />
        <Skeleton className="h-8 sm:h-10 w-1/2 max-w-md rounded-lg mb-6" />

        {/* Subtitle Description Skeleton */}
        <div className="space-y-2 max-w-xl w-full mb-8 flex flex-col items-center">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
        </div>

        {/* CTA Buttons Skeleton */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Skeleton className="h-12 w-36 sm:w-44 rounded-xl" />
          <Skeleton className="h-12 w-36 sm:w-44 rounded-xl" />
        </div>

        {/* Slide indicator dots */}
        <div className="flex items-center gap-2 mt-8">
          <Skeleton className="h-2.5 w-7 rounded-full" />
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
        </div>
      </div>
    </section>
  );
};

/**
 * FeaturesSkeleton - يحاكي قسم مميزات المنصة
 */
export const FeaturesSkeleton: React.FC = () => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 flex flex-col items-center">
          <Skeleton className="h-8 w-44 rounded-lg mb-3" />
          <Skeleton className="h-4 w-72 max-w-full rounded-md" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Skeleton className="w-14 h-14 rounded-xl mb-4" />
                <Skeleton className="h-6 w-32 rounded-md mb-2" />
                <Skeleton className="h-4 w-full rounded-md mb-1.5" />
                <Skeleton className="h-4 w-4/5 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * InstructorsCarouselSkeleton - يحاكي شريط نخبة المعلمين والمدربين
 */
export const InstructorsCarouselSkeleton: React.FC = () => {
  return (
    <section className="py-16 bg-muted/20 border-y border-border/40 overflow-hidden">
      <div className="container mx-auto px-4 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <Skeleton className="h-6 w-36 rounded-full mb-3" />
            <Skeleton className="h-8 w-72 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="flex gap-6 overflow-hidden py-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[18.5rem] sm:w-[20.5rem] shrink-0 block">
              <InstructorCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * CategoriesSkeleton - يحاكي قسم استعراض التصنيفات
 */
export const CategoriesSkeleton: React.FC = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <Skeleton className="h-6 w-32 rounded-full mb-3" />
            <Skeleton className="h-8 w-60 rounded-lg mb-2" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Skeleton className="w-12 h-12 rounded-xl mb-3" />
                <Skeleton className="h-5 w-24 rounded-md mb-2" />
                <Skeleton className="h-3.5 w-16 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * FeaturedCoursesSkeleton - يحاكي قسم أبرز الدورات التدريبية
 */
export const FeaturedCoursesSkeleton: React.FC = () => {
  return (
    <section className="py-16 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <Skeleton className="h-6 w-44 rounded-full mb-3" />
            <Skeleton className="h-8 w-64 rounded-lg mb-2" />
            <Skeleton className="h-4 w-80 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-xs min-h-[360px] flex flex-col"
            >
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="p-5 space-y-3 flex-1 flex flex-col">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <Skeleton className="h-5 w-4/5 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-2/3 rounded-md" />
                <div className="pt-4 border-t border-border/40 mt-auto flex items-center justify-between">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * TestimonialsSkeleton - يحاكي قسم آراء وتقييمات الطلاب
 */
export const TestimonialsSkeleton: React.FC = () => {
  return (
    <section className="py-16 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 flex flex-col items-center">
          <Skeleton className="h-8 w-48 rounded-lg mb-3" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-6">
                <Skeleton className="w-8 h-8 rounded mb-4" />
                <div className="space-y-2 mb-6">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-24 rounded mb-1" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * CallToActionSkeleton - يحاكي البانر التحفيزي السفلي
 */
export const CallToActionSkeleton: React.FC = () => {
  return (
    <section className="py-20 bg-primary/15 relative overflow-hidden border-t border-border/40">
      <div className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
        <Skeleton className="w-12 h-12 rounded-full mb-4" />
        <Skeleton className="h-9 sm:h-11 w-3/4 max-w-xl rounded-xl mb-4" />
        <Skeleton className="h-5 w-2/3 max-w-md rounded-md mb-8" />
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Skeleton className="h-12 w-48 rounded-xl" />
          <Skeleton className="h-12 w-48 rounded-xl" />
        </div>
      </div>
    </section>
  );
};

/**
 * LandingSkeleton - المكون الأب الرئيسي الذي يمثل صفحة الهبوط بالكامل أثناء التحميل
 */
export const LandingSkeleton: React.FC = () => {
  return (
    <div
      className="min-h-screen flex flex-col bg-background text-foreground animate-fade-in"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="جاري تحميل الصفحة الرئيسية"
    >
      <NavbarSkeleton />
      <main className="flex-grow">
        <HeroSkeleton />
        <FeaturesSkeleton />
        <InstructorsCarouselSkeleton />
        <CategoriesSkeleton />
        <FeaturedCoursesSkeleton />
        <TestimonialsSkeleton />
        <CallToActionSkeleton />
      </main>
      <footer className="h-32 bg-muted/20 border-t border-border/40 flex items-center justify-center">
        <Skeleton className="h-4 w-48 rounded" />
      </footer>
    </div>
  );
};

export default LandingSkeleton;
