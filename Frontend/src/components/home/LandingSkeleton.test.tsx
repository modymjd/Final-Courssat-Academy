import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  LandingSkeleton,
  NavbarSkeleton,
  HeroSkeleton,
  FeaturesSkeleton,
  CategoriesSkeleton,
  FeaturedCoursesSkeleton,
  InstructorsCarouselSkeleton,
  TestimonialsSkeleton,
  CallToActionSkeleton,
} from "./LandingSkeleton";

describe("LandingSkeleton and Section Skeletons", () => {
  it("renders LandingSkeleton with polite live region and busy status", () => {
    render(<LandingSkeleton />);

    const skeletonContainer = screen.getByRole("status", { name: "جاري تحميل الصفحة الرئيسية" });
    expect(skeletonContainer).toBeInTheDocument();
    expect(skeletonContainer).toHaveAttribute("aria-busy", "true");
    expect(skeletonContainer).toHaveAttribute("aria-live", "polite");
  });

  it("renders NavbarSkeleton with header element", () => {
    const { container } = render(<NavbarSkeleton />);
    expect(container.querySelector("header")).toBeInTheDocument();
  });

  it("renders HeroSkeleton with appropriate accessibility label", () => {
    render(<HeroSkeleton />);
    const heroSection = screen.getByLabelText("جاري تحميل البانر الرئيسي");
    expect(heroSection).toBeInTheDocument();
  });

  it("renders all section skeletons without throwing errors", () => {
    const { container: features } = render(<FeaturesSkeleton />);
    expect(features.querySelector("section")).toBeInTheDocument();

    const { container: categories } = render(<CategoriesSkeleton />);
    expect(categories.querySelector("section")).toBeInTheDocument();

    const { container: courses } = render(<FeaturedCoursesSkeleton />);
    expect(courses.querySelector("section")).toBeInTheDocument();

    const { container: instructors } = render(<InstructorsCarouselSkeleton />);
    expect(instructors.querySelector("section")).toBeInTheDocument();

    const { container: testimonials } = render(<TestimonialsSkeleton />);
    expect(testimonials.querySelector("section")).toBeInTheDocument();

    const { container: cta } = render(<CallToActionSkeleton />);
    expect(cta.querySelector("section")).toBeInTheDocument();
  });
});
