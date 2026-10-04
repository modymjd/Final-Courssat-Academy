import { lazy, Suspense } from "react";
import Layout from "@/components/layout/Layout";
import Hero from "@/components/home/Hero";
import {
  FeaturesSkeleton,
  InstructorsCarouselSkeleton,
  CategoriesSkeleton,
  FeaturedCoursesSkeleton,
  TestimonialsSkeleton,
  CallToActionSkeleton,
} from "@/components/home/LandingSkeleton";

const Features = lazy(() => import("@/components/home/Features"));
const InstructorsCarousel = lazy(() => import("@/components/home/InstructorsCarousel"));
const Categories = lazy(() => import("@/components/home/Categories"));
const FeaturedCourses = lazy(() => import("@/components/home/FeaturedCourses"));
const Testimonials = lazy(() => import("@/components/home/Testimonials"));
// const Stats = lazy(() => import("@/components/home/Stats"));
const CallToAction = lazy(() => import("@/components/home/CallToAction"));

const Index = () => {
  return (
    <Layout>
      <Hero />
      {/* قسم الإحصائيات معطل مؤقتاً */}
      {/* <Suspense fallback={<div className="h-24 bg-muted animate-pulse" />}>
        <Stats />
      </Suspense> */}
      <Suspense fallback={<FeaturesSkeleton />}>
        <Features />
      </Suspense>
      <Suspense fallback={<InstructorsCarouselSkeleton />}>
        <InstructorsCarousel />
      </Suspense>
      <Suspense fallback={<CategoriesSkeleton />}>
        <Categories />
      </Suspense>
      <Suspense fallback={<FeaturedCoursesSkeleton />}>
        <FeaturedCourses />
      </Suspense>
      <Suspense fallback={<TestimonialsSkeleton />}>
        <Testimonials />
      </Suspense>
      <Suspense fallback={<CallToActionSkeleton />}>
        <CallToAction />
      </Suspense>
    </Layout>
  );
};

export default Index;

