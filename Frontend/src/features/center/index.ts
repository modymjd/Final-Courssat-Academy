import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/http';

export interface CenterStudentItem {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  student_phone?: string;
  joined_at: string;
  is_active: boolean;
}

export interface CenterInstructorItem {
  id: number;
  instructor_id: number;
  full_name: string;
  email: string;
  phone: string;
  teacher_uid: string;
  specialization: string;
  qualification: string;
  subject: string;
  student_quota: number;
  is_active: boolean;
  is_approved: boolean;
  joined_at: string;
  active_students_count: number;
  instructor_name: string;
  instructor_email: string;
  instructor_phone: string;
}

export interface CenterOverviewData {
  center_info: {
    id: number;
    institution_name: string;
    institution_type: string;
    is_verified: boolean;
    logo: string | null;
  };
  kpis: {
    total_active_students: number;
    total_active_instructors: number;
    total_generated_codes: number;
    total_redeemed_codes: number;
    remaining_quota: number;
    usage_rate: number;
  };
  subscription: {
    plan_tier: string;
    is_trial: boolean;
    trial_days_left: number;
    trial_expired: boolean;
    is_active: boolean;
    expires_at: string | null;
  };
  onboarding: {
    has_instructors: boolean;
    can_generate_codes: boolean;
    step_message: string;
  };
  activity_feed: Array<{
    id: string;
    type: 'code_redeemed' | 'instructor_joined';
    title: string;
    description: string;
    target_instructor: string;
    timestamp: string;
  }>;
}

export interface CenterReportsData {
  generated_codes: number;
  redeemed_codes: number;
  usage_rate: number;
  timeline: Array<{
    date: string;
    label: string;
    redeemed: number;
  }>;
  subjects: Array<{
    subject: string;
    count: number;
  }>;
  total_students: number;
}

export interface CenterSettingsData {
  institution_name: string;
  institution_type: string;
  address: string;
  license_number: string;
  website: string;
  phone: string;
  email: string;
  full_name: string;
  logo: string | null;
  notification_preferences: {
    notify_on_redemption: boolean;
    notify_on_quota_low: boolean;
    notify_on_admin_review: boolean;
  };
}

export function normalizeCenterOverview(raw: any): CenterOverviewData {
  const center_info_raw = raw?.center_info || raw?.centerInfo || {};
  const kpis_raw = raw?.kpis || {};
  const sub_raw = raw?.subscription || {};
  const onb_raw = raw?.onboarding || {};
  const feed_raw = raw?.activity_feed || raw?.recent_activity || raw?.recentActivity || raw?.activityFeed || [];

  const generated = Number(kpis_raw.total_generated_codes ?? kpis_raw.generated_codes ?? kpis_raw.generatedCodes ?? 0);
  const redeemed = Number(kpis_raw.total_redeemed_codes ?? kpis_raw.redeemed_codes ?? kpis_raw.redeemedCodes ?? 0);
  const availableQuota = Number(kpis_raw.remaining_quota ?? kpis_raw.available_quota ?? kpis_raw.availableQuota ?? 0);
  const usageRate = Number(
    kpis_raw.usage_rate ?? kpis_raw.usageRate ?? (generated > 0 ? Math.round((redeemed / generated) * 100) : 0)
  );

  return {
    center_info: {
      id: Number(center_info_raw.id ?? 0),
      institution_name: center_info_raw.institution_name ?? center_info_raw.institutionName ?? "المركز التعليمي",
      institution_type: center_info_raw.institution_type ?? center_info_raw.institutionType ?? "center",
      is_verified: Boolean(center_info_raw.is_verified ?? center_info_raw.isVerified ?? false),
      logo: center_info_raw.logo ?? null,
    },
    kpis: {
      total_active_students: Number(kpis_raw.total_active_students ?? kpis_raw.totalActiveStudents ?? 0),
      total_active_instructors: Number(
        kpis_raw.total_active_instructors ??
          kpis_raw.active_instructors ??
          kpis_raw.activeInstructors ??
          kpis_raw.total_instructors ??
          kpis_raw.totalInstructors ??
          0
      ),
      total_generated_codes: generated,
      total_redeemed_codes: redeemed,
      remaining_quota: availableQuota,
      usage_rate: usageRate,
    },
    subscription: {
      plan_tier: sub_raw.plan_tier ?? sub_raw.plan_name ?? sub_raw.planName ?? "باقة المركز",
      is_trial: Boolean(sub_raw.is_trial ?? sub_raw.isTrial ?? false),
      trial_days_left: Number(sub_raw.trial_days_left ?? sub_raw.days_remaining ?? sub_raw.daysRemaining ?? 0),
      trial_expired: Boolean(sub_raw.trial_expired ?? sub_raw.is_expired ?? sub_raw.isExpired ?? false),
      is_active: Boolean(sub_raw.is_active ?? sub_raw.isActive ?? !sub_raw.is_expired),
      expires_at: sub_raw.expires_at ?? sub_raw.expiresAt ?? null,
    },
    onboarding: {
      has_instructors: Boolean(onb_raw.has_instructors ?? onb_raw.hasInstructors ?? false),
      can_generate_codes: Boolean(onb_raw.can_generate_codes ?? onb_raw.canGenerateCodes ?? false),
      step_message: onb_raw.step_message ?? onb_raw.warning_message ?? onb_raw.warningMessage ?? "",
    },
    activity_feed: Array.isArray(feed_raw)
      ? feed_raw.map((item: any) => ({
          id: String(item.id ?? Math.random()),
          type: item.type ?? "code_redeemed",
          title: item.title ?? "",
          description: item.description ?? "",
          target_instructor: item.target_instructor ?? item.targetInstructor ?? "عام",
          timestamp: item.timestamp ?? new Date().toISOString(),
        }))
      : [],
  };
}

export function normalizeCenterReports(raw: any): CenterReportsData {
  if (!raw) {
    return {
      generated_codes: 0,
      redeemed_codes: 0,
      usage_rate: 0,
      timeline: [],
      subjects: [],
      total_students: 0,
    };
  }

  const generated = Number(raw.generated_codes ?? raw.generatedCodes ?? 0);
  const redeemed = Number(raw.redeemed_codes ?? raw.redeemedCodes ?? 0);
  const usageRate = Number(
    raw.usage_rate ?? raw.usageRate ?? (generated > 0 ? Math.round((redeemed / generated) * 100) : 0)
  );
  const totalStudents = Number(raw.total_students ?? raw.totalStudents ?? 0);

  const timelineRaw = raw.timeline ?? [];
  const timeline = Array.isArray(timelineRaw)
    ? timelineRaw.map((t: any) => ({
        date: t.date ?? "",
        label: t.label ?? "",
        redeemed: Number(t.redeemed ?? 0),
      }))
    : [];

  const subjectsRaw = raw.subjects ?? [];
  const subjects = Array.isArray(subjectsRaw)
    ? subjectsRaw.map((s: any) => ({
        subject: s.subject ?? "عام",
        count: Number(s.count ?? 0),
      }))
    : [];

  return {
    generated_codes: generated,
    redeemed_codes: redeemed,
    usage_rate: usageRate,
    timeline,
    subjects,
    total_students: totalStudents,
  };
}

export function normalizeCenterSettings(raw: any): CenterSettingsData {
  if (!raw) {
    return {
      institution_name: "",
      institution_type: "center",
      address: "",
      license_number: "",
      website: "",
      phone: "",
      email: "",
      full_name: "",
      logo: null,
      notification_preferences: {
        notify_on_redemption: true,
        notify_on_quota_low: true,
        notify_on_admin_review: true,
      },
    };
  }

  const notifRaw = raw.notification_preferences || raw.notificationPreferences || {};

  return {
    institution_name: raw.institution_name ?? raw.institutionName ?? "",
    institution_type: raw.institution_type ?? raw.institutionType ?? "center",
    address: raw.address ?? "",
    license_number: raw.license_number ?? raw.licenseNumber ?? "",
    website: raw.website ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    full_name: raw.full_name ?? raw.fullName ?? "",
    logo: raw.logo ?? null,
    notification_preferences: {
      notify_on_redemption: Boolean(notifRaw.notify_on_redemption ?? notifRaw.notifyOnRedemption ?? true),
      notify_on_quota_low: Boolean(notifRaw.notify_on_quota_low ?? notifRaw.notifyOnQuotaLow ?? true),
      notify_on_admin_review: Boolean(notifRaw.notify_on_admin_review ?? notifRaw.notifyOnAdminReview ?? true),
    },
  };
}

export function normalizeCenterStudent(raw: any): CenterStudentItem {
  return {
    id: Number(raw.id ?? 0),
    student_id: Number(raw.student_id ?? raw.studentId ?? 0),
    student_name: raw.student_name ?? raw.studentName ?? "",
    student_email: raw.student_email ?? raw.studentEmail ?? "",
    student_phone: raw.student_phone ?? raw.studentPhone ?? undefined,
    joined_at: raw.joined_at ?? raw.joinedAt ?? "",
    is_active: Boolean(raw.is_active ?? raw.isActive ?? true),
  };
}

export function normalizeCenterInstructor(raw: any): CenterInstructorItem {
  const name =
    raw.full_name ??
    raw.fullName ??
    raw.instructor_name ??
    raw.instructorName ??
    "معلم";

  const email =
    raw.email ??
    raw.instructor_email ??
    raw.instructorEmail ??
    "";

  const phone =
    raw.phone ??
    raw.instructor_phone ??
    raw.instructorPhone ??
    "";

  return {
    id: Number(raw.id ?? 0),
    instructor_id: Number(raw.instructor_id ?? raw.instructorId ?? 0),
    full_name: name,
    email: email,
    phone: phone,
    teacher_uid: raw.teacher_uid ?? raw.teacherUid ?? "",
    specialization: raw.specialization ?? "",
    qualification: raw.qualification ?? "",
    subject: raw.subject ?? "عام",
    student_quota: Number(raw.student_quota ?? raw.studentQuota ?? 0),
    is_active: Boolean(raw.is_active ?? raw.isActive ?? true),
    is_approved: Boolean(raw.is_approved ?? raw.isApproved ?? true),
    joined_at: raw.joined_at ?? raw.joinedAt ?? "",
    active_students_count: Number(raw.active_students_count ?? raw.activeStudentsCount ?? 0),
    instructor_name: name,
    instructor_email: email,
    instructor_phone: phone,
  };
}

export async function getCenterOverview(): Promise<CenterOverviewData> {
  const res = await apiGet<any>('/accounts/center/overview/');
  return normalizeCenterOverview(res);
}

export function useCenterOverview() {
  return useQuery({
    queryKey: ['center-overview'],
    queryFn: getCenterOverview,
  });
}

export async function getCenterStudents(): Promise<CenterStudentItem[]> {
  const res = await apiGet<any>('/accounts/center/students/');
  const list = Array.isArray(res) ? res : res?.results || [];
  return list.map(normalizeCenterStudent);
}

export function useCenterStudents() {
  return useQuery({
    queryKey: ['center-students'],
    queryFn: getCenterStudents,
  });
}

export async function getCenterInstructors(): Promise<CenterInstructorItem[]> {
  const res = await apiGet<any>('/accounts/center/instructors/');
  const list = Array.isArray(res) ? res : res?.results || [];
  return list.map(normalizeCenterInstructor);
}

export function useCenterInstructors() {
  return useQuery({
    queryKey: ['center-instructors'],
    queryFn: getCenterInstructors,
  });
}

export async function getCenterReports(): Promise<CenterReportsData> {
  const res = await apiGet<any>('/accounts/center/reports/');
  return normalizeCenterReports(res);
}

export function useCenterReports() {
  return useQuery({
    queryKey: ['center-reports'],
    queryFn: getCenterReports,
  });
}

export async function getCenterSettings(): Promise<CenterSettingsData> {
  const res = await apiGet<any>('/accounts/center/settings/');
  return normalizeCenterSettings(res);
}

export function useCenterSettings() {
  return useQuery({
    queryKey: ['center-settings'],
    queryFn: getCenterSettings,
  });
}

export function useUpdateCenterSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CenterSettingsData>) => apiPatch<CenterSettingsData>('/accounts/center/settings/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-settings'] });
      queryClient.invalidateQueries({ queryKey: ['center-overview'] });
    },
  });
}


