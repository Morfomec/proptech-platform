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
      staleTime: 5 * 1000, // 5 seconds: instant cache hit + immediate background revalidation
      gcTime: 10 * 60 * 1000, // 10 minutes cache retention in memory
      retry: 1,
      refetchOnMount: true, // Always revalidate data whenever a component/page mounts
      refetchOnWindowFocus: true, // Auto-sync when switching back to the app tab
    },
    mutations: {
      retry: 0,
    },
  },
})

export default queryClient

