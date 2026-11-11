import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { propertyService } from '../services/property.service'
import { OWNER_PROPERTIES_QUERY_KEY } from './useOwnerProperties'

/**
 * Returns a Set of property IDs owned by the authenticated owner, derived strictly
 * from the backend owner-scoped `/api/v1/properties/me/` endpoint.
 * Never executes for unauthenticated visitors or non-owner accounts.
 */
export function useOwnedPropertyIds(): Set<string> {
  const { isAuthenticated, user } = useAuth()
  const isOwner = isAuthenticated && Boolean(user?.is_owner)

  const { data } = useQuery({
    queryKey: [OWNER_PROPERTIES_QUERY_KEY, 1, 100],
    queryFn: () => propertyService.getMyProperties({ page: 1, page_size: 100 }),
    enabled: isOwner,
    staleTime: 1000 * 60 * 3,
  })

  return useMemo(() => {
    const ids = new Set<string>()
    if (!isOwner) return ids
    for (const prop of data?.results ?? []) {
      ids.add(prop.id)
    }
    return ids
  }, [isOwner, data])
}

export default useOwnedPropertyIds

