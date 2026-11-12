import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMyApplications } from '../../hooks/useTenantWorkspace'
import { listingService } from '../../services/listing.service'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Pagination,
  Skeleton,
} from '../../components/ui'
import { ApplicationWithdrawModal } from '../../components/tenant/ApplicationWithdrawModal'
import { getMediaUrl } from '../../utils/imageUrl'
import {
  formatDate,
  formatINR,
  getApplicationStatusMeta,
  isActiveApplicationStatus,
  isWithdrawableApplication,
} from '../../utils/application'
import type { ApplicationListItem } from '../../types/leasing'
import type { PublicListingItem } from '../../types/listing'

const PAGE_SIZE = 10

/**
 * TenantApplicationsPage
 * Authenticated Tenant "My Applications" view at `/app/tenant/applications`.
 * Displays real-API overview statistics, paginated application cards, listing enrichment
 * (for active published listings), and inline withdrawal for eligible applications.
 */
export const TenantApplicationsPage: React.FC = () => {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const [withdrawTarget, setWithdrawTarget] = useState<ApplicationListItem | null>(null)

  // Paginated list query
  const {
    data: applicationsData,
    isLoading,
    isError,
    refetch,
  } = useMyApplications({ page: currentPage, page_size: PAGE_SIZE })

  // Overview summary query (up to max_page_size=100) for accurate status counts across pages
  const { data: overviewData, isLoading: overviewLoading } = useMyApplications({
    page: 1,
    page_size: 100,
  })

  // Optional enrichment lookup from published listings (avoids 404s for paused/closed listings)
  const { data: publishedListingsData } = useQuery({
    queryKey: ['tenant', 'published-listings-index'],
    queryFn: () => listingService.getPublicListings({ page: 1, page_size: 100 }),
    staleTime: 60_000,
  })

  const applications = useMemo(() => applicationsData?.results ?? [], [applicationsData])
  const totalCount = applicationsData?.count ?? overviewData?.count ?? applications.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const overviewStats = useMemo(() => {
    const items = overviewData?.results ?? applications
    const total = overviewData?.count ?? totalCount
    const pendingOrUnderReview = items.filter(
      (app) => app.status === 'submitted' || app.status === 'under_review'
    ).length
    const approved = items.filter((app) => app.status === 'approved').length
    const rejected = items.filter((app) => app.status === 'rejected').length

    return {
      total,
      pendingOrUnderReview,
      approved,
      rejected,
      isTruncated: total > items.length,
    }
  }, [overviewData, applications, totalCount])

  const listingMap = useMemo(() => {
    const map = new Map<string, PublicListingItem>()
    for (const item of publishedListingsData?.results ?? []) {
      map.set(item.id, item)
    }
    return map
  }, [publishedListingsData])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
          My Applications
        </h1>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/app/tenant/properties')}
        >
          Browse Properties
        </Button>
      </div>

      {/* 2. Overview Stat Cards */}
      <section aria-label="Application Summary">
        {overviewLoading && isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2"
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {/* Total Applications */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-normal text-[#6B7280]">Total Applications</p>
                  <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                    {overviewStats.total}
                  </p>
                </div>
              </div>

              {/* Pending / Under Review */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-normal text-[#6B7280]">Pending / Under Review</p>
                  <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                    {overviewStats.pendingOrUnderReview}
                  </p>
                </div>
              </div>

              {/* Approved */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#15803D]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-normal text-[#6B7280]">Approved</p>
                  <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                    {overviewStats.approved}
                  </p>
                </div>
              </div>

              {/* Rejected */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[#DC2626]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-normal text-[#6B7280]">Rejected</p>
                  <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                    {overviewStats.rejected}
                  </p>
                </div>
              </div>
            </div>

            {overviewStats.isTruncated && (
              <p className="mt-2 text-[11px] text-[#6B7280]">
                Status breakdown reflects the latest 100 applications.
              </p>
            )}
          </>
        )}
      </section>

      {/* 3. Error State */}
      {isError && (
        <Alert variant="error" title="Failed to load applications">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>We couldn&apos;t retrieve your rental applications right now.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 4. Applications List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden"
            >
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="p-3.5 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : applications.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {applications.map((app) => {
              const matchedListing = listingMap.get(app.listing)
              const prop = matchedListing?.property
              const rawImageUrl = app.property_image_url || prop?.primary_image_url
              const imageUrl = rawImageUrl ? getMediaUrl(rawImageUrl) : null
              const locationText = prop
                ? [prop.locality, prop.city].filter(Boolean).join(', ') || prop.address_line_1
                : null
              const rentText = matchedListing
                ? formatINR(matchedListing.monthly_rent)
                : null
              const statusMeta = getApplicationStatusMeta(app.status)
              const canWithdraw = isWithdrawableApplication(app.status)
              const displayTitle = app.property_title || app.listing_title || 'Rental Property'

              return (
                <article
                  key={app.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col group"
                >
                  {/* Property Image + Status Overlay */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
                    <Link
                      to={`/app/tenant/applications/${app.id}`}
                      className="block w-full h-full"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={displayTitle}
                          loading="lazy"
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#F4FAF7] to-[#E6F4EE] text-[#408A71] p-4 text-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 shadow-2xs mb-1.5">
                            <svg
                              className="h-5 w-5 text-[#408A71]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="1.8"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                              />
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-[#408A71]">
                            Listing photo unavailable
                          </span>
                        </div>
                      )}
                    </Link>

                    <div className="absolute top-2.5 left-2.5">
                      <Badge variant={statusMeta.variant} size="sm" dot>
                        {statusMeta.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 flex flex-col flex-grow justify-between gap-2.5">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/app/tenant/applications/${app.id}`}
                            className="block"
                          >
                            <h2 className="text-sm sm:text-base font-medium text-[#111827] group-hover:text-[#408A71] transition-colors line-clamp-1">
                              {displayTitle}
                            </h2>
                          </Link>
                          {app.listing_title && app.listing_title !== app.property_title && (
                            <p className="text-xs text-[#6B7280] line-clamp-1 mt-0.5">
                              {app.listing_title}
                            </p>
                          )}
                        </div>

                        {rentText && (
                          <div className="text-right shrink-0">
                            <span className="text-sm sm:text-base font-medium text-[#111827]">
                              {rentText}
                            </span>
                            <span className="text-xs text-[#6B7280]">/mo</span>
                          </div>
                        )}
                      </div>

                      {locationText && (
                        <p className="text-xs text-[#6B7280] flex items-center gap-1.5 truncate">
                          <svg
                            className="w-3.5 h-3.5 text-[#408A71] shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span className="truncate">{locationText}</span>
                        </p>
                      )}

                      {app.message?.trim() && (
                        <p className="text-xs text-[#4B5563] line-clamp-2 bg-[#F9FAFB] rounded-lg px-3 py-2 border border-[#F3F4F6]">
                          &ldquo;{app.message.trim()}&rdquo;
                        </p>
                      )}

                      {/* Dates Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B7280] pt-1">
                        <span>Submitted {formatDate(app.created_at)}</span>
                        {app.reviewed_at && (
                          <span>Reviewed {formatDate(app.reviewed_at)}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="flex items-center gap-2.5 pt-3 border-t border-[#F3F4F6]">
                      <Link
                        to={`/app/tenant/applications/${app.id}`}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#ECF5F2] hover:bg-[#DDF0E8] text-[#408A71] text-xs sm:text-sm font-medium transition-colors text-center"
                      >
                        View Details
                      </Link>

                      {canWithdraw && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setWithdrawTarget(app)}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                        >
                          Withdraw
                        </Button>
                      )}

                      {!isActiveApplicationStatus(app.status) &&
                        matchedListing?.status === 'published' &&
                        !applications.some(
                          (other) =>
                            other.listing === app.listing &&
                            isActiveApplicationStatus(other.status)
                        ) && (
                          <Link
                            to={`/app/tenant/properties/${app.listing}/apply`}
                            className="py-2 px-3 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-xs sm:text-sm font-medium transition-colors text-center"
                          >
                            Apply Again
                          </Link>
                        )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="lg"
            title="No applications submitted yet"
            description="Browse available properties and submit a rental application when you find a space you like."
            action={
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/app/tenant/properties')}
              >
                Browse Properties
              </Button>
            }
          />
        </div>
      )}

      {/* Withdraw Confirmation Modal */}
      <ApplicationWithdrawModal
        open={Boolean(withdrawTarget)}
        applicationId={withdrawTarget?.id ?? null}
        propertyTitle={withdrawTarget?.property_title || withdrawTarget?.listing_title}
        onClose={() => setWithdrawTarget(null)}
      />
    </div>
  )
}

export default TenantApplicationsPage
