import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { OwnerSidebar } from '../components/owner/OwnerSidebar'
import { OwnerHeader } from '../components/owner/OwnerHeader'

/**
 * OwnerWorkspaceLayout
 * Dedicated application layout for authenticated property owners.
 * Features persistent desktop sidebar, responsive mobile drawer, and dedicated header.
 */
export const OwnerWorkspaceLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex flex-col">
      {/* Sidebar (Desktop persistent + Mobile slide-over) */}
      <OwnerSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area (offset by 64px on lg displays) */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Workspace Top Header */}
        <OwnerHeader onOpenSidebar={() => setIsSidebarOpen(true)} />

        {/* Dynamic Nested Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default OwnerWorkspaceLayout

