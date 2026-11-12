import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'

export interface TenantSidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  badge?: string | number
  badgeVariant?: 'danger' | 'neutral'
}

/**
 * TenantSidebar
 * Dedicated navigation sidebar for the Tenant Workspace matching the PropTech design system.
 * Features desktop persistent sidebar + mobile slide-over drawer.
 */
export const TenantSidebar: React.FC<TenantSidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation()

  const mainNavItems: NavItem[] = [
    {
      label: 'Overview',
      path: '/app/tenant/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
      ),
    },
    {
      label: 'Browse Properties',
      path: '/app/tenant/properties',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.64 5.64a7.5 7.5 0 0010.61 10.61z"
          />
        </svg>
      ),
    },
    {
      label: 'Saved Properties',
      path: '/app/tenant/saved-properties',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      ),
    },
    {
      label: 'My Applications',
      path: '/app/tenant/applications',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      label: 'My Tenancy',
      path: '/app/tenant/tenancy',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      label: 'Documents',
      path: '/app/tenant/documents',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          />
        </svg>
      ),
    },
  ]

  const bottomNavItems: NavItem[] = [
    {
      label: 'Notifications',
      path: '/app/tenant/notifications',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
    },
    {
      label: 'Settings',
      path: '/app/tenant/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ]

  const isNavItemActive = (path: string) => {
    if (path === '/app/tenant/dashboard') {
      return location.pathname === '/app/tenant/dashboard' || location.pathname === '/app/tenant'
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  const renderNavList = (items: NavItem[]) => (
    <ul className="space-y-1">
      {items.map((item) => {
        const isActive = isNavItemActive(item.path)

        return (
          <li key={item.path}>
            <Link
              to={item.path}
              onClick={onClose}
              className={`flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#ECF5F2] text-[#408A71] font-semibold'
                  : 'text-[#4B5563] hover:bg-gray-50 hover:text-[#111827]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={isActive ? 'text-[#408A71]' : 'text-[#6B7280]'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full ${
                    item.badgeVariant === 'danger'
                      ? 'bg-[#EF4444] text-white'
                      : 'bg-gray-100 text-gray-600'
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
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 10v10h14V10" />
                <path d="M9 20v-6h6v6" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-[#111827] leading-none">
                prop<span className="text-[#408A71]">tech</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-[#6B7280] uppercase mt-0.5">
                Tenant Workspace
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
          currentWorkspace="tenant"
          variant="sidebar"
          onSwitch={onClose}
        />

        {/* Main Navigation */}
        <nav className="p-3 pt-3" aria-label="Tenant Workspace Navigation">
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
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-white shadow-2xl flex flex-col z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}

export default TenantSidebar

