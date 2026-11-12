import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useManagedTenancies,
  useManagedTenanciesCount,
} from '../../hooks/useOwnerTenancies'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Pagination,
  Skeleton,
} from '../../components/ui'
import { formatDate, formatINR } from '../../utils/application'
import { getMediaUrl } from '../../utils/imageUrl'
import { getOwnerTenancyStatusMeta } from '../../utils/tenancy'
import type { TenancyStatus } from '../../types/leasing'

const PAGE_SIZE = 20

type StatusFilter = 'all' | TenancyStatus

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Upcoming' },
  { id: 'active', label: 'Active' },
  { id: 'ended', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

/**
 * OwnerTenanciesPage
 * Owner Workspace tenancy management overview at `/app/owner/tenancies`.
 * Backed by `GET /api/v1/tenancies/managed/` with server-side `?status=` filtering and pagination.
 */
export const OwnerTenanciesPage: React.FC = () => {
  const navigate = useNavigate()

  const [currentPage, setCurrentPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const {
    data: tenanciesData,
    isLoading,
    isError,
    refetch,
  } = useManagedTenancies({
    page: currentPage,
    page_size: PAGE_SIZE,
    ...(activeStatus !== 'all' ? { status: activeStatus } : {}),
  })

  // Accurate server-side global counts per status
  const { data: totalAllCount = 0, isLoading: isLoadingAllCount } =
    useManagedTenanciesCount()
  const { data: confirmedCount = 0, isLoading: isLoadingConfirmedCount } =
    useManagedTenanciesCount('confirmed')
  const { data: activeCount = 0, isLoading: isLoadingActiveCount } =
    useManagedTenanciesCount('active')
  const { data: endedCount = 0, isLoading: isLoadingEndedCount } =
    useManagedTenanciesCount('ended')
  const { data: cancelledCount = 0 } = useManagedTenanciesCount('cancelled')

  const tabCounts: Partial<Record<StatusFilter, number>> = {
    all: totalAllCount,
    confirmed: confirmedCount,
    active: activeCount,
    ended: endedCount,
    cancelled: cancelledCount,
  }

  const tenancies = useMemo(() => tenanciesData?.results ?? [], [tenanciesData])
  const filteredTotalCount = tenanciesData?.count ?? tenancies.length
  const totalPages = Math.max(1, Math.ceil(filteredTotalCount / PAGE_SIZE))

  const visibleTenancies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return tenancies
    return tenancies.filter((item) => {
      const tenantMatch = (item.tenant_name ?? '').toLowerCase().includes(query)
      const propertyMatch = (item.property_title ?? '').toLowerCase().includes(query)
      const addressMatch = (item.property_address ?? '').toLowerCase().includes(query)
      return tenantMatch || propertyMatch || addressMatch
    })
  }, [tenancies, searchQuery])

  const handleStatusChange = (status: StatusFilter) => {
    setActiveStatus(status)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasAnyTenancyInAccount = totalAllCount > 0 || activeStatus !== 'all'

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
          Tenancies
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/owner/applications')}
          >
            View Applications
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/owner/properties')}
          >
            My Properties
          </Button>
        </div>
      </div>

      {/* 2. Summary KPI Cards (server-side global totals) */}
      <section
        aria-label="Tenancy overview"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
      >
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Total Tenancies</p>
            {isLoadingAllCount ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {totalAllCount}
              </p>
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
            <p className="text-xs font-normal text-[#6B7280]">Active Tenancies</p>
            {isLoadingActiveCount ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {activeCount}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Upcoming Tenancies</p>
            {isLoadingConfirmedCount ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {confirmedCount}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#4B5563]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Completed Tenancies</p>
            {isLoadingEndedCount ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {endedCount}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 3. Error State */}
      {isError && (
        <Alert variant="error" title="Unable to load tenancies">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span>We could not fetch tenancies for your properties.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 4. Filter Tabs & Search */}
      {(hasAnyTenancyInAccount || isLoading) && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Filter tenancies by status"
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
                    onClick={() => handleStatusChange(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#ECF5F2] border-[#408A71]/40 text-[#408A71]'
                        : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${
                        isSelected
                          ? 'bg-[#408A71] text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tabCounts[tab.id]}
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
                placeholder="Search tenant or property on page..."
                aria-label="Search tenancies by tenant or property name"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Loading / Empty / List Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <Skeleton key={idx} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : !hasAnyTenancyInAccount && !isError ? (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="lg"
            title="No tenancies yet"
            description="When you approve a rental application, you can create a tenancy agreement to track confirmation, move-in activation, and checkout here."
            action={
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/app/owner/applications')}
              >
                Review Applications
              </Button>
            }
          />
        </div>
      ) : visibleTenancies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="md"
            title="No matching tenancies"
            description="No tenancies match the selected status or search filter."
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
                Reset Filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleTenancies.map((tenancy) => {
              const statusMeta = getOwnerTenancyStatusMeta(tenancy.status)
              const propertyTitle = tenancy.property_title || 'Property'
              const tenantName = tenancy.tenant_name || 'Tenant'
              const imageUrl = tenancy.property_image_url
                ? getMediaUrl(tenancy.property_image_url)
                : null

              return (
                <article
                  key={tenancy.id}
                  className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden flex flex-col justify-between hover:shadow-xs transition-shadow"
                >
                  <div>
                    {/* Top Property Photo + Overlaid Status Badge */}
                    <Link
                      to={`/app/owner/tenancies/${tenancy.id}`}
                      className="block relative aspect-[16/10] w-full bg-[#F4FAF7] overflow-hidden"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={propertyTitle}
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#408A71] gap-1">
                          <svg
                            className="w-6 h-6 opacity-75"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth="1.6"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          <span className="text-[11px] font-medium">No property photo</span>
                        </div>
                      )}
                      <div className="absolute top-2.5 right-2.5">
                        <Badge variant={statusMeta.variant} size="sm" dot>
                          {statusMeta.label}
                        </Badge>
                      </div>
                    </Link>

                    {/* Compact Body */}
                    <div className="p-3.5 space-y-2.5">
                      <div className="min-w-0">
                        <Link
                          to={`/app/owner/tenancies/${tenancy.id}`}
                          className="block text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors truncate"
                        >
                          {propertyTitle}
                        </Link>
                        {tenancy.property_address && (
                          <p className="text-xs font-normal text-[#6B7280] truncate mt-0.5">
                            {tenancy.property_address}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] p-2.5 text-xs">
                        <div className="min-w-0">
                          <p className="text-[11px] font-normal text-[#6B7280]">Tenant</p>
                          <p className="mt-0.5 font-medium text-[#111827] truncate">
                            {tenantName}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-normal text-[#6B7280]">Monthly Rent</p>
                          <p className="mt-0.5 font-medium text-[#111827] tabular-nums">
                            {formatINR(tenancy.monthly_rent)}/mo
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-normal text-[#6B7280]">Deposit</p>
                          <p className="mt-0.5 font-medium text-[#111827] tabular-nums">
                            {formatINR(tenancy.security_deposit)}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-normal text-[#6B7280]">Start</p>
                          <p className="mt-0.5 font-medium text-[#111827] truncate">
                            {formatDate(tenancy.start_date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-3.5 pb-3.5 pt-2 flex items-center justify-between gap-2 border-t border-[#F3F4F6]">
                    <span className="text-[11px] font-normal text-[#6B7280] truncate">
                      {tenancy.end_date ? `Ends ${formatDate(tenancy.end_date)}` : 'Open-ended'}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/app/owner/tenancies/${tenancy.id}`)}
                    >
                      View Details
                    </Button>
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
                totalItems={filteredTotalCount}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default OwnerTenanciesPage

