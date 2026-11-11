import React, { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useOwnerProperties } from '../../hooks/useOwnerProperties'
import { useOwnerListings, useOwnerListingsCount } from '../../hooks/useOwnerListings'
import {
  useReceivedApplications,
  useReceivedApplicationsCount,
} from '../../hooks/useOwnerApplications'
import { useManagedTenanciesCount } from '../../hooks/useOwnerTenancies'
import { useMarkNotificationRead, useNotifications } from '../../hooks/useTenantWorkspace'
import { Alert, Badge, Button, Skeleton, type BadgeVariant } from '../../components/ui'
import { formatDate, formatINR, getApplicationStatusMeta } from '../../utils/application'
import { getOwnerNotificationTarget } from '../../utils/notification'
import { getMediaUrl } from '../../utils/imageUrl'
import type { PublicListingItem } from '../../types/listing'
import type { NotificationItem } from '../../types/notification'

const LISTING_STATUS_META: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  published: { label: 'Published', variant: 'success' },
  draft: { label: 'Draft Listing', variant: 'warning' },
  paused: { label: 'Paused', variant: 'neutral' },
  closed: { label: 'Closed', variant: 'neutral' },
}

/**
 * OwnerDashboardPage (Overview)
 * Owner Workspace overview backed exclusively by live API responses.
 * Route: /app/owner/dashboard
 */
export const OwnerDashboardPage: React.FC = () => {
  const navigate = useNavigate()

  const {
    data: propertiesData,
    isLoading: propertiesLoading,
    isError: propertiesError,
    refetch: refetchProperties,
  } = useOwnerProperties({ page: 1, page_size: 20 })

  const {
    data: listingsData,
    isError: listingsError,
    refetch: refetchListings,
  } = useOwnerListings({ page: 1, page_size: 100 })

  const {
    data: activeListingsCount,
    isLoading: activeListingsLoading,
    isError: activeListingsError,
    refetch: refetchActiveListingsCount,
  } = useOwnerListingsCount('published')

  const {
    data: applicationsData,
    isLoading: applicationsLoading,
    isError: applicationsError,
    refetch: refetchApplications,
  } = useReceivedApplications({ page: 1, page_size: 4 })

  const {
    data: pendingApplicationsCount,
    isLoading: pendingAppsLoading,
    isError: pendingAppsError,
    refetch: refetchPendingAppsCount,
  } = useReceivedApplicationsCount('submitted,under_review')

  const {
    data: activeTenanciesCount,
    isLoading: tenanciesLoading,
    isError: tenanciesError,
    refetch: refetchTenancies,
  } = useManagedTenanciesCount('active')

  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    isError: notificationsError,
    refetch: refetchNotifications,
  } = useNotifications({ page: 1, page_size: 5 })

  const markReadMutation = useMarkNotificationRead()

  const properties = useMemo(() => propertiesData?.results ?? [], [propertiesData])
  const listings = useMemo(() => listingsData?.results ?? [], [listingsData])
  const applications = useMemo(() => applicationsData?.results ?? [], [applicationsData])
  const notifications = useMemo(() => notificationsData?.results ?? [], [notificationsData])

  // Map property_id -> latest/most relevant listing for quick property summary display
  const listingByPropertyId = useMemo(() => {
    const map = new Map<string, PublicListingItem>()
    for (const listing of listings) {
      const existing = map.get(listing.property_id)
      if (!existing || listing.status === 'published') {
        map.set(listing.property_id, listing)
      }
    }
    return map
  }, [listings])

  const metrics = useMemo(
    () => ({
      totalProperties: propertiesData?.count ?? properties.length,
      activeListings: activeListingsCount ?? 0,
      pendingApplications: pendingApplicationsCount ?? 0,
      activeTenancies: activeTenanciesCount ?? 0,
    }),
    [
      propertiesData,
      properties,
      activeListingsCount,
      pendingApplicationsCount,
      activeTenanciesCount,
    ]
  )

  const isStatsLoading =
    propertiesLoading ||
    activeListingsLoading ||
    pendingAppsLoading ||
    tenanciesLoading
  const hasCoreError =
    propertiesError ||
    listingsError ||
    activeListingsError ||
    applicationsError ||
    pendingAppsError ||
    tenanciesError

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markReadMutation.mutate(item.id)
    }
    const target = getOwnerNotificationTarget(item)
    navigate(target ? target.path : '/app/owner/notifications')
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Error Alert */}
      {hasCoreError && (
        <Alert variant="error" title="Unable to load complete portfolio summary">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>Some owner workspace metrics could not be retrieved right now.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchProperties()
                void refetchListings()
                void refetchActiveListingsCount()
                void refetchApplications()
                void refetchPendingAppsCount()
                void refetchTenancies()
              }}
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* B. Summary Stat Cards Row */}
      <section aria-label="Owner Summary Metrics">
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
            {/* Total Properties */}
            <Link
              to="/app/owner/properties"
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 transition-all hover:shadow-sm flex items-center gap-3.5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#408A71]/15 text-[#408A71]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-normal text-[#6B7280]">Total Properties</p>
                <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                  {metrics.totalProperties}
                </p>
              </div>
            </Link>

            {/* Active Listings */}
            <Link
              to="/app/owner/properties"
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 transition-all hover:shadow-sm flex items-center gap-3.5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-normal text-[#6B7280]">Active Listings</p>
                <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                  {metrics.activeListings !== null ? metrics.activeListings : '—'}
                </p>
              </div>
            </Link>

            {/* Pending Applications */}
            <Link
              to="/app/owner/applications"
              className={`rounded-xl border p-4 transition-all hover:shadow-sm flex items-center justify-between gap-3 ${
                (metrics.pendingApplications ?? 0) > 0
                  ? 'border-[#CBE7DC] bg-[#F4FAF7]'
                  : 'border-[#E5E7EB] bg-white'
              }`}
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
                  <p className="text-xs font-normal text-[#6B7280]">Pending Applications</p>
                  <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                    {metrics.pendingApplications !== null ? metrics.pendingApplications : '—'}
                  </p>
                </div>
              </div>
              {(metrics.pendingApplications ?? 0) > 0 && (
                <span className="shrink-0 rounded-full bg-[#408A71] px-2.5 py-0.5 text-[11px] font-medium text-white">
                  Action Needed
                </span>
              )}
            </Link>

            {/* Active Tenancies */}
            <Link
              to="/app/owner/tenancies"
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5 hover:border-[#408A71]/40 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#408A71]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-normal text-[#6B7280]">Active Tenancies</p>
                <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                  {metrics.activeTenancies}
                </p>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* C & F. Main Two-Column Row: Recent Applications + Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* C. Recent Applications */}
        <div className="lg:col-span-7 xl:col-span-8 rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <h2 className="text-sm sm:text-base font-medium text-[#111827]">Recent Applications</h2>
              {(metrics.pendingApplications ?? 0) > 0 && (
                <Badge variant="warning" size="sm">
                  {metrics.pendingApplications} pending
                </Badge>
              )}
            </div>

            <Link
              to="/app/owner/applications"
              className="text-xs font-medium text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {applicationsLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((idx) => (
                <Skeleton key={idx} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : applications.length > 0 ? (
            <div className="space-y-2">
              {applications.slice(0, 4).map((app) => {
                const statusMeta = getApplicationStatusMeta(app.status)
                const isPending = app.status === 'submitted' || app.status === 'under_review'
                return (
                  <Link
                    key={app.id}
                    to={`/app/owner/applications/${app.id}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors ${
                      isPending
                        ? 'border-[#CBE7DC] bg-[#F4FAF7]/60 hover:bg-[#ECF5F2]/80'
                        : 'border-[#F3F4F6] bg-[#F9FAFB]/60 hover:bg-gray-100/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs sm:text-sm font-medium text-[#111827] truncate">
                          {app.applicant_name || 'Applicant'}
                        </p>
                        <Badge variant={statusMeta.variant} size="sm" dot>
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[#6B7280] truncate">
                        {app.property_title || app.listing_title} · Submitted{' '}
                        {formatDate(app.created_at)}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[#408A71] shrink-0">
                      Review →
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-5 text-center">
              <p className="text-sm font-medium text-[#111827]">No rental applications yet</p>
              <p className="mt-1 text-xs text-[#6B7280] max-w-md mx-auto">
                Published property listings make your units discoverable so tenants can submit rental applications here.
              </p>
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5">
                <Button variant="primary" size="sm" onClick={() => navigate('/app/owner/properties')}>
                  Manage Properties
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/app/owner/properties/new')}
                >
                  Add Property
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* F. Quick Actions Card (implemented routes only) */}
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
            <Link
              to="/app/owner/properties/new"
              className="group col-span-2 rounded-xl border border-[#DCE8E2] bg-[#ECF5F2]/80 hover:bg-[#DCECE6] px-3.5 py-3 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-[#408A71]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                <span className="text-xs font-medium text-[#111827]">
                  Add Property
                </span>
              </div>
              <span className="text-xs font-medium text-[#408A71]" aria-hidden="true">→</span>
            </Link>

            <Link
              to="/app/owner/properties"
              className="group rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-gray-100 p-3.5 flex flex-col justify-between min-h-[84px] transition-colors"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#408A71] border border-[#E5E7EB]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
                  />
                </svg>
              </span>
              <span className="mt-2 text-xs font-medium text-[#111827]">
                Manage Properties
              </span>
            </Link>

            <Link
              to="/app/owner/applications"
              className="group rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-gray-100 p-3.5 flex flex-col justify-between min-h-[84px] transition-colors"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#408A71] border border-[#E5E7EB]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
                  />
                </svg>
              </span>
              <span className="mt-2 text-xs font-medium text-[#111827]">
                Review Applications
              </span>
            </Link>

            <Link
              to="/app/owner/tenancies"
              className="group rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-gray-100 p-3.5 flex flex-col justify-between min-h-[84px] transition-colors"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#408A71] border border-[#E5E7EB]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                  />
                </svg>
              </span>
              <span className="mt-2 text-xs font-medium text-[#111827]">
                Manage Tenancies
              </span>
            </Link>

            <Link
              to="/app/owner/documents"
              className="group rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-gray-100 p-3.5 flex flex-col justify-between min-h-[84px] transition-colors"
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
              <span className="mt-2 text-xs font-medium text-[#111827]">
                Manage Documents
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* D & E. Bottom Two-Column Row: My Properties + Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* D. My Properties Preview */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
                  />
                </svg>
              </div>
              <h2 className="text-sm sm:text-base font-medium text-[#111827]">My Properties</h2>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/app/owner/properties/new"
                className="text-xs font-medium text-[#4B5563] hover:text-[#111827] transition-colors"
              >
                + Add Property
              </Link>
              <Link
                to="/app/owner/properties"
                className="text-xs font-medium text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1 transition-colors"
              >
                <span>View All</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          {propertiesLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((idx) => (
                <Skeleton key={idx} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : properties.length > 0 ? (
            <div className="space-y-2">
              {properties.slice(0, 4).map((prop) => {
                const matchedListing = listingByPropertyId.get(prop.id)
                const listingBadge = matchedListing
                  ? LISTING_STATUS_META[matchedListing.status] ?? {
                      label: matchedListing.status,
                      variant: 'neutral' as BadgeVariant,
                    }
                  : { label: 'No Listing', variant: 'neutral' as BadgeVariant }
                const locationText =
                  [prop.locality, prop.city].filter(Boolean).join(', ') ||
                  prop.address_line_1 ||
                  ''
                const rentText = matchedListing ? formatINR(matchedListing.monthly_rent) : null

                return (
                  <Link
                    key={prop.id}
                    to={`/app/owner/properties/${prop.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#F3F4F6] bg-[#F9FAFB]/60 hover:bg-gray-100/70 p-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {prop.primary_image_url ? (
                        <img
                          src={getMediaUrl(prop.primary_image_url)}
                          alt={prop.title}
                          className="h-10 w-12 rounded-lg object-cover border border-[#E5E7EB] shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71] border border-[#DCE8E2]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                          </svg>
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs sm:text-sm font-medium text-[#111827] truncate">
                            {prop.title}
                          </p>
                          <Badge variant={listingBadge.variant} size="sm">
                            {listingBadge.label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-[#6B7280] truncate">
                          {locationText}
                          {rentText && (
                            <>
                              {' · '}
                              <span className="font-medium text-[#111827] tabular-nums">
                                {rentText}/mo
                              </span>
                            </>
                          )}
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
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-xs font-medium text-[#111827]">No properties added yet</p>
              <p className="mt-1 text-xs text-[#6B7280] max-w-sm mx-auto">
                Add your first residential or commercial property to start publishing listings.
              </p>
              <div className="mt-3.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/app/owner/properties/new')}
                >
                  Add Your First Property
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* E. Recent Activity (Real Notifications Feed) */}
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
              to="/app/owner/notifications"
              className="text-xs font-medium text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1 transition-colors"
            >
              <span>View All Notifications</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {notificationsLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((idx) => (
                <Skeleton key={idx} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : notificationsError ? (
            <Alert variant="error" title="Unable to load recent activity">
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span>Could not fetch notifications right now.</span>
                <Button variant="outline" size="sm" onClick={() => void refetchNotifications()}>
                  Retry
                </Button>
              </div>
            </Alert>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs sm:text-sm font-medium text-[#111827] truncate">
                            {item.title}
                          </p>
                          <Badge variant={item.is_read ? 'neutral' : 'info'} size="sm">
                            {item.is_read ? 'Read' : 'Unread'}
                          </Badge>
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
                Updates on property applications, tenancies, and documents will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default OwnerDashboardPage
