import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOwnerTenancyDetail } from '../../hooks/useOwnerTenancies'
import { useDocuments } from '../../hooks/useTenantWorkspace'
import documentService from '../../services/document.service'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Skeleton,
  useToast,
  type BadgeVariant,
} from '../../components/ui'
import {
  useOwnerPayments,
  useOwnerRentCharges,
  useOwnerRentSummary,
  useOwnerSecurityDeposits,
} from '../../hooks/useOwnerRent'
import { RecordPaymentModal } from '../../components/owner/RecordPaymentModal'
import { PaymentDetailModal } from '../../components/owner/PaymentDetailModal'
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
  DOCUMENT_TYPE_LABELS,
  formatFileSize,
  getOwnerTenancyStatusMeta,
} from '../../utils/tenancy'
import { isPreviewableDocument } from '../../utils/document'
import type { DocumentItem } from '../../types/document'

/**
 * OwnerTenancyDetailPage
 * Complete owner management view for a single tenancy at `/app/owner/tenancies/:tenancyId`.
 * Standardized with the PropTech design system: #408A71 green, light font-medium typography,
 * #E5E7EB borders, and a balanced max-w-[1200px] layout.
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

  // Financial Activity state
  const [activeLedgerTab, setActiveLedgerTab] = useState<'charges' | 'payments' | 'deposit' | 'documents'>('charges')
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
  const [recordInitialAmount, setRecordInitialAmount] = useState<string | undefined>()
  const [recordInitialChargeType, setRecordInitialChargeType] = useState<'rent' | 'security_deposit'>('rent')
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)

  const {
    data: tenancyResponse,
    isLoading,
    isError,
    refetch,
  } = useOwnerTenancyDetail(tenancyId)

  // Scoped Rent Summary, Charges, Payments & Security Deposits for this tenancy
  const { data: rentSummary } = useOwnerRentSummary(
    tenancyId ? { tenancy_id: tenancyId } : undefined
  )
  const { data: rentChargesData, isLoading: isLoadingCharges } = useOwnerRentCharges(
    tenancyId ? { tenancy_id: tenancyId, page: 1, page_size: 50, charge_type: 'rent' } : undefined
  )
  const { data: tenancyPaymentsData, isLoading: isLoadingPayments } = useOwnerPayments(
    tenancyId ? { tenancy_id: tenancyId, page: 1, page_size: 50 } : undefined
  )
  const { data: tenancyDeposits = [], isLoading: isLoadingDeposits } = useOwnerSecurityDeposits(
    tenancyId ? { tenancy_id: tenancyId } : undefined
  )

  const tenancyCharges = useMemo(() => rentChargesData?.results ?? [], [rentChargesData])
  const tenancyPayments = useMemo(() => tenancyPaymentsData?.results ?? [], [tenancyPaymentsData])
  const depositRecord = tenancyDeposits[0]

  const rentOverdueNum = parseFloat(rentSummary?.overdue_rent || '0')
  const rentOutstandingNum = parseFloat(rentSummary?.outstanding_rent || '0')

  const rentStatusMeta = useMemo(() => {
    if (rentOverdueNum > 0) {
      return { label: 'Overdue', variant: 'danger' as BadgeVariant }
    }
    if (rentOutstandingNum > 0) {
      return { label: 'Pending', variant: 'warning' as BadgeVariant }
    }
    return { label: 'Up to Date', variant: 'success' as BadgeVariant }
  }, [rentOverdueNum, rentOutstandingNum])

  const depositReceivedAmount =
    depositRecord?.deposit_received || rentSummary?.total_deposits_received || '0.00'
  const depositPendingAmount =
    depositRecord?.outstanding_deposit ||
    rentSummary?.pending_deposit_collection ||
    rentSummary?.total_deposits_outstanding ||
    '0.00'
  const depositPendingNum = parseFloat(depositPendingAmount || '0')

  const handleOpenRecordPayment = (
    initialAmount?: string,
    chargeType: 'rent' | 'security_deposit' = 'rent'
  ) => {
    setRecordInitialAmount(initialAmount)
    setRecordInitialChargeType(chargeType)
    setIsRecordPaymentOpen(true)
  }

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
      <div className="max-w-[1200px] mx-auto space-y-5 pb-10">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-96 w-full rounded-xl" />
          <Skeleton className="lg:col-span-1 h-96 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !tenancy) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-5 pb-10">
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

  const canActivate = tenancy.status === 'confirmed'
  const canCancel = tenancy.status === 'pending' || tenancy.status === 'confirmed'
  const canEnd = tenancy.status === 'active'

  const showOverdueBanner = rentOutstandingNum > 0

  return (
    <div className="max-w-[1200px] mx-auto space-y-5 pb-10">
      {/* 1. Breadcrumb: "Tenancies / {Property Name}" */}
      <nav aria-label="Breadcrumb" className="text-xs sm:text-sm font-normal text-[#6B7280] flex items-center gap-1.5">
        <Link
          to="/app/owner/tenancies"
          className="hover:text-[#408A71] transition-colors"
        >
          Tenancies
        </Link>
        <span className="text-[#9CA3AF]">/</span>
        <span className="text-[#111827] font-medium">{tenancy.property_title || 'Tenancy Detail'}</span>
      </nav>

      {/* 2. Header card (single card, flex row, wraps on small screens) */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* Property Thumbnail (88x88, rounded 12px) */}
          <div className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-lg shrink-0 overflow-hidden border border-[#E5E7EB] bg-[#F4FAF7] flex items-center justify-center">
            {tenancy.property_image_url ? (
              <img
                src={getMediaUrl(tenancy.property_image_url)}
                alt={tenancy.property_title || 'Property'}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="flex flex-col items-center text-[#408A71]">
                <svg className="w-6 h-6 opacity-75 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span className="text-[10px] font-medium">No photo</span>
              </div>
            )}
          </div>

          {/* Middle: property name + status pill, address, tenant info */}
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0 leading-tight">
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
            <p className="text-xs sm:text-sm text-[#6B7280]">
              Tenant: <span className="font-medium text-[#111827]">{tenancy.tenant_name || 'Tenant'}</span>
              {tenancy.tenant_email ? ` · ${tenancy.tenant_email}` : ''}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(`/app/owner/properties/${tenancy.property_id}`, {
                state: {
                  from: `/app/owner/tenancies/${tenancy.id}`,
                  fromLabel: 'Tenancies',
                },
              })
            }
          >
            View property
          </Button>
          {tenancy.application_id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                navigate(`/app/owner/applications/${tenancy.application_id}`, {
                  state: {
                    from: `/app/owner/tenancies/${tenancy.id}`,
                    fromLabel: 'Tenancies',
                  },
                })
              }
            >
              Source application
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleOpenRecordPayment()}
          >
            Record payment
          </Button>
        </div>
      </div>

      {/* 3. Overdue alert banner (only render when rent outstanding > 0) */}
      {showOverdueBanner && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-rose-800 leading-relaxed font-normal">
            <span className="font-medium text-rose-900">{formatINR(rentSummary?.outstanding_rent)} rent is overdue.</span>
            {tenancy.rent_due_day ? ` Rent was due on day ${tenancy.rent_due_day} of the month.` : ''}
            {depositPendingNum > 0 ? ` Deposit of ${formatINR(depositPendingAmount)} is also still pending.` : ''}
          </p>
          <button
            type="button"
            onClick={() => handleOpenRecordPayment(rentSummary?.outstanding_rent, 'rent')}
            className="px-3.5 py-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs sm:text-sm font-medium hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
          >
            Record payment
          </button>
        </div>
      )}

      {/* 4. Summary strip: ONE card containing 4 equal columns separated by thin dividers */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB]">
        {/* Col 1: Monthly rent */}
        <div className="px-0 sm:px-4 first:pl-0 last:pr-0 py-3 sm:py-0 space-y-1">
          <span className="text-xs font-normal text-[#6B7280]">Monthly rent</span>
          <p className="text-xl font-medium text-[#111827] tabular-nums">
            {formatINR(tenancy.monthly_rent)}
          </p>
          <p className="text-xs font-normal text-[#6B7280]">
            {tenancy.rent_due_day ? `Due day ${tenancy.rent_due_day} of every month` : 'Monthly schedule'}
          </p>
        </div>

        {/* Col 2: Rent outstanding */}
        <div className="px-0 sm:px-4 first:pl-0 last:pr-0 py-3 sm:py-0 space-y-1">
          <span className="text-xs font-normal text-[#6B7280]">Rent outstanding</span>
          <p className={`text-xl font-medium tabular-nums ${rentOutstandingNum > 0 ? 'text-rose-600' : 'text-[#111827]'}`}>
            {formatINR(rentSummary?.outstanding_rent) ?? '₹0.00'}
          </p>
          <p className={`text-xs font-medium ${rentOverdueNum > 0 ? 'text-rose-600' : rentOutstandingNum > 0 ? 'text-amber-700' : 'text-[#408A71]'}`}>
            {rentStatusMeta.label}
          </p>
        </div>

        {/* Col 3: Deposit received */}
        <div className="px-0 sm:px-4 first:pl-0 last:pr-0 py-3 sm:py-0 space-y-1">
          <span className="text-xs font-normal text-[#6B7280]">Deposit received</span>
          <p className="text-xl font-medium text-[#111827] tabular-nums">
            {formatINR(depositReceivedAmount)} of {formatINR(tenancy.security_deposit)}
          </p>
          <p className={`text-xs font-medium ${depositPendingNum > 0 ? 'text-amber-700' : 'text-[#408A71]'}`}>
            {depositPendingNum > 0 ? `${formatINR(depositPendingAmount)} pending` : 'Fully paid'}
          </p>
        </div>

        {/* Col 4: Tenancy start date */}
        <div className="px-0 sm:px-4 first:pl-0 last:pr-0 py-3 sm:py-0 space-y-1">
          <span className="text-xs font-normal text-[#6B7280]">Tenancy</span>
          <p className="text-xl font-medium text-[#111827]">
            {formatDate(tenancy.start_date)}
          </p>
          <p className="text-xs font-normal text-[#6B7280]">
            {tenancy.end_date ? `Until ${formatDate(tenancy.end_date)}` : 'Open-ended, no fixed end date'}
          </p>
        </div>
      </div>

      {/* 5. Two-column grid below: left 2fr, right 1fr (min 280px), gap 20px */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* LEFT (2fr): "Financial activity" card */}
        <section className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
          <div>
            <h2 className="text-base font-medium text-[#111827]">Financial activity</h2>
            <p className="text-xs font-normal text-[#6B7280] mt-0.5">
              Rent charges, payments and the security deposit for this tenancy.
            </p>
          </div>

          {/* Underline-style tabs */}
          <div className="border-b border-[#E5E7EB] flex items-center space-x-6 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setActiveLedgerTab('charges')}
              className={`pb-2.5 border-b-2 font-medium transition-colors cursor-pointer ${
                activeLedgerTab === 'charges'
                  ? 'border-[#408A71] text-[#408A71]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300 font-normal'
              }`}
            >
              Rent charges ({tenancyCharges.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveLedgerTab('payments')}
              className={`pb-2.5 border-b-2 font-medium transition-colors cursor-pointer ${
                activeLedgerTab === 'payments'
                  ? 'border-[#408A71] text-[#408A71]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300 font-normal'
              }`}
            >
              Payments
            </button>

            <button
              type="button"
              onClick={() => setActiveLedgerTab('deposit')}
              className={`pb-2.5 border-b-2 font-medium transition-colors cursor-pointer ${
                activeLedgerTab === 'deposit'
                  ? 'border-[#408A71] text-[#408A71]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300 font-normal'
              }`}
            >
              Security deposit
            </button>

            <button
              type="button"
              onClick={() => setActiveLedgerTab('documents')}
              className={`pb-2.5 border-b-2 font-medium transition-colors cursor-pointer ${
                activeLedgerTab === 'documents'
                  ? 'border-[#408A71] text-[#408A71]'
                  : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300 font-normal'
              }`}
            >
              Documents{tenancyDocuments.length > 0 ? ` (${tenancyDocuments.length})` : ''}
            </button>
          </div>

          {/* Tab 1: Rent Charges */}
          {activeLedgerTab === 'charges' && (
            <div>
              {isLoadingCharges ? (
                <div className="p-4 space-y-2.5">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : tenancyCharges.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No rent charges yet"
                    description="This tenancy does not have active rent charges recorded yet."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                    <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                      <tr>
                        <th className="py-2.5 px-3 text-center font-normal w-12">S.No.</th>
                        <th className="py-2.5 px-3.5 font-normal">Billing Period</th>
                        <th className="py-2.5 px-3.5 font-normal">Due Date</th>
                        <th className="py-2.5 px-3.5 font-normal text-right">Billed Amount</th>
                        <th className="py-2.5 px-3.5 font-normal text-right">Paid Amount</th>
                        <th className="py-2.5 px-3.5 font-normal text-right">Outstanding Balance</th>
                        <th className="py-2.5 px-3.5 font-normal text-center">Status</th>
                        <th className="py-2.5 px-3.5 font-normal text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                      {tenancyCharges.map((chg, idx) => {
                        const hasOutstanding = parseFloat(chg.outstanding_amount || '0') > 0
                        return (
                          <tr key={chg.id} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                            <td className="py-2.5 px-3 text-center text-[#6B7280] tabular-nums font-normal">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#6B7280]">
                              {formatDate(chg.billing_period_start)} – {formatDate(chg.billing_period_end)}
                            </td>
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              <span className={chg.is_overdue ? 'text-rose-600 font-medium' : 'text-[#4B5563]'}>
                                {formatDate(chg.due_date)}
                              </span>
                              {chg.is_overdue && (
                                <div className="mt-0.5">
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                    Overdue
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-medium tabular-nums">
                              {formatINR(chg.amount)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-medium tabular-nums text-emerald-700">
                              {formatINR(chg.paid_amount)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-medium tabular-nums">
                              <span className={hasOutstanding ? 'text-amber-700 font-medium' : 'text-[#6B7280]'}>
                                {formatINR(chg.outstanding_amount)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-center">
                              <Badge
                                variant={
                                  chg.status === 'paid'
                                    ? 'success'
                                    : chg.status === 'partially_paid'
                                    ? 'warning'
                                    : 'neutral'
                                }
                                size="sm"
                                dot={chg.is_overdue}
                              >
                                {chg.status.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3.5 text-right pr-4 whitespace-nowrap">
                              {hasOutstanding ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenRecordPayment(
                                      chg.outstanding_amount,
                                      chg.charge_type === 'security_deposit' ? 'security_deposit' : 'rent'
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[#408A71] text-[#408A71] hover:bg-[#ECF5F2] transition-colors cursor-pointer"
                                >
                                  Record Payment
                                </button>
                              ) : (
                                <span className="text-xs text-[#9CA3AF] italic">Paid</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Payments */}
          {activeLedgerTab === 'payments' && (
            <div>
              {isLoadingPayments ? (
                <div className="p-4 space-y-2.5">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : tenancyPayments.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No payments recorded"
                    description="No payment receipts recorded for this tenancy yet."
                    action={{
                      label: 'Record First Payment',
                      onClick: () => handleOpenRecordPayment(),
                    }}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                    <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                      <tr>
                        <th className="py-2.5 px-3 text-center font-normal w-12">S.No.</th>
                        <th className="py-2.5 px-3.5 font-normal">Payment Date</th>
                        <th className="py-2.5 px-3.5 font-normal text-right">Amount &amp; Credit</th>
                        <th className="py-2.5 px-3.5 font-normal">Method</th>
                        <th className="py-2.5 px-3.5 font-normal">Reference</th>
                        <th className="py-2.5 px-3.5 font-normal text-center">Status</th>
                        <th className="py-2.5 px-3.5 font-normal text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                      {tenancyPayments.map((pmt, idx) => {
                        const totalAllocated = (pmt.allocations ?? []).reduce(
                          (acc, a) => acc + parseFloat(a.allocated_amount || '0'),
                          0
                        )
                        const advanceCredit = Math.max(0, parseFloat(pmt.amount || '0') - totalAllocated)

                        return (
                          <tr key={pmt.id} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                            <td className="py-2.5 px-3 text-center text-[#6B7280] tabular-nums font-normal">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#6B7280]">
                              {formatDateTime(pmt.paid_at || pmt.created_at)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right tabular-nums">
                              <span className="font-medium text-emerald-700">
                                {formatINR(pmt.amount)}
                              </span>
                              {advanceCredit > 0 && (
                                <div className="mt-0.5">
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    {formatINR(advanceCredit)} Advance Credit
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#4B5563]">
                              {pmt.payment_method_display || pmt.payment_method.toUpperCase()}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono text-[11px] text-[#6B7280]">
                              {pmt.transaction_reference || '—'}
                            </td>
                            <td className="py-2.5 px-3.5 text-center">
                              <Badge
                                variant={
                                  pmt.status === 'completed'
                                    ? 'success'
                                    : pmt.status === 'pending'
                                    ? 'warning'
                                    : 'danger'
                                }
                                size="sm"
                              >
                                {pmt.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3.5 text-right pr-4">
                              <button
                                type="button"
                                onClick={() => setSelectedPaymentId(pmt.id)}
                                className="text-xs font-medium text-[#408A71] hover:text-[#34745C] hover:underline cursor-pointer"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Security Deposit (Columns: Agreed, Received, Pending, Deductions, Refunds, Status, Action) */}
          {activeLedgerTab === 'deposit' && (
            <div>
              {isLoadingDeposits ? (
                <div className="p-4 space-y-2.5">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : tenancyDeposits.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No security deposit record"
                    description="No active security deposit obligations found for this tenancy."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                    <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                      <tr>
                        <th className="py-2.5 px-3.5 font-normal">Agreed</th>
                        <th className="py-2.5 px-3.5 font-normal">Received</th>
                        <th className="py-2.5 px-3.5 font-normal">Pending</th>
                        <th className="py-2.5 px-3.5 font-normal">Deductions</th>
                        <th className="py-2.5 px-3.5 font-normal">Refunds</th>
                        <th className="py-2.5 px-3.5 font-normal">Status</th>
                        <th className="py-2.5 px-3.5 font-normal text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                      {tenancyDeposits.map((dep, idx) => {
                        const hasOutstanding = parseFloat(dep.outstanding_deposit || '0') > 0
                        const statusVariant: BadgeVariant =
                          dep.status === 'paid'
                            ? 'success'
                            : dep.status === 'partially_paid'
                            ? 'warning'
                            : 'neutral'

                        return (
                          <tr key={dep.tenancy_id || idx} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                            <td className="py-3 px-3.5 font-medium tabular-nums text-[#111827]">
                              {formatINR(dep.agreed_deposit)}
                            </td>
                            <td className="py-3 px-3.5 font-medium tabular-nums text-[#111827]">
                              {formatINR(dep.deposit_received)}
                            </td>
                            <td className="py-3 px-3.5 font-medium tabular-nums">
                              {hasOutstanding ? (
                                <span className="text-amber-700 font-medium">{formatINR(dep.outstanding_deposit)}</span>
                              ) : (
                                <span className="text-[#6B7280]">₹0.00</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 tabular-nums text-[#111827]">
                              {formatINR(dep.adjustments)}
                            </td>
                            <td className="py-3 px-3.5 tabular-nums text-[#111827]">
                              {parseFloat(dep.refunds || '0') > 0 ? (
                                <span className="text-rose-600 font-medium">{formatINR(dep.refunds)}</span>
                              ) : (
                                <span className="text-[#111827]">₹0.00</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5">
                              <Badge variant={statusVariant} size="sm">
                                {dep.status_display}
                              </Badge>
                            </td>
                            <td className="py-3 px-3.5 text-right pr-4 whitespace-nowrap">
                              {hasOutstanding ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenRecordPayment(
                                      dep.outstanding_deposit,
                                      'security_deposit'
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#408A71] text-[#408A71] hover:bg-[#ECF5F2] transition-colors cursor-pointer"
                                >
                                  Record deposit
                                </button>
                              ) : (
                                <span className="text-xs text-[#9CA3AF] italic">Settled</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Documents */}
          {activeLedgerTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-normal text-[#6B7280]">
                  {tenancyDocuments.length} {tenancyDocuments.length === 1 ? 'document' : 'documents'} uploaded for this tenancy
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadModalOpen(true)}
                >
                  Upload document
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
                <div className="py-8 text-center border border-dashed border-[#D1D5DB] rounded-lg p-6 bg-[#F9FAFB]">
                  <p className="text-xs font-medium text-[#111827]">No tenancy documents uploaded yet</p>
                  <p className="mt-1 text-xs font-normal text-[#6B7280]">
                    Upload signed rental agreements or inspection reports to share with the tenant.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                    <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                      <tr>
                        <th className="py-2.5 px-3.5 font-normal">Document Title</th>
                        <th className="py-2.5 px-3.5 font-normal">Type</th>
                        <th className="py-2.5 px-3.5 font-normal">Size</th>
                        <th className="py-2.5 px-3.5 font-normal">Uploaded Date</th>
                        <th className="py-2.5 px-3.5 font-normal text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                      {tenancyDocuments.map((doc) => {
                        const previewable = isPreviewableDocument(doc.mime_type, doc.original_filename)
                        const typeLabel = DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type
                        const isDownloading = downloadingDocId === doc.id

                        return (
                          <tr key={doc.id} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                            <td className="py-3 px-3.5 font-medium text-[#111827] truncate max-w-xs">
                              {doc.title || doc.original_filename}
                            </td>
                            <td className="py-3 px-3.5 text-[#6B7280]">
                              <Badge variant="neutral" size="sm">
                                {typeLabel}
                              </Badge>
                            </td>
                            <td className="py-3 px-3.5 text-[#6B7280] tabular-nums">
                              {formatFileSize(doc.file_size_bytes)}
                            </td>
                            <td className="py-3 px-3.5 text-[#6B7280]">
                              {formatDate(doc.created_at)}
                            </td>
                            <td className="py-3 px-3.5 text-right pr-4 whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                {previewable && (
                                  <button
                                    type="button"
                                    onClick={() => void handleOpenPreview(doc)}
                                    className="text-xs font-medium text-[#408A71] hover:text-[#34745C] hover:underline cursor-pointer"
                                  >
                                    Preview
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isDownloading}
                                  onClick={() => void handleDownloadDocument(doc)}
                                  className="text-xs font-medium text-[#6B7280] hover:text-[#111827] cursor-pointer"
                                >
                                  {isDownloading ? 'Downloading...' : 'Download'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* RIGHT (1fr): stacked lightweight cards */}
        <aside className="lg:col-span-1 space-y-5 min-w-[280px]">
          {/* Card 1: Rental terms */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-3">
            <h3 className="text-sm font-medium text-[#111827]">Rental terms</h3>
            <div className="divide-y divide-[#F3F4F6] text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="font-normal text-[#6B7280]">Start date</span>
                <span className="font-medium text-[#111827]">{formatDate(tenancy.start_date)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-normal text-[#6B7280]">End date</span>
                <span className="font-medium text-[#111827]">
                  {tenancy.end_date ? formatDate(tenancy.end_date) : 'Open-ended'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-normal text-[#6B7280]">Rent due</span>
                <span className="font-medium text-[#111827]">
                  {tenancy.rent_due_day ? `Day ${tenancy.rent_due_day} of month` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-normal text-[#6B7280]">Security deposit</span>
                <span className="font-medium text-[#111827] tabular-nums">
                  {formatINR(tenancy.security_deposit)}
                </span>
              </div>
            </div>
            {tenancy.notes && (
              <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                <span className="text-xs font-normal text-[#6B7280]">Agreement notes</span>
                <p className="mt-1 text-xs text-[#111827] whitespace-pre-wrap leading-relaxed">{tenancy.notes}</p>
              </div>
            )}
          </div>

          {/* Card 2: Timeline */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-3">
            <h3 className="text-sm font-medium text-[#111827]">Timeline</h3>
            <div className="divide-y divide-[#F3F4F6] text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="font-normal text-[#6B7280]">Created</span>
                <span className="font-medium text-[#111827]">{formatDateTime(tenancy.created_at)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-normal text-[#6B7280]">Move-in</span>
                <span className="font-medium text-[#111827]">
                  {tenancy.actual_move_in_date ? formatDate(tenancy.actual_move_in_date) : 'Not recorded'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-normal text-[#6B7280]">Move-out</span>
                <span className="font-medium text-[#111827]">
                  {tenancy.actual_move_out_date ? formatDate(tenancy.actual_move_out_date) : 'Not recorded'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-normal text-[#6B7280]">Last updated</span>
                <span className="font-medium text-[#111827]">{formatDateTime(tenancy.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Tenancy documents */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-3">
            <h3 className="text-sm font-medium text-[#111827]">Tenancy documents</h3>
            {tenancyDocuments.length === 0 ? (
              <p className="text-xs font-normal text-[#6B7280] leading-relaxed">
                No documents yet. Upload the signed agreement or inspection reports to share with the tenant.
              </p>
            ) : (
              <ul className="divide-y divide-[#F3F4F6] text-xs">
                {tenancyDocuments.map((doc) => (
                  <li key={doc.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-[#111827] truncate">{doc.title || doc.original_filename}</p>
                      <p className="text-[11px] text-[#6B7280]">{formatDate(doc.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPreviewableDocument(doc.mime_type, doc.original_filename) && (
                        <button
                          type="button"
                          onClick={() => void handleOpenPreview(doc)}
                          className="text-xs font-medium text-[#408A71] hover:text-[#34745C] hover:underline"
                        >
                          Preview
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDownloadDocument(doc)}
                        className="text-xs font-medium text-[#6B7280] hover:text-[#111827]"
                      >
                        Download
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="w-full py-2.5 rounded-lg border border-[#408A71] text-[#408A71] bg-white hover:bg-[#ECF5F2] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              Upload document
            </button>
          </div>

          {/* Card 4: Checkout / End tenancy */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            {canEnd ? (
              <button
                type="button"
                onClick={() => setLifecycleAction('end')}
                className="w-full py-2.5 rounded-lg border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                Checkout / end tenancy
              </button>
            ) : canActivate ? (
              <button
                type="button"
                onClick={() => setLifecycleAction('activate')}
                className="w-full py-2.5 rounded-lg border border-[#408A71] text-[#408A71] bg-white hover:bg-[#ECF5F2] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                Activate tenancy (move-in)
              </button>
            ) : canCancel ? (
              <button
                type="button"
                onClick={() => setLifecycleAction('cancel')}
                className="w-full py-2.5 rounded-lg border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel tenancy
              </button>
            ) : (
              <p className="text-xs text-center text-[#6B7280]">
                {tenancy.status === 'ended'
                  ? 'This tenancy has ended and checked out.'
                  : 'This tenancy was cancelled prior to activation.'}
              </p>
            )}
          </div>
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

      {/* Rent Payment Recording & Details Modals */}
      <RecordPaymentModal
        open={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        initialTenancyId={tenancy.id}
        initialAmount={recordInitialAmount}
        initialChargeType={recordInitialChargeType}
      />

      <PaymentDetailModal
        open={Boolean(selectedPaymentId)}
        paymentId={selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
      />
    </div>
  )
}

export default OwnerTenancyDetailPage
