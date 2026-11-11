import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  useDocuments,
  useMyApplications,
  useMyTenancies,
  useTenancyDetail,
} from '../../hooks/useTenantWorkspace'
import { listingService } from '../../services/listing.service'
import documentService from '../../services/document.service'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Pagination,
  Skeleton,
  useToast,
} from '../../components/ui'
import { getMediaUrl } from '../../utils/imageUrl'
import { extractApiErrorMessage, formatDate, formatDateTime, formatINR } from '../../utils/application'
import {
  calculateContractDurationLabel,
  calculateTenancyProgress,
  DOCUMENT_TYPE_LABELS,
  formatFileSize,
  getTenancyStatusMeta,
  isCurrentTenancyStatus,
  pickPrioritizedTenancy,
} from '../../utils/tenancy'
import type { DocumentItem } from '../../types/document'
import type { ApplicationListItem, TenancyListItem } from '../../types/leasing'
import type { PublicListingItem } from '../../types/listing'

const PAGE_SIZE = 10

/**
 * TenantTenancyPage
 * Authenticated Tenant "My Tenancy" module at `/app/tenant/tenancy`.
 * Integrates `GET /api/v1/tenancies/me/`, `GET /api/v1/tenancies/{id}/`,
 * `GET /api/v1/applications/me/` (for property/listing titles when linked),
 * and `GET /api/v1/documents/` + secure `GET /api/v1/documents/{id}/download/`.
 */
export const TenantTenancyPage: React.FC = () => {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [currentPage, setCurrentPage] = useState(1)
  const [selectedTenancyId, setSelectedTenancyId] = useState<string | null>(null)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  const {
    data: tenanciesData,
    isLoading: tenanciesLoading,
    isError: tenanciesError,
    refetch: refetchTenancies,
  } = useMyTenancies({ page: currentPage, page_size: PAGE_SIZE })

  const { data: applicationsData } = useMyApplications({ page: 1, page_size: 100 })
  const {
    data: documentsData,
    isLoading: documentsLoading,
    isError: documentsError,
  } = useDocuments({ page: 1, page_size: 100 })

  // Optional enrichment for pending tenancies whose listing might still be published
  const { data: publishedListingsData } = useQuery({
    queryKey: ['tenant', 'published-listings-index'],
    queryFn: () => listingService.getPublicListings({ page: 1, page_size: 100 }),
    staleTime: 60_000,
  })

  const tenancies = useMemo(() => tenanciesData?.results ?? [], [tenanciesData])
  const totalCount = tenanciesData?.count ?? tenancies.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Group current vs past tenancies
  const { currentTenancies, pastTenancies } = useMemo(() => {
    const current: TenancyListItem[] = []
    const past: TenancyListItem[] = []
    for (const t of tenancies) {
      if (isCurrentTenancyStatus(t.status)) {
        current.push(t)
      } else {
        past.push(t)
      }
    }
    return { currentTenancies: current, pastTenancies: past }
  }, [tenancies])

  // Select active/prioritized tenancy unless user picked a specific one on the page
  const activeSelectedTenancy = useMemo(() => {
    if (tenancies.length === 0) return null
    if (selectedTenancyId) {
      const explicit = tenancies.find((t) => t.id === selectedTenancyId)
      if (explicit) return explicit
    }
    return pickPrioritizedTenancy(tenancies)
  }, [tenancies, selectedTenancyId])

  // Fetch full detail fields (rent_due_day, actual_move_in_date, actual_move_out_date, notes, updated_at)
  const {
    data: tenancyDetailResponse,
    isLoading: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useTenancyDetail(activeSelectedTenancy?.id)

  const tenancyDetail = tenancyDetailResponse?.data

  // Map linked applications by id for real property_title / listing_title
  const applicationMap = useMemo(() => {
    const map = new Map<string, ApplicationListItem>()
    for (const app of applicationsData?.results ?? []) {
      map.set(app.id, app)
    }
    return map
  }, [applicationsData])

  // Map published listings by id & property_id
  const listingByIdMap = useMemo(() => {
    const map = new Map<string, PublicListingItem>()
    for (const listing of publishedListingsData?.results ?? []) {
      map.set(listing.id, listing)
    }
    return map
  }, [publishedListingsData])

  const matchedApplication = activeSelectedTenancy?.application_id
    ? applicationMap.get(activeSelectedTenancy.application_id) ?? null
    : null

  const matchedListing = matchedApplication
    ? listingByIdMap.get(matchedApplication.listing) ?? null
    : null

  // Filter documents attached to the selected tenancy; highlight rental agreements first
  const { rentalAgreements, otherTenancyDocuments } = useMemo(() => {
    if (!activeSelectedTenancy) {
      return { rentalAgreements: [] as DocumentItem[], otherTenancyDocuments: [] as DocumentItem[] }
    }
    const allDocs = documentsData?.results ?? []
    const linked = allDocs.filter((doc) => doc.tenancy === activeSelectedTenancy.id)
    return {
      rentalAgreements: linked.filter((doc) => doc.document_type === 'rental_agreement'),
      otherTenancyDocuments: linked.filter((doc) => doc.document_type !== 'rental_agreement'),
    }
  }, [documentsData, activeSelectedTenancy])

  const handleDownloadDocument = async (doc: DocumentItem) => {
    if (downloadingDocId) return
    setDownloadingDocId(doc.id)
    try {
      await documentService.downloadDocument(doc.id, doc.original_filename)
    } catch (err: unknown) {
      addToast({
        title: 'Download Failed',
        description: extractApiErrorMessage(err, 'Unable to download this document.'),
        variant: 'error',
      })
    } finally {
      setDownloadingDocId(null)
    }
  }

  const handlePageChange = (page: number) => {
    setSelectedTenancyId(null)
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderTenancySummaryTitle = (tenancy: TenancyListItem) => {
    const linkedApp = tenancy.application_id
      ? applicationMap.get(tenancy.application_id)
      : null
    return linkedApp?.property_title || linkedApp?.listing_title || `Tenancy #${tenancy.id.slice(0, 8)}`
  }

  // Detail values merged cleanly (detail response overrides summary when ready)
  const displayTenancy = tenancyDetail ?? activeSelectedTenancy
  const statusMeta = displayTenancy ? getTenancyStatusMeta(displayTenancy.status) : null
  const progress =
    displayTenancy &&
    (displayTenancy.status === 'active' || displayTenancy.status === 'confirmed')
      ? calculateTenancyProgress(displayTenancy.start_date, displayTenancy.end_date)
      : null

  const propImageUrl = matchedListing?.property?.primary_image_url
    ? getMediaUrl(matchedListing.property.primary_image_url)
    : null
  const propLocation = matchedListing?.property
    ? [
        matchedListing.property.address_line_1,
        matchedListing.property.locality,
        matchedListing.property.city,
        matchedListing.property.state,
      ]
        .filter(Boolean)
        .join(', ')
    : null

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">My Tenancy</h1>
        {tenancies.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/tenant/documents')}
          >
            All Documents
          </Button>
        )}
      </div>

      {/* 2. Error State */}
      {tenanciesError && (
        <Alert variant="error" title="Failed to load tenancies">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>We couldn&apos;t retrieve your tenancy records right now.</span>
            <Button variant="outline" size="sm" onClick={() => void refetchTenancies()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 3. Loading State */}
      {tenanciesLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-7 h-64 rounded-2xl" />
            <Skeleton className="lg:col-span-5 h-64 rounded-2xl" />
          </div>
        </div>
      ) : tenancies.length === 0 ? (
        /* 4. Empty State (E) */
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
      ) : (
        <>
          {/* 5. Multi-Tenancy Selector (when tenant has > 1 tenancy on page or multiple historical records) */}
          {(tenancies.length > 1 || totalPages > 1) && (
            <section
              aria-label="Tenancy Switcher"
              className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#111827]">
                    Your Tenancies ({totalCount})
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    {currentTenancies.length} current / upcoming · {pastTenancies.length} past
                  </p>
                </div>
              </div>

              {currentTenancies.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Current &amp; Upcoming
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentTenancies.map((item) => {
                      const isSelected = activeSelectedTenancy?.id === item.id
                      const meta = getTenancyStatusMeta(item.status)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedTenancyId(item.id)}
                          className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#408A71] bg-[#ECF5F2]/70 ring-1 ring-[#408A71]/30'
                              : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs sm:text-sm font-bold text-[#111827] truncate">
                              {renderTenancySummaryTitle(item)}
                            </p>
                            <Badge variant={meta.variant} size="sm">
                              {meta.label}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-xs text-[#4B5563]">
                            {formatINR(item.monthly_rent) ?? '—'}/mo · Starts{' '}
                            {formatDate(item.start_date)}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {pastTenancies.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Past &amp; Cancelled
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pastTenancies.map((item) => {
                      const isSelected = activeSelectedTenancy?.id === item.id
                      const meta = getTenancyStatusMeta(item.status)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedTenancyId(item.id)}
                          className={`text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#408A71] bg-[#ECF5F2]/70 ring-1 ring-[#408A71]/30'
                              : 'border-[#E5E7EB] bg-[#F9FAFB] hover:bg-gray-100/70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs sm:text-sm font-bold text-[#111827] truncate">
                              {renderTenancySummaryTitle(item)}
                            </p>
                            <Badge variant={meta.variant} size="sm">
                              {meta.label}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-xs text-[#6B7280]">
                            {formatDate(item.start_date)} –{' '}
                            {item.end_date ? formatDate(item.end_date) : 'Open-ended'}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {totalPages > 1 && (
                <div className="pt-2 border-t border-[#F3F4F6]">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalCount}
                    pageSize={PAGE_SIZE}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </section>
          )}

          {/* 6. Active / Selected Tenancy Overview & Details */}
          {displayTenancy && statusMeta && (
            <>
              {detailError && (
                <Alert variant="error" title="Could not load extended tenancy terms">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                    <span>Showing summary tenancy information.</span>
                    <Button variant="outline" size="sm" onClick={() => void refetchDetail()}>
                      Retry
                    </Button>
                  </div>
                </Alert>
              )}

              {/* Section A: Active / Selected Tenancy Overview Card */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex flex-col md:flex-row gap-5 items-stretch">
                  {/* Property Image or Clean Architectural Placeholder */}
                  <div className="w-full md:w-52 h-36 shrink-0 rounded-xl overflow-hidden border border-[#DCE8E2] bg-gradient-to-br from-[#F4FAF7] to-[#E6F4EE] flex flex-col items-center justify-center text-center">
                    {propImageUrl ? (
                      <img
                        src={propImageUrl}
                        alt={matchedApplication?.property_title || 'Rental property'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="p-4 flex flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#408A71] shadow-2xs mb-2.5">
                          <svg
                            className="w-6 h-6"
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
                        <span className="text-xs font-semibold text-[#408A71]">
                          {statusMeta.label}
                        </span>
                        <span className="text-[11px] text-[#6B7280] mt-0.5 font-mono">
                          Property #{displayTenancy.property_id.slice(0, 8)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Overview Content */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusMeta.variant} size="md" dot>
                            {statusMeta.label}
                          </Badge>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563]">
                            {isCurrentTenancyStatus(displayTenancy.status)
                              ? 'Current Tenancy'
                              : 'Historical Tenancy'}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-[#6B7280]">
                          ID: {displayTenancy.id.slice(0, 8)}
                        </span>
                      </div>

                      <h2 className="mt-2 text-lg sm:text-xl font-medium text-[#111827] truncate">
                        {matchedApplication?.property_title ||
                          `Tenancy Agreement #${displayTenancy.id.slice(0, 8)}`}
                      </h2>

                      <p className="mt-0.5 text-xs sm:text-sm text-[#6B7280]">
                        {propLocation ||
                          matchedApplication?.listing_title ||
                          `Property Reference: ${displayTenancy.property_id}`}
                      </p>
                    </div>

                    {/* Key Financials & Dates Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 border-t border-[#F3F4F6] pt-3">
                      <div>
                        <p className="text-[11px] font-normal text-[#6B7280]">Monthly Rent</p>
                        <p className="mt-0.5 text-sm sm:text-base font-medium text-[#111827]">
                          {formatINR(displayTenancy.monthly_rent) ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-normal text-[#6B7280]">Security Deposit</p>
                        <p className="mt-0.5 text-sm sm:text-base font-medium text-[#111827]">
                          {formatINR(displayTenancy.security_deposit) ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-[#6B7280]">Start Date</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#111827]">
                          {formatDate(displayTenancy.start_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-[#6B7280]">End Date</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#111827]">
                          {displayTenancy.end_date
                            ? formatDate(displayTenancy.end_date)
                            : 'Open-ended'}
                        </p>
                      </div>
                    </div>

                    {/* Optional Agreement Progress Bar (strictly from real dates) */}
                    {progress && (
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-medium text-[#4B5563]">Agreement Progress</span>
                          <span className="font-semibold text-[#111827]">
                            {progress.daysRemaining} Days Remaining
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#408A71] transition-all duration-300"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* 7. Details, Status & Rental Agreement Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Section B — Tenancy Details & Terms */}
                <section className="lg:col-span-7 rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2 border-b border-[#F3F4F6] pb-3.5">
                    <h2 className="text-base font-bold text-[#111827]">
                      Tenancy Details &amp; Terms
                    </h2>
                    {displayTenancy.application_id && (
                      <Link
                        to={`/app/tenant/applications/${displayTenancy.application_id}`}
                        className="text-xs font-semibold text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1"
                      >
                        <span>View Source Application</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    )}
                  </div>

                  {detailLoading && !tenancyDetail ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : (
                    <>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                          <dt className="text-[11px] font-medium text-[#6B7280]">Property</dt>
                          <dd className="mt-0.5 font-semibold text-[#111827] break-words">
                            {matchedApplication?.property_title ||
                              `Ref: ${displayTenancy.property_id}`}
                          </dd>
                          {!propLocation && (
                            <p className="mt-1 text-[11px] text-[#6B7280]">
                              Full property address is not exposed on the tenancy endpoint.
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                          <dt className="text-[11px] font-medium text-[#6B7280]">
                            Contract Duration
                          </dt>
                          <dd className="mt-0.5 font-semibold text-[#111827]">
                            {calculateContractDurationLabel(
                              displayTenancy.start_date,
                              displayTenancy.end_date
                            )}
                          </dd>
                        </div>

                        <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                          <dt className="text-[11px] font-medium text-[#6B7280]">Monthly Rent</dt>
                          <dd className="mt-0.5 font-bold text-[#111827]">
                            {formatINR(displayTenancy.monthly_rent) ?? '—'}
                          </dd>
                        </div>

                        <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                          <dt className="text-[11px] font-medium text-[#6B7280]">
                            Security Deposit
                          </dt>
                          <dd className="mt-0.5 font-bold text-[#111827]">
                            {formatINR(displayTenancy.security_deposit) ?? '—'}
                          </dd>
                        </div>

                        <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                          <dt className="text-[11px] font-medium text-[#6B7280]">Rent Due Day</dt>
                          <dd className="mt-0.5 font-semibold text-[#111827]">
                            {tenancyDetail?.rent_due_day
                              ? `Day ${tenancyDetail.rent_due_day} of every month`
                              : '—'}
                          </dd>
                        </div>

                        <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                          <dt className="text-[11px] font-medium text-[#6B7280]">
                            Actual Move-in Date
                          </dt>
                          <dd className="mt-0.5 font-semibold text-[#111827]">
                            {tenancyDetail?.actual_move_in_date
                              ? formatDate(tenancyDetail.actual_move_in_date)
                              : 'Not recorded yet'}
                          </dd>
                        </div>

                        <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                          <dt className="text-[11px] font-medium text-[#6B7280]">
                            Actual Move-out Date
                          </dt>
                          <dd className="mt-0.5 font-semibold text-[#111827]">
                            {tenancyDetail?.actual_move_out_date
                              ? formatDate(tenancyDetail.actual_move_out_date)
                              : 'Not recorded'}
                          </dd>
                        </div>

                        <div className="rounded-xl bg-[#F9FAFB] border border-[#F3F4F6] p-3.5">
                          <dt className="text-[11px] font-medium text-[#6B7280]">
                            Tenancy Created
                          </dt>
                          <dd className="mt-0.5 font-semibold text-[#111827]">
                            {formatDate(displayTenancy.created_at)}
                          </dd>
                        </div>
                      </dl>

                      {tenancyDetail?.notes?.trim() && (
                        <div className="rounded-xl border border-[#DCE8E2] bg-[#F4FAF7] p-4">
                          <p className="text-xs font-semibold text-[#1A382A] mb-1">
                            Agreement Notes
                          </p>
                          <p className="text-sm text-[#374151] whitespace-pre-line">
                            {tenancyDetail.notes.trim()}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </section>

                {/* Right Column: Section C (Status) & Section D (Rental Agreement) */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Section C: Tenancy Status (honest representation without invented history API) */}
                  <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-bold text-[#111827]">Tenancy Status</h2>
                      <Badge variant={statusMeta.variant} size="sm" dot>
                        {statusMeta.label}
                      </Badge>
                    </div>

                    <p className="text-xs sm:text-sm text-[#4B5563]">{statusMeta.description}</p>

                    <div className="space-y-2 border-t border-[#F3F4F6] pt-3 text-xs text-[#6B7280]">
                      <div className="flex justify-between gap-2">
                        <span>Created</span>
                        <span className="font-medium text-[#111827]">
                          {formatDateTime(displayTenancy.created_at)}
                        </span>
                      </div>
                      {tenancyDetail?.updated_at && (
                        <div className="flex justify-between gap-2">
                          <span>Last Updated</span>
                          <span className="font-medium text-[#111827]">
                            {formatDateTime(tenancyDetail.updated_at)}
                          </span>
                        </div>
                      )}
                      {tenancyDetail?.actual_move_in_date && (
                        <div className="flex justify-between gap-2">
                          <span>Move-in Recorded</span>
                          <span className="font-medium text-[#111827]">
                            {formatDate(tenancyDetail.actual_move_in_date)}
                          </span>
                        </div>
                      )}
                      {tenancyDetail?.actual_move_out_date && (
                        <div className="flex justify-between gap-2">
                          <span>Move-out Recorded</span>
                          <span className="font-medium text-[#111827]">
                            {formatDate(tenancyDetail.actual_move_out_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Section D: Rental Agreement & Tenancy Documents */}
                  <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-bold text-[#111827]">Rental Agreement</h2>
                      <Link
                        to="/app/tenant/documents"
                        className="text-xs font-semibold text-[#408A71] hover:text-[#34745C]"
                      >
                        Documents →
                      </Link>
                    </div>

                    {documentsError && (
                      <Alert variant="error">
                        Unable to load tenancy documents right now.
                      </Alert>
                    )}

                    {documentsLoading ? (
                      <div className="space-y-2.5">
                        <Skeleton className="h-16 w-full rounded-xl" />
                        <Skeleton className="h-16 w-full rounded-xl" />
                      </div>
                    ) : rentalAgreements.length > 0 || otherTenancyDocuments.length > 0 ? (
                      <div className="space-y-3">
                        {rentalAgreements.map((doc) => (
                          <div
                            key={doc.id}
                            className="rounded-xl border border-[#CBE7DC] bg-[#F4FAF7] p-4 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="success" size="sm">
                                  Rental Agreement
                                </Badge>
                              </div>
                              <p className="mt-1.5 text-sm font-semibold text-[#111827] truncate">
                                {doc.title || doc.original_filename}
                              </p>
                              <p className="text-[11px] text-[#6B7280]">
                                {formatFileSize(doc.file_size_bytes)} · Uploaded{' '}
                                {formatDate(doc.created_at)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              isLoading={downloadingDocId === doc.id}
                              onClick={() => void handleDownloadDocument(doc)}
                            >
                              Download
                            </Button>
                          </div>
                        ))}

                        {otherTenancyDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#111827] truncate">
                                {doc.title || doc.original_filename}
                              </p>
                              <p className="text-[11px] text-[#6B7280]">
                                {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type} ·{' '}
                                {formatFileSize(doc.file_size_bytes)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              isLoading={downloadingDocId === doc.id}
                              onClick={() => void handleDownloadDocument(doc)}
                            >
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-5 text-center">
                        <p className="text-xs sm:text-sm font-semibold text-[#111827]">
                          No rental agreement uploaded yet
                        </p>
                        <p className="mt-1 text-xs text-[#6B7280]">
                          Once a rental agreement document is attached to this tenancy, you can download it securely here.
                        </p>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default TenantTenancyPage
