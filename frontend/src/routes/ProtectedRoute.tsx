import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingScreen from '../components/common/LoadingScreen'

/**
 * ProtectedRoute
 * Route guard that requires active authentication.
 * Unauthenticated visitors are redirected to /login with their original
 * destination preserved in React Router location state.
 */
export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  // Wait for session rehydration before evaluating protection
  if (isInitializing) {
    return <LoadingScreen message="Validating session..." />
  }

  // Redirect unauthenticated users to login while preserving their destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Render the protected route outlet
  return <Outlet />
}

export default ProtectedRoute

