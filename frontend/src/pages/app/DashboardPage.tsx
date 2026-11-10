import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * DashboardPage
 * Redirects authenticated users to their active workspace.
 * Owners land directly in the Owner Workspace (/app/owner/dashboard).
 * Non-owners are directed to property creation to initialize owner capabilities.
 */
export const DashboardPage: React.FC = () => {
  const { user } = useAuth()

  if (user?.is_owner) {
    return <Navigate to="/app/owner/dashboard" replace />
  }

  return <Navigate to="/app/owner/properties/new" replace />
}

export default DashboardPage
