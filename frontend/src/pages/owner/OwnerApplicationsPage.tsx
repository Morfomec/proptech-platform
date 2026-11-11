import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useReceivedApplications,
  useReceivedApplicationsCount,
} from '../../hooks/useOwnerApplications'
import { useOwnerListings } from '../../hooks/useOwnerListings'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Pagination,
  Skeleton,
} from '../../components/ui'
import { ApplicationReviewModal } from '../../components/owner/ApplicationReviewModal'
import { CreateTenancyModal } from '../../components/owner/CreateTenancyModal'
import {
  formatDate,
  formatINR,
  getApplicationStatusMeta,
  isReviewableApplication,
} from '../../utils/application'
import type {
  ApplicationListItem,
  ApplicationStatus,
  OwnerReviewApplicationStatus,
} from '../../types/leasing'
import type { PublicListingItem } from '../../types/listing'

const PAGE_SIZE = 20

type StatusTab = 'all' | ApplicationStatus

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'withdrawn', label: 'Withdrawn' },
]

/**
 * OwnerApplicationsPage
 * Owner Workspace application management page at `/app/owner/applications`.
 * Reuses `GET /api/v1/applications/received/`, `GET /api/v1/listings/me/`,
 * and `POST /api/v1/applications/{id}/review/`.
 */
export const OwnerApplicationsPage: React.FC = () => {
  const navigate = useNavigate()

  const [currentPage, setCurrentPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState<StatusTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [reviewTarget, setReviewTarget] = useState<{
    application: ApplicationListItem
    status: OwnerReviewApplicationStatus
  } | null>(null)
  const [createTenancyTarget, setCreateTenancyTarget] =
    useState<ApplicationListItem | null>(null)

  const {
    data: applicationsData,
    isLoading,
    isError,
    refetch,
  } = useReceivedApplications({
    page: currentPage,
    page_size: PAGE_SIZE,
    ...(activeStatus !== 'all' ? { status: activeStatus } : {}),
  })

  // Accurate global counts per status from the backend
  const { data: totalAllCount = 0 } = useReceivedApplicationsCount()
  const { data: pendingCount = 0 } = useReceivedApplicationsCount('submitted,under_review')
  const { data: submittedCount = 0 } = useReceivedApplicationsCount('submitted')
  const { data: underReviewCount = 0 } = useReceivedApplicationsCount('under_review')
  const { data: approvedCount = 0 } = useReceivedApplicationsCount('approved')
  const { data: rejectedCount = 0 } = useReceivedApplicationsCount('rejected')
  const { data: withdrawnCount = 0 } = useReceivedApplicationsCount('withdrawn')

  const { data: ownerListingsData } = useOwnerListings({ page: 1, page_size: 100 })

  const applications = useMemo(
    () => applicationsData?.results ?? [],
    [applicationsData]
  )
  const filteredTotalCount = applicationsData?.count ?? applications.length
  const totalPages = Math.max(1, Math.ceil(filteredTotalCount / PAGE_SIZE))

  const listingMap = useMemo(() => {
    const map = new Map<string, PublicListingItem>()
    for (const item of ownerListingsData?.results ?? []) {
      map.set(item.id, item)
    }
    return map
  }, [ownerListingsData])

  const counts = {
    total: totalAllCount,
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
    byStatus: {
      all: totalAllCount,
      submitted: submittedCount,
      under_review: underReviewCount,
      approved: approvedCount,
      rejected: rejectedCount,
      withdrawn: withdrawnCount,
    } as Record<StatusTab, number>,
  }

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return applications
    return applications.filter((app) => {
      const applicantMatch = (app.applicant_name || '').toLowerCase().includes(q)
      const propertyMatch = (app.property_title || '').toLowerCase().includes(q)
      const listingMatch = (app.listing_title || '').toLowerCase().includes(q)
      return applicantMatch || propertyMatch || listingMatch
    })
  }, [applications, searchQuery])

  const handlePageChange = (nextPage: number) => {
    setCurrentPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
          Applications
        </h1>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/app/owner/properties')}
        >
          My Properties
        </Button>
      </div>

      {/* 2. Summary Cards */}
      <section aria-label="Application overview" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
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
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Total Received</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">{counts.total}</p>
            )}
          </div>
        </div>

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
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Pending Review</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">{counts.pending}</p>
            )}
          </div>
        </div>

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
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Approved</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">{counts.approved}</p>
            )}
          </div>
        </div>

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
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Rejected</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">{counts.rejected}</p>
            )}
          </div>
        </div>
      </section>

      {/* 3. Error State */}
      {isError && (
        <Alert variant="error" title="Unable to load applications">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span>We could not fetch applications received for your properties.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 4. Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <Skeleton key={idx} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : counts.total === 0 && activeStatus === 'all' ? (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="lg"
            title="No rental applications yet"
            description="When prospective tenants apply for one of your published property listings, their applications will appear here for review."
            action={
              <Button variant="primary" size="md" onClick={() => navigate('/app/owner/properties')}>
                View My Properties
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* 5. Filter Tabs & Search */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Filter applications by status"
                className="flex flex-wrap items-center gap-2"
              >
                {STATUS_TABS.map((tab) => {
                  const isSelected = activeStatus === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => {
                        setActiveStatus(tab.id)
                        setCurrentPage(1)
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#ECF5F2] border-[#408A71]/40 text-[#408A71]'
                          : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isSelected ? 'bg-[#408A71] text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {counts.byStatus[tab.id]}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="w-full lg:w-72 shrink-0">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search applicant or property on page..."
                  aria-label="Search applications by applicant or property name"
                />
              </div>
            </div>

            {filteredTotalCount > PAGE_SIZE && (
              <p className="text-[11px] text-[#6B7280]">
                Showing page {currentPage} of {totalPages} ({filteredTotalCount} matching applications).
              </p>
            )}
          </div>

          {/* 6. Applications List */}
          {filteredApplications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
              <EmptyState
                size="md"
                title="No matching applications"
                description="No received applications match your current status filter or search query."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveStatus('all')
                      setSearchQuery('')
                      setCurrentPage(1)
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredApplications.map((app) => {
                const statusMeta = getApplicationStatusMeta(app.status)
                const matchedListing = listingMap.get(app.listing)
                const canReview = isReviewableApplication(app.status)
                const rentText = matchedListing ? formatINR(matchedListing.monthly_rent) : null

                return (
                  <article
                    key={app.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col justify-between gap-3 hover:shadow-xs transition-shadow"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          to={`/app/owner/applications/${app.id}`}
                          className="text-sm sm:text-base font-medium text-[#111827] hover:text-[#408A71] transition-colors truncate"
                        >
                          {app.applicant_name || 'Applicant'}
                        </Link>
                        <Badge variant={statusMeta.variant} size="sm" dot>
                          {statusMeta.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4B5563]">
                        <span className="font-medium text-[#111827]">
                          {app.property_title || app.listing_title}
                        </span>
                        {app.listing_title && app.listing_title !== app.property_title && (
                          <span className="text-[#6B7280]">· {app.listing_title}</span>
                        )}
                        {rentText && (
                          <span className="font-medium text-[#111827]">· {rentText}/mo</span>
                        )}
                        <span className="text-[#6B7280]">
                          · Submitted {formatDate(app.created_at)}
                        </span>
                      </div>

                      {app.message && (
                        <p className="text-xs text-[#6B7280] line-clamp-2 rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-1.5">
                          “{app.message}”
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2.5 border-t border-[#F3F4F6]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/app/owner/applications/${app.id}`)}
                      >
                        View Details
                      </Button>

                      {canReview && (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              setReviewTarget({ application: app, status: 'approved' })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() =>
                              setReviewTarget({ application: app, status: 'rejected' })
                            }
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {app.status === 'approved' && (
                        app.tenancy_id ? (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              navigate(`/app/owner/tenancies/${app.tenancy_id}`)
                            }
                          >
                            View Tenancy
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setCreateTenancyTarget(app)}
                          >
                            Create Tenancy
                          </Button>
                        )
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* 7. Server Pagination */}
          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredTotalCount}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <ApplicationReviewModal
        key={`${reviewTarget?.application.id ?? 'none'}-${reviewTarget?.status ?? 'none'}`}
        open={Boolean(reviewTarget)}
        application={reviewTarget?.application ?? null}
        targetStatus={reviewTarget?.status ?? null}
        onClose={() => setReviewTarget(null)}
      />

      {/* Create Tenancy Modal */}
      <CreateTenancyModal
        key={`create-tenancy-${createTenancyTarget?.id ?? 'none'}`}
        open={Boolean(createTenancyTarget)}
        application={createTenancyTarget}
        listing={createTenancyTarget ? listingMap.get(createTenancyTarget.listing) ?? null : null}
        onClose={() => setCreateTenancyTarget(null)}
        onCreated={(tenancyId) => navigate(`/app/owner/tenancies/${tenancyId}`)}
      />
    </div>
  )
}

export default OwnerApplicationsPage

