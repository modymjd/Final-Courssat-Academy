import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotificationDropdown } from "../NotificationDropdown";

// Mock the notifications hook
vi.mock("@/features/notifications", () => ({
  useNotifications: vi.fn(),
  useMarkNotificationRead: () => ({
    mutate: vi.fn(),
  }),
  useMarkAllNotificationsRead: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

import { useNotifications } from "@/features/notifications";

describe("NotificationDropdown Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderDropdown = (open = true) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NotificationDropdown open={open} onOpenChange={vi.fn()} />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it("renders empty state with friendly message when no notifications exist", () => {
    (useNotifications as any).mockReturnValue({
      data: { data: [], unreadCount: 0 },
    });

    renderDropdown(true);

    expect(screen.getByRole("heading", { name: "الإشعارات" })).toBeInTheDocument();
    expect(screen.getByText(/أنت على اطلاع بكل جديد!/i)).toBeInTheDocument();
    expect(screen.getByText(/محدّث بالكامل/i)).toBeInTheDocument();
    expect(screen.getByText(/عرض كافة الإشعارات في صفحة مخصصة/i)).toBeInTheDocument();
  });

  it("renders notification items, tabs, and unread badge when notifications exist", () => {
    (useNotifications as any).mockReturnValue({
      data: {
        unreadCount: 1,
        data: [
          {
            id: 1,
            userId: 10,
            type: "course_update",
            title: "تم إضافة درس جديد في الرياضيات",
            message: "قام الأستاذ برفع فيديو شرح الفصل الثالث.",
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: 2,
            userId: 10,
            type: "grade_posted",
            title: "نتيجة اختبار الفيزياء",
            message: "حصلت على 95% في الاختبار النصفي.",
            isRead: true,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });

    renderDropdown(true);

    // Unread count badge and button
    expect(screen.getByText(/1 جديدة/i)).toBeInTheDocument();
    expect(screen.getByText(/تحديد الكل كمقروء/i)).toBeInTheDocument();

    // Filter tabs
    expect(screen.getByText(/الكل \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/غير المقروءة \(1\)/i)).toBeInTheDocument();

    // Notification titles
    expect(screen.getByText(/تم إضافة درس جديد في الرياضيات/i)).toBeInTheDocument();
    expect(screen.getByText(/نتيجة اختبار الفيزياء/i)).toBeInTheDocument();

    // Filter switching
    const unreadTab = screen.getByText(/غير المقروءة \(1\)/i);
    fireEvent.click(unreadTab);

    expect(screen.getByText(/تم إضافة درس جديد في الرياضيات/i)).toBeInTheDocument();
    expect(screen.queryByText(/نتيجة اختبار الفيزياء/i)).not.toBeInTheDocument();
  });
});
