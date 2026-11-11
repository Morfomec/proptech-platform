import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../../hooks/useTenantWorkspace'
import {
  formatNotificationDate,
  getOwnerNotificationTarget,
} from '../../utils/notification'
import type { NotificationItem } from '../../types/notification'

export interface OwnerNotificationBellProps {
  onBeforeOpen?: () => void
}

/**
 * OwnerNotificationBell
 * Live unread counter badge, recent notifications flyout, mark-read actions,
 * and route-safe navigation for OwnerHeader.
 */
export const OwnerNotificationBell: React.FC<OwnerNotificationBellProps> = ({
  onBeforeOpen,
}) => {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
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
    const target = getOwnerNotificationTarget(item)
    setIsOpen(false)
    if (!item.is_read) {
      try {
        await markNotificationRead.mutateAsync(item.id)
      } catch {
        // Navigate even if read-sync fails; page will reflect server state
      }
    }
    if (target) {
      navigate(target.path)
    } else {
      navigate('/app/owner/notifications')
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          onBeforeOpen?.()
          setIsOpen((prev) => !prev)
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative p-2.5 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
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

      {isOpen && (
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
                <p className="text-xs text-red-600 font-medium">
                  Unable to load notifications.
                </p>
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
                <p className="mt-1 text-[11px] font-normal text-[#6B7280]">
                  No notifications yet.
                </p>
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
                      <p className="text-xs font-medium text-[#111827] truncate">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] font-normal text-[#4B5563] line-clamp-2">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[10px] font-normal text-[#6B7280]">
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
                      className="shrink-0 text-[10px] font-medium text-[#408A71] hover:text-[#34745C] px-2 py-1 rounded-md hover:bg-white cursor-pointer"
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
              to="/app/owner/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1"
            >
              <span>View All Notifications</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default OwnerNotificationBell

