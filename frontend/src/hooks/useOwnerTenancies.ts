import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import tenancyService, { type ManagedTenanciesParams } from '../services/tenancy.service'
import type {
  ActivateTenancyPayload,
  CreateTenancyPayload,
  EndTenancyPayload,
  TenancyStatus,
} from '../types/leasing'
import { useAuth } from './useAuth'
import { OWNER_APPLICATIONS_QUERY_KEYS } from './useOwnerApplications'
import { OWNER_PROPERTIES_QUERY_KEY } from './useOwnerProperties'
import { OWNER_LISTINGS_QUERY_KEY } from './useOwnerListings'
import { TENANT_QUERY_KEYS } from './useTenantWorkspace'

export const OWNER_TENANCIES_QUERY_KEY = ['owner', 'tenancies', 'managed'] as const
export const OWNER_TENANCY_DETAIL_QUERY_KEY = ['owner', 'tenancies', 'detail'] as const

export function useManagedTenancies(params?: ManagedTenanciesParams) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_TENANCIES_QUERY_KEY, params],
    queryFn: () => tenancyService.getManagedTenancies(params),
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

export function useManagedTenanciesCount(status?: TenancyStatus) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_TENANCIES_QUERY_KEY, 'count', status ?? 'all'],
    queryFn: () =>
      tenancyService.getManagedTenancies({
        page: 1,
        page_size: 1,
        ...(status ? { status } : {}),
      }),
    select: (data) => data.count,
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

export function useOwnerTenancyDetail(tenancyId?: string) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_TENANCY_DETAIL_QUERY_KEY, tenancyId ?? ''],
    queryFn: () => tenancyService.getTenancyDetail(tenancyId!),
    enabled: isAuthenticated && Boolean(user?.is_owner) && Boolean(tenancyId),
    staleTime: 30_000,
  })
}

function invalidateTenancyRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  tenancyId?: string
) {
  queryClient.invalidateQueries({ queryKey: OWNER_TENANCIES_QUERY_KEY })
  if (tenancyId) {
    queryClient.invalidateQueries({
      queryKey: [...OWNER_TENANCY_DETAIL_QUERY_KEY, tenancyId],
    })
  } else {
    queryClient.invalidateQueries({ queryKey: OWNER_TENANCY_DETAIL_QUERY_KEY })
  }
  queryClient.invalidateQueries({ queryKey: OWNER_APPLICATIONS_QUERY_KEYS.received })
  queryClient.invalidateQueries({ queryKey: ['owner', 'applications', 'detail'] })
  queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })
  queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] })
  queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.myTenancies })
  queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.notifications })
  queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.unreadCount })
}

export function useCreateTenancy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTenancyPayload) => tenancyService.createTenancy(payload),
    onSuccess: (response) => {
      invalidateTenancyRelatedQueries(queryClient, response.data?.id)
    },
  })
}

export function useActivateTenancy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      tenancyId,
      payload,
    }: {
      tenancyId: string
      payload?: ActivateTenancyPayload
    }) => tenancyService.activateTenancy(tenancyId, payload),
    onSuccess: (_response, variables) => {
      invalidateTenancyRelatedQueries(queryClient, variables.tenancyId)
    },
  })
}

export function useCancelTenancy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tenancyId: string) => tenancyService.cancelTenancy(tenancyId),
    onSuccess: (_response, tenancyId) => {
      invalidateTenancyRelatedQueries(queryClient, tenancyId)
    },
  })
}

export function useEndTenancy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      tenancyId,
      payload,
    }: {
      tenancyId: string
      payload?: EndTenancyPayload
    }) => tenancyService.endTenancy(tenancyId, payload),
    onSuccess: (_response, variables) => {
      invalidateTenancyRelatedQueries(queryClient, variables.tenancyId)
    },
  })
}

export default useManagedTenancies

