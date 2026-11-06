import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingScreen from '../components/common/LoadingScreen'

interface LocationState {
  from?: {
    pathname?: string
    search?: string
    hash?: string
  }
}

/**
 * GuestRoute
 * Route guard that restricts access to unauthenticated guests.
 * Authenticated users are redirected to their intended destination or back to `/`.
 */
export const GuestRoute: React.FC = () => {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  // Wait for session rehydration before evaluating routing guards
  if (isInitializing) {
    return <LoadingScreen message="Checking session..." />
  }

  // If already authenticated, redirect to the intended destination or landing page (/)
  if (isAuthenticated) {
    const state = location.state as LocationState | undefined
    const destination =
      state?.from?.pathname && state.from.pathname.startsWith('/')
        ? `${state.from.pathname}${state.from.search || ''}${state.from.hash || ''}`
        : '/'

    return <Navigate to={destination} replace />
  }

  // Render the guest-only route outlet
  return <Outlet />
}

export default GuestRoute

