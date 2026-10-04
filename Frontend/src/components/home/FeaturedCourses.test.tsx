import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FeaturedCourses from "./FeaturedCourses";

vi.mock("@/features/courses", () => ({
  useFeaturedCourses: vi.fn(() => ({
    data: [
      { id: 1, title: "الدورة الأولى", instructor: { name: "أحمد" }, level: "beginner", category: { name: "برمجة" }, price: 100 },
      { id: 2, title: "الدورة الثانية", instructor: { name: "محمد" }, level: "intermediate", category: { name: "تصميم" }, price: 200 },
    ],
    isLoading: false,
  })),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("FeaturedCourses Component", () => {
  it("renders carousel container with accessibility attributes", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <FeaturedCourses />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const region = screen.getByRole("region", { name: /أبرز ٥ دورات تعليمية/i });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-roledescription", "carousel");

    const playPauseBtn = screen.getByRole("button", { name: /إيقاف التشغيل التلقائي للدورات/i });
    expect(playPauseBtn).toBeInTheDocument();
  });
});
