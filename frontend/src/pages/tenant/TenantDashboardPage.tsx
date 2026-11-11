import React, { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useDocuments,
  useMarkNotificationRead,
  useMyApplications,
  useMyTenancies,
  useNotifications,
  useSavedPropertiesCount,
} from '../../hooks/useTenantWorkspace'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import type { TenancyListItem, TenancyStatus } from '../../types/leasing'
import type { NotificationItem } from '../../types/notification'

function formatINR(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(numeric)) return String(value)
  return `₹${numeric.toLocaleString('en-IN', {
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDaysUntil(dateString: string | null | undefined): number | null {
  if (!dateString) return null
  const target = new Date(dateString)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getAgreementProgress(
  startDate: string | null,
  endDate: string | null
): { percent: number; daysRemaining: number } | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayMs = now.getTime()

  const total = end - start
  const elapsed = Math.min(total, Math.max(0, todayMs - start))
  const percent = Math.round((elapsed / total) * 100)
  const daysRemaining = Math.max(0, Math.ceil((end - todayMs) / (1000 * 60 * 60 * 24)))

  return { percent, daysRemaining }
}

const TENANCY_STATUS_STYLES: Record<
  TenancyStatus,
  { label: string; badgeClass: string }
> = {
  active: {
    label: 'Active Tenancy',
    badgeClass: 'bg-[#ECF5F2] text-[#15803D] border-[#BBF7D0]',
  },
  confirmed: {
    label: 'Confirmed',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  ended: {
    label: 'Ended',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
}

function pickPrimaryTenancy(tenancies: TenancyListItem[]): TenancyListItem | null {
  if (tenancies.length === 0) return null
  const priority: TenancyStatus[] = ['active', 'confirmed', 'pending', 'ended', 'cancelled']
  for (const status of priority) {
    const match = tenancies.find((t) => t.status === status)
    if (match) return match
  }
  return tenancies[0]
}

function getNotificationRoute(notification: NotificationItem): string {
  switch (notification.related_object_type) {
    case 'application':
      return '/app/tenant/applications'
    case 'tenancy':
      return '/app/tenant/tenancy'
    case 'document':
      return '/app/tenant/documents'
    default:
      return '/app/tenant/notifications'
  }
}

/**
 * TenantDashboardPage (Overview)
 * Approved Tenant Workspace overview backed exclusively by live API responses.
 * Route: /app/tenant/dashboard
 */
export const TenantDashboardPage: React.FC = () => {
  const navigate = useNavigate()

  const {
    data: tenanciesData,
    isLoading: tenanciesLoading,
    isError: tenanciesError,
    refetch: refetchTenancies,
  } = useMyTenancies({ page: 1, page_size: 20 })

  const {
    data: applicationsData,
    isLoading: applicationsLoading,
    isError: applicationsError,
    refetch: refetchApplications,
  } = useMyApplications({ page: 1, page_size: 50 })

  const {
    data: savedData,
    isLoading: savedLoading,
  } = useSavedPropertiesCount()

  const {
    data: documentsData,
    isLoading: documentsLoading,
  } = useDocuments({ page: 1, page_size: 10 })

  const {
    data: notificationsData,
    isLoading: notificationsLoading,
  } = useNotifications({ page: 1, page_size: 5 })

  const markReadMutation = useMarkNotificationRead()

  const tenancies = useMemo(() => tenanciesData?.results ?? [], [tenanciesData])
  const applications = useMemo(() => applicationsData?.results ?? [], [applicationsData])
  const notifications = useMemo(() => notificationsData?.results ?? [], [notificationsData])

  const activeTenancyCount = useMemo(
    () => tenancies.filter((t) => t.status === 'active').length,
    [tenancies]
  )

  const applicationsTotal = applicationsData?.count ?? applications.length
  const inReviewApplicationsCount = useMemo(
    () =>
      applications.filter(
        (a) => a.status === 'submitted' || a.status === 'under_review'
      ).length,
    [applications]
  )

  const savedCount = savedData?.count ?? savedData?.results?.length ?? 0
  const documentsCount = documentsData?.count ?? documentsData?.results?.length ?? 0

  const primaryTenancy = useMemo(() => pickPrimaryTenancy(tenancies), [tenancies])

  // Match tenancy.application_id against loaded applications to get real property_title
  const matchedApplication = useMemo(() => {
    if (!primaryTenancy) return null
    return applications.find((a) => a.id === primaryTenancy.application_id) ?? null
  }, [applications, primaryTenancy])

  const agreementProgress = useMemo(() => {
    if (!primaryTenancy) return null
    if (primaryTenancy.status !== 'active' && primaryTenancy.status !== 'confirmed') {
      return null
    }
    return getAgreementProgress(primaryTenancy.start_date, primaryTenancy.end_date)
  }, [primaryTenancy])

  // Real upcoming lease milestones derived strictly from tenancy dates
  const upcomingMilestones = useMemo(() => {
    const items: Array<{
      id: string
      title: string
      subtitle: string
      daysLabel: string
      dateLabel: string
    }> = []

    if (!primaryTenancy) return items

    if (
      (primaryTenancy.status === 'pending' || primaryTenancy.status === 'confirmed') &&
      primaryTenancy.start_date
    ) {
      const daysUntilStart = getDaysUntil(primaryTenancy.start_date)
      if (daysUntilStart !== null && daysUntilStart >= 0) {
        items.push({
          id: 'move-in',
          title: 'Tenancy Start Date',
          subtitle: `Scheduled move-in on ${formatDate(primaryTenancy.start_date)}`,
          daysLabel: daysUntilStart === 0 ? 'Today' : `In ${daysUntilStart} days`,
          dateLabel: formatDate(primaryTenancy.start_date),
        })
      }
    }

    if (
      (primaryTenancy.status === 'active' || primaryTenancy.status === 'confirmed') &&
      primaryTenancy.end_date
    ) {
      const daysUntilEnd = getDaysUntil(primaryTenancy.end_date)
      if (daysUntilEnd !== null && daysUntilEnd >= 0) {
        items.push({
          id: 'lease-end',
          title: 'Lease End Date',
          subtitle: `Current lease ends on ${formatDate(primaryTenancy.end_date)}`,
          daysLabel: daysUntilEnd === 0 ? 'Today' : `In ${daysUntilEnd} days`,
          dateLabel: formatDate(primaryTenancy.end_date),
        })
      }
    }

    return items
  }, [primaryTenancy])

  const isStatsLoading =
    tenanciesLoading || applicationsLoading || savedLoading || documentsLoading
  const hasCoreError = tenanciesError || applicationsError

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id)
    }
    navigate(getNotificationRoute(notification))
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Core Fetch Error Alert */}
      {hasCoreError && (
        <Alert variant="error" title="Unable to load complete workspace summary">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>Some rental summary details could not be loaded.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchTenancies()
                refetchApplications()
              }}
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 2. Summary Stat Cards Row */}
      <section aria-label="Workspace Summary Metrics">
        {isStatsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5"
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-14" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {/* Active Tenancy Card */}
            <Link
              to="/app/tenant/tenancy"
              className={`rounded-xl border p-4 transition-all hover:shadow-sm flex items-center gap-3.5 ${
                activeTenancyCount > 0
                  ? 'border-[#CBE7DC] bg-[#F4FAF7]'
                  : 'border-[#E5E7EB] bg-white'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#408A71]/15 text-[#408A71]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-normal text-[#6B7280]">Active Tenancy</p>
                <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                  {activeTenancyCount}
                </p>
              </div>
            </Link>

            {/* Applications Card */}
            <Link
              to="/app/tenant/applications"
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 transition-all hover:shadow-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-normal text-[#6B7280]">Applications</p>
                  <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                    {applicationsTotal}
                  </p>
                </div>
              </div>
              {inReviewApplicationsCount > 0 && (
                <span className="shrink-0 rounded-full bg-[#ECF5F2] px-2.5 py-0.5 text-[11px] font-medium text-[#408A71]">
                  {inReviewApplicationsCount} In Review
                </span>
              )}
            </Link>

            {/* Saved Properties Card */}
            <Link
              to="/app/tenant/saved-properties"
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 transition-all hover:shadow-sm flex items-center gap-3.5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-normal text-[#6B7280]">Saved Properties</p>
                <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                  {savedCount}
                </p>
              </div>
            </Link>

            {/* Documents Card */}
            <Link
              to="/app/tenant/documents"
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 transition-all hover:shadow-sm flex items-center gap-3.5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#408A71]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-normal text-[#6B7280]">Documents</p>
                <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                  {documentsCount}
                </p>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* 3. Main 2-Column Row: My Tenancy + Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* My Tenancy Card */}
        <div className="lg:col-span-7 xl:col-span-8 rounded-2xl border border-[#E5E7EB] bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>
              <h2 className="text-sm sm:text-base font-medium text-[#111827]">My Tenancy</h2>
            </div>

            <Link
              to="/app/tenant/tenancy"
              className="text-xs font-medium text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1 transition-colors"
            >
              <span>View Details</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {tenanciesLoading ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <Skeleton className="h-36 w-full sm:w-44 rounded-xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ) : primaryTenancy ? (
            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              {/* Property Visual Placeholder (API Tenancy payload does not expose property image) */}
              <div className="w-full sm:w-44 h-36 shrink-0 rounded-xl border border-[#DCE8E2] bg-gradient-to-br from-[#F4FAF7] to-[#E6F4EE] flex flex-col items-center justify-center p-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#408A71] shadow-2xs mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <span className="text-[11px] font-medium text-[#408A71]">
                  {TENANCY_STATUS_STYLES[primaryTenancy.status].label}
                </span>
                <span className="text-[10px] text-[#6B7280] mt-0.5 font-mono">
                  Ref #{primaryTenancy.property_id.slice(0, 8)}
                </span>
              </div>

              {/* Tenancy Summary Metrics */}
              <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium text-[#111827] truncate">
                    {matchedApplication?.property_title || 'Rental Tenancy'}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#6B7280] truncate">
                    {matchedApplication?.listing_title ||
                      `Property reference: ${primaryTenancy.property_id.slice(0, 8)}`}
                  </p>

                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        TENANCY_STATUS_STYLES[primaryTenancy.status].badgeClass
                      }`}
                    >
                      {TENANCY_STATUS_STYLES[primaryTenancy.status].label}
                    </span>
                  </div>
                </div>

                {/* Financials & Lease Dates */}
                <div className="grid grid-cols-3 gap-3 border-t border-[#F3F4F6] pt-2.5">
                  <div>
                    <p className="text-[11px] font-normal text-[#6B7280]">Monthly Rent</p>
                    <p className="mt-0.5 text-sm font-medium text-[#111827]">
                      {formatINR(primaryTenancy.monthly_rent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-normal text-[#6B7280]">Lease Ends</p>
                    <p className="mt-0.5 text-sm font-medium text-[#111827]">
                      {primaryTenancy.end_date
                        ? formatDate(primaryTenancy.end_date)
                        : 'Open-ended'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-normal text-[#6B7280]">Security Deposit</p>
                    <p className="mt-0.5 text-sm font-medium text-[#111827]">
                      {formatINR(primaryTenancy.security_deposit)}
                    </p>
                  </div>
                </div>

                {/* Agreement Progress (only rendered when valid start & end dates exist) */}
                {agreementProgress ? (
                  <div className="pt-1">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-[#4B5563]">Agreement Progress</span>
                      <span className="font-semibold text-[#111827]">
                        {agreementProgress.daysRemaining} Days Remaining
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#408A71] transition-all duration-300"
                        style={{ width: `${agreementProgress.percent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  primaryTenancy.start_date && (
                    <p className="text-xs text-[#6B7280]">
                      Started on {formatDate(primaryTenancy.start_date)}
                    </p>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-6 text-center">
              <p className="text-sm font-semibold text-[#111827]">No active tenancy yet</p>
              <p className="mt-1 text-xs text-[#6B7280] max-w-md mx-auto">
                Once an application is approved and a tenancy is confirmed, your rental terms and agreement progress will appear here.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <Button variant="primary" size="sm" onClick={() => navigate('/app/tenant/properties')}>
                  Browse Properties
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/app/tenant/applications')}
                >
                  View Applications
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-sm sm:text-base font-medium text-[#111827]">Quick Actions</h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Browse Properties */}
            <Link
              to="/app/tenant/properties"
              className="group rounded-xl border border-[#DCE8E2] bg-[#ECF5F2]/80 hover:bg-[#DCECE6] p-3.5 flex flex-col justify-between min-h-[88px] transition-colors"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-[#408A71]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.64 5.64a7.5 7.5 0 0010.61 10.61z"
                  />
                </svg>
              </span>
              <span className="mt-2.5 text-xs font-medium text-[#111827]">
                Browse Properties
              </span>
            </Link>

            {/* Apply for a Property */}
            <Link
              to="/app/tenant/properties"
              className="group rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-gray-100 p-3.5 flex flex-col justify-between min-h-[88px] transition-colors"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#408A71] border border-[#E5E7EB]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span className="mt-2.5 text-xs font-medium text-[#111827]">
                Apply for a Property
              </span>
            </Link>

            {/* Request Maintenance — explicitly marked unavailable */}
            <div
              aria-disabled="true"
              title="Maintenance requests are not yet available"
              className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] opacity-75 p-3.5 flex flex-col justify-between min-h-[88px] cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#6B7280] border border-[#E5E7EB]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
                    />
                  </svg>
                </span>
                <span className="rounded-full bg-gray-200/80 px-1.5 py-0.5 text-[9px] font-medium text-[#4B5563]">
                  Soon
                </span>
              </div>
              <div className="mt-2.5">
                <p className="text-xs font-medium text-[#4B5563]">Request Maintenance</p>
                <p className="text-[10px] text-[#6B7280]">Unavailable</p>
              </div>
            </div>

            {/* View Documents */}
            <Link
              to="/app/tenant/documents"
              className="group rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-gray-100 p-3.5 flex flex-col justify-between min-h-[88px] transition-colors"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#408A71] border border-[#E5E7EB]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </span>
              <span className="mt-2.5 text-xs font-medium text-[#111827]">
                View Documents
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Bottom 2-Column Row: Recent Activity + Upcoming */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity (Real Notifications Feed) */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3-7 4 14 3-7h4" />
                </svg>
              </div>
              <h2 className="text-sm sm:text-base font-medium text-[#111827]">Recent Activity</h2>
            </div>

            <Link
              to="/app/tenant/notifications"
              className="text-xs font-medium text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {notificationsLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((idx) => (
                <Skeleton key={idx} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <ul className="divide-y divide-[#F3F4F6]">
              {notifications.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-gray-50/80 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          item.is_read
                            ? 'bg-gray-100 text-[#6B7280]'
                            : 'bg-[#ECF5F2] text-[#408A71]'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                          />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-medium text-[#111827] truncate">
                            {item.title}
                          </p>
                          {!item.is_read && (
                            <span
                              className="h-2 w-2 rounded-full bg-[#408A71] shrink-0"
                              aria-label="Unread notification"
                            />
                          )}
                        </div>
                        <p className="text-xs text-[#6B7280] truncate">
                          {item.message} · {formatDate(item.created_at)}
                        </p>
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 text-[#9CA3AF] shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs font-medium text-[#111827]">No recent activity</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Updates on your applications, tenancies, and documents will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Upcoming Milestones (Strictly real tenancy date reminders) */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-sm sm:text-base font-medium text-[#111827]">Upcoming</h2>
          </div>

          {tenanciesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : upcomingMilestones.length > 0 ? (
            <div className="space-y-3">
              {upcomingMilestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#F3F4F6] bg-[#F9FAFB]/60 px-4 py-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-[#111827]">
                        {milestone.title}
                      </p>
                      <p className="text-xs text-[#6B7280] truncate">{milestone.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center rounded-full bg-[#ECF5F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#408A71]">
                      {milestone.daysLabel}
                    </span>
                    <p className="mt-1 text-[11px] text-[#6B7280]">{milestone.dateLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs font-semibold text-[#111827]">
                No upcoming lease milestones
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Lease start and end dates from active or confirmed tenancies will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default TenantDashboardPage

