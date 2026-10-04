import { apiGet, apiPost } from '@/lib/http';
import { superAdminPost, superAdminPatch } from '@/lib/superAdminHttp';
import { superAdminTokenStore } from '@/lib/superAdminTokenStore';
import {
  ActivationCodeBatch,
  ActivationCodeItem,
  CenterQuotaRequest,
  CodeValidationResponse,
  ValidationResponse,
  RedeemCodeResponse,
  QuotaInfo,
  CoursePreview,
  GenerateBatchPayload,
  CreateBatchPayload,
  QuotaContract,
  QuickGrantPayload,
} from './types';

export function normalizeActivationPin(value: string): string {
  return value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

interface QuotaStatusResponse {
  available?: number;
  max_limit?: number;
  maxLimit?: number;
  generated?: number;
  billing_unit_size?: number;
  billingUnitSize?: number;
  price_per_billing_unit?: string | null;
  pricePerBillingUnit?: string | null;
  currency?: string;
  billing_units?: number;
  billingUnits?: number;
  billing_amount?: string | null;
  billingAmount?: string | null;
  pricing_configured?: boolean;
  pricingConfigured?: boolean;
  source?: QuotaInfo['source'];
  period_start?: string | null;
  periodStart?: string | null;
  period_end?: string | null;
  periodEnd?: string | null;
  contract_id?: number | null;
  contractId?: number | null;
}

export function normalizeActivationCode(c: any): ActivationCodeItem {
  return {
    id: c?.id ?? 0,
    batchId: c?.batchId ?? c?.batch_id ?? 0,
    batchType: c?.batchType ?? c?.batch_type ?? '',
    code: c?.code ?? '',
    password: c?.password ?? '',
    status: c?.status ?? 'active',
    displayStatus: c?.displayStatus ?? c?.display_status ?? 'active',
    createdAt: c?.createdAt ?? c?.created_at ?? '',
    expiresAt: c?.expiresAt ?? c?.expires_at ?? '',
    redeemedAt: c?.redeemedAt ?? c?.redeemed_at ?? null,
    redeemedByName: c?.redeemedByName ?? c?.redeemed_by_name ?? '',
    redeemedByEmail: c?.redeemedByEmail ?? c?.redeemed_by_email ?? '',
    targetInstructorName: c?.targetInstructorName ?? c?.target_instructor_name ?? '',
    courseNames: Array.isArray(c?.courseNames)
      ? c.courseNames
      : Array.isArray(c?.course_names)
      ? c.course_names
      : [],
  };
}

export function normalizeBatch(b: any): ActivationCodeBatch {
  const accessDurationDays = b?.accessDurationDays ?? b?.access_duration_days ?? null;
  const fixedAccessUntil = b?.fixedAccessUntil ?? b?.fixed_access_until ?? null;
  const unredeemedCount = Number(b?.unredeemedCount ?? b?.unredeemed_count ?? 0);
  const isExpired = Boolean(b?.isExpired ?? b?.is_expired ?? false);

  return {
    id: b?.id ?? 0,
    batchType: b?.batchType ?? b?.batch_type ?? 'course_access',
    batch_type: b?.batch_type ?? b?.batchType ?? 'course_access',
    quantity: Number(b?.quantity ?? 0),
    pricePerCode: String(b?.pricePerCode ?? b?.price_per_code ?? '0'),
    price_per_code: String(b?.price_per_code ?? b?.pricePerCode ?? '0'),
    expiresAt: b?.expiresAt ?? b?.expires_at ?? '',
    expires_at: b?.expires_at ?? b?.expiresAt ?? '',
    createdAt: b?.createdAt ?? b?.created_at ?? '',
    created_at: b?.created_at ?? b?.createdAt ?? '',
    courses: Array.isArray(b?.courses)
      ? b.courses.map((course: any) => ({
          id: course?.id ?? 0,
          title: course?.title ?? '',
          instructorName: course?.instructorName ?? course?.instructor_name ?? '',
          thumbnail: course?.thumbnail ?? course?.image_url ?? null,
        }))
      : [],
    targetInstructorId: b?.targetInstructorId ?? b?.target_instructor_id ?? null,
    target_instructor_id: b?.target_instructor_id ?? b?.targetInstructorId ?? null,
    targetInstructorName: b?.targetInstructorName ?? b?.target_instructor_name ?? '',
    target_instructor_name: b?.target_instructor_name ?? b?.targetInstructorName ?? '',
    pdfFile: b?.pdfFile ?? b?.pdf_file ?? null,
    pdf_file: b?.pdf_file ?? b?.pdfFile ?? null,
    activeCount: Number(b?.activeCount ?? b?.active_count ?? 0),
    active_count: Number(b?.active_count ?? b?.activeCount ?? 0),
    redeemedCount: Number(b?.redeemedCount ?? b?.redeemed_count ?? 0),
    redeemed_count: Number(b?.redeemed_count ?? b?.redeemedCount ?? 0),
    expiredCount: Number(b?.expiredCount ?? b?.expired_count ?? 0),
    expired_count: Number(b?.expired_count ?? b?.expiredCount ?? 0),
    accessDurationDays,
    access_duration_days: accessDurationDays,
    fixedAccessUntil,
    fixed_access_until: fixedAccessUntil,
    unredeemedCount,
    unredeemed_count: unredeemedCount,
    isExpired,
    is_expired: isExpired,
  };
}

export function normalizeQuotaRequest(r: any): CenterQuotaRequest {
  return {
    id: r?.id ?? 0,
    centerId: r?.centerId ?? r?.center_id ?? 0,
    centerName: r?.centerName ?? r?.center_name ?? '',
    requestedByEmail: r?.requestedByEmail ?? r?.requested_by_email ?? '',
    requestedByName: r?.requestedByName ?? r?.requested_by_name ?? '',
    requestedByRole: r?.requestedByRole ?? r?.requested_by_role ?? '',
    requestedQuantity: Number(r?.requestedQuantity ?? r?.requested_quantity ?? 0),
    currentQuota: Number(r?.currentQuota ?? r?.current_quota ?? 0),
    reason: r?.reason ?? '',
    status: r?.status ?? 'pending',
    reviewedByName: r?.reviewedByName ?? r?.reviewed_by_name ?? '',
    reviewedAt: r?.reviewedAt ?? r?.reviewed_at ?? null,
    adminNotes: r?.adminNotes ?? r?.admin_notes ?? '',
    createdAt: r?.createdAt ?? r?.created_at ?? '',
  };
}

export const activationCodesApi = {
  getBatches: async (): Promise<ActivationCodeBatch[]> => {
    const res = await apiGet<any>('/activation-codes/batches/');
    const list: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.results)
      ? res.results
      : Array.isArray(res?.data)
      ? res.data
      : [];
    return list.map(normalizeBatch);
  },

  getQuota: async (): Promise<QuotaInfo> => {
    const status = await apiGet<QuotaStatusResponse>('/activation-codes/quota/status/');
    return {
      available: Number(status?.available ?? 0),
      maxLimit: Number(status?.maxLimit ?? status?.max_limit ?? 0),
      generated: Number(status?.generated ?? 0),
      billingUnitSize: Number(status?.billingUnitSize ?? status?.billing_unit_size ?? 100),
      pricePerBillingUnit: status?.pricePerBillingUnit ?? status?.price_per_billing_unit ?? null,
      currency: status?.currency ?? 'EGP',
      billingUnits: Number(status?.billingUnits ?? status?.billing_units ?? 0),
      billingAmount: status?.billingAmount ?? status?.billing_amount ?? null,
      pricingConfigured: Boolean(status?.pricingConfigured ?? status?.pricing_configured ?? false),
      source: status?.source ?? 'not_applicable',
      periodStart: status?.periodStart ?? status?.period_start ?? null,
      periodEnd: status?.periodEnd ?? status?.period_end ?? null,
      contractId: status?.contractId ?? status?.contract_id ?? null,
    };
  },

  generateBatch: async (data: GenerateBatchPayload) => {
    const payload = {
      batch_type: data.batch_type ?? data.batchType,
      quantity: data.quantity,
      price_per_code: data.price_per_code ?? data.pricePerCode ?? 0,
      balance_amount: data.balance_amount ?? data.balanceAmount ?? 0,
      course_ids: data.course_ids ?? data.courseIds ?? [],
      target_instructor_id: data.target_instructor_id ?? data.targetInstructorId ?? null,
      shelf_life_days: data.shelfLifeDays ?? data.shelf_life_days ?? 90,
      access_duration_days: data.accessDurationDays ?? data.access_duration_days ?? null,
      fixed_access_until: data.fixedAccessUntil ?? data.fixed_access_until ?? null,
    };
    return apiPost<{ id: number; message: string; pdf_url: string | null }>(
      '/activation-codes/batches/',
      payload,
      { timeout: 120_000 }
    );
  },

  extendBatchShelfLife: async (batchId: number, additionalDays: number = 30) => {
    return apiPost<{ message: string; expires_at?: string; additional_days?: number }>(
      `/activation-codes/batches/${batchId}/extend-shelf-life/`,
      { additional_days: additionalDays }
    );
  },

  getCodes: async (params?: { status?: string; batch_id?: number; search?: string; target_instructor_id?: number }): Promise<ActivationCodeItem[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.batch_id) searchParams.append('batch_id', params.batch_id.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.target_instructor_id) searchParams.append('target_instructor_id', params.target_instructor_id.toString());

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiGet<any>(`/activation-codes/codes/${queryString}`);
    const list: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.results)
      ? res.results
      : Array.isArray(res?.data)
      ? res.data
      : [];
    return list.map(normalizeActivationCode);
  },

  getQuotaRequests: async (): Promise<CenterQuotaRequest[]> => {
    const res = await apiGet<any>('/activation-codes/quota-requests/');
    const list: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.results)
      ? res.results
      : Array.isArray(res?.data)
      ? res.data
      : [];
    return list.map(normalizeQuotaRequest);
  },

  createQuotaRequest: async (data: { requested_quantity?: number; requestedQuantity?: number; reason: string }) => {
    const payload = {
      requested_quantity: data.requested_quantity ?? data.requestedQuantity ?? 0,
      reason: data.reason,
    };
    return apiPost<CenterQuotaRequest>('/activation-codes/quota-requests/', payload);
  },

  validateCode: async (code: string, password?: string, course_id?: number) => {
    return apiPost<CodeValidationResponse>('/activation-codes/validate/', { code, password, course_id });
  },

  redeemCode: async (code: string, password?: string, course_id?: number) => {
    return apiPost<RedeemCodeResponse>('/activation-codes/redeem/', { code, password, course_id });
  },

  superAdminReviewQuotaRequest: async (requestId: number, action: 'approve' | 'reject', adminNotes?: string) => {
    return superAdminPost<{ message: string; status: string }>(
      `/activation-codes/quota-requests/${requestId}/review/`,
      { action, admin_notes: adminNotes }
    );
  },

  superAdminQuickGrantQuota: async (payload: {
    owner_id: number;
    additional_quantity?: number;
    new_monthly_limit?: number;
    price_per_billing_unit?: string;
    billing_unit_size?: number;
    notes?: string;
  }) => {
    return superAdminPost<{ status: string; message?: string; contract?: QuotaContract }>(
      '/super-admin/quota-contracts/quick-grant/',
      payload
    );
  },

  superAdminUpdateContract: async (contractId: number, payload: Partial<any>) => {
    return superAdminPatch<QuotaContract>(`/super-admin/quota-contracts/${contractId}/`, payload);
  },
};

