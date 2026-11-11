import { useQuery } from '@tanstack/react-query'
import documentService, { type DocumentListParams } from '../services/document.service'
import type { DocumentScope } from '../types/document'
import { useAuth } from './useAuth'

export const OWNER_DOCUMENTS_QUERY_KEY = ['owner', 'documents'] as const

export function useOwnerDocuments(params?: DocumentListParams) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_DOCUMENTS_QUERY_KEY, params],
    queryFn: () => documentService.getDocuments(params),
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

export function useOwnerDocumentCount(scope?: DocumentScope) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...OWNER_DOCUMENTS_QUERY_KEY, 'count', scope ?? 'all'],
    queryFn: () =>
      documentService.getDocuments({
        page: 1,
        page_size: 1,
        ...(scope && scope !== 'all' ? { scope } : {}),
      }),
    select: (data) => data.count,
    enabled: isAuthenticated && Boolean(user?.is_owner),
    staleTime: 30_000,
  })
}

export default useOwnerDocuments

