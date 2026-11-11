import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { resolveDefaultWorkspaceRoute } from '../../utils/workspace'

/**
 * DashboardPage
 * Intelligent entry point for `/app/dashboard`.
 * Routes users cleanly to their authorized workspace (honoring stored preference when eligible).
 */
export const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const targetRoute = resolveDefaultWorkspaceRoute(user)

  return <Navigate to={targetRoute} replace />
}

export default DashboardPage
