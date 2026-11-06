import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../config/query-client'
import { ToastProvider } from '../components/ui/toast'
import { AuthProvider } from './AuthProvider'

export interface AppProvidersProps {
  children: React.ReactNode
}

/**
 * Centralized Application Providers
 *
 * Provider Hierarchy:
 * 1. QueryClientProvider: Server state caching and asynchronous query lifecycle
 * 2. ToastProvider: Global toast notifications container and context
 * 3. AuthProvider: In-memory session state, access token lifecycle, and authentication context
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider placement="top-right">
        <AuthProvider>
          {children}
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default AppProviders
