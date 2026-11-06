import { useQuery } from '@tanstack/react-query'
import { propertyService } from '../services/property.service'
import type { FetchPropertiesParams, PaginatedPropertiesResponse } from '../types/property'

export const OWNER_PROPERTIES_QUERY_KEY = 'owner-properties'

/**
 * Hook to fetch paginated properties for the authenticated owner using React Query.
 */
export function useOwnerProperties(params: FetchPropertiesParams = {}) {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 20

  return useQuery<PaginatedPropertiesResponse, Error>({
    queryKey: [OWNER_PROPERTIES_QUERY_KEY, page, pageSize],
    queryFn: () => propertyService.getMyProperties({ page, page_size: pageSize }),
    staleTime: 1000 * 60 * 3, // 3 minutes stale cache
  })
}

export default useOwnerProperties

