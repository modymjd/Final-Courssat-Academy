import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/http";
import type { InstructorDailyBrief, AcademicTask, KanbanTasksResponse, TaskPriority, TaskStatus, TaskType } from "@/types";

export async function getInstructorDailyBrief(): Promise<InstructorDailyBrief | null> {
  const res = await apiGet<InstructorDailyBrief>("/analytics/instructor/daily-brief/");
  return res ?? null;
}

export async function getAcademicTasks(): Promise<AcademicTask[]> {
  const res = await apiGet<AcademicTask[]>("/academic-tools/tasks/");
  return res ?? [];
}

export async function getKanbanTasks(): Promise<KanbanTasksResponse> {
  const res = await apiGet<KanbanTasksResponse>("/academic-tools/tasks/kanban/");
  return res ?? { pending: [], in_progress: [], completed: [] };
}

export async function createAcademicTask(data: {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  task_type?: TaskType;
  due_date?: string | null;
  course?: number | null;
}) {
  return apiPost<AcademicTask>("/academic-tools/tasks/", data);
}

export async function updateAcademicTask(
  id: number,
  data: Partial<{
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    due_date: string | null;
  }>,
) {
  return apiPatch<AcademicTask>(`/academic-tools/tasks/${id}/`, data);
}

export async function deleteAcademicTask(id: number) {
  return apiDelete(`/academic-tools/tasks/${id}/`);
}

// Phase 2: Student Management, Earnings, Coupons & Analytics API Fetchers

export interface InstructorStudentItem {
  id: number;
  course_id: number;
  courseId?: number;
  student_id: number;
  studentId?: number;
  student_name: string;
  studentName?: string;
  student_email: string;
  studentEmail?: string;
  course: { id: number; title: string; image_url?: string };
  progress: number;
  enrolled_at: string;
  enrolledAt?: string;
  completed_at?: string | null;
  completedAt?: string | null;
  last_accessed_at?: string | null;
  lastAccessedAt?: string | null;
}

export function normalizeInstructorStudent(raw: any): InstructorStudentItem {
  const course_id = Number(raw?.course_id ?? raw?.courseId ?? raw?.course?.id ?? 0);
  const student_id = Number(raw?.student_id ?? raw?.studentId ?? raw?.student?.id ?? 0);
  const student_name = String(raw?.student_name ?? raw?.studentName ?? raw?.student?.full_name ?? raw?.student?.fullName ?? "");
  const student_email = String(raw?.student_email ?? raw?.studentEmail ?? raw?.student?.email ?? "");
  const enrolled_at = String(raw?.enrolled_at ?? raw?.enrolledAt ?? "");
  const completed_at = raw?.completed_at ?? raw?.completedAt ?? null;
  const last_accessed_at = raw?.last_accessed_at ?? raw?.lastAccessedAt ?? null;

  return {
    id: Number(raw?.id ?? 0),
    course_id,
    courseId: course_id,
    student_id,
    studentId: student_id,
    student_name,
    studentName: student_name,
    student_email,
    studentEmail: student_email,
    course: {
      id: Number(raw?.course?.id ?? course_id),
      title: String(raw?.course?.title ?? "دورة تعليمية"),
      image_url: raw?.course?.image_url ?? raw?.course?.imageUrl,
    },
    progress: Number(raw?.progress ?? 0),
    enrolled_at,
    enrolledAt: enrolled_at,
    completed_at,
    completedAt: completed_at,
    last_accessed_at,
    lastAccessedAt: last_accessed_at,
  };
}

export async function getInstructorStudents(params?: { course_id?: number; search?: string }): Promise<InstructorStudentItem[]> {
  const query = new URLSearchParams();
  if (params?.course_id) query.append("course_id", params.course_id.toString());
  if (params?.search) query.append("search", params.search);
  const res = await apiGet<any>(`/enrollments/?${query.toString()}`);
  const items = Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);
  return items.map(normalizeInstructorStudent);
}

export interface PrivateStudentItem {
  id: number;
  student_id: number;
  studentId?: number;
  student_name: string;
  studentName?: string;
  student_email: string;
  studentEmail?: string;
  joined_at: string;
  joinedAt?: string;
  is_active: boolean;
  isActive?: boolean;
}

export function normalizePrivateStudent(raw: any): PrivateStudentItem {
  const student_id = Number(raw?.student_id ?? raw?.studentId ?? 0);
  const student_name = String(raw?.student_name ?? raw?.studentName ?? raw?.full_name ?? raw?.fullName ?? "");
  const student_email = String(raw?.student_email ?? raw?.studentEmail ?? raw?.email ?? "");
  const joined_at = String(raw?.joined_at ?? raw?.joinedAt ?? raw?.created_at ?? raw?.createdAt ?? "");
  const is_active = Boolean(raw?.is_active ?? raw?.isActive ?? true);

  return {
    id: Number(raw?.id ?? 0),
    student_id,
    studentId: student_id,
    student_name,
    studentName: student_name,
    student_email,
    studentEmail: student_email,
    joined_at,
    joinedAt: joined_at,
    is_active,
    isActive: is_active,
  };
}

export async function getInstructorPrivateStudents(): Promise<PrivateStudentItem[]> {
  const res = await apiGet<any>("/accounts/instructor/private-students/");
  const items = Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);
  return items.map(normalizePrivateStudent);
}

export async function removeStudentEnrollment(id: number) {
  return apiDelete(`/enrollments/${id}/`);
}

export interface InstructorEarningsData {
  currency: string;
  gross_revenue: number;
  grossRevenue?: number;
  net_earnings: number;
  netEarnings?: number;
  available_balance: number;
  availableBalance?: number;
  pending_payout: number;
  pendingPayout?: number;
  platform_commission_pct: number | null;
  platformCommissionPct?: number | null;
  instructor_share_pct: number | null;
  instructorSharePct?: number | null;
  recent_transactions: Array<{
    id: number;
    course_title: string;
    courseTitle?: string;
    student_count: number;
    studentCount?: number;
    gross_amount: number;
    grossAmount?: number;
    net_amount: number | null;
    netAmount?: number | null;
    date: string;
  }>;
  recentTransactions?: Array<{
    id: number;
    course_title: string;
    courseTitle?: string;
    student_count: number;
    studentCount?: number;
    gross_amount: number;
    grossAmount?: number;
    net_amount: number | null;
    netAmount?: number | null;
    date: string;
  }>;
  wallet_id: number | null;
  walletId?: number | null;
}

export function normalizeInstructorEarnings(raw: any): InstructorEarningsData {
  if (!raw || typeof raw !== "object") {
    return {
      currency: "EGP",
      gross_revenue: 0,
      grossRevenue: 0,
      net_earnings: 0,
      netEarnings: 0,
      available_balance: 0,
      availableBalance: 0,
      pending_payout: 0,
      pendingPayout: 0,
      platform_commission_pct: null,
      platformCommissionPct: null,
      instructor_share_pct: null,
      instructorSharePct: null,
      recent_transactions: [],
      recentTransactions: [],
      wallet_id: null,
      walletId: null,
    };
  }

  const rawTxList = Array.isArray(raw.recent_transactions)
    ? raw.recent_transactions
    : Array.isArray(raw.recentTransactions)
    ? raw.recentTransactions
    : [];

  const normalizedTx = rawTxList.map((tx: any) => {
    const course_title = String(tx?.course_title ?? tx?.courseTitle ?? "");
    const student_count = Number(tx?.student_count ?? tx?.studentCount ?? 0);
    const gross_amount = Number(tx?.gross_amount ?? tx?.grossAmount ?? 0);
    const net_amount =
      tx?.net_amount != null
        ? Number(tx.net_amount)
        : tx?.netAmount != null
        ? Number(tx.netAmount)
        : null;

    return {
      id: Number(tx?.id ?? 0),
      course_title,
      courseTitle: course_title,
      student_count: isNaN(student_count) ? 0 : student_count,
      studentCount: isNaN(student_count) ? 0 : student_count,
      gross_amount: isNaN(gross_amount) ? 0 : gross_amount,
      grossAmount: isNaN(gross_amount) ? 0 : gross_amount,
      net_amount: net_amount != null && !isNaN(net_amount) ? net_amount : null,
      netAmount: net_amount != null && !isNaN(net_amount) ? net_amount : null,
      date: String(tx?.date ?? ""),
    };
  });

  const gross_revenue = Number(raw.gross_revenue ?? raw.grossRevenue ?? 0);
  const net_earnings = Number(raw.net_earnings ?? raw.netEarnings ?? 0);
  const available_balance = Number(raw.available_balance ?? raw.availableBalance ?? 0);
  const pending_payout = Number(raw.pending_payout ?? raw.pendingPayout ?? 0);

  const rawCommPct = raw.platform_commission_pct ?? raw.platformCommissionPct;
  const commPct = rawCommPct != null ? Number(rawCommPct) : null;
  const rawSharePct = raw.instructor_share_pct ?? raw.instructorSharePct;
  const sharePct = rawSharePct != null ? Number(rawSharePct) : null;
  const wallet_id = raw.wallet_id ?? raw.walletId ?? null;

  return {
    currency: String(raw.currency || "EGP"),
    gross_revenue: isNaN(gross_revenue) ? 0 : gross_revenue,
    grossRevenue: isNaN(gross_revenue) ? 0 : gross_revenue,
    net_earnings: isNaN(net_earnings) ? 0 : net_earnings,
    netEarnings: isNaN(net_earnings) ? 0 : net_earnings,
    available_balance: isNaN(available_balance) ? 0 : available_balance,
    availableBalance: isNaN(available_balance) ? 0 : available_balance,
    pending_payout: isNaN(pending_payout) ? 0 : pending_payout,
    pendingPayout: isNaN(pending_payout) ? 0 : pending_payout,
    platform_commission_pct: commPct != null && !isNaN(commPct) ? commPct : null,
    platformCommissionPct: commPct != null && !isNaN(commPct) ? commPct : null,
    instructor_share_pct: sharePct != null && !isNaN(sharePct) ? sharePct : null,
    instructorSharePct: sharePct != null && !isNaN(sharePct) ? sharePct : null,
    recent_transactions: normalizedTx,
    recentTransactions: normalizedTx,
    wallet_id,
    walletId: wallet_id,
  };
}

export async function getInstructorEarnings(): Promise<InstructorEarningsData> {
  const res = await apiGet<any>("/finance/instructor/earnings/");
  return normalizeInstructorEarnings(res);
}

export interface InstructorCoupon {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discountType?: "percent" | "fixed";
  discount_value: string;
  discountValue?: string;
  max_uses?: number | null;
  maxUses?: number | null;
  used_count: number;
  usedCount?: number;
  is_active: boolean;
  isActive?: boolean;
  expires_at?: string | null;
  expiresAt?: string | null;
}

export function normalizeInstructorCoupon(raw: any): InstructorCoupon {
  const discount_type = (raw?.discount_type ?? raw?.discountType) === "fixed" ? "fixed" : "percent";
  const discount_value = String(raw?.discount_value ?? raw?.discountValue ?? "0");
  const max_uses = raw?.max_uses ?? raw?.maxUses ?? null;
  const used_count = Number(raw?.used_count ?? raw?.usedCount ?? 0);
  const is_active = Boolean(raw?.is_active ?? raw?.isActive ?? false);
  const expires_at = raw?.expires_at ?? raw?.expiresAt ?? null;

  return {
    id: Number(raw?.id ?? 0),
    code: String(raw?.code ?? ""),
    discount_type,
    discountType: discount_type,
    discount_value,
    discountValue: discount_value,
    max_uses,
    maxUses: max_uses,
    used_count: isNaN(used_count) ? 0 : used_count,
    usedCount: isNaN(used_count) ? 0 : used_count,
    is_active,
    isActive: is_active,
    expires_at,
    expiresAt: expires_at,
  };
}

export async function getInstructorCoupons(): Promise<InstructorCoupon[]> {
  const res = await apiGet<any>("/finance/instructor/coupons/");
  const items = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
  return items.map(normalizeInstructorCoupon);
}

export async function createInstructorCoupon(data: {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  max_uses?: number;
  is_active?: boolean;
}) {
  return apiPost<InstructorCoupon>("/finance/instructor/coupons/", data);
}

export interface InstructorPayout {
  id: number;
  user: number;
  user_email: string;
  userEmail?: string;
  wallet: number;
  amount: string;
  channel: "instapay" | "mobile_wallet" | "bank_wire";
  channel_display: string;
  channelDisplay?: string;
  account_details: Record<string, string>;
  accountDetails?: Record<string, string>;
  status: "pending" | "approved" | "rejected" | "disbursed";
  status_display: string;
  statusDisplay?: string;
  admin_notes: string;
  adminNotes?: string;
  transaction_reference: string;
  transactionReference?: string;
  created_at: string;
  createdAt?: string;
  processed_at: string | null;
  processedAt?: string | null;
}

export function normalizeInstructorPayout(raw: any): InstructorPayout {
  const user_email = String(raw?.user_email ?? raw?.userEmail ?? "");
  const channel = (raw?.channel ?? "instapay") as InstructorPayout["channel"];
  const channel_display = String(raw?.channel_display ?? raw?.channelDisplay ?? raw?.channel ?? "إنستاباي");
  const account_details = raw?.account_details ?? raw?.accountDetails ?? {};
  const status = (raw?.status ?? "pending") as InstructorPayout["status"];
  const status_display = String(raw?.status_display ?? raw?.statusDisplay ?? "قيد المراجعة");
  const admin_notes = String(raw?.admin_notes ?? raw?.adminNotes ?? "");
  const transaction_reference = String(raw?.transaction_reference ?? raw?.transactionReference ?? "");
  const created_at = String(raw?.created_at ?? raw?.createdAt ?? "");
  const processed_at = raw?.processed_at ?? raw?.processedAt ?? null;

  return {
    id: Number(raw?.id ?? 0),
    user: Number(raw?.user ?? 0),
    user_email,
    userEmail: user_email,
    wallet: Number(raw?.wallet ?? 0),
    amount: String(raw?.amount ?? "0"),
    channel,
    channel_display,
    channelDisplay: channel_display,
    account_details,
    accountDetails: account_details,
    status,
    status_display,
    statusDisplay: status_display,
    admin_notes,
    adminNotes: admin_notes,
    transaction_reference,
    transactionReference: transaction_reference,
    created_at,
    createdAt: created_at,
    processed_at,
    processedAt: processed_at,
  };
}

export async function getInstructorPayouts(): Promise<InstructorPayout[]> {
  const res = await apiGet<any>("/finance/payouts/");
  const items = Array.isArray(res) ? res : (res?.data ?? res?.results ?? []);
  return items.map(normalizeInstructorPayout);
}

export async function createInstructorPayout(data: {
  amount: number;
  channel: InstructorPayout["channel"];
  account_details: Record<string, string>;
}): Promise<InstructorPayout> {
  return apiPost<InstructorPayout>("/finance/payouts/", data);
}

export interface CourseAnalyticsData {
  course_id: number;
  courseId?: number;
  course_title: string;
  courseTitle?: string;
  enrolled_count: number;
  enrolledCount?: number;
  funnel: Array<{ stage: string; count: number; pct: number }>;
  video_drop_off: Array<{ marker: string; retention_pct: number; drop_count: number }>;
  videoDropOff?: Array<{ marker: string; retention_pct: number; drop_count: number }>;
}

export function normalizeCourseAnalytics(raw: any): CourseAnalyticsData {
  const course_id = Number(raw?.course_id ?? raw?.courseId ?? 0);
  const course_title = String(raw?.course_title ?? raw?.courseTitle ?? "");
  const enrolled_count = Number(raw?.enrolled_count ?? raw?.enrolledCount ?? 0);

  const rawFunnel = Array.isArray(raw?.funnel) ? raw.funnel : [];
  const funnel = rawFunnel.map((item: any) => ({
    stage: String(item?.stage ?? ""),
    count: Number(item?.count ?? 0),
    pct: Number(item?.pct ?? 0),
  }));

  const rawVideoDropOff = Array.isArray(raw?.video_drop_off)
    ? raw.video_drop_off
    : Array.isArray(raw?.videoDropOff)
    ? raw.videoDropOff
    : [];

  const video_drop_off = rawVideoDropOff.map((m: any) => ({
    marker: String(m?.marker ?? ""),
    retention_pct: Number(m?.retention_pct ?? m?.retentionPct ?? 0),
    drop_count: Number(m?.drop_count ?? m?.dropCount ?? 0),
  }));

  return {
    course_id,
    courseId: course_id,
    course_title,
    courseTitle: course_title,
    enrolled_count,
    enrolledCount: enrolled_count,
    funnel,
    video_drop_off,
    videoDropOff: video_drop_off,
  };
}

export async function getCourseAnalytics(courseId: number): Promise<CourseAnalyticsData | null> {
  const res = await apiGet<any>(`/analytics/instructor/courses/${courseId}/analytics/`);
  return res ? normalizeCourseAnalytics(res) : null;
}
