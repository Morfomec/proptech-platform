import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../../hooks/useTenantWorkspace'
import { Alert, Badge, Button, EmptyState, Pagination, Skeleton, useToast } from '../../components/ui'
import { extractApiErrorMessage } from '../../utils/application'
import {
  formatNotificationDate,
  getNotificationTypeMeta,
  getTenantNotificationTarget,
  type NotificationIconKind,
} from '../../utils/notification'
import type { NotificationItem } from '../../types/notification'

const PAGE_SIZE = 20

type ReadFilter = 'all' | 'unread' | 'read'

function NotificationTypeIcon({ kind, isUnread }: { kind: NotificationIconKind; isUnread: boolean }) {
  const baseClass = `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
    isUnread ? 'bg-[#408A71] text-white' : 'bg-[#ECF5F2] text-[#408A71]'
  }`

  if (kind === 'application') {
    return (
      <div className={baseClass}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      </div>
    )
  }

  if (kind === 'tenancy') {
    return (
      <div className={baseClass}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      </div>
    )
  }

  if (kind === 'document') {
    return (
      <div className={baseClass}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className={baseClass}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    </div>
  )
}

/**
 * TenantNotificationsPage
 * Tenant Notification Centre inside TenantWorkspaceLayout (`/app/tenant/notifications`).
 */
export const TenantNotificationsPage: React.FC = () => {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [filter, setFilter] = useState<ReadFilter>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const isReadParam = filter === 'all' ? undefined : filter === 'read'

  const { data, isLoading, isError, refetch } = useNotifications({
    page: currentPage,
    page_size: PAGE_SIZE,
    ...(isReadParam !== undefined ? { is_read: isReadParam } : {}),
  })
  const { data: unreadData } = useUnreadNotificationCount()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = data?.results ?? []
  const totalCount = data?.count ?? notifications.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const unreadCount = unreadData?.data?.unread_count ?? 0

  const handleFilterChange = (next: ReadFilter) => {
    setFilter(next)
    setCurrentPage(1)
  }

  const handleMarkSingleRead = async (
    item: NotificationItem,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    if (item.is_read || markingId) return
    setMarkingId(item.id)
    try {
      await markRead.mutateAsync(item.id)
    } catch (err: unknown) {
      addToast({
        title: 'Action Failed',
        description: extractApiErrorMessage(err, 'Unable to mark notification as read.'),
        variant: 'error',
      })
    } finally {
      setMarkingId(null)
    }
  }

  const handleNotificationActivate = async (item: NotificationItem) => {
    const target = getTenantNotificationTarget(item)
    if (!item.is_read) {
      setMarkingId(item.id)
      try {
        await markRead.mutateAsync(item.id)
      } catch (err: unknown) {
        addToast({
          title: 'Action Failed',
          description: extractApiErrorMessage(err, 'Unable to mark notification as read.'),
          variant: 'error',
        })
      } finally {
        setMarkingId(null)
      }
    }
    if (target) {
      navigate(target.path)
    }
  }

  const handleMarkAllRead = async () => {
    if (markAllRead.isPending || unreadCount === 0) return
    try {
      await markAllRead.mutateAsync()
      addToast({
        title: 'Notifications Updated',
        description: 'All notifications have been marked as read.',
        variant: 'success',
      })
    } catch (err: unknown) {
      addToast({
        title: 'Action Failed',
        description: extractApiErrorMessage(err, 'Unable to mark all notifications as read.'),
        variant: 'error',
      })
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="success" size="sm">
              {unreadCount} unread
            </Badge>
          )}
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={markAllRead.isPending}
            loadingText="Updating..."
            onClick={() => void handleMarkAllRead()}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filter notifications"
        className="flex flex-wrap items-center gap-2"
      >
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'read', label: 'Read' },
          ] as const
        ).map((tab) => {
          const isSelected = filter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleFilterChange(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#ECF5F2] border-[#408A71]/40 text-[#408A71]'
                  : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'unread' && unreadCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-[#408A71] text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Error State */}
      {isError && (
        <Alert variant="error" title="Failed to load notifications">
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <>
          <div className="space-y-3">
            {notifications.map((item) => {
              const typeMeta = getNotificationTypeMeta(item.notification_type)
              const target = getTenantNotificationTarget(item)
              const isInteractive = !item.is_read || Boolean(target)
              const isMarkingThis = markingId === item.id

              return (
                <article
                  key={item.id}
                  onClick={
                    isInteractive
                      ? () => void handleNotificationActivate(item)
                      : undefined
                  }
                  onKeyDown={
                    isInteractive
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            void handleNotificationActivate(item)
                          }
                        }
                      : undefined
                  }
                  role={isInteractive ? 'button' : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all ${
                    item.is_read
                      ? 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
                      : 'border-[#CBE7DC] bg-[#F4FAF7] hover:border-[#408A71]/50 shadow-2xs'
                  } ${isInteractive ? 'cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#408A71]/40' : ''}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <NotificationTypeIcon kind={typeMeta.iconKind} isUnread={!item.is_read} />

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!item.is_read && (
                          <span
                            className="w-2 h-2 rounded-full bg-[#408A71] shrink-0"
                            aria-label="Unread notification"
                          />
                        )}
                        <h2 className="text-sm sm:text-base font-medium text-[#111827]">
                          {item.title}
                        </h2>
                        <Badge variant={typeMeta.variant} size="sm">
                          {typeMeta.label}
                        </Badge>
                      </div>

                      <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
                        {item.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-[#6B7280]">
                        <span>{formatNotificationDate(item.created_at)}</span>
                        {target && (
                          <span className="font-semibold text-[#408A71] inline-flex items-center gap-0.5">
                            <span>· {target.label}</span>
                            <span aria-hidden="true">→</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5E7EB]/60">
                    {!item.is_read && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={isMarkingThis}
                        loadingText="Marking..."
                        onClick={(e) => void handleMarkSingleRead(item, e)}
                      >
                        Mark as Read
                      </Button>
                    )}
                    {target && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleNotificationActivate(item)
                        }}
                      >
                        Open →
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={PAGE_SIZE}
                onPageChange={(page) => {
                  setCurrentPage(page)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="lg"
            title={
              filter === 'unread'
                ? 'No unread notifications'
                : filter === 'read'
                  ? 'No read notifications'
                  : "You're all caught up"
            }
            description={
              filter === 'all'
                ? 'Notifications about your rental applications, tenancies, and documents will appear here.'
                : 'Try switching filters to view your other notifications.'
            }
            action={
              filter !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => handleFilterChange('all')}>
                  Show All Notifications
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/app/tenant/properties')}
                >
                  Browse Properties
                </Button>
              )
            }
          />
        </div>
      )}
    </div>
  )
}

export default TenantNotificationsPage
