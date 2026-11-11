import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/ui/spinner'

/**
 * TenantRoute
 * Protects all `/app/tenant/*` routes by verifying `user.is_tenant === true`.
 * Assumes parent `ProtectedRoute` has already verified authentication.
 */
export const TenantRoute: React.FC = () => {
  const { user, isInitializing } = useAuth()

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm font-medium text-[#6B7280]">
            Initializing workspace...
          </span>
        </div>
      </div>
    )
  }

  if (!user?.is_tenant) {
    if (user?.is_owner) {
      return <Navigate to="/app/owner/dashboard" replace />
    }
    return <Navigate to="/properties" replace />
  }

  return <Outlet />
}

export default TenantRoute

