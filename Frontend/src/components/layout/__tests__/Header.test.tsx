import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach } from "vitest";
import { AuthProvider } from "@/features/auth";
import Header from "../Header";

describe("Header Component with Coursera-Style Explore Mega Menu", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderHeader = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Header />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  it("renders the brand name and the new Explore button", () => {
    renderHeader();
    const brandElement = screen.getByText(/كورسات/i);
    expect(brandElement).toBeInTheDocument();
    expect(brandElement).toHaveClass("font-calligraphy");
    expect(screen.getByRole("button", { name: /استكشف/i })).toBeInTheDocument();
  });

  it("opens the Coursera-style Explore Mega Menu on click and displays stages and subjects", () => {
    renderHeader();
    const exploreBtn = screen.getByRole("button", { name: /استكشف/i });
    expect(screen.queryByText(/الابتدائي والإعدادي/i)).not.toBeInTheDocument();

    // Click explore button
    fireEvent.click(exploreBtn);

    // Should now display the 4 columns
    expect(screen.getByText(/الابتدائي والإعدادي/i)).toBeInTheDocument();
    expect(screen.getByText(/الثانوية العامة/i)).toBeInTheDocument();
    expect(screen.getByText(/البكالوريا المصرية/i)).toBeInTheDocument();
    expect(screen.getByText(/مقررات حديثة وأدوات المنصة/i)).toBeInTheDocument();

    // Check specific stages and grades
    expect(screen.getByText(/الصف الثالث الثانوي/i)).toBeInTheDocument();
    expect(screen.getByText(/مسار الطب والعلوم/i)).toBeInTheDocument();

    // Check bottom banner
    expect(screen.getByText(/لست متأكداً من أين تبدأ؟/i)).toBeInTheDocument();
    expect(screen.getByText(/تصفح الدورات المجانية/i)).toBeInTheDocument();
  });

  it("closes the Explore Mega Menu when clicking the explore button again", async () => {
    renderHeader();
    const exploreBtn = screen.getByRole("button", { name: /استكشف/i });
    
    // Open
    fireEvent.click(exploreBtn);
    expect(screen.getByText(/الابتدائي والإعدادي/i)).toBeInTheDocument();

    // Close
    fireEvent.click(exploreBtn);
    await waitFor(() => {
      expect(screen.queryByText(/الابتدائي والإعدادي/i)).not.toBeInTheDocument();
    });
  });
});
