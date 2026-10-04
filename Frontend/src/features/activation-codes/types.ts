export interface CoursePreview {
  id: number;
  title: string;
  instructorName: string;
  thumbnail: string | null;
}

export interface ActivationCodeBatch {
  id: number;
  batchType: 'course_access' | 'instructor_join' | 'center_student' | 'instructor_student' | 'digital_balance';
  batch_type?: string;
  quantity: number;
  pricePerCode: string;
  price_per_code?: string;
  expiresAt: string;
  expires_at?: string;
  createdAt: string;
  created_at?: string;
  courses: CoursePreview[];
  targetInstructorId?: number | null;
  target_instructor_id?: number | null;
  targetInstructorName?: string;
  target_instructor_name?: string;
  pdfFile: string | null;
  pdf_file?: string | null;
  activeCount: number;
  active_count?: number;
  redeemedCount: number;
  redeemed_count?: number;
  expiredCount: number;
  expired_count?: number;
  accessDurationDays?: number | null;
  access_duration_days?: number | null;
  fixedAccessUntil?: string | null;
  fixed_access_until?: string | null;
  unredeemedCount?: number;
  unredeemed_count?: number;
  isExpired?: boolean;
  is_expired?: boolean;
}

export interface ActivationCodeItem {
  id: number;
  batchId: number;
  batchType: string;
  code: string;
  password: string;
  status: 'active' | 'redeemed' | 'revoked';
  displayStatus: 'active' | 'redeemed' | 'expired';
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedByName: string;
  redeemedByEmail: string;
  targetInstructorName: string;
  courseNames: string[];
}

export interface CenterQuotaRequest {
  id: number;
  centerId: number;
  centerName: string;
  requestedByEmail: string;
  requestedByName?: string;
  requestedByRole?: string;
  requestedQuantity: number;
  currentQuota: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedByName: string;
  reviewedAt: string | null;
  adminNotes: string;
  createdAt: string;
}

export interface QuotaContract {
  id: number;
  owner: number;
  owner_email?: string;
  ownerEmail?: string;
  owner_name?: string;
  ownerName?: string;
  owner_role?: 'instructor' | 'center';
  ownerRole?: 'instructor' | 'center';
  monthly_code_limit: number;
  monthlyCodeLimit?: number;
  billing_unit_size: number;
  billingUnitSize?: number;
  price_per_billing_unit: string;
  pricePerBillingUnit?: string;
  currency: string;
  effective_from: string;
  effectiveFrom?: string;
  effective_to: string | null;
  effectiveTo?: string | null;
  is_active: boolean;
  isActive?: boolean;
  notes: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  generated_count?: number;
  generatedCount?: number;
  available_count?: number;
  availableCount?: number;
}

export interface QuickGrantPayload {
  owner_id: number;
  additional_quantity?: number;
  new_monthly_limit?: number;
  price_per_billing_unit?: string;
  billing_unit_size?: number;
  notes?: string;
}

export interface CodeValidationResponse {
  valid: boolean;
  batchType?: string;
  batch_type?: string;
  balanceAmount?: string;
  balance_amount?: string;
  courses: CoursePreview[];
  isRenewal?: boolean;
  is_renewal?: boolean;
  currentExpiresAt?: string | null;
  current_expires_at?: string | null;
  newProjectedExpiresAt?: string | null;
  new_projected_expires_at?: string | null;
  accessDurationDays?: number | null;
  access_duration_days?: number | null;
  fixedAccessUntil?: string | null;
  fixed_access_until?: string | null;
}

export type ValidationResponse = CodeValidationResponse;

export interface RedeemCodeResponse {
  isRenewal?: boolean;
  is_renewal?: boolean;
  newExpiresAt?: string | null;
  new_expires_at?: string | null;
  message?: string;
  enrolledCourses?: CoursePreview[];
}

export interface QuotaInfo {
  available: number;
  maxLimit: number;
  generated: number;
  billingUnitSize: number;
  pricePerBillingUnit: string | null;
  currency: string;
  billingUnits: number;
  billingAmount: string | null;
  pricingConfigured: boolean;
  source: 'custom_contract' | 'system_default' | 'not_applicable';
  periodStart: string | null;
  periodEnd: string | null;
  contractId: number | null;
}

export interface GenerateBatchPayload {
  batch_type?: string;
  batchType?: string;
  quantity: number;
  price_per_code?: number;
  pricePerCode?: number;
  balance_amount?: number;
  balanceAmount?: number;
  course_ids?: number[];
  courseIds?: number[];
  target_instructor_id?: number | null;
  targetInstructorId?: number | null;
  shelfLifeDays?: number;
  shelf_life_days?: number;
  accessDurationDays?: number | null;
  access_duration_days?: number | null;
  fixedAccessUntil?: string | null;
  fixed_access_until?: string | null;
}

export type CreateBatchPayload = GenerateBatchPayload;

