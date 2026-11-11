import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TenantSidebar } from '../components/tenant/TenantSidebar'
import { TenantHeader } from '../components/tenant/TenantHeader'

/**
 * TenantWorkspaceLayout
 * Dedicated application layout for authenticated tenants.
 * Features persistent desktop sidebar, responsive mobile drawer, and workspace header.
 */
export const TenantWorkspaceLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex flex-col">
      {/* Sidebar (Desktop persistent + Mobile slide-over) */}
      <TenantSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area (offset by 64 units on lg displays) */}
      <div className="flex-1 flex flex-col lg:pl-64">
        <TenantHeader onOpenSidebar={() => setIsSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default TenantWorkspaceLayout

