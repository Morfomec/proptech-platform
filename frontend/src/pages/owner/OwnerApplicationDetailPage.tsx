import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOwnerApplicationDetail } from '../../hooks/useOwnerApplications'
import { useOwnerListings } from '../../hooks/useOwnerListings'
import { Alert, Badge, Button, Skeleton } from '../../components/ui'
import { ApplicationReviewModal } from '../../components/owner/ApplicationReviewModal'
import { CreateTenancyModal } from '../../components/owner/CreateTenancyModal'
import {
  formatDateTime,
  formatINR,
  getApplicationStatusMeta,
  isReviewableApplication,
} from '../../utils/application'
import type { OwnerReviewApplicationStatus } from '../../types/leasing'

/**
 * OwnerApplicationDetailPage
 * Owner application details, status history timeline, and review decision page
 * at `/app/owner/applications/:applicationId`.
 */
export const OwnerApplicationDetailPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>()
  const navigate = useNavigate()

  const [reviewStatusTarget, setReviewStatusTarget] =
    useState<OwnerReviewApplicationStatus | null>(null)
  const [createTenancyOpen, setCreateTenancyOpen] = useState(false)

  const {
    data: applicationResponse,
    isLoading,
    isError,
    refetch,
  } = useOwnerApplicationDetail(applicationId)

  const { data: ownerListingsData } = useOwnerListings({ page: 1, page_size: 100 })

  const application = applicationResponse?.data

  const matchedListing = useMemo(() => {
    if (!application) return null
    return (ownerListingsData?.results ?? []).find((l) => l.id === application.listing) ?? null
  }, [application, ownerListingsData])

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <Skeleton className="h-56 w-full rounded-2xl" />
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
        <Alert variant="error" title="Application unavailable">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span>
              We couldn&apos;t load this application. It may not exist or you do not own the associated property.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/app/owner/applications')}
              >
                Back to Applications
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    )
  }

  const statusMeta = getApplicationStatusMeta(application.status)
  const canReview = isReviewableApplication(application.status)
  const propertyTitle =
    application.property_title || application.listing_title || 'Rental Application'
  const rentText = matchedListing ? formatINR(matchedListing.monthly_rent) : null
  const depositText = matchedListing?.security_deposit
    ? formatINR(matchedListing.security_deposit)
    : null

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Breadcrumbs & Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-[#6B7280] font-medium">
            <li>
              <Link to="/app/owner/dashboard" className="hover:text-[#408A71] transition-colors">
                Overview
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/app/owner/applications" className="hover:text-[#408A71] transition-colors">
                Applications
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-[#111827] font-semibold truncate max-w-[200px] sm:max-w-sm">
              {application.applicant_name || propertyTitle}
            </li>
          </ol>
        </nav>

        <Link
          to="/app/owner/applications"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-gray-50 text-xs font-semibold text-[#374151] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Applications</span>
        </Link>
      </div>

      {/* 2. Summary Header Card */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-medium tracking-tight text-[#111827] truncate mb-0">
              {propertyTitle}
            </h1>
            <Badge variant={statusMeta.variant} size="md" dot>
              {statusMeta.label}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Applicant:{' '}
            <span className="font-medium text-[#111827]">
              {application.applicant_name || 'Applicant'}
            </span>
            {' · '}Submitted {formatDateTime(application.created_at)}
            {application.reviewed_at ? ` · Reviewed ${formatDateTime(application.reviewed_at)}` : ''}
          </p>
        </div>

        {matchedListing?.property_id && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/app/owner/properties/${matchedListing.property_id}`)}
          >
            Manage Property
          </Button>
        )}
      </section>

      {/* 3. Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Applicant Message & Review Decision */}
        <div className="lg:col-span-7 space-y-5">
          {/* Application Message & Listing Terms */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
            <h2 className="text-base font-medium text-[#111827]">Application Summary</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5">
                <p className="text-xs font-normal text-[#6B7280]">
                  Applicant
                </p>
                <p className="mt-1 font-medium text-[#111827]">
                  {application.applicant_name || 'Applicant'}
                </p>
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5">
                <p className="text-xs font-normal text-[#6B7280]">
                  Property &amp; Listing
                </p>
                <p className="mt-1 font-medium text-[#111827] truncate">{propertyTitle}</p>
                {application.listing_title &&
                  application.listing_title !== application.property_title && (
                    <p className="text-xs text-[#6B7280] truncate">{application.listing_title}</p>
                  )}
              </div>

              {rentText && (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5">
                  <p className="text-xs font-normal text-[#6B7280]">
                    Monthly Rent
                  </p>
                  <p className="mt-1 font-medium text-[#111827]">{rentText}/mo</p>
                </div>
              )}

              {depositText && (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5">
                  <p className="text-xs font-normal text-[#6B7280]">
                    Security Deposit
                  </p>
                  <p className="mt-1 font-medium text-[#111827]">{depositText}</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-normal text-[#6B7280]">
                Applicant Message
              </h3>
              {application.message ? (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm text-[#111827] whitespace-pre-wrap leading-relaxed">
                  {application.message}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-[#6B7280] italic">
                  No message was included with this application.
                </p>
              )}
            </div>
          </section>

          {/* Review Actions */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
            <h2 className="text-base font-medium text-[#111827]">Application Review</h2>

            {canReview ? (
              <>
                <p className="text-xs sm:text-sm text-[#4B5563]">
                  Update the review status for this application. Approving or rejecting notifies the tenant immediately.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {application.status === 'submitted' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => setReviewStatusTarget('under_review')}
                    >
                      Mark Under Review
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => setReviewStatusTarget('approved')}
                  >
                    Approve Application
                  </Button>

                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    onClick={() => setReviewStatusTarget('rejected')}
                  >
                    Reject Application
                  </Button>
                </div>
              </>
            ) : application.status === 'approved' ? (
              <div className="space-y-4">
                <Alert variant="success">
                  {application.tenancy_id
                    ? 'This application has been approved and converted into a tenancy agreement.'
                    : 'This application has been approved. Create a tenancy agreement to record dates, rent terms, and track move-in.'}
                </Alert>

                <div className="flex flex-wrap items-center gap-3">
                  {application.tenancy_id ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() =>
                        navigate(`/app/owner/tenancies/${application.tenancy_id}`)
                      }
                    >
                      View Tenancy
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => setCreateTenancyOpen(true)}
                    >
                      Create Tenancy
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Alert
                variant={application.status === 'rejected' ? 'error' : 'info'}
              >
                {application.status === 'rejected'
                  ? 'This application has been rejected. No further review transitions are allowed.'
                  : 'This application was withdrawn by the applicant and cannot be reviewed.'}
              </Alert>
            )}
          </section>
        </div>

        {/* Right Column: Status History Timeline */}
        <aside className="lg:col-span-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
          <h2 className="text-base font-medium text-[#111827]">Status History</h2>

          {application.status_history && application.status_history.length > 0 ? (
            <ol className="space-y-4 border-l-2 border-[#DCE8E2] pl-4 ml-1.5">
              {application.status_history.map((entry) => {
                const entryMeta = getApplicationStatusMeta(entry.new_status)
                return (
                  <li key={entry.id} className="relative space-y-1">
                    <span
                      className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-[#408A71] ring-4 ring-white"
                      aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={entryMeta.variant} size="sm">
                        {entryMeta.label}
                      </Badge>
                      <span className="text-[11px] text-[#6B7280]">
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>
                    {entry.changed_by_name && (
                      <p className="text-xs text-[#4B5563]">By {entry.changed_by_name}</p>
                    )}
                    {entry.change_reason && (
                      <p className="text-xs text-[#374151] bg-[#F9FAFB] rounded-lg px-2.5 py-1.5 border border-[#F3F4F6]">
                        {entry.change_reason}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-xs sm:text-sm text-[#6B7280]">
              No status history entries recorded yet.
            </p>
          )}
        </aside>
      </div>

      {/* Confirmation Modal */}
      <ApplicationReviewModal
        key={`${application.id}-${reviewStatusTarget ?? 'none'}`}
        open={Boolean(reviewStatusTarget)}
        application={application}
        targetStatus={reviewStatusTarget}
        onClose={() => setReviewStatusTarget(null)}
      />

      {/* Create Tenancy Modal */}
      <CreateTenancyModal
        key={`create-tenancy-${application.id}-${createTenancyOpen ? 'open' : 'closed'}`}
        open={createTenancyOpen}
        application={application}
        listing={matchedListing}
        onClose={() => setCreateTenancyOpen(false)}
        onCreated={(tenancyId) => navigate(`/app/owner/tenancies/${tenancyId}`)}
      />
    </div>
  )
}

export default OwnerApplicationDetailPage

