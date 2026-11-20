import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingScreen from '../components/common/LoadingScreen'

/**
 * OwnerRoute Guard
 * Restricts access to the Owner Workspace.
 * - Non-owner authenticated users can access the creation wizard (/app/owner/properties/new)
 *   to create their first property and activate Owner capability.
 * - Dashboard, portfolio listing, and operational routes strictly require `user.is_owner === true`.
 * - Platform administrators without owner status are not treated as owners.
 */
export const OwnerRoute: React.FC = () => {
  const { user, isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <LoadingScreen message="Validating owner authorization..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Strictly require is_owner for owner workspace pages. Non-owners are directed
  // to activate their 90-day free trial first.
  if (user?.is_owner !== true) {
    return <Navigate to="/owner/get-started" replace />
  }

  return <Outlet />
}

export default OwnerRoute
