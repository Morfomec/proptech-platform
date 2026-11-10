import React from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'

/**
 * PublicLayout
 * Minimal shell for public-facing routes.
 * Renders child routes through Outlet without adding duplicate navigation or footer elements.
 */
export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-muted antialiased">
      <ScrollRestoration />
      <Outlet />
    </div>
  )
}

export default PublicLayout

