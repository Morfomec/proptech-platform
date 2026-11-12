import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOwnerTenancyDetail } from '../../hooks/useOwnerTenancies'
import { useDocuments } from '../../hooks/useTenantWorkspace'
import documentService from '../../services/document.service'
import {
  Alert,
  Badge,
  Button,
  Skeleton,
  useToast,
} from '../../components/ui'
import {
  TenancyLifecycleModal,
  type OwnerTenancyAction,
} from '../../components/owner/TenancyLifecycleModal'
import { DocumentUploadModal } from '../../components/tenant/DocumentUploadModal'
import { DocumentPreviewModal } from '../../components/tenant/DocumentPreviewModal'
import {
  extractApiErrorMessage,
  formatDate,
  formatDateTime,
  formatINR,
} from '../../utils/application'
import { getMediaUrl } from '../../utils/imageUrl'
import {
  calculateContractDurationLabel,
  calculateTenancyProgress,
  DOCUMENT_TYPE_LABELS,
  formatFileSize,
  getOwnerTenancyStatusMeta,
} from '../../utils/tenancy'
import { formatMimeTypeLabel, isPreviewableDocument } from '../../utils/document'
import type { DocumentItem } from '../../types/document'

/**
 * OwnerTenancyDetailPage
 * Complete owner management view for a single tenancy at `/app/owner/tenancies/:tenancyId`:
 * Overview, Rental Terms, Lifecycle Transitions (Confirm / Activate / Checkout / Cancel),
 * Tenancy Documents (list, preview, download, upload), and Lifecycle Dates.
 */
export const OwnerTenancyDetailPage: React.FC = () => {
  const { tenancyId } = useParams<{ tenancyId: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [lifecycleAction, setLifecycleAction] = useState<OwnerTenancyAction | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  const {
    data: tenancyResponse,
    isLoading,
    isError,
    refetch,
  } = useOwnerTenancyDetail(tenancyId)

  const {
    data: documentsData,
    isLoading: isLoadingDocs,
    isError: isErrorDocs,
    refetch: refetchDocs,
  } = useDocuments({ page: 1, page_size: 100 })

  const tenancy = tenancyResponse?.data

  const tenancyDocuments = useMemo(() => {
    if (!tenancy) return []
    return (documentsData?.results ?? []).filter((doc) => doc.tenancy === tenancy.id)
  }, [documentsData, tenancy])

  const hasMoreDocsThanPage = (documentsData?.count ?? 0) > 100

  const handleDownloadDocument = async (doc: DocumentItem) => {
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

  const handleOpenPreview = async (doc: DocumentItem) => {
    setPreviewDoc(doc)
    setPreviewUrl(null)
    setPreviewMimeType(doc.mime_type)
    setPreviewError(null)
    setIsPreviewLoading(true)

    try {
      const result = await documentService.fetchDocumentBlob(
        doc.id,
        doc.original_filename,
        doc.mime_type
      )
      const url = URL.createObjectURL(result.blob)
      setPreviewUrl(url)
      setPreviewMimeType(result.mimeType)
    } catch (err: unknown) {
      setPreviewError(
        extractApiErrorMessage(err, 'Unable to load preview for this document.')
      )
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewDoc(null)
    setPreviewUrl(null)
    setPreviewError(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !tenancy) {
    return (
      <div className="space-y-6 pb-10">
        <Alert variant="error" title="Tenancy unavailable">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span>
              We couldn&apos;t load this tenancy. It may not exist or you do not own the associated property.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/app/owner/tenancies')}
              >
                Back to Tenancies
              </Button>
            </div>
          </div>
        </Alert>
      </div>
    )
  }

  const statusMeta = getOwnerTenancyStatusMeta(tenancy.status)
  const durationLabel = calculateContractDurationLabel(tenancy.start_date, tenancy.end_date)
  const progress =
    tenancy.status === 'active'
      ? calculateTenancyProgress(tenancy.start_date, tenancy.end_date)
      : null

  const canActivate = tenancy.status === 'confirmed'
  const canCancel = tenancy.status === 'pending' || tenancy.status === 'confirmed'
  const canEnd = tenancy.status === 'active'
  const hasLifecycleActions = canActivate || canCancel || canEnd

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Back Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/owner/tenancies"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#408A71] hover:text-[#336E5A] transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Tenancies</span>
        </Link>
      </div>

      {/* 2. Compact Top Overview Header with Property Photo */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch">
          {/* Property Photo */}
          <div className="w-full sm:w-44 h-32 sm:h-auto sm:min-h-[108px] shrink-0 rounded-lg overflow-hidden border border-[#E5E7EB] bg-[#F4FAF7] flex flex-col items-center justify-center text-center">
            {tenancy.property_image_url ? (
              <img
                src={getMediaUrl(tenancy.property_image_url)}
                alt={tenancy.property_title || 'Property'}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="p-3 flex flex-col items-center text-[#408A71]">
                <svg className="w-6 h-6 opacity-75 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span className="text-[11px] font-medium">No photo</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-medium tracking-tight text-[#111827] mb-0 truncate">
                    {tenancy.property_title || 'Property Tenancy'}
                  </h1>
                  <Badge variant={statusMeta.variant} size="sm" dot>
                    {statusMeta.label}
                  </Badge>
                </div>
                {tenancy.property_address && (
                  <p className="text-xs font-normal text-[#6B7280] truncate">
                    {tenancy.property_address}
                  </p>
                )}
                <p className="text-xs font-normal text-[#4B5563]">{statusMeta.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/app/owner/properties/${tenancy.property_id}`)}
                >
                  View Property
                </Button>
                {tenancy.application_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/app/owner/applications/${tenancy.application_id}`)
                    }
                  >
                    Source Application
                  </Button>
                )}
              </div>
            </div>

            {/* Active Tenancy Timeline Progress (when end date is set) */}
            {progress && (
              <div className="pt-2 border-t border-[#F3F4F6] space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-normal text-[#6B7280]">Term Elapsed</span>
                  <span className="font-medium text-[#111827] tabular-nums">
                    {progress.percent}% ({progress.daysRemaining}{' '}
                    {progress.daysRemaining === 1 ? 'day' : 'days'} remaining)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#408A71] transition-all"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Rental Terms, Lifecycle Actions, Documents */}
        <div className="lg:col-span-7 space-y-4">
          {/* B. Rental Terms */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
            <h2 className="text-sm font-medium text-[#111827]">Rental Terms</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[11px] font-normal text-[#6B7280]">Monthly Rent</p>
                <p className="mt-0.5 text-sm font-medium text-[#111827] tabular-nums">
                  {formatINR(tenancy.monthly_rent)}/mo
                </p>
              </div>

              <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[11px] font-normal text-[#6B7280]">Security Deposit</p>
                <p className="mt-0.5 text-sm font-medium text-[#111827] tabular-nums">
                  {formatINR(tenancy.security_deposit)}
                </p>
              </div>

              <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[11px] font-normal text-[#6B7280]">Start Date</p>
                <p className="mt-0.5 font-medium text-[#111827]">
                  {formatDate(tenancy.start_date)}
                </p>
              </div>

              <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[11px] font-normal text-[#6B7280]">End Date</p>
                <p className="mt-0.5 font-medium text-[#111827]">
                  {tenancy.end_date ? formatDate(tenancy.end_date) : 'Open-ended'}
                </p>
              </div>

              <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[11px] font-normal text-[#6B7280]">Contract Duration</p>
                <p className="mt-0.5 font-medium text-[#111827]">{durationLabel}</p>
              </div>

              <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[11px] font-normal text-[#6B7280]">Rent Due Day</p>
                <p className="mt-0.5 font-medium text-[#111827]">
                  {tenancy.rent_due_day ? `Day ${tenancy.rent_due_day} of month` : '—'}
                </p>
              </div>
            </div>

            {tenancy.notes && (
              <div className="rounded-lg border border-[#DCE8E2] bg-[#F4FAF7] px-3 py-2.5">
                <h3 className="text-[11px] font-medium text-[#1A382A] mb-0.5">Agreement Notes</h3>
                <p className="text-xs text-[#374151] whitespace-pre-wrap leading-relaxed">
                  {tenancy.notes}
                </p>
              </div>
            )}
          </section>

          {/* C. Tenancy Documents */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-[#111827]">
                Tenancy Documents
              </h2>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUploadModalOpen(true)}
              >
                Upload Document
              </Button>
            </div>

            {hasMoreDocsThanPage && (
              <Alert variant="warning">
                Showing documents matched within your most recent 100 accessible documents because server-side tenancy document filtering is not yet supported by the API.
              </Alert>
            )}

            {isLoadingDocs ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : isErrorDocs ? (
              <Alert variant="error" title="Could not load tenancy documents">
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>We were unable to retrieve documents for this tenancy.</span>
                  <Button variant="outline" size="sm" onClick={() => void refetchDocs()}>
                    Retry
                  </Button>
                </div>
              </Alert>
            ) : tenancyDocuments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-3.5 text-center">
                <p className="text-xs font-medium text-[#111827]">No tenancy documents yet</p>
                <p className="mt-0.5 text-[11px] text-[#6B7280]">
                  Upload a signed rental agreement or inspection document to share securely with the tenant.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F3F4F6] rounded-xl border border-[#E5E7EB]">
                {tenancyDocuments.map((doc) => {
                  const previewable = isPreviewableDocument(doc.mime_type, doc.original_filename)
                  const typeLabel =
                    DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type
                  const isDownloading = downloadingDocId === doc.id

                  return (
                    <li
                      key={doc.id}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[#111827] truncate">
                            {doc.title || doc.original_filename}
                          </p>
                          <Badge variant="neutral" size="sm">
                            {typeLabel}
                          </Badge>
                        </div>
                        <p className="text-xs font-normal text-[#6B7280] truncate">
                          {formatMimeTypeLabel(doc.mime_type, doc.original_filename)} ·{' '}
                          {formatFileSize(doc.file_size_bytes)} · Uploaded{' '}
                          {formatDate(doc.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {previewable && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleOpenPreview(doc)}
                          >
                            Preview
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={isDownloading}
                          loadingText="Downloading..."
                          onClick={() => void handleDownloadDocument(doc)}
                        >
                          Download
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column: Tenant Info, Lifecycle Dates & Actions */}
        <aside className="lg:col-span-5 space-y-4">
          {/* Tenant Summary */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
            <h2 className="text-sm font-medium text-[#111827]">Tenant Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[11px] font-normal text-[#6B7280]">Tenant Name</p>
                <p className="mt-0.5 font-medium text-[#111827] truncate">
                  {tenancy.tenant_name || 'Tenant'}
                </p>
              </div>

              {tenancy.tenant_email && (
                <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] px-3 py-2">
                  <p className="text-[11px] font-normal text-[#6B7280]">Tenant Email</p>
                  <p className="mt-0.5 font-medium text-[#111827] truncate" title={tenancy.tenant_email}>
                    {tenancy.tenant_email}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* E. Lifecycle Milestones & History */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
            <h2 className="text-sm font-medium text-[#111827]">
              Tenancy Dates &amp; Milestones
            </h2>

            <dl className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F3F4F6]">
                <dt className="font-normal text-[#6B7280]">Created</dt>
                <dd className="font-medium text-[#111827]">
                  {formatDateTime(tenancy.created_at)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F3F4F6]">
                <dt className="font-normal text-[#6B7280]">Actual Move-In Date</dt>
                <dd className="font-medium text-[#111827]">
                  {tenancy.actual_move_in_date
                    ? formatDate(tenancy.actual_move_in_date)
                    : 'Not yet recorded'}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F3F4F6]">
                <dt className="font-normal text-[#6B7280]">Actual Move-Out Date</dt>
                <dd className="font-medium text-[#111827]">
                  {tenancy.actual_move_out_date
                    ? formatDate(tenancy.actual_move_out_date)
                    : 'Not yet recorded'}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3 py-1.5">
                <dt className="font-normal text-[#6B7280]">Last Updated</dt>
                <dd className="font-medium text-[#111827]">
                  {formatDateTime(tenancy.updated_at)}
                </dd>
              </div>
            </dl>
          </section>

          {/* F. Tenancy Lifecycle Actions */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
            <h2 className="text-sm font-medium text-[#111827]">Lifecycle Actions</h2>

            {hasLifecycleActions ? (
              <>
                <p className="text-xs text-[#4B5563]">
                  Update the tenancy stage below. Every status change updates property availability and notifies the tenant.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {canActivate && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setLifecycleAction('activate')}
                    >
                      Activate Tenancy (Move-In)
                    </Button>
                  )}

                  {canEnd && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setLifecycleAction('end')}
                    >
                      Checkout / End Tenancy
                    </Button>
                  )}

                  {canCancel && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => setLifecycleAction('cancel')}
                    >
                      Cancel Tenancy
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <Alert variant={tenancy.status === 'cancelled' ? 'error' : 'info'}>
                {tenancy.status === 'ended'
                  ? 'This tenancy has been completed and checked out. No further lifecycle transitions are available.'
                  : 'This tenancy was cancelled prior to activation. No further lifecycle transitions are available.'}
              </Alert>
            )}
          </section>
        </aside>
      </div>

      {/* Modals */}
      <TenancyLifecycleModal
        key={`${tenancy.id}-${lifecycleAction ?? 'none'}`}
        open={Boolean(lifecycleAction)}
        tenancy={tenancy}
        action={lifecycleAction}
        onClose={() => setLifecycleAction(null)}
      />

      <DocumentUploadModal
        key={`owner-tenancy-upload-${tenancy.id}-${uploadModalOpen ? 'open' : 'closed'}`}
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        tenancyId={tenancy.id}
        defaultDocumentType="rental_agreement"
        allowTypeSelection
      />

      <DocumentPreviewModal
        document={previewDoc}
        previewUrl={previewUrl}
        mimeType={previewMimeType}
        isLoading={isPreviewLoading}
        error={previewError}
        onClose={handleClosePreview}
        onDownload={(doc) => void handleDownloadDocument(doc)}
        isDownloading={Boolean(previewDoc && downloadingDocId === previewDoc.id)}
      />
    </div>
  )
}

export default OwnerTenancyDetailPage
