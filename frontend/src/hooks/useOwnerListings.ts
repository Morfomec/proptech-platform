import { useQuery } from '@tanstack/react-query'
import { listingService } from '../services/listing.service'
import type { PaginatedListingsResponse } from '../types/listing'

export const OWNER_LISTINGS_QUERY_KEY = 'owner-listings'

/**
 * Hook to fetch paginated listings for properties owned by the authenticated user.
 */
export function useOwnerListings(params: { page?: number; page_size?: number } = {}) {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 100

  return useQuery<PaginatedListingsResponse, Error>({
    queryKey: [OWNER_LISTINGS_QUERY_KEY, page, pageSize],
    queryFn: () => listingService.getOwnerListings({ page, page_size: pageSize }),
    staleTime: 1000 * 60 * 3, // 3 minutes stale cache
  })
}

export default useOwnerListings

