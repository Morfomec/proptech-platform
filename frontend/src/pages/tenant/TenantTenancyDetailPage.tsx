import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useAcceptTenancyProposal,
  useDocuments,
  useRejectTenancyProposal,
  useTenancyDetail,
  useTenantPayments,
  useTenantRentCharges,
  useTenantSecurityDeposits,
} from '../../hooks/useTenantWorkspace'
import documentService from '../../services/document.service'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Modal,
  Skeleton,
  Textarea,
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
  DOCUMENT_TYPE_LABELS,
  formatFileSize,
  getTenancyStatusMeta,
} from '../../utils/tenancy'
import type { DocumentItem } from '../../types/document'
import type { PaymentItem, RentChargeItem } from '../../types/rent'

type LedgerFilter = 'all' | 'rent' | 'deposit' | 'payments'

interface LedgerEntry {
  id: string
  date: string
  dateRaw: string
  timestamp: number
  type: 'rent' | 'deposit' | 'payment'
  title: string
  subtitle: string
  charged: number | null
  paid: number | null
  balance: number
  status: 'due' | 'overdue' | 'paid'
  statusLabel: string
  payment?: PaymentItem
}

/**
 * Helper to compute merged chronological ledger with running balance.
 */
function computeTenancyLedger(
  charges: RentChargeItem[],
  payments: PaymentItem[],
  tenancySecurityDeposit?: string,
  tenancyStartDate?: string
): LedgerEntry[] {
  const entries: Omit<LedgerEntry, 'balance'>[] = []
  const today = new Date().toISOString().split('T')[0]

  // 1. Rent charges
  for (const chg of charges) {
    if (chg.charge_type === 'rent') {
      const isOverdue =
        chg.is_overdue ||
        (parseFloat(chg.outstanding_amount || '0') > 0 && chg.due_date && chg.due_date < today)
      const isPaid = chg.status === 'paid' || parseFloat(chg.outstanding_amount || '0') === 0

      let periodLabel = ''
      if (chg.billing_period_start) {
        const d = new Date(chg.billing_period_start)
        periodLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }

      entries.push({
        id: `charge-${chg.id}`,
        date: formatDate(chg.due_date || chg.created_at),
        dateRaw: chg.due_date || chg.created_at,
        timestamp: new Date(chg.due_date || chg.created_at).getTime(),
        type: 'rent',
        title: 'Rent charge',
        subtitle: periodLabel || 'Monthly schedule',
        charged: parseFloat(chg.amount || '0'),
        paid: null,
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'due',
        statusLabel: isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Due',
      })
    }
  }

  // 2. Security deposit charges
  const depositCharges = charges.filter((c) => c.charge_type === 'security_deposit')
  if (depositCharges.length > 0) {
    for (const dep of depositCharges) {
      const isOverdue =
        dep.is_overdue ||
        (parseFloat(dep.outstanding_amount || '0') > 0 && dep.due_date && dep.due_date < today)
      const isPaid = dep.status === 'paid' || parseFloat(dep.outstanding_amount || '0') === 0

      entries.push({
        id: `charge-${dep.id}`,
        date: formatDate(dep.due_date || dep.created_at),
        dateRaw: dep.due_date || dep.created_at,
        timestamp: new Date(dep.due_date || dep.created_at).getTime(),
        type: 'deposit',
        title: 'Security deposit',
        subtitle: 'One-time, refundable',
        charged: parseFloat(dep.amount || '0'),
        paid: null,
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'due',
        statusLabel: isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Due',
      })
    }
  } else if (tenancySecurityDeposit && parseFloat(tenancySecurityDeposit) > 0) {
    // If deposit charge is not yet created in RentCharge, record agreed deposit obligation
    const dateStr = tenancyStartDate || today
    entries.push({
      id: 'deposit-obligation',
      date: formatDate(dateStr),
      dateRaw: dateStr,
      timestamp: new Date(dateStr).getTime(),
      type: 'deposit',
      title: 'Security deposit',
      subtitle: 'One-time, refundable',
      charged: parseFloat(tenancySecurityDeposit),
      paid: null,
      status: 'due',
      statusLabel: 'Due',
    })
  }

  // 3. Payment receipts
  for (const pmt of payments) {
    if (pmt.status !== 'failed') {
      const pmtDate = pmt.paid_at || pmt.created_at
      const methodDisplay = pmt.payment_method_display || pmt.payment_method.toUpperCase()
      const refDisplay = pmt.transaction_reference ? ` · ref ${pmt.transaction_reference}` : ''

      entries.push({
        id: `payment-${pmt.id}`,
        date: formatDate(pmtDate),
        dateRaw: pmtDate,
        timestamp: new Date(pmtDate).getTime() + 1, // Charges precede payments on identical dates
        type: 'payment',
        title: 'Payment',
        subtitle: `${methodDisplay}${refDisplay}`,
        charged: null,
        paid: parseFloat(pmt.amount || '0'),
        status: 'paid',
        statusLabel: 'Paid',
        payment: pmt,
      })
    }
  }

  // Sort chronological ascending (oldest first) to compute running balance
  entries.sort((a, b) => a.timestamp - b.timestamp)

  let runningBalance = 0
  const result: LedgerEntry[] = []

  for (const item of entries) {
    if (item.charged) {
      runningBalance += item.charged
    }
    if (item.paid) {
      runningBalance = Math.max(0, runningBalance - item.paid)
    }
    result.push({
      ...item,
      balance: runningBalance,
    })
  }

  // Return newest first
  return result.reverse()
}

/**
 * TenantTenancyDetailPage
 * Read-only Tenant Tenancy view at `/app/tenant/tenancy/:tenancyId`.
 * Presents top-to-bottom hierarchy with summary metrics, read-only payments ledger,
 * documents list, and rental terms.
 */
export const TenantTenancyDetailPage: React.FC = () => {
  const { tenancyId } = useParams<{ tenancyId: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [activeFilter, setActiveFilter] = useState<LedgerFilter>('all')
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const acceptMutation = useAcceptTenancyProposal()
  const rejectMutation = useRejectTenancyProposal()

  // 1. Core Tenancy Detail
  const {
    data: detailResponse,
    isLoading: isLoadingTenancy,
    isError: isErrorTenancy,
    refetch: refetchTenancy,
  } = useTenancyDetail(tenancyId)

  const tenancy = detailResponse?.data

  // 2. Tenancy Documents
  const {
    data: documentsData,
    isLoading: documentsLoading,
    isError: documentsError,
  } = useDocuments({ page: 1, page_size: 100 })

  const tenancyDocuments = useMemo(() => {
    if (!tenancy) return []
    const allDocs = documentsData?.results ?? []
    return allDocs.filter((doc) => doc.tenancy === tenancy.id)
  }, [documentsData, tenancy])

  // 3. Read-Only Rent Charges, Payments, and Deposits for this Tenancy
  const { data: rentChargesData, isLoading: isLoadingCharges } = useTenantRentCharges(tenancyId)
  const { data: tenancyPaymentsData, isLoading: isLoadingPayments } = useTenantPayments(tenancyId)
  const { data: tenancyDeposits = [], isLoading: isLoadingDeposits } = useTenantSecurityDeposits(tenancyId)

  const rawCharges = useMemo(() => rentChargesData?.results ?? [], [rentChargesData])
  const rawPayments = useMemo(() => tenancyPaymentsData?.results ?? [], [tenancyPaymentsData])
  const depositRecord = tenancyDeposits[0]

  // Compute merged ledger
  const fullLedger = useMemo(() => {
    if (!tenancy) return []
    return computeTenancyLedger(
      rawCharges,
      rawPayments,
      tenancy.security_deposit,
      tenancy.start_date || undefined
    )
  }, [rawCharges, rawPayments, tenancy])

  // Filter ledger client-side
  const filteredLedger = useMemo(() => {
    if (activeFilter === 'all') return fullLedger
    return fullLedger.filter((item) => {
      if (activeFilter === 'rent') return item.type === 'rent'
      if (activeFilter === 'deposit') return item.type === 'deposit'
      if (activeFilter === 'payments') return item.type === 'payment'
      return true
    })
  }, [fullLedger, activeFilter])

  // Summary strip financial aggregates
  const {
    totalOutstanding,
    overdueRent,
    totalPaid,
    depositReceived,
    depositPending,
  } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]

    let overdueSum = 0
    let outstandingSum = 0

    for (const chg of rawCharges) {
      const out = parseFloat(chg.outstanding_amount || '0')
      if (out > 0) {
        outstandingSum += out
        if (chg.charge_type === 'rent') {
          const isOverdue = chg.is_overdue || (chg.due_date && chg.due_date < today)
          if (isOverdue) {
            overdueSum += out
          }
        }
      }
    }

    // If no deposit charge exists yet, add agreed deposit to outstanding if unpaid
    const hasDepositCharge = rawCharges.some((c) => c.charge_type === 'security_deposit')
    if (!hasDepositCharge && tenancy?.security_deposit) {
      outstandingSum += parseFloat(tenancy.security_deposit)
    }

    let paidSum = 0
    for (const pmt of rawPayments) {
      if (pmt.status === 'completed') {
        paidSum += parseFloat(pmt.amount || '0')
      }
    }

    const recDeposit =
      depositRecord?.deposit_received ||
      rawCharges.find((c) => c.charge_type === 'security_deposit')?.paid_amount ||
      '0.00'

    const pendDeposit =
      depositRecord?.outstanding_deposit ||
      rawCharges.find((c) => c.charge_type === 'security_deposit')?.outstanding_amount ||
      tenancy?.security_deposit ||
      '0.00'

    return {
      totalOutstanding: outstandingSum,
      overdueRent: overdueSum,
      totalPaid: paidSum,
      depositReceived: recDeposit,
      depositPending: parseFloat(pendDeposit || '0'),
    }
  }, [rawCharges, rawPayments, depositRecord, tenancy])

  // Handle document download
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

  const handleAcceptProposal = async () => {
    if (!tenancy) return
    setActionError(null)
    try {
      await acceptMutation.mutateAsync(tenancy.id)
      addToast({
        title: 'Tenancy Terms Accepted',
        description:
          'You have confirmed the tenancy agreement. The owner will activate it upon your move-in.',
        variant: 'success',
      })
      setIsAcceptModalOpen(false)
      void refetchTenancy()
    } catch (err: unknown) {
      setActionError(
        extractApiErrorMessage(err, 'Unable to accept proposal. Please try again.')
      )
    }
  }

  const handleRejectProposal = async () => {
    if (!tenancy) return
    setActionError(null)
    try {
      await rejectMutation.mutateAsync({
        tenancyId: tenancy.id,
        payload: { reason: rejectionReason.trim() || undefined },
      })
      addToast({
        title: 'Tenancy Proposal Declined',
        description: 'You have declined this tenancy proposal. The owner has been notified.',
        variant: 'success',
      })
      setIsRejectModalOpen(false)
      setRejectionReason('')
      void refetchTenancy()
    } catch (err: unknown) {
      setActionError(
        extractApiErrorMessage(err, 'Unable to decline proposal. Please try again.')
      )
    }
  }

  if (isLoadingTenancy) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-5 pb-10">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isErrorTenancy || !tenancy) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-5 pb-10">
        <nav aria-label="Breadcrumb" className="text-xs sm:text-sm font-normal text-[#6B7280] flex items-center gap-1.5">
          <Link to="/app/tenant/tenancy" className="hover:text-[#408A71] transition-colors">
            My Tenancy
          </Link>
          <span className="text-[#9CA3AF]">/</span>
          <span className="text-[#111827] font-medium">Tenancy Detail</span>
        </nav>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8">
          <EmptyState
            size="md"
            title="Tenancy not found"
            description="We could not load your tenancy record. It may not exist or access has expired."
            action={
              <div className="flex items-center gap-2.5">
                <Button variant="outline" size="sm" onClick={() => void refetchTenancy()}>
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
  const moveInDateStr = tenancy.actual_move_in_date
    ? formatDate(tenancy.actual_move_in_date)
    : formatDate(tenancy.start_date)
  const endDateStr = tenancy.end_date ? formatDate(tenancy.end_date) : 'Open-ended'

  return (
    <div className="max-w-[1200px] mx-auto space-y-5 pb-10">
      {/* 1. Breadcrumb: "My Tenancy / {propertyName}" */}
      <nav aria-label="Breadcrumb" className="text-xs sm:text-sm font-normal text-[#6B7280] flex items-center gap-1.5">
        <Link
          to="/app/tenant/tenancy"
          className="hover:text-[#408A71] transition-colors"
        >
          My Tenancy
        </Link>
        <span className="text-[#9CA3AF]">/</span>
        <span className="text-[#111827] font-medium">{tenancy.property_title || 'Tenancy Detail'}</span>
      </nav>

      {/* 2. Header card (single card, flex row, wraps on small screens) */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* Property Thumbnail (88x88, rounded 12px) */}
          <div className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-xl shrink-0 overflow-hidden border border-[#E5E7EB] bg-[#ECF5F2] flex items-center justify-center">
            {tenancy.property_image_url ? (
              <img
                src={getMediaUrl(tenancy.property_image_url)}
                alt={tenancy.property_title || 'Property'}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="flex flex-col items-center text-[#408A71]">
                <svg className="w-7 h-7 opacity-75 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6">
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

          {/* Middle: property name + status pill, address below, date line */}
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
                {tenancy.property_title || 'Property Tenancy'}
              </h1>
              <Badge variant={statusMeta.variant} size="sm">
                {statusMeta.label === 'Active' ? 'Active tenancy' : statusMeta.label}
              </Badge>
            </div>
            {tenancy.property_address && (
              <p className="text-xs font-normal text-[#6B7280] truncate">
                {tenancy.property_address}
              </p>
            )}
            <p className="text-xs font-normal text-[#6B7280]">
              {tenancy.status === 'pending'
                ? `Proposed start: ${formatDate(tenancy.start_date)} · ${endDateStr}`
                : tenancy.status === 'confirmed'
                ? `Starts: ${formatDate(tenancy.start_date)} · ${endDateStr}`
                : `Moved in ${moveInDateStr} · ${endDateStr}`}
            </p>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {tenancy.status === 'pending' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRejectModalOpen(true)}
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
              >
                Reject proposal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAcceptModalOpen(true)}
              >
                Accept terms
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/tenant/documents')}
            className="border-[#408A71] text-[#408A71] hover:bg-[#ECF5F2]"
          >
            All documents
          </Button>
          {tenancy.application_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/tenant/applications/${tenancy.application_id}`)}
              className="border-[#408A71] text-[#408A71] hover:bg-[#ECF5F2]"
            >
              Source application
            </Button>
          )}
        </div>
      </div>

      {/* 2b. Pending Proposal Review Panel */}
      {tenancy.status === 'pending' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Action Required
                </span>
                <h2 className="text-base font-medium text-amber-950">
                  Tenancy Agreement Proposal
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                The property owner has submitted the following tenancy terms for your review. Please examine the details below. Once you accept, the tenancy will be confirmed and can be activated upon move-in.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRejectModalOpen(true)}
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
              >
                Reject Proposal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsAcceptModalOpen(true)}
              >
                Accept Terms & Confirm
              </Button>
            </div>
          </div>

          {/* Proposal Terms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-amber-200/60">
            <div className="rounded-lg bg-white/80 p-3 border border-amber-200/50">
              <span className="text-xs text-[#6B7280]">Monthly Rent</span>
              <p className="text-lg font-medium text-[#111827] tabular-nums mt-0.5">
                {formatINR(tenancy.monthly_rent)}
              </p>
              <p className="text-[11px] text-[#6B7280]">Due day {tenancy.rent_due_day || 1} of each month</p>
            </div>
            <div className="rounded-lg bg-white/80 p-3 border border-amber-200/50">
              <span className="text-xs text-[#6B7280]">Security Deposit</span>
              <p className="text-lg font-medium text-[#111827] tabular-nums mt-0.5">
                {formatINR(tenancy.security_deposit)}
              </p>
              <p className="text-[11px] text-[#6B7280]">Refundable upon move-out</p>
            </div>
            <div className="rounded-lg bg-white/80 p-3 border border-amber-200/50">
              <span className="text-xs text-[#6B7280]">Proposed Start Date</span>
              <p className="text-base font-medium text-[#111827] mt-0.5">
                {formatDate(tenancy.start_date)}
              </p>
              <p className="text-[11px] text-[#6B7280]">Agreement effective date</p>
            </div>
            <div className="rounded-lg bg-white/80 p-3 border border-amber-200/50">
              <span className="text-xs text-[#6B7280]">Proposed End Date</span>
              <p className="text-base font-medium text-[#111827] mt-0.5">
                {tenancy.end_date ? formatDate(tenancy.end_date) : 'Open-ended'}
              </p>
              <p className="text-[11px] text-[#6B7280]">{tenancy.end_date ? 'Fixed duration' : 'No fixed end date'}</p>
            </div>
          </div>

          {tenancy.notes && (
            <div className="rounded-lg bg-white/80 p-3.5 border border-amber-200/50 text-xs">
              <span className="font-medium text-[#111827] block mb-1">Agreement Notes & Conditions:</span>
              <p className="text-[#4B5563] whitespace-pre-wrap leading-relaxed">{tenancy.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* 2c. Rejected Proposal Banner */}
      {tenancy.status === 'rejected' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
              Proposal Declined
            </span>
            <h2 className="text-sm font-medium text-rose-950">
              You declined this tenancy agreement proposal
            </h2>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            You declined the proposed terms on{' '}
            {formatDateTime(tenancy.tenant_responded_at || tenancy.updated_at)}. The property owner has been notified. If the owner updates the agreement terms, you will be invited to review them again.
          </p>
          {tenancy.rejection_reason && (
            <p className="text-xs text-rose-900 bg-white/80 p-2.5 rounded-lg border border-rose-200/60 mt-1 italic">
              Reason provided: &ldquo;{tenancy.rejection_reason}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* 2d. Confirmed Agreement Banner */}
      {tenancy.status === 'confirmed' && (
        <div className="rounded-xl border border-emerald-200 bg-[#F4FAF7] p-5 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
              Confirmed
            </span>
            <h2 className="text-sm font-medium text-emerald-950">
              Tenancy Agreement Confirmed
            </h2>
          </div>
          <p className="text-xs text-[#285747] leading-relaxed">
            You accepted the proposed terms on{' '}
            {formatDateTime(tenancy.tenant_responded_at || tenancy.updated_at)}. Your tenancy is scheduled to begin on{' '}
            <span className="font-medium">{formatDate(tenancy.start_date)}</span>. The owner will activate your tenancy upon move-in.
          </p>
        </div>
      )}

      {/* 3. Summary strip: ONE card with 4 equal columns separated by thin dividers */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB]">
        {/* Col 1: Total outstanding */}
        <div className="px-0 sm:px-4 first:pl-0 last:pr-0 py-3 sm:py-0 space-y-1">
          <span className="text-xs font-normal text-[#6B7280]">Total outstanding</span>
          <p className={`text-xl font-medium tabular-nums ${totalOutstanding > 0 ? 'text-rose-600' : 'text-[#111827]'}`}>
            {formatINR(totalOutstanding)}
          </p>
          {overdueRent > 0 ? (
            <p className="text-xs font-medium text-rose-600">
              Includes {formatINR(overdueRent)} overdue rent
            </p>
          ) : (
            <p className="text-xs font-normal text-[#6B7280]">
              {totalOutstanding > 0 ? 'Due for payment' : 'Up to date'}
            </p>
          )}
        </div>

        {/* Col 2: Monthly rent */}
        <div className="px-0 sm:px-4 first:pl-0 last:pr-0 py-3 sm:py-0 space-y-1">
          <span className="text-xs font-normal text-[#6B7280]">Monthly rent</span>
          <p className="text-xl font-medium text-[#111827] tabular-nums">
            {formatINR(tenancy.monthly_rent)}
          </p>
          <p className="text-xs font-normal text-[#6B7280]">
            Due day {tenancy.rent_due_day || 1} of every month
          </p>
        </div>

        {/* Col 3: Total paid so far */}
        <div className="px-0 sm:px-4 first:pl-0 last:pr-0 py-3 sm:py-0 space-y-1">
          <span className="text-xs font-normal text-[#6B7280]">Total paid so far</span>
          <p className="text-xl font-medium text-[#111827] tabular-nums">
            {formatINR(totalPaid)}
          </p>
          <p className="text-xs font-normal text-[#6B7280]">
            {totalPaid > 0 ? 'Recorded payments' : 'No payments recorded yet'}
          </p>
        </div>

        {/* Col 4: Security deposit */}
        <div className="px-0 sm:px-4 first:pl-0 last:pr-0 py-3 sm:py-0 space-y-1">
          <span className="text-xs font-normal text-[#6B7280]">Security deposit</span>
          <p className="text-xl font-medium text-[#111827] tabular-nums">
            {formatINR(depositReceived)} of {formatINR(tenancy.security_deposit)}
          </p>
          {depositPending > 0 ? (
            <p className="text-xs font-medium text-amber-700">
              {formatINR(depositPending)} to pay
            </p>
          ) : (
            <p className="text-xs font-medium text-[#408A71]">Fully paid</p>
          )}
        </div>
      </div>

      {/* 4. Two-column grid: left 2fr, right 1fr (min 280px), gap 20px */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* LEFT COLUMN (2fr) */}
        <div className="lg:col-span-2 space-y-5">
          {/* a) "Payments ledger" card */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
            <div>
              <h2 className="text-base font-medium text-[#111827]">Payments ledger</h2>
              <p className="text-xs font-normal text-[#6B7280] mt-0.5">
                Every charge and payment for this tenancy, with a running balance.
              </p>
            </div>

            {/* Filter chips: All | Rent | Deposit | Payments */}
            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'rent', 'deposit', 'payments'] as const).map((chip) => {
                const isActive = activeFilter === chip
                const labels = {
                  all: 'All',
                  rent: 'Rent',
                  deposit: 'Deposit',
                  payments: 'Payments',
                }
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setActiveFilter(chip)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#ECF5F2] text-[#408A71] border border-[#408A71] font-medium'
                        : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:text-[#111827] hover:border-gray-400 font-normal'
                    }`}
                  >
                    {labels[chip]}
                  </button>
                )
              })}
            </div>

            {/* Table or Stacked List */}
            {isLoadingCharges || isLoadingPayments || isLoadingDeposits ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : filteredLedger.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-[#E5E7EB] rounded-lg p-6 bg-[#F9FAFB]">
                <p className="text-xs font-medium text-[#111827]">
                  No charges or payments yet. Your first rent of {formatINR(tenancy.monthly_rent)} is due on {formatDate(tenancy.start_date)}.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop view (min-width 720px table) */}
                <div className="overflow-x-auto min-w-full hidden sm:block">
                  <table className="min-w-[720px] w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                        <th className="py-2.5 px-3 font-normal">Date</th>
                        <th className="py-2.5 px-3 font-normal">Description</th>
                        <th className="py-2.5 px-3 text-right font-normal">Charged</th>
                        <th className="py-2.5 px-3 text-right font-normal">Paid</th>
                        <th className="py-2.5 px-3 text-right font-normal">Balance</th>
                        <th className="py-2.5 px-3 text-right pr-3 font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6] text-[#111827]">
                      {filteredLedger.map((row) => {
                        const statusPillClasses =
                          row.status === 'overdue'
                            ? 'bg-rose-50 text-rose-700'
                            : row.status === 'due'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-[#ECF5F2] text-[#408A71]'

                        return (
                          <tr key={row.id} className="hover:bg-[#F9FAFB] transition-colors">
                            <td className="py-3 px-3 text-[#6B7280] whitespace-nowrap">
                              {row.date}
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-medium text-[#111827] leading-tight">
                                {row.title}
                              </p>
                              <p className="text-[11px] text-[#6B7280] mt-0.5 font-normal">
                                {row.subtitle}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-normal text-[#111827]">
                              {row.charged ? formatINR(row.charged) : '–'}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-normal text-[#408A71]">
                              {row.paid ? formatINR(row.paid) : '–'}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-medium text-[#111827]">
                              {formatINR(row.balance)}
                            </td>
                            <td className="py-3 px-3 text-right pr-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses}`}
                              >
                                {row.statusLabel}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view (<640px stacked cards) */}
                <div className="block sm:hidden space-y-3">
                  {filteredLedger.map((row) => {
                    const statusPillClasses =
                      row.status === 'overdue'
                        ? 'bg-rose-50 text-rose-700'
                        : row.status === 'due'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-[#ECF5F2] text-[#408A71]'

                    return (
                      <div
                        key={row.id}
                        className="rounded-xl border border-[#E5E7EB] p-3.5 bg-white space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#6B7280]">{row.date}</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses}`}
                          >
                            {row.statusLabel}
                          </span>
                        </div>

                        <div>
                          <p className="font-medium text-[#111827] text-sm">{row.title}</p>
                          <p className="text-[11px] text-[#6B7280] font-normal">{row.subtitle}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F3F4F6] text-center">
                          <div>
                            <p className="text-[10px] text-[#6B7280] font-normal">Charged</p>
                            <p className="font-normal text-[#111827] tabular-nums mt-0.5">
                              {row.charged ? formatINR(row.charged) : '–'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#6B7280] font-normal">Paid</p>
                            <p className="font-normal text-[#408A71] tabular-nums mt-0.5">
                              {row.paid ? formatINR(row.paid) : '–'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#6B7280] font-normal">Balance</p>
                            <p className="font-medium text-[#111827] tabular-nums mt-0.5">
                              {formatINR(row.balance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Footer row inside the card with a small "Status guide" showing the three pills */}
            <div className="pt-3 border-t border-[#F3F4F6] flex items-center gap-2.5 text-xs text-[#6B7280] flex-wrap">
              <span className="font-normal">Status guide:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                Due
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700">
                Overdue
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ECF5F2] text-[#408A71]">
                Paid
              </span>
            </div>
          </section>

          {/* b) "Rental agreement & documents" card */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-3">
            <h2 className="text-base font-medium text-[#111827]">Rental agreement &amp; documents</h2>

            {documentsError && (
              <Alert variant="error">Unable to load tenancy documents right now.</Alert>
            )}

            {documentsLoading ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : tenancyDocuments.length > 0 ? (
              <div className="space-y-2.5">
                {tenancyDocuments.map((doc) => {
                  const typeLabel = DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type
                  const isDownloading = downloadingDocId === doc.id

                  return (
                    <div
                      key={doc.id}
                      className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[#111827] truncate">
                          {doc.title || doc.original_filename}
                        </p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5 font-normal">
                          {typeLabel} · {formatFileSize(doc.file_size_bytes)} · Uploaded {formatDate(doc.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDownloading}
                        onClick={() => void handleDownloadDocument(doc)}
                        className="border-[#408A71] text-[#408A71] hover:bg-[#ECF5F2] shrink-0"
                      >
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] p-6 text-center">
                <p className="text-xs font-medium text-[#111827]">No rental agreement uploaded yet</p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Once your owner attaches it, you can download it here.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN (1fr, min 280px, stacked cards) */}
        <div className="space-y-5">
          {/* a) "Rental terms" card */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-1">
            <h2 className="text-base font-medium text-[#111827] mb-2">Rental terms</h2>
            <div className="divide-y divide-[#F3F4F6] text-xs">
              <div className="flex items-center justify-between py-2.5 border-t border-[#F3F4F6] first:border-t-0">
                <span className="font-normal text-[#6B7280]">Start date</span>
                <span className="font-medium text-[#111827] text-right">
                  {formatDate(tenancy.start_date)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-t border-[#F3F4F6]">
                <span className="font-normal text-[#6B7280]">End date</span>
                <span className="font-medium text-[#111827] text-right">{endDateStr}</span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-t border-[#F3F4F6]">
                <span className="font-normal text-[#6B7280]">Rent due</span>
                <span className="font-medium text-[#111827] text-right">
                  Day {tenancy.rent_due_day || 1} of month
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-t border-[#F3F4F6]">
                <span className="font-normal text-[#6B7280]">Monthly rent</span>
                <span className="font-medium text-[#111827] text-right tabular-nums">
                  {formatINR(tenancy.monthly_rent)}
                </span>
              </div>
            </div>

            {tenancy.notes && (
              <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                <span className="text-[11px] font-normal text-[#6B7280]">Agreement notes</span>
                <p className="mt-1 text-xs text-[#111827] whitespace-pre-wrap leading-relaxed">
                  {tenancy.notes}
                </p>
              </div>
            )}
          </section>

          {/* b) "Key dates" card */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-1">
            <h2 className="text-base font-medium text-[#111827] mb-2">Key dates</h2>
            <div className="divide-y divide-[#F3F4F6] text-xs">
              <div className="flex items-center justify-between py-2.5 border-t border-[#F3F4F6] first:border-t-0">
                <span className="font-normal text-[#6B7280]">Created</span>
                <span className="font-medium text-[#111827] text-right">
                  {formatDateTime(tenancy.created_at)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-t border-[#F3F4F6]">
                <span className="font-normal text-[#6B7280]">Move-in</span>
                <span className="font-medium text-[#111827] text-right">{moveInDateStr}</span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-t border-[#F3F4F6]">
                <span className="font-normal text-[#6B7280]">Move-out</span>
                <span className="font-medium text-[#111827] text-right">
                  {tenancy.actual_move_out_date
                    ? formatDate(tenancy.actual_move_out_date)
                    : 'Not recorded'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 border-t border-[#F3F4F6]">
                <span className="font-normal text-[#6B7280]">Last updated</span>
                <span className="font-medium text-[#111827] text-right">
                  {formatDateTime(tenancy.updated_at)}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Accept Terms Modal */}
      <Modal
        open={isAcceptModalOpen}
        onClose={() => {
          if (!acceptMutation.isPending) {
            setIsAcceptModalOpen(false)
            setActionError(null)
          }
        }}
        closeOnBackdropClick={!acceptMutation.isPending}
        closeOnEscape={!acceptMutation.isPending}
        title="Accept Tenancy Terms"
        description="Please confirm your acceptance of the proposed tenancy agreement."
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAcceptModalOpen(false)
                setActionError(null)
              }}
              disabled={acceptMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={acceptMutation.isPending}
              loadingText="Accepting..."
              onClick={() => void handleAcceptProposal()}
            >
              Confirm Acceptance
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {actionError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              {actionError}
            </div>
          )}
          <p className="text-xs text-[#4B5563] leading-relaxed">
            By accepting, you agree to the following terms for{' '}
            <span className="font-medium text-[#111827]">{tenancy.property_title || 'this property'}</span>:
          </p>
          <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Monthly Rent:</span>
              <span className="font-medium text-[#111827]">{formatINR(tenancy.monthly_rent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Security Deposit:</span>
              <span className="font-medium text-[#111827]">{formatINR(tenancy.security_deposit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Start Date:</span>
              <span className="font-medium text-[#111827]">{formatDate(tenancy.start_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Rent Due Day:</span>
              <span className="font-medium text-[#111827]">Day {tenancy.rent_due_day || 1} of month</span>
            </div>
          </div>
          <p className="text-[11px] text-[#6B7280]">
            The owner will be notified of your acceptance and will activate the tenancy upon your move-in.
          </p>
        </div>
      </Modal>

      {/* Reject Proposal Modal */}
      <Modal
        open={isRejectModalOpen}
        onClose={() => {
          if (!rejectMutation.isPending) {
            setIsRejectModalOpen(false)
            setActionError(null)
          }
        }}
        closeOnBackdropClick={!rejectMutation.isPending}
        closeOnEscape={!rejectMutation.isPending}
        title="Decline Tenancy Proposal"
        description="Decline the terms proposed by the property owner."
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsRejectModalOpen(false)
                setActionError(null)
              }}
              disabled={rejectMutation.isPending}
            >
              Keep Proposal
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={rejectMutation.isPending}
              loadingText="Declining..."
              onClick={() => void handleRejectProposal()}
            >
              Decline Proposal
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {actionError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              {actionError}
            </div>
          )}
          <p className="text-xs text-[#4B5563] leading-relaxed">
            Are you sure you want to decline this agreement proposal? You can provide a reason below to explain what terms do not work for you.
          </p>
          <Textarea
            label="Reason for declining (Optional)"
            placeholder="e.g. The proposed start date is too early, or rent amount differs from listing..."
            rows={3}
            maxLength={1000}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            disabled={rejectMutation.isPending}
          />
        </div>
      </Modal>
    </div>
  )
}

export default TenantTenancyDetailPage
