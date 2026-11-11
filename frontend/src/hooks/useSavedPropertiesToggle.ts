import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { listingService } from '../services/listing.service'

/**
 * Shared saved-property status and optimistic toggle hook for public and
 * tenant workspace property card grids.
 */
export function useSavedPropertiesToggle() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({})

  const { data: savedData } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: () => listingService.getSavedProperties({ page: 1 }),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  })

  const savedPropertyIds = useMemo(() => {
    const ids = new Set<string>()
    if (savedData?.results) {
      savedData.results.forEach((item) => {
        if (item.property_id) {
          ids.add(item.property_id)
        }
      })
    }
    return ids
  }, [savedData])

  const isPropertySaved = (propertyId: string): boolean => {
    if (propertyId in optimisticOverrides) {
      return optimisticOverrides[propertyId]
    }
    return savedPropertyIds.has(propertyId)
  }

  const toggleSaveMutation = useMutation({
    mutationFn: async ({ propertyId, isSaved }: { propertyId: string; isSaved: boolean }) => {
      if (isSaved) {
        return listingService.removeSavedProperty(propertyId)
      }
      return listingService.saveProperty(propertyId)
    },
    onMutate: async ({ propertyId, isSaved }) => {
      setOptimisticOverrides((prev) => ({ ...prev, [propertyId]: !isSaved }))
    },
    onError: (_err, { propertyId, isSaved }) => {
      setOptimisticOverrides((prev) => ({ ...prev, [propertyId]: isSaved }))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-properties'] })
    },
  })

  const handleToggleSave = (e: React.MouseEvent, propertyId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: location.pathname + location.search },
      })
      return
    }

    const isSaved = isPropertySaved(propertyId)
    toggleSaveMutation.mutate({ propertyId, isSaved })
  }

  return {
    isPropertySaved,
    handleToggleSave,
    isToggling: toggleSaveMutation.isPending,
  }
}

export default useSavedPropertiesToggle

