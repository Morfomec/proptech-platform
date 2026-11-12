import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useReceivedApplicationsCount } from '../../hooks/useOwnerApplications'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'

export interface OwnerSidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  badge?: string
  disabled?: boolean
  isActiveCheck?: (currentPath: string) => boolean
}

export const OwnerSidebar: React.FC<OwnerSidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation()
  const currentPath = location.pathname
  const { data: pendingApplicationsCount = 0 } = useReceivedApplicationsCount(
    'submitted,under_review'
  )

  const mainNavItems: NavItem[] = [
    {
      label: 'Overview',
      path: '/app/owner/dashboard',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
      isActiveCheck: (p) => p === '/app/owner/dashboard' || p === '/app/owner',
    },
    {
      label: 'My Properties',
      path: '/app/owner/properties',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
          <path d="M10 6h4" />
          <path d="M10 10h4" />
          <path d="M10 14h4" />
          <path d="M10 18h4" />
        </svg>
      ),
      isActiveCheck: (p) => p.startsWith('/app/owner/properties'),
    },
    {
      label: 'Applications',
      path: '/app/owner/applications',
      badge:
        pendingApplicationsCount > 0
          ? pendingApplicationsCount > 99
            ? '99+'
            : String(pendingApplicationsCount)
          : undefined,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect width="6" height="4" x="9" y="3" rx="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      ),
      isActiveCheck: (p) => p.startsWith('/app/owner/applications'),
    },
    {
      label: 'Tenancies',
      path: '/app/owner/tenancies',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      isActiveCheck: (p) => p.startsWith('/app/owner/tenancies'),
    },
    {
      label: 'Documents',
      path: '/app/owner/documents',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      ),
      isActiveCheck: (p) => p.startsWith('/app/owner/documents'),
    },
  ]

  const bottomNavItems: NavItem[] = [
    {
      label: 'Notifications',
      path: '/app/owner/notifications',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      ),
    },
    {
      label: 'Settings',
      path: '/app/owner/settings',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      isActiveCheck: (p) => p === '/app/owner/settings' || p === '/app/profile',
    },
  ]

  const renderNavList = (items: NavItem[]) => (
    <ul className="space-y-1">
      {items.map((item) => {
        const isActive = item.isActiveCheck
          ? item.isActiveCheck(currentPath)
          : currentPath === item.path

        if (item.disabled || item.path === '#') {
          return (
            <li key={item.label}>
              <div className="flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#9CA3AF] rounded-lg cursor-not-allowed select-none">
                <div className="flex items-center gap-3">
                  <span className="text-[#9CA3AF]">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {item.badge}
                  </span>
                )}
              </div>
            </li>
          )
        }

        return (
          <li key={item.label}>
            <Link
              to={item.path}
              onClick={onClose}
              className={`flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#408A71]/10 text-[#408A71] font-semibold'
                  : 'text-[#4B5563] hover:bg-gray-50 hover:text-[#111827]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-[#408A71]' : 'text-[#6B7280]'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[11px] font-medium min-w-[20px] h-5 inline-flex items-center justify-center px-1.5 rounded-full tabular-nums ${
                    item.label === 'Notifications'
                      ? 'bg-[#EF4444] text-white'
                      : 'bg-[#ECF5F2] text-[#408A71]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white text-[#111827]">
      {/* Top Brand Section */}
      <div>
        <div className="flex h-20 items-center justify-between border-b border-[#E5E7EB] px-5">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-2.5 focus:outline-hidden"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#408A71] text-white shadow-2xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-[#111827] leading-none">
                prop<span className="text-[#408A71]">tech</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-[#6B7280] uppercase mt-0.5">
                Owner Workspace
              </span>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden inline-flex p-1.5 text-[#6B7280] hover:text-[#111827] rounded-md focus:outline-hidden cursor-pointer"
            aria-label="Close navigation sidebar"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar Workspace Switcher */}
        <WorkspaceSwitcher
          currentWorkspace="owner"
          variant="sidebar"
          onSwitch={onClose}
        />

        {/* Main Navigation */}
        <nav className="p-3 pt-3" aria-label="Owner Workspace Navigation">
          {renderNavList(mainNavItems)}
        </nav>
      </div>

      {/* Bottom Pinned Section: Notifications & Settings */}
      <div className="border-t border-[#E5E7EB] p-3 pb-4">
        {renderNavList(bottomNavItems)}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[#E5E7EB] bg-white z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-white shadow-2xl flex flex-col z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}

export default OwnerSidebar
