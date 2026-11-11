import { useQuery } from '@tanstack/react-query'
import { listingService } from '../services/listing.service'
import type { PaginatedListingsResponse } from '../types/listing'
import { useAuth } from './useAuth'

export const OWNER_LISTINGS_QUERY_KEY = 'owner-listings'

/**
 * Hook to fetch paginated listings for properties owned by the authenticated user.
 */
export function useOwnerListings(
  params: { page?: number; page_size?: number; status?: string } = {}
) {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 100
  const status = params.status

  return useQuery<PaginatedListingsResponse, Error>({
    queryKey: [OWNER_LISTINGS_QUERY_KEY, page, pageSize, status ?? 'all'],
    queryFn: () =>
      listingService.getOwnerListings({
        page,
        page_size: pageSize,
        ...(status ? { status } : {}),
      }),
    staleTime: 1000 * 60 * 3, // 3 minutes stale cache
  })
}

export function useOwnerListingsCount(status?: string) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [OWNER_LISTINGS_QUERY_KEY, 'count', status ?? 'all'],
    queryFn: () =>
      listingService.getOwnerListings({
        page: 1,
        page_size: 1,
        ...(status ? { status } : {}),
      }),
    select: (data) => data.count,
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

export default useOwnerListings

