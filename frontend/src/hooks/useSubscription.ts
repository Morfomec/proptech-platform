import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import subscriptionService from '../services/subscription.service'
import type {
  SubscriptionPaymentsQueryParams,
  UpgradeSubscriptionPayload,
} from '../types/subscription'
import { useAuth } from './useAuth'

export const SUBSCRIPTION_PLANS_KEY = ['subscriptions', 'plans'] as const
export const SUBSCRIPTION_ME_KEY = ['subscriptions', 'me'] as const
export const SUBSCRIPTION_QUOTA_KEY = ['subscriptions', 'quota'] as const
export const SUBSCRIPTION_PAYMENTS_KEY = ['subscriptions', 'payments'] as const

/**
 * Hook to retrieve available active subscription plans.
 */
export function useSubscriptionPlans() {
  return useQuery({
    queryKey: SUBSCRIPTION_PLANS_KEY,
    queryFn: () => subscriptionService.getActivePlans(),
    select: (res) => res.data,
    staleTime: 60_000,
  })
}

/**
 * Hook to retrieve the authenticated owner's current subscription.
 */
export function useMySubscription() {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: SUBSCRIPTION_ME_KEY,
    queryFn: () => subscriptionService.getMySubscription(),
    select: (res) => res.data,
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Hook to retrieve the owner's property quota usage and limits.
 */
export function useSubscriptionQuota() {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: SUBSCRIPTION_QUOTA_KEY,
    queryFn: () => subscriptionService.getQuotaUtilization(),
    select: (res) => res.data,
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Hook to retrieve billing/payment history for the owner subscription.
 */
export function useSubscriptionPayments(params?: SubscriptionPaymentsQueryParams) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...SUBSCRIPTION_PAYMENTS_KEY, params],
    queryFn: () => subscriptionService.getSubscriptionPayments(params),
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

/**
 * Mutation hook to upgrade or change subscription plan.
 */
export function useUpgradeSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpgradeSubscriptionPayload) =>
      subscriptionService.upgradeSubscription(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_ME_KEY })
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUOTA_KEY })
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_PAYMENTS_KEY })
    },
  })
}

/**
 * Mutation hook to activate the owner 90-day Starter trial.
 */
export function useActivateOwnerTrial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => subscriptionService.activateOwnerTrial(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_ME_KEY })
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUOTA_KEY })
    },
  })
}

/**
 * Mutation hook to cancel subscription.
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => subscriptionService.cancelSubscription(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_ME_KEY })
      void queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUOTA_KEY })
    },
  })
}

