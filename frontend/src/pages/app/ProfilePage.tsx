import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { resolveDefaultSettingsRoute } from '../../utils/workspace'
import { AccountSettingsPage } from './AccountSettingsPage'

/**
 * ProfilePage
 * Compatibility wrapper for `/app/profile`.
 * Redirects users into their active workspace's shared Settings route
 * (`/app/owner/settings` or `/app/tenant/settings`) so the active sidebar
 * and top navigation stay visible. Falls back cleanly if no workspace role applies.
 */
export const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const targetSettingsRoute = resolveDefaultSettingsRoute(user)

  if (targetSettingsRoute) {
    return <Navigate to={targetSettingsRoute} replace />
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <AccountSettingsPage />
      </div>
    </div>
  )
}

export default ProfilePage
