import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { Avatar } from '../../../components/ui/avatar'
import { Dropdown, type DropdownMenuItem } from '../../../components/ui/dropdown'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../../../hooks/useTenantWorkspace'
import {
  formatNotificationDate,
  getOwnerNotificationTarget,
  getTenantNotificationTarget,
} from '../../../utils/notification'
import type { NotificationItem } from '../../../types/notification'

export interface LandingHeaderProps {
  activeNav?: string
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ activeNav }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifDropdownRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated, isInitializing, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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

  const handleNotificationClick = async (item: NotificationItem) => {
    setIsNotifOpen(false)
    if (!item.is_read) {
      try {
        await markNotificationRead.mutateAsync(item.id)
      } catch {
        // Continue navigation even if read sync fails
      }
    }
    const target = user?.is_owner
      ? getOwnerNotificationTarget(item)
      : getTenantNotificationTarget(item)

    if (target) {
      navigate(target.path)
    } else {
      navigate(user?.is_owner ? '/app/owner/notifications' : '/app/tenant/notifications')
    }
  }

  const firstName = typeof user?.first_name === 'string' ? user.first_name.trim() : ''
  const lastName = typeof user?.last_name === 'string' ? user.last_name.trim() : ''
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') || firstName || user?.email || 'My Account'
  const avatarName =
    [firstName, lastName].filter(Boolean).join(' ') || firstName || user?.email || ''
  const profileImage =
    user && 'profile_image' in user ? user.profile_image || undefined : undefined

  const avatarFallback = (
    <svg
      className="w-4 h-4 text-[#408A71]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  )

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/')
    }
  }

  const dropdownMenuItems: DropdownMenuItem[] = [
    {
      id: 'user-identity',
      header: true,
      label: (
        <div className="flex flex-col py-0.5">
          <span className="text-sm font-semibold text-[#111827] truncate leading-tight">
            {fullName}
          </span>
          {user?.email && (
            <span className="text-xs text-gray-500 font-normal truncate leading-tight mt-1">
              {user.email}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: (
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
      onClick: () => navigate('/app/profile'),
    },
    {
      separator: true,
    },
    {
      id: 'signout',
      label: 'Sign out',
      icon: (
        <svg className="w-4 h-4 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      ),
      danger: true,
      onClick: handleLogout,
    },
  ]

  const isPropertiesPage =
    location.pathname.startsWith('/properties') ||
    location.pathname.startsWith('/rentals') ||
    activeNav === 'properties'
  const dynamicNavLabel = isPropertiesPage ? 'Home' : 'Browse Rentals'
  const dynamicNavDestination = isPropertiesPage ? '/' : '/properties'

  const handleHowItWorksClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (location.pathname === '/') {
      const el = document.getElementById('how-it-works')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      navigate('/', { state: { scrollTo: 'how-it-works' } })
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="bg-[#408A71] text-white p-2 rounded-xl group-hover:bg-[#34745C] transition-colors shadow-2xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-building-2"
            >
              <path d="M10 12h4" />
              <path d="M10 8h4" />
              <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
              <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
              <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#111827]">
            prop<span className="text-[#408A71]">tech</span>
          </span>
        </Link>

        {/* Nav Items (Desktop) */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            to={dynamicNavDestination}
            className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
          >
            {dynamicNavLabel}
          </Link>
          <a
            href="/#how-it-works"
            onClick={handleHowItWorksClick}
            className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
          >
            How It Works
          </a>
          <Link
            to="/pricing"
            className={`text-sm font-medium transition-colors ${
              location.pathname === '/pricing' || activeNav === 'pricing'
                ? 'text-[#408A71] font-semibold'
                : 'text-[#111827] hover:text-[#408A71]'
            }`}
          >
            Pricing
          </Link>
          {isAuthenticated && (
            <Link
              to="/saved-properties"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/saved-properties' || activeNav === 'saved'
                  ? 'text-[#408A71] font-semibold'
                  : 'text-[#111827] hover:text-[#408A71]'
              }`}
            >
              Saved Properties
            </Link>
          )}
          {isAuthenticated && (
            <Link
              to="/app/dashboard"
              className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
            >
              Dashboard
            </Link>
          )}

          <div className="h-4 w-[1px] bg-gray-200 mx-1" aria-hidden="true" />

          {/* Notification Bell (Desktop Authenticated) */}
          {!isInitializing && isAuthenticated && (
            <div className="relative" ref={notifDropdownRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                aria-expanded={isNotifOpen}
                aria-haspopup="true"
                className="relative p-2 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                title="Notifications"
                aria-label={
                  unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'
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
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white tabular-nums"
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
                      <span className="text-sm font-medium text-[#111827]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#ECF5F2] text-[#408A71] tabular-nums">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        disabled={markAllNotificationsRead.isPending}
                        onClick={() => markAllNotificationsRead.mutate()}
                        className="text-xs font-medium text-[#408A71] hover:text-[#34745C] disabled:opacity-50 cursor-pointer"
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
                        <p className="text-xs text-red-600 font-medium">Unable to load notifications.</p>
                        <button
                          type="button"
                          onClick={() => void refetchNotifs()}
                          className="text-xs font-medium text-[#408A71] hover:underline cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    ) : recentNotifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-xs font-medium text-[#111827]">You&apos;re all caught up</p>
                        <p className="mt-1 text-[11px] font-normal text-[#6B7280]">No notifications yet.</p>
                      </div>
                    ) : (
                      recentNotifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => void handleNotificationClick(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              void handleNotificationClick(item)
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
                              <p className="text-xs font-medium text-[#111827] truncate">{item.title}</p>
                              <p className="mt-0.5 text-[11px] font-normal text-[#4B5563] line-clamp-2">
                                {item.message}
                              </p>
                              <span className="mt-1 text-[10px] font-normal text-[#9CA3AF] block">
                                {formatNotificationDate(item.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 border-t border-[#F3F4F6] bg-gray-50 text-center">
                    <Link
                      to={user?.is_owner ? '/app/owner/notifications' : '/app/tenant/notifications'}
                      onClick={() => setIsNotifOpen(false)}
                      className="text-xs font-medium text-[#408A71] hover:text-[#34745C] transition-colors inline-block"
                    >
                      View all notifications &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Auth-Aware Section */}
          {isInitializing ? (
            <div
              className="flex items-center gap-2 h-10 min-w-[50px] justify-end"
              aria-busy="true"
              aria-label="Checking authentication status"
            >
              <div className="w-[35px] h-[35px] bg-gray-100 rounded-full animate-pulse" />
            </div>
          ) : isAuthenticated ? (
            <Dropdown
              placement="bottom-right"
              width="w-[216px]"
              trigger={(isOpen) => (
                <div
                  className={`group inline-flex items-center gap-1.5 p-1 rounded-full transition-all cursor-pointer select-none ${
                    isOpen
                      ? 'bg-gray-100 ring-2 ring-[#408A71]'
                      : 'hover:bg-gray-100/80 focus-visible:ring-2 focus-visible:ring-[#408A71]'
                  }`}
                  aria-label="User account menu"
                >
                  <Avatar
                    name={avatarName}
                    src={profileImage}
                    size="sm"
                    fallback={avatarName ? undefined : avatarFallback}
                    className="w-[35px] h-[35px] [&>div]:w-[35px] [&>div]:h-[35px] [&>div]:text-xs rounded-full shadow-2xs"
                  />
                  <svg
                    className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 group-hover:text-gray-700 ${
                      isOpen ? 'rotate-180 text-[#408A71] group-hover:text-[#408A71]' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              )}
              items={dropdownMenuItems}
            />
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-xl bg-[#408A71] px-5 py-2.5 text-sm font-semibold !text-white shadow-xs transition-colors hover:bg-[#34745C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#408A71]"
              >
                <span className="!text-white text-white font-semibold tracking-wide">
                  Get Started
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Right Controls (Notification + Account Icon + Hamburger) */}
        <div className="flex md:hidden items-center gap-2">
          {!isInitializing && isAuthenticated && (
            <Link
              to={user?.is_owner ? '/app/owner/notifications' : '/app/tenant/notifications'}
              className="relative p-2 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              title="Notifications"
              aria-label={
                unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'
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
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white tabular-nums"
                  aria-hidden="true"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}
          {!isInitializing && isAuthenticated && (
            <Dropdown
              placement="bottom-right"
              width="w-[216px]"
              trigger={(isOpen) => (
                <div
                  className={`group inline-flex items-center gap-1.5 p-1 rounded-full transition-all cursor-pointer select-none ${
                    isOpen
                      ? 'bg-gray-100 ring-2 ring-[#408A71]'
                      : 'hover:bg-gray-100/80 focus-visible:ring-2 focus-visible:ring-[#408A71]'
                  }`}
                  aria-label="User account menu"
                >
                  <Avatar
                    name={avatarName}
                    src={profileImage}
                    size="sm"
                    fallback={avatarName ? undefined : avatarFallback}
                    className="w-[35px] h-[35px] [&>div]:w-[35px] [&>div]:h-[35px] [&>div]:text-xs rounded-full shadow-2xs"
                  />
                  <svg
                    className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 group-hover:text-gray-700 ${
                      isOpen ? 'rotate-180 text-[#408A71] group-hover:text-[#408A71]' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              )}
              items={dropdownMenuItems}
            />
          )}

          {/* Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-lg text-gray-600 hover:text-[#111827] hover:bg-gray-100 transition-colors focus:outline-none"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 shadow-lg animate-in fade-in-0 duration-200">
          <div className="flex flex-col gap-3">
            <Link
              to={dynamicNavDestination}
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium py-2 transition-colors text-[#111827] hover:text-[#408A71]"
            >
              {dynamicNavLabel}
            </Link>
            <a
              href="/#how-it-works"
              onClick={(e) => {
                setMobileMenuOpen(false)
                handleHowItWorksClick(e)
              }}
              className="text-base font-medium text-[#111827] hover:text-[#408A71] py-2 transition-colors"
            >
              How It Works
            </a>
            <Link
              to="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className={`text-base font-medium py-2 transition-colors ${
                location.pathname === '/pricing' || activeNav === 'pricing'
                  ? 'text-[#408A71] font-semibold'
                  : 'text-[#111827] hover:text-[#408A71]'
              }`}
            >
              Pricing
            </Link>
            {isAuthenticated && (
              <Link
                to="/saved-properties"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-base font-medium py-2 transition-colors ${
                  location.pathname === '/saved-properties' || activeNav === 'saved'
                    ? 'text-[#408A71] font-semibold'
                    : 'text-[#111827] hover:text-[#408A71]'
                }`}
              >
                Saved Properties
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/app/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-[#111827] hover:text-[#408A71] py-2 transition-colors"
              >
                Dashboard
              </Link>
            )}

            <div className="h-[1px] bg-gray-100 my-1" />

            {isInitializing ? (
              <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse my-1" />
            ) : isAuthenticated ? (
              <div className="flex flex-col gap-1 pt-1">
                <div className="flex items-center gap-3 px-3 py-2 mb-1">
                  <Avatar
                    name={avatarName}
                    src={profileImage}
                    size="sm"
                    fallback={avatarName ? undefined : avatarFallback}
                    className="w-[35px] h-[35px] [&>div]:w-[35px] [&>div]:h-[35px] [&>div]:text-xs rounded-full shadow-2xs"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-[#111827] truncate">{fullName}</span>
                    {user?.email && (
                      <span className="text-xs text-gray-500 truncate">{user.email}</span>
                    )}
                  </div>
                </div>

                <Link
                  to="/app/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#111827] hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  My Profile
                </Link>

                <div className="h-[1px] bg-gray-100 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#DC2626] hover:bg-red-50 transition-colors text-left w-full"
                >
                  <svg className="w-4 h-4 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-[#111827] hover:text-[#408A71] py-2 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl bg-[#408A71] px-5 py-3 text-base font-semibold !text-white shadow-xs transition-colors hover:bg-[#34745C] text-center"
                >
                  <span className="!text-white text-white font-semibold">Get Started</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export default LandingHeader

