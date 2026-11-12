import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDocuments, useTenancyDetail } from '../../hooks/useTenantWorkspace'
import documentService from '../../services/document.service'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Skeleton,
  useToast,
} from '../../components/ui'
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
  getTenancyStatusMeta,
} from '../../utils/tenancy'
import type { DocumentItem } from '../../types/document'

/**
 * TenantTenancyDetailPage
 * Compact Tenant Tenancy Detail view at `/app/tenant/tenancy/:tenancyId`,
 * matching the Owner Tenancy Detail layout.
 */
export const TenantTenancyDetailPage: React.FC = () => {
  const { tenancyId } = useParams<{ tenancyId: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  const {
    data: detailResponse,
    isLoading,
    isError,
    refetch,
  } = useTenancyDetail(tenancyId)

  const tenancy = detailResponse?.data

  const {
    data: documentsData,
    isLoading: documentsLoading,
    isError: documentsError,
  } = useDocuments({ page: 1, page_size: 100 })

  const { rentalAgreements, otherTenancyDocuments } = useMemo(() => {
    if (!tenancy) {
      return {
        rentalAgreements: [] as DocumentItem[],
        otherTenancyDocuments: [] as DocumentItem[],
      }
    }
    const allDocs = documentsData?.results ?? []
    const linked = allDocs.filter((doc) => doc.tenancy === tenancy.id)
    return {
      rentalAgreements: linked.filter((doc) => doc.document_type === 'rental_agreement'),
      otherTenancyDocuments: linked.filter((doc) => doc.document_type !== 'rental_agreement'),
    }
  }, [documentsData, tenancy])

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

  if (isLoading) {
    return (
      <div className="space-y-4 pb-10">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Skeleton className="lg:col-span-7 h-64 rounded-xl" />
          <Skeleton className="lg:col-span-5 h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !tenancy) {
    return (
      <div className="space-y-4 pb-10">
        <Link
          to="/app/tenant/tenancy"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#408A71] hover:text-[#34745C]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to My Tenancy</span>
        </Link>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8">
          <EmptyState
            size="md"
            title="Tenancy not found"
            description="We could not load this tenancy record."
            action={
              <div className="flex items-center gap-2.5">
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Retry
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/app/tenant/tenancy')}>
                  Back to My Tenancy
                </Button>
              </div>
            }
          />
        </div>
      </div>
    )
  }

  const statusMeta = getTenancyStatusMeta(tenancy.status)
  const durationLabel = calculateContractDurationLabel(tenancy.start_date, tenancy.end_date)
  const progress =
    tenancy.status === 'active' || tenancy.status === 'confirmed'
      ? calculateTenancyProgress(tenancy.start_date, tenancy.end_date)
      : null

  return (
    <div className="space-y-4 pb-10">
      {/* 1. Breadcrumb & ID */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/tenant/tenancy"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#408A71] hover:text-[#34745C]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to My Tenancy</span>
        </Link>
      </div>

      {/* 2. Compact Top Overview Header with Property Photo */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch">
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
                  onClick={() => navigate('/app/tenant/documents')}
                >
                  All Documents
                </Button>
                {tenancy.application_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/app/tenant/applications/${tenancy.application_id}`)
                    }
                  >
                    Source Application
                  </Button>
                )}
              </div>
            </div>

            {progress && (
              <div className="pt-2 border-t border-[#F3F4F6] space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-normal text-[#6B7280]">Agreement Progress</span>
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
        {/* Left Column: Rental Terms & Tenancy Documents */}
        <div className="lg:col-span-7 space-y-4">
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

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-[#111827]">Rental Agreement &amp; Documents</h2>
              <Link
                to="/app/tenant/documents"
                className="text-xs font-medium text-[#408A71] hover:text-[#34745C]"
              >
                Documents →
              </Link>
            </div>

            {documentsError && (
              <Alert variant="error">Unable to load tenancy documents right now.</Alert>
            )}

            {documentsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : rentalAgreements.length > 0 || otherTenancyDocuments.length > 0 ? (
              <div className="space-y-2">
                {rentalAgreements.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-lg border border-[#CBE7DC] bg-[#F4FAF7] px-3 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <Badge variant="success" size="sm">
                        Rental Agreement
                      </Badge>
                      <p className="mt-1 text-xs font-medium text-[#111827] truncate">
                        {doc.title || doc.original_filename}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">
                        {formatFileSize(doc.file_size_bytes)} · Uploaded {formatDate(doc.created_at)}
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
                    className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#111827] truncate">
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
              <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-3.5 text-center">
                <p className="text-xs font-medium text-[#111827]">No rental agreement uploaded yet</p>
                <p className="mt-0.5 text-[11px] text-[#6B7280]">
                  Once a rental agreement document is attached, you can download it here.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Status & Milestones */}
        <aside className="lg:col-span-5 space-y-4">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-[#111827]">Tenancy Status</h2>
              <Badge variant={statusMeta.variant} size="sm" dot>
                {statusMeta.label}
              </Badge>
            </div>
            <p className="text-xs text-[#4B5563]">{statusMeta.description}</p>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
            <h2 className="text-sm font-medium text-[#111827]">Tenancy Dates &amp; Milestones</h2>

            <dl className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F3F4F6]">
                <dt className="font-normal text-[#6B7280]">Created</dt>
                <dd className="font-medium text-[#111827]">{formatDateTime(tenancy.created_at)}</dd>
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
                <dd className="font-medium text-[#111827]">{formatDateTime(tenancy.updated_at)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default TenantTenancyDetailPage
