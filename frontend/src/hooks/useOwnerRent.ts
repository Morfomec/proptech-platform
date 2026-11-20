import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import rentService from '../services/rent.service'
import type {
  CreateRefundPayload,
  FinancialTransactionsQueryParams,
  PaymentsQueryParams,
  RecordPaymentPayload,
  RefundsQueryParams,
  RentChargesQueryParams,
} from '../types/rent'
import { useAuth } from './useAuth'

export const OWNER_RENT_SUMMARY_KEY = ['owner', 'rent', 'summary'] as const
export const OWNER_SECURITY_DEPOSITS_KEY = ['owner', 'rent', 'security-deposits'] as const
export const OWNER_RENT_CHARGES_KEY = ['owner', 'rent', 'charges'] as const
export const OWNER_PAYMENTS_KEY = ['owner', 'rent', 'payments'] as const
export const OWNER_PAYMENT_DETAIL_KEY = ['owner', 'rent', 'payment-detail'] as const
export const OWNER_REFUNDS_KEY = ['owner', 'rent', 'refunds'] as const
export const OWNER_TRANSACTIONS_KEY = ['owner', 'rent', 'transactions'] as const

/**
 * Hook to retrieve portfolio-level or tenancy-filtered financial summary metrics.
 */
export function useOwnerRentSummary(params?: {
  tenancy_id?: string
  property_id?: string
}) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_RENT_SUMMARY_KEY, params],
    queryFn: () => rentService.getRentSummary(params),
    select: (res) => res.data,
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Hook to retrieve paginated and filtered rent charges for the owner portfolio.
 */
export function useOwnerRentCharges(params?: RentChargesQueryParams) {
  const { isAuthenticated, user } = useAuth()
  const queryParams: RentChargesQueryParams = { role: 'owner', ...params }
  return useQuery({
    queryKey: [...OWNER_RENT_CHARGES_KEY, queryParams],
    queryFn: () => rentService.getRentCharges(queryParams),
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Hook to retrieve paginated payment records for the owner portfolio.
 */
export function useOwnerPayments(params?: PaymentsQueryParams) {
  const { isAuthenticated, user } = useAuth()
  const queryParams: PaymentsQueryParams = { role: 'owner', ...params }
  return useQuery({
    queryKey: [...OWNER_PAYMENTS_KEY, queryParams],
    queryFn: () => rentService.getPayments(queryParams),
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Hook to retrieve detailed payment record with rent charge allocations.
 */
export function useOwnerPaymentDetail(paymentId?: string | null) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_PAYMENT_DETAIL_KEY, paymentId ?? ''],
    queryFn: () => rentService.getPaymentDetail(paymentId!),
    select: (res) => res.data,
    enabled: isAuthenticated && Boolean(user?.is_owner) && Boolean(paymentId),
    staleTime: 30_000,
  })
}

/**
 * Hook to retrieve security deposits breakdown across the owner's portfolio.
 */
export function useOwnerSecurityDeposits(params?: {
  tenancy_id?: string
  property_id?: string
}) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_SECURITY_DEPOSITS_KEY, params],
    queryFn: () => rentService.getSecurityDeposits({ ...params, role: 'owner' }),
    select: (res) => res.data,
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Hook to retrieve refund records for the owner portfolio.
 */
export function useOwnerRefunds(params?: RefundsQueryParams) {
  const { isAuthenticated, user } = useAuth()
  const queryParams: RefundsQueryParams = { role: 'owner', ...params }
  return useQuery({
    queryKey: [...OWNER_REFUNDS_KEY, queryParams],
    queryFn: () => rentService.getRefunds(queryParams),
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Hook to retrieve unified chronological financial transactions (payments and refunds).
 */
export function useOwnerFinancialTransactions(params?: FinancialTransactionsQueryParams) {
  const { isAuthenticated, user } = useAuth()
  const queryParams: FinancialTransactionsQueryParams = { role: 'owner', ...params }
  return useQuery({
    queryKey: [...OWNER_TRANSACTIONS_KEY, queryParams],
    queryFn: () => rentService.getFinancialTransactions(queryParams),
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Mutation to record a manual payment for a tenancy.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: RecordPaymentPayload) => rentService.recordPayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OWNER_PAYMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: OWNER_RENT_CHARGES_KEY })
      queryClient.invalidateQueries({ queryKey: OWNER_RENT_SUMMARY_KEY })
      queryClient.invalidateQueries({ queryKey: OWNER_SECURITY_DEPOSITS_KEY })
      queryClient.invalidateQueries({ queryKey: OWNER_TRANSACTIONS_KEY })
    },
  })
}

/**
 * Mutation to issue a refund against a completed payment.
 */
export function useCreateRefund() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRefundPayload) => rentService.createRefund(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: OWNER_REFUNDS_KEY })
      queryClient.invalidateQueries({ queryKey: OWNER_PAYMENTS_KEY })
      queryClient.invalidateQueries({
        queryKey: [...OWNER_PAYMENT_DETAIL_KEY, variables.payment_id],
      })
      queryClient.invalidateQueries({ queryKey: OWNER_RENT_CHARGES_KEY })
      queryClient.invalidateQueries({ queryKey: OWNER_RENT_SUMMARY_KEY })
      queryClient.invalidateQueries({ queryKey: OWNER_SECURITY_DEPOSITS_KEY })
      queryClient.invalidateQueries({ queryKey: OWNER_TRANSACTIONS_KEY })
    },
  })
}

