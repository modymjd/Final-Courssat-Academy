import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Categories from "./Categories";

vi.mock("@/features/courses", () => ({
  useCategories: vi.fn(() => ({
    data: [
      { id: 1, name: "برمجة", slug: "programming", icon: "Globe", courseCount: 15 },
      { id: 2, name: "تصميم", slug: "design", icon: "Palette", courseCount: 8 },
    ],
    isLoading: false,
  })),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("Categories Component", () => {
  it("renders categories carousel with accessibility attributes and play/pause button", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Categories />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const region = screen.getByRole("region", { name: /أبرز ٥ تصنيفات/i });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-roledescription", "carousel");

    const playPauseBtn = screen.getByRole("button", { name: /إيقاف التشغيل التلقائي للتصنيفات/i });
    expect(playPauseBtn).toBeInTheDocument();
  });
});
