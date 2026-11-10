import { QueryClient } from '@tanstack/react-query'

/**
 * Centralized TanStack Query Client Configuration
 *
 * Configured with sensible defaults:
 * - staleTime: 60 seconds (prevents aggressive refetching of recently fetched data)
 * - retry: 1 (retries failed network requests once before throwing)
 * - refetchOnWindowFocus: false (avoids disruptive refetches when users switch browser tabs)
 * - mutation retry: 0 (mutations should generally fail fast and prompt user feedback)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

export default queryClient

