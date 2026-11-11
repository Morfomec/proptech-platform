import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import applicationService, {
  type ReceivedApplicationsParams,
} from '../services/application.service'
import { useAuth } from './useAuth'
import type { ReviewApplicationPayload } from '../types/leasing'

export const OWNER_APPLICATIONS_QUERY_KEYS = {
  received: ['owner', 'applications', 'received'] as const,
  detail: (applicationId: string) =>
    ['owner', 'applications', 'detail', applicationId] as const,
}

export function useReceivedApplications(params?: ReceivedApplicationsParams) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_APPLICATIONS_QUERY_KEYS.received, params],
    queryFn: () => applicationService.getReceivedApplications(params),
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

export function useReceivedApplicationsCount(status?: string) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_APPLICATIONS_QUERY_KEYS.received, 'count', status ?? 'all'],
    queryFn: () =>
      applicationService.getReceivedApplications({
        page: 1,
        page_size: 1,
        ...(status ? { status } : {}),
      }),
    select: (data) => data.count,
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

export function useOwnerApplicationDetail(applicationId?: string) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: OWNER_APPLICATIONS_QUERY_KEYS.detail(applicationId ?? ''),
    queryFn: () => applicationService.getApplicationDetail(applicationId!),
    enabled: isAuthenticated && Boolean(user?.is_owner) && Boolean(applicationId),
    staleTime: 30_000,
  })
}

export function useReviewApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      applicationId,
      payload,
    }: {
      applicationId: string
      payload: ReviewApplicationPayload
    }) => applicationService.reviewApplication(applicationId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: OWNER_APPLICATIONS_QUERY_KEYS.received })
      queryClient.invalidateQueries({
        queryKey: OWNER_APPLICATIONS_QUERY_KEYS.detail(variables.applicationId),
      })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}

