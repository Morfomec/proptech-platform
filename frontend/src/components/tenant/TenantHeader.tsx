import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../../hooks/useTenantWorkspace'
import {
  formatNotificationDate,
  getTenantNotificationTarget,
} from '../../utils/notification'
import type { NotificationItem } from '../../types/notification'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'

export interface TenantHeaderProps {
  onOpenSidebar: () => void
}

export const TenantHeader: React.FC<TenantHeaderProps> = ({ onOpenSidebar }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifDropdownRef = useRef<HTMLDivElement>(null)

  const { data: unreadData } = useUnreadNotificationCount()
  const {
    data: recentNotificationsData,
    isLoading: isNotifLoading,
    isError: isNotifError,
    refetch: refetchNotifs,
  } = useNotifications({ page: 1, page_size: 5 })
  const markNotificationRead = useMarkNotificationRead()
  const markAllNotificationsRead = useMarkAllNotificationsRead()

  const unreadCount = unreadData?.data?.unread_count ?? 0
  const recentNotifications = recentNotificationsData?.results ?? []

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false)
        setIsNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleHeaderNotificationClick = async (item: NotificationItem) => {
    const target = getTenantNotificationTarget(item)
    setIsNotifOpen(false)
    if (!item.is_read) {
      try {
        await markNotificationRead.mutateAsync(item.id)
      } catch {
        // Ignore silent read error on navigation; user still navigates
      }
    }
    if (target) {
      navigate(target.path)
    } else {
      navigate('/app/tenant/notifications')
    }
  }

  const userFullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'Tenant'

  const userInitials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : (userFullName.slice(0, 2) || 'TU').toUpperCase()

  const handleLogout = async () => {
    setIsDropdownOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (trimmed) {
      navigate(`/app/tenant/properties?search=${encodeURIComponent(trimmed)}`, {
        state: { headerSearch: trimmed },
      })
    } else {
      navigate('/app/tenant/properties', {
        state: { headerSearch: '' },
      })
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 sm:px-6 lg:px-8">
      {/* Mobile Hamburger & Brand */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex p-2 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Open navigation sidebar"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#408A71] text-white shadow-2xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5 10v10h14V10" />
              <path d="M9 20v-6h6v6" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-[#111827]">
            prop<span className="text-[#408A71]">tech</span>
          </span>
        </Link>
      </div>

      {/* Desktop Search Bar */}
      <div className="hidden lg:flex items-center flex-1 max-w-md">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search properties, locations..."
            className="w-full pl-9 pr-4 py-2 bg-[#F3F4F6] hover:bg-[#EBEEF2] focus:bg-white text-xs text-[#111827] placeholder-[#6B7280] rounded-lg border border-[#E5E7EB] focus:border-[#408A71] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/20 transition-all"
          />
        </form>
      </div>

      {/* Right Actions, Workspace Switcher & User Dropdown */}
      <div className="flex items-center gap-3 sm:gap-4 ml-auto">
        {/* Notification Bell Flyout */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setIsNotifOpen((prev) => !prev)
              setIsDropdownOpen(false)
            }}
            aria-expanded={isNotifOpen}
            aria-haspopup="true"
            className="relative p-2.5 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            title="Notifications"
            aria-label={
              unreadCount > 0
                ? `Notifications (${unreadCount} unread)`
                : 'Notifications'
            }
          >
            <svg
              className="w-5.5 h-5.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white tabular-nums"
                aria-hidden="true"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl border border-[#E5E7EB] overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#111827]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECF5F2] text-[#408A71]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    disabled={markAllNotificationsRead.isPending}
                    onClick={() => markAllNotificationsRead.mutate()}
                    className="text-xs font-semibold text-[#408A71] hover:text-[#34745C] disabled:opacity-50 cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#F3F4F6]">
                {isNotifLoading ? (
                  <div className="p-4 space-y-2.5">
                    {[1, 2, 3].map((idx) => (
                      <div key={idx} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : isNotifError ? (
                  <div className="p-5 text-center space-y-2">
                    <p className="text-xs text-red-600 font-medium">
                      Unable to load notifications.
                    </p>
                    <button
                      type="button"
                      onClick={() => void refetchNotifs()}
                      className="text-xs font-semibold text-[#408A71] hover:underline cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-xs font-semibold text-[#111827]">You&apos;re all caught up</p>
                    <p className="mt-1 text-[11px] text-[#6B7280]">No notifications yet.</p>
                  </div>
                ) : (
                  recentNotifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => void handleHeaderNotificationClick(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void handleHeaderNotificationClick(item)
                        }
                      }}
                      className={`px-4 py-3 flex items-start justify-between gap-2.5 cursor-pointer transition-colors ${
                        item.is_read
                          ? 'bg-white hover:bg-gray-50'
                          : 'bg-[#F4FAF7]/70 hover:bg-[#ECF5F2]/80'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                            item.is_read ? 'bg-transparent' : 'bg-[#408A71]'
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#111827] truncate">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#4B5563] line-clamp-2">
                            {item.message}
                          </p>
                          <p className="mt-1 text-[10px] text-[#6B7280]">
                            {formatNotificationDate(item.created_at)}
                          </p>
                        </div>
                      </div>

                      {!item.is_read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            markNotificationRead.mutate(item.id)
                          }}
                          title="Mark as read"
                          className="shrink-0 text-[10px] font-semibold text-[#408A71] hover:text-[#34745C] px-2 py-1 rounded-md hover:bg-white cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-[#F3F4F6] bg-[#F9FAFB] px-4 py-2.5 text-center">
                <Link
                  to="/app/tenant/notifications"
                  onClick={() => setIsNotifOpen(false)}
                  className="text-xs font-semibold text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1"
                >
                  <span>View All Notifications</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Workspace Switcher (visible only when user has multiple workspaces) */}
        <WorkspaceSwitcher currentWorkspace="tenant" />

        {/* Vertical Divider */}
        <div className="h-7 w-px bg-[#E5E7EB]" />

        {/* User Profile Pill & Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer group focus:outline-hidden"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            <div className="w-9 h-9 rounded-full bg-[#408A71]/15 text-[#408A71] font-semibold text-sm flex items-center justify-center ring-2 ring-[#408A71]/20 group-hover:ring-[#408A71]/40 transition-all shrink-0">
              {userInitials}
            </div>

            <div className="hidden sm:flex flex-col text-left leading-tight">
              <span className="text-sm font-medium text-[#111827] group-hover:text-[#408A71] transition-colors truncate max-w-[160px]">
                {userFullName}
              </span>
              <span className="text-xs font-normal text-[#6B7280]">
                Tenant
              </span>
            </div>

            <svg
              className={`w-4 h-4 text-[#9CA3AF] group-hover:text-[#4B5563] transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-[#408A71]' : ''
                }`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-[#E5E7EB] py-1.5 z-50">
              <div className="px-4 py-3 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#408A71]/15 text-[#408A71] font-bold text-xs flex items-center justify-center ring-1 ring-[#408A71]/30 shrink-0">
                    {userInitials}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#111827] truncate">
                      {userFullName}
                    </span>
                    <span className="text-[11px] text-[#6B7280] truncate">
                      {user?.email}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#408A71]/10 text-[#408A71]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#408A71]" />
                    Tenant Account
                  </span>
                  {user?.is_owner && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Owner Enabled
                    </span>
                  )}
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/app/tenant/settings"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#374151] hover:bg-gray-50 hover:text-[#111827] transition-colors"
                >
                  <svg
                    className="w-4 h-4 text-[#6B7280]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span>My Profile &amp; Settings</span>
                </Link>
              </div>

              <div className="border-t border-[#F3F4F6] my-1" />

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer text-left"
              >
                <svg
                  className="w-4 h-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default TenantHeader

