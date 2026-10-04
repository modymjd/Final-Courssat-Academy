import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/features/auth";
import About from "../About";
import * as aboutHook from "@/hooks/usePlatformAboutContent";

// Mock the hook to test every single state strictly
vi.mock("@/hooks/usePlatformAboutContent", () => ({
  usePlatformAboutContent: vi.fn(),
}));

describe("About Page Component - Data Flow & States", () => {
  const mockRefetch = vi.fn();
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <About />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  it("renders loading skeleton while query is in flight without inventing mock content", () => {
    vi.mocked(aboutHook.usePlatformAboutContent).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      isSuccess: false,
      isEmpty: false,
      teamMembers: [],
      partnerships: [],
      error: null,
      refetch: mockRefetch,
    } as any);

    const { container } = renderComponent();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText(/Eng. Mohamed Elhetawy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NervaX Tech/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dr. Ahmed Salem/i)).not.toBeInTheDocument();
  });

  it("renders error state with retry button on API failure (NO mock fallback)", () => {
    vi.mocked(aboutHook.usePlatformAboutContent).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      isSuccess: false,
      isEmpty: false,
      teamMembers: [],
      partnerships: [],
      error: new Error("Network Error"),
      refetch: mockRefetch,
    } as any);

    renderComponent();
    expect(screen.getByText(/تعذر تحميل معلومات الصفحة/i)).toBeInTheDocument();
    expect(screen.queryByText(/Eng. Mohamed Elhetawy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dr. Ahmed Salem/i)).not.toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /إعادة المحاولة/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when content is empty and unconfigured (NO mock fallback)", () => {
    vi.mocked(aboutHook.usePlatformAboutContent).mockReturnValue({
      data: {
        founder_name: "",
        company_name: "",
        platform_name: "",
      },
      isLoading: false,
      isError: false,
      isSuccess: true,
      isEmpty: true,
      teamMembers: [],
      partnerships: [],
      error: null,
      refetch: mockRefetch,
    } as any);

    renderComponent();
    expect(screen.getByText(/محتوى الصفحة قيد الإعداد/i)).toBeInTheDocument();
    expect(screen.queryByText(/Eng. Mohamed Elhetawy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NervaX Tech/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dr. Ahmed Salem/i)).not.toBeInTheDocument();
  });

  it("renders real dynamic data from Backend API when data is loaded", () => {
    vi.mocked(aboutHook.usePlatformAboutContent).mockReturnValue({
      data: {
        founder_name: "الأستاذ خالد السعيد",
        founder_title: "الرئيس التنفيذي والمؤسس",
        founder_quote: "رسالتنا هي تطوير التعليم الرقمي العربي بأحدث التقنيات.",
        company_name: "مؤسسة الابتكار الرقمي",
        company_tagline: "حلول تقنية تعليمية رائدة",
        company_description: "نبني منصات تعليمية تفاعلية متطورة.",
        platform_name: "منصة التميز",
        platform_tagline: "أفضل منصة للتعليم الذكي",
        platform_description: "دورات وبطاقات استذكار واختبارات فورية.",
        contact_email: "contact@altamayoz.edu",
        contact_phone: "+201112223334",
      },
      isLoading: false,
      isError: false,
      isSuccess: true,
      isEmpty: false,
      teamMembers: [
        {
          id: 101,
          name: "م. إبراهيم ناصر",
          role: "مدير البرمجيات",
          quote: "التعليم التفاعلي هو المستقبل.",
        },
      ],
      partnerships: [
        {
          id: 201,
          partner_name: "جامعة القاهرة",
          date: "2025-05-01",
          description: "شراكة أكاديمية مشتركة لتقديم شهادات معتمدة.",
        },
      ],
      error: null,
      refetch: mockRefetch,
    } as any);

    renderComponent();
    expect(screen.getAllByText(/الأستاذ خالد السعيد/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الرئيس التنفيذي والمؤسس/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/مؤسسة الابتكار الرقمي/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/منصة التميز/i)).toBeInTheDocument();
    expect(screen.getByText(/م. إبراهيم ناصر/i)).toBeInTheDocument();
    expect(screen.getByText(/جامعة القاهرة/i)).toBeInTheDocument();
    expect(screen.getByText(/contact@altamayoz.edu/i)).toBeInTheDocument();
  });
});
