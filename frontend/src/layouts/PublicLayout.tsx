import React from 'react'
import { Outlet } from 'react-router-dom'

/**
 * PublicLayout
 * Minimal shell for public-facing routes.
 * Renders child routes through Outlet without adding duplicate navigation or footer elements.
 */
export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-muted antialiased">
      <Outlet />
    </div>
  )
}

export default PublicLayout

