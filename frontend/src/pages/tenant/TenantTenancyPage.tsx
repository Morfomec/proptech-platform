import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMyTenancies } from '../../hooks/useTenantWorkspace'
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
import { calculateContractDurationLabel, getTenancyStatusMeta } from '../../utils/tenancy'
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
 * TenantTenancyPage
 * Tenant Workspace tenancy overview at `/app/tenant/tenancy`,
 * matching the Owner Tenancies layout (KPI summary, status tabs, search, 4-column photo cards).
 */
export const TenantTenancyPage: React.FC = () => {
  const navigate = useNavigate()

  const [currentPage, setCurrentPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const {
    data: tenanciesData,
    isLoading,
    isError,
    refetch,
  } = useMyTenancies({ page: 1, page_size: 100 })

  const allTenancies = useMemo(() => tenanciesData?.results ?? [], [tenanciesData])

  const tabCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: allTenancies.length,
      pending: 0,
      confirmed: 0,
      active: 0,
      ended: 0,
      cancelled: 0,
    }
    for (const item of allTenancies) {
      counts[item.status] = (counts[item.status] ?? 0) + 1
    }
    return counts
  }, [allTenancies])

  const filteredTenancies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return allTenancies.filter((item) => {
      if (activeStatus !== 'all' && item.status !== activeStatus) {
        return false
      }
      if (!query) return true
      const titleMatch = (item.property_title ?? '').toLowerCase().includes(query)
      const addressMatch = (item.property_address ?? '').toLowerCase().includes(query)
      return titleMatch || addressMatch
    })
  }, [allTenancies, activeStatus, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredTenancies.length / PAGE_SIZE))
  const visibleTenancies = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredTenancies.slice(start, start + PAGE_SIZE)
  }, [filteredTenancies, currentPage])

  const handleStatusChange = (status: StatusFilter) => {
    setActiveStatus(status)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasAnyTenancyInAccount = allTenancies.length > 0

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
          My Tenancy
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/tenant/applications')}
          >
            My Applications
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/tenant/documents')}
          >
            All Documents
          </Button>
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
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
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {tabCounts.all}
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
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {tabCounts.active}
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
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {tabCounts.confirmed}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#4B5563]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Completed Tenancies</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {tabCounts.ended}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 3. Error State */}
      {isError && (
        <Alert variant="error" title="Unable to load tenancies">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span>We couldn&apos;t retrieve your tenancy records right now.</span>
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
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search property or address..."
                aria-label="Search tenancies by property or address"
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
            description="A tenancy is created once a property owner approves your rental application and converts it into a tenancy agreement."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/app/tenant/properties')}
                >
                  Browse Properties
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/app/tenant/applications')}
                >
                  My Applications
                </Button>
              </div>
            }
          />
        </div>
      ) : visibleTenancies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="md"
            title="No matching tenancies"
            description="No tenancies match the active status tab or search filter."
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
              const statusMeta = getTenancyStatusMeta(tenancy.status)
              const propertyTitle = tenancy.property_title || `Tenancy #${tenancy.id.slice(0, 8)}`
              const imageUrl = tenancy.property_image_url
                ? getMediaUrl(tenancy.property_image_url)
                : null
              const durationLabel = calculateContractDurationLabel(
                tenancy.start_date,
                tenancy.end_date
              )

              return (
                <article
                  key={tenancy.id}
                  className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden flex flex-col justify-between hover:shadow-xs transition-shadow"
                >
                  <div>
                    {/* Top Property Photo + Overlaid Status Badge */}
                    <Link
                      to={`/app/tenant/tenancy/${tenancy.id}`}
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
                          to={`/app/tenant/tenancy/${tenancy.id}`}
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

                        <div className="min-w-0">
                          <p className="text-[11px] font-normal text-[#6B7280]">Duration</p>
                          <p className="mt-0.5 font-medium text-[#111827] truncate">
                            {durationLabel}
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
                      onClick={() => navigate(`/app/tenant/tenancy/${tenancy.id}`)}
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
                totalItems={filteredTenancies.length}
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

export default TenantTenancyPage
