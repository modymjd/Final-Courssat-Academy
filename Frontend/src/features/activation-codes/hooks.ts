import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activationCodesApi } from './api';

export const useBatches = () => {
  return useQuery({
    queryKey: ['activation-batches'],
    queryFn: activationCodesApi.getBatches,
  });
};

export const useQuota = () => {
  return useQuery({
    queryKey: ['activation-quota'],
    queryFn: activationCodesApi.getQuota,
  });
};

export const useActivationCodes = (params?: { status?: string; batch_id?: number; search?: string; target_instructor_id?: number }) => {
  return useQuery({
    queryKey: ['activation-codes', params],
    queryFn: () => activationCodesApi.getCodes(params),
  });
};

export const useQuotaRequests = () => {
  return useQuery({
    queryKey: ['quota-requests'],
    queryFn: activationCodesApi.getQuotaRequests,
  });
};

export const useCenterQuotaRequests = useQuotaRequests;

export const useCreateQuotaRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activationCodesApi.createQuotaRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quota-requests'] });
      queryClient.invalidateQueries({ queryKey: ['center-quota-requests'] });
      queryClient.invalidateQueries({ queryKey: ['activation-quota'] });
    },
  });
};

export const useCreateCenterQuotaRequest = useCreateQuotaRequest;

export const useGenerateBatch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activationCodesApi.generateBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activation-batches'] });
      queryClient.invalidateQueries({ queryKey: ['activation-code-batches'] });
      queryClient.invalidateQueries({ queryKey: ['activation-codes'] });
      queryClient.invalidateQueries({ queryKey: ['activation-quota'] });
      queryClient.invalidateQueries({ queryKey: ['center-overview'] });
    },
  });
};

export const useExtendBatchShelfLife = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, additionalDays = 30 }: { batchId: number; additionalDays?: number }) =>
      activationCodesApi.extendBatchShelfLife(batchId, additionalDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activation-batches'] });
      queryClient.invalidateQueries({ queryKey: ['activation-code-batches'] });
      queryClient.invalidateQueries({ queryKey: ['activation-codes'] });
    },
  });
};

export const useValidateCode = () => {
  return useMutation({
    mutationFn: (data: { code: string; password?: string; courseId?: number }) =>
      activationCodesApi.validateCode(data.code, data.password, data.courseId),
  });
};

export const useRedeemCode = () => {
  return useMutation({
    mutationFn: (data: { code: string; password?: string; courseId?: number }) =>
      activationCodesApi.redeemCode(data.code, data.password, data.courseId),
  });
};

export const useSuperAdminReviewQuotaRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, action, adminNotes }: { requestId: number; action: 'approve' | 'reject'; adminNotes?: string }) =>
      activationCodesApi.superAdminReviewQuotaRequest(requestId, action, adminNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quota-requests'] });
      queryClient.invalidateQueries({ queryKey: ['center-quota-requests'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-quota-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-quota-periods'] });
      queryClient.invalidateQueries({ queryKey: ['activation-quota'] });
    },
  });
};

export const useSuperAdminQuickGrantQuota = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activationCodesApi.superAdminQuickGrantQuota,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-quota-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-quota-periods'] });
      queryClient.invalidateQueries({ queryKey: ['quota-requests'] });
      queryClient.invalidateQueries({ queryKey: ['center-quota-requests'] });
      queryClient.invalidateQueries({ queryKey: ['activation-quota'] });
    },
  });
};

export const useSuperAdminUpdateContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, payload }: { contractId: number; payload: Partial<any> }) =>
      activationCodesApi.superAdminUpdateContract(contractId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-quota-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-quota-periods'] });
      queryClient.invalidateQueries({ queryKey: ['activation-quota'] });
    },
  });
};

