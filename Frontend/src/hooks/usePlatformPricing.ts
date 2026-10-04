import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/http";

export interface PlanFeatureDto {
  id?: number;
  label: string;
  is_included: boolean;
  order?: number;
}

export interface PricingPlanDto {
  id: number;
  name: string;
  slug: string;
  description: string;
  price_monthly: number | string;
  price_yearly: number | string;
  currency: string;
  is_featured: boolean;
  is_active: boolean;
  trial_days: number;
  order: number;
  features: PlanFeatureDto[];
  yearly_savings_percentage?: number;
}

export interface PaymentGatewayStatusDto {
  gateway: string;
  is_enabled: boolean;
  status: "active" | "coming_soon";
  mode: "test" | "live";
  display_name: string;
  message: string;
}

export interface CouponValidatePayload {
  code: string;
  plan_id: number;
  billing_cycle: "monthly" | "yearly";
}

export interface CouponValidationResultDto {
  valid: boolean;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  discount_amount: string;
  original_price: string;
  final_price: string;
  currency: string;
}

export interface SubscriptionCheckoutPayload {
  plan_id: number;
  billing_cycle: "monthly" | "yearly";
  payment_gateway: "kashier" | "fawry";
  coupon_code?: string;
  idempotency_key?: string;
}

export interface SubscriptionCheckoutResponseDto {
  subscription_id: number;
  plan_name: string;
  billing_cycle: string;
  amount: string;
  currency: string;
  gateway: string;
  checkout_url?: string;
  hash?: string;
  merchant_order_id?: string;
  fawry_reference?: {
    merchant_code: string;
    merchant_ref_num: string;
    fawry_ref_number: string;
    amount: string;
    signature: string;
    instructions: string;
  };
}

export interface KashierSessionPayload {
  resource_type: "course" | "exam" | "subscription" | "wallet_deposit";
  resource_id: string | number;
  billing_cycle?: "monthly" | "yearly";
  amount?: number | string;
  coupon_code?: string;
  return_url?: string;
}

export interface KashierSessionResponseDto {
  checkout_url: string;
  merchant_order_id: string;
  order_id: string;
  amount: string;
  currency: string;
  hash: string;
  merchant_id: string;
  mode: "test" | "live";
}

export interface WalletDto {
  id: number;
  wallet_type: "platform" | "instructor" | "student" | "center";
  currency: string;
  current_balance: string;
  pending_balance: string;
  available_balance: string;
  withdrawn_balance: string;
  updated_at: string;
}

export interface LedgerEntryDto {
  id: number;
  reference_id: string;
  description: string;
  entry_type: "debit" | "credit";
  amount: string;
  created_at: string;
}

export interface PayoutRequestDto {
  id: number;
  user_email: string;
  amount: string;
  channel: "instapay" | "mobile_wallet" | "bank_wire";
  channel_display: string;
  account_details: Record<string, string>;
  status: "pending" | "approved" | "rejected" | "disbursed";
  status_display: string;
  admin_notes: string;
  transaction_reference: string;
  created_at: string;
  processed_at?: string;
}

interface WalletTopUpResponseDto {
  status: "checkout_created";
  wallet_id: number;
  checkout_url: string;
  merchant_order_id: string;
  order_id: string;
  amount: string;
  currency: string;
  hash: string;
  merchant_id: string;
  mode: "test" | "live";
}

interface PayWithBalanceResponseDto {
  status: string;
  order_id: number;
  course_id: number;
  remaining_balance: string;
  enrolled: boolean;
}

export function usePlatformPricing() {
  const validateCouponMutation = useMutation<CouponValidationResultDto, Error, CouponValidatePayload>({
    mutationFn: async (payload) => apiPost<CouponValidationResultDto>("/finance/coupons/validate/", payload),
  });

  const checkoutMutation = useMutation<SubscriptionCheckoutResponseDto, Error, SubscriptionCheckoutPayload>({
    mutationFn: async (payload) => {
      const headers = payload.idempotency_key ? { "Idempotency-Key": payload.idempotency_key } : undefined;
      return apiPost<SubscriptionCheckoutResponseDto>("/finance/subscriptions/checkout/", payload, { headers });
    },
  });

  const kashierSessionMutation = useMutation<KashierSessionResponseDto, Error, KashierSessionPayload>({
    mutationFn: async (payload) => apiPost<KashierSessionResponseDto>("/finance/checkout/session/", payload),
  });

  const plansQuery = useQuery<PricingPlanDto[]>({
    queryKey: ["public-pricing-plans"],
    queryFn: async () => {
      const res = await apiGet<PricingPlanDto[]>("/finance/pricing/");
      return Array.isArray(res) ? res : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const gatewayStatusQuery = useQuery<PaymentGatewayStatusDto>({
    queryKey: ["public-payment-gateway-status"],
    queryFn: async () => {
      const res = await apiGet<PaymentGatewayStatusDto>("/finance/gateway-status/");
      return res;
    },
    staleTime: 1000 * 30, // 30 seconds fresh check
  });

  return {
    plans: plansQuery.data ?? [],
    isLoading: plansQuery.isLoading,
    isError: plansQuery.isError,
    error: plansQuery.error,
    refetchPlans: plansQuery.refetch,
    gatewayStatus: gatewayStatusQuery.data,
    isGatewayStatusLoading: gatewayStatusQuery.isLoading,
    refetchGatewayStatus: gatewayStatusQuery.refetch,
    validateCoupon: validateCouponMutation.mutateAsync,
    isValidatingCoupon: validateCouponMutation.isPending,
    processCheckout: checkoutMutation.mutateAsync,
    isProcessingCheckout: checkoutMutation.isPending,
    createKashierSession: kashierSessionMutation.mutateAsync,
    isCreatingKashierSession: kashierSessionMutation.isPending,
  };
}

import { useAuth } from "@/features/auth";

export function useStudentWallet() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const walletQuery = useQuery<WalletDto>({
    queryKey: ["user-my-wallet", user?.id],
    queryFn: () => apiGet<WalletDto>("/finance/wallets/my-wallet/"),
    staleTime: 1000 * 30,
    enabled: isAuthenticated && !!user?.id,
  });

  const ledgerQuery = useQuery<{ results?: LedgerEntryDto[] } | LedgerEntryDto[]>({
    queryKey: ["user-wallet-ledger", user?.id],
    queryFn: () => apiGet<{ results?: LedgerEntryDto[] } | LedgerEntryDto[]>("/finance/wallets/ledger/"),
    staleTime: 1000 * 30,
    enabled: isAuthenticated && !!user?.id,
  });

  const topUpMutation = useMutation<WalletTopUpResponseDto, Error, { amount: number }>({
    mutationFn: (payload) => apiPost<WalletTopUpResponseDto>("/finance/wallets/top-up/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-my-wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["user-wallet-ledger", user?.id] });
    },
  });

  const payWithBalanceMutation = useMutation<PayWithBalanceResponseDto, Error, { course_id: number; coupon_code?: string }>({
    mutationFn: (payload) => apiPost<PayWithBalanceResponseDto>("/finance/wallets/pay-with-balance/", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-my-wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["user-wallet-ledger", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });

  const ledgerEntries: LedgerEntryDto[] = Array.isArray(ledgerQuery.data)
    ? ledgerQuery.data
    : (ledgerQuery.data?.results ?? []);

  return {
    wallet: walletQuery.data,
    isLoadingWallet: walletQuery.isLoading,
    isErrorWallet: walletQuery.isError,
    refetchWallet: walletQuery.refetch,
    ledgerEntries,
    isLoadingLedger: ledgerQuery.isLoading,
    isErrorLedger: ledgerQuery.isError,
    refetchLedger: ledgerQuery.refetch,
    topUpWallet: topUpMutation.mutateAsync,
    isTopUpLoading: topUpMutation.isPending,
    payWithBalance: payWithBalanceMutation.mutateAsync,
    isPayingWithBalance: payWithBalanceMutation.isPending,
  };
}
