import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useApplicationDetail } from '../../hooks/useTenantWorkspace'
import { listingService } from '../../services/listing.service'
import { Alert, Badge, Button, Skeleton } from '../../components/ui'
import { ApplicationWithdrawModal } from '../../components/tenant/ApplicationWithdrawModal'
import { getMediaUrl } from '../../utils/imageUrl'
import {
  formatDate,
  formatDateTime,
  formatINR,
  getApplicationStatusMeta,
  isWithdrawableApplication,
} from '../../utils/application'
import type { ApplicationStatusHistoryItem } from '../../types/leasing'

function formatHistoryHeadline(entry: ApplicationStatusHistoryItem): string {
  const newMeta = getApplicationStatusMeta(entry.new_status)
  if (!entry.previous_status) {
    return `Application ${newMeta.label}`
  }
  const prevMeta = getApplicationStatusMeta(entry.previous_status)
  return `${prevMeta.label} → ${newMeta.label}`
}

/**
 * TenantApplicationDetailPage
 * Full-page application details inside TenantWorkspaceLayout (`/app/tenant/applications/:applicationId`).
 * Displays property info (when listing is published), submitted message, owner review notes,
 * full status_history timeline, and withdraw flow for eligible applications.
 */
export const TenantApplicationDetailPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>()
  const navigate = useNavigate()
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  const {
    data: applicationResponse,
    isLoading,
    isError,
    refetch,
  } = useApplicationDetail(applicationId)

  const application = applicationResponse?.data

  // Attempt to load public listing details (may 404 cleanly if paused/closed)
  const {
    data: listingResponse,
    isLoading: listingLoading,
    isError: listingUnavailable,
  } = useQuery({
    queryKey: ['tenant', 'application-listing-detail', application?.listing],
    queryFn: () => listingService.getListing(application!.listing),
    enabled: Boolean(application?.listing),
    retry: false,
    staleTime: 60_000,
  })

  const listing = listingResponse?.data

  // Extract owner/reviewer notes from status history transitions
  const reviewNotes = useMemo(() => {
    if (!application?.status_history) return []
    return application.status_history.filter(
      (entry) =>
        Boolean(entry.change_reason?.trim()) &&
        entry.new_status !== 'submitted' &&
        entry.new_status !== 'withdrawn'
    )
  }, [application])

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !application) {
    return (
      <div className="space-y-6 pb-10">
        <Link
          to="/app/tenant/applications"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#408A71] hover:text-[#34745C]"
        >
          <span aria-hidden="true">←</span>
          <span>Back to My Applications</span>
        </Link>

        <Alert variant="error" title="Application not found">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>
              We couldn&apos;t load this rental application. It may not exist or you may not have access to it.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/app/tenant/applications')}
              >
                My Applications
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    )
  }

  const statusMeta = getApplicationStatusMeta(application.status)
  const canWithdraw = isWithdrawableApplication(application.status)
  const displayTitle = application.property_title || application.listing_title || 'Rental Application'

  const prop = listing?.property
  const primaryImgPath =
    prop?.images?.find((img) => img.is_primary)?.image_url ||
    prop?.primary_image_url ||
    prop?.images?.[0]?.image_url ||
    null
  const imageUrl = primaryImgPath ? getMediaUrl(primaryImgPath) : null
  const locationText = prop
    ? [prop.address_line_1, prop.locality, prop.city, prop.state]
        .filter(Boolean)
        .join(', ')
    : null

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Breadcrumbs & Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-xs sm:text-sm text-[#6B7280] font-medium">
            <li>
              <Link to="/app/tenant/dashboard" className="hover:text-[#408A71] transition-colors">
                Overview
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/app/tenant/applications" className="hover:text-[#408A71] transition-colors">
                My Applications
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-[#111827] font-semibold truncate max-w-[220px] sm:max-w-sm">
              {displayTitle}
            </li>
          </ol>
        </nav>

        <Link
          to="/app/tenant/applications"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-gray-50 text-xs font-semibold text-[#374151] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to My Applications</span>
        </Link>
      </div>

      {/* 2. Summary Header Card */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-medium tracking-tight text-[#111827] truncate mb-0">
              {displayTitle}
            </h1>
            <Badge variant={statusMeta.variant} size="md" dot>
              {statusMeta.label}
            </Badge>
          </div>

          {application.listing_title &&
            application.listing_title !== application.property_title && (
              <p className="text-sm text-[#6B7280]">{application.listing_title}</p>
            )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#6B7280]">
            <span>Submitted {formatDateTime(application.created_at)}</span>
            <span>Last updated {formatDateTime(application.updated_at)}</span>
            {application.reviewed_at && (
              <span>Reviewed {formatDateTime(application.reviewed_at)}</span>
            )}
          </div>
        </div>

        {canWithdraw && (
          <div className="shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWithdrawOpen(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              Withdraw Application
            </Button>
          </div>
        )}
      </section>

      {/* 3. Main 2-Column Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Property Info + Submission & Owner Response */}
        <div className="lg:col-span-7 space-y-5">
          {/* Property Information Card */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium text-[#111827]">Property Information</h2>
              {listing && !listingUnavailable && (
                <Link
                  to={`/app/tenant/properties/${application.listing}`}
                  className="text-xs font-medium text-[#408A71] hover:text-[#34745C] inline-flex items-center gap-1"
                >
                  <span>View Property Listing</span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>

            {listingLoading ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <Skeleton className="h-36 w-full sm:w-48 rounded-xl" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ) : listing && !listingUnavailable ? (
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-48 h-36 shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-[#E5E7EB]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={displayTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#F4FAF7] text-xs font-medium text-[#408A71]">
                      No photo uploaded
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <h3 className="text-base font-medium text-[#111827] truncate">
                      {listing.title || displayTitle}
                    </h3>
                    {locationText && (
                      <p className="mt-0.5 text-xs text-[#6B7280]">{locationText}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-[#F3F4F6] pt-3">
                    <div>
                      <p className="text-xs font-normal text-[#6B7280]">Monthly Rent</p>
                      <p className="text-sm font-medium text-[#111827]">
                        {formatINR(listing.monthly_rent) ?? '—'}
                      </p>
                    </div>
                    {listing.security_deposit && (
                      <div>
                        <p className="text-xs font-normal text-[#6B7280]">Security Deposit</p>
                        <p className="text-sm font-medium text-[#111827]">
                          {formatINR(listing.security_deposit) ?? '—'}
                        </p>
                      </div>
                    )}
                    {listing.available_from && (
                      <div>
                        <p className="text-xs font-normal text-[#6B7280]">Available From</p>
                        <p className="text-sm font-medium text-[#111827]">
                          {formatDate(listing.available_from)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] p-4 space-y-1.5">
                <p className="text-sm font-medium text-[#111827]">{displayTitle}</p>
                {application.listing_title && (
                  <p className="text-xs text-[#4B5563]">{application.listing_title}</p>
                )}
                <p className="text-xs text-[#6B7280]">
                  Full public listing details are currently unavailable because this listing is paused or closed.
                </p>
              </div>
            )}
          </section>

          {/* Submitted Message & Owner Review Notes */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
            <div>
              <h2 className="text-base font-medium text-[#111827] mb-2">
                Your Application Message
              </h2>
              {application.message?.trim() ? (
                <div className="rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] p-4 text-sm text-[#374151] whitespace-pre-line">
                  {application.message.trim()}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-[#6B7280]">
                  No cover message was included with this application.
                </p>
              )}
            </div>

            <div className="border-t border-[#F3F4F6] pt-4">
              <h2 className="text-base font-medium text-[#111827] mb-2">
                Owner Review Notes
              </h2>
              {reviewNotes.length > 0 ? (
                <div className="space-y-3">
                  {reviewNotes.map((entry) => {
                    const meta = getApplicationStatusMeta(entry.new_status)
                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-[#DCE8E2] bg-[#F4FAF7] p-4 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant={meta.variant} size="sm">
                            {meta.label}
                          </Badge>
                          <span className="text-[11px] text-[#6B7280]">
                            {formatDateTime(entry.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-[#111827] whitespace-pre-line">
                          {entry.change_reason}
                        </p>
                        {entry.changed_by_name && (
                          <p className="text-[11px] text-[#6B7280]">
                            By {entry.changed_by_name}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-[#6B7280]">
                  No review notes have been shared for this application yet.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Application Status History / Timeline */}
        <aside className="lg:col-span-5 rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-base font-bold text-[#111827] mb-5">
            Application Timeline
          </h2>

          {application.status_history && application.status_history.length > 0 ? (
            <ol className="relative border-l border-[#DCE8E2] ml-2.5 space-y-6">
              {application.status_history.map((entry, idx) => {
                const isLatest = idx === application.status_history.length - 1
                const meta = getApplicationStatusMeta(entry.new_status)

                return (
                  <li key={entry.id} className="ml-5">
                    <span
                      className={`absolute -left-2 mt-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                        isLatest ? 'bg-[#408A71]' : 'bg-[#A5E0CB]'
                      }`}
                    />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-[#111827]">
                          {formatHistoryHeadline(entry)}
                        </p>
                        <Badge variant={meta.variant} size="sm">
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[#6B7280]">
                        {formatDateTime(entry.created_at)}
                        {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ''}
                      </p>
                      {entry.change_reason?.trim() && (
                        <p className="mt-1.5 text-xs text-[#374151] rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] px-3 py-2">
                          {entry.change_reason.trim()}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-xs sm:text-sm text-[#6B7280]">
              Status history is not available for this application.
            </p>
          )}
        </aside>
      </div>

      {/* Withdraw Modal */}
      <ApplicationWithdrawModal
        open={withdrawOpen}
        applicationId={application.id}
        propertyTitle={displayTitle}
        onClose={() => setWithdrawOpen(false)}
      />
    </div>
  )
}

export default TenantApplicationDetailPage

