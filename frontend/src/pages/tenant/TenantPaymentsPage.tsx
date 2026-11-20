import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useMyTenancies,
  useTenantPayments,
  useTenantRentCharges,
  useTenantSecurityDeposits,
} from '../../hooks/useTenantWorkspace'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Skeleton,
  type BadgeVariant,
} from '../../components/ui'
import { formatDate, formatINR } from '../../utils/application'
import type { TenancyListItem } from '../../types/leasing'
import type { PaymentItem, RentChargeItem, SecurityDepositItem } from '../../types/rent'

type ViewTab = 'history' | 'obligations' | 'deposits' | 'ledger'
type LedgerFilter = 'all' | 'rent' | 'deposit' | 'payments'

interface LedgerEntry {
  id: string
  date: string
  dateRaw: string
  timestamp: number
  type: 'rent' | 'deposit' | 'payment'
  propertyTitle: string
  title: string
  subtitle: string
  charged: number | null
  paid: number | null
  balance: number
  status: 'due' | 'overdue' | 'paid'
  statusLabel: string
  payment?: PaymentItem
}

const PAYMENT_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  completed: { label: 'Completed', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  failed: { label: 'Failed', variant: 'danger' },
}

export const TenantPaymentsPage: React.FC = () => {
  const navigate = useNavigate()

  // Selected tenancy filter: 'all' or tenancy ID
  const [selectedTenancyId, setSelectedTenancyId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<ViewTab>('history')
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')

  // 1. Fetch all tenancies for the authenticated tenant
  const { data: tenanciesResponse, isLoading: isLoadingTenancies } = useMyTenancies({
    page: 1,
    page_size: 100,
  })
  const allTenancies: TenancyListItem[] = useMemo(
    () => tenanciesResponse?.results ?? [],
    [tenanciesResponse]
  )
  const activeTenancies = useMemo(
    () => allTenancies.filter((t) => t.status === 'active'),
    [allTenancies]
  )

  // Target tenancies based on selected filter
  const targetTenancyIds = useMemo(() => {
    if (selectedTenancyId !== 'all') {
      return new Set([selectedTenancyId])
    }
    return new Set(allTenancies.map((t) => t.id))
  }, [selectedTenancyId, allTenancies])

  // Map of tenancy ID to tenancy details for easy lookup
  const tenancyMap = useMemo(() => {
    const map = new Map<string, TenancyListItem>()
    for (const t of allTenancies) {
      map.set(t.id, t)
    }
    return map
  }, [allTenancies])

  // 2. Fetch rent charges, payments, and security deposits (scoped to selectedTenancyId if not 'all')
  const queryTenancyParam = selectedTenancyId === 'all' ? undefined : selectedTenancyId
  const { data: rentChargesData, isLoading: isLoadingCharges } = useTenantRentCharges(queryTenancyParam)
  const { data: paymentsData, isLoading: isLoadingPayments } = useTenantPayments(queryTenancyParam)
  const { data: depositsData = [], isLoading: isLoadingDeposits } = useTenantSecurityDeposits(queryTenancyParam)

  const rawCharges: RentChargeItem[] = useMemo(
    () => rentChargesData?.results ?? [],
    [rentChargesData]
  )
  const rawPayments: PaymentItem[] = useMemo(
    () => paymentsData?.results ?? [],
    [paymentsData]
  )
  const rawDeposits: SecurityDepositItem[] = useMemo(
    () => depositsData ?? [],
    [depositsData]
  )

  // Filter items matching target tenancies
  const charges = useMemo(
    () => rawCharges.filter((c) => !c.tenancy || targetTenancyIds.has(c.tenancy)),
    [rawCharges, targetTenancyIds]
  )
  const payments = useMemo(
    () => rawPayments.filter((p) => !p.tenancy || targetTenancyIds.has(p.tenancy)),
    [rawPayments, targetTenancyIds]
  )
  const deposits = useMemo(
    () => rawDeposits.filter((d) => !d.tenancy_id || targetTenancyIds.has(d.tenancy_id)),
    [rawDeposits, targetTenancyIds]
  )

  // 3. Financial Summary Calculation (Strictly scoped & separated)
  const summary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let totalOutstandingRent = 0
    let totalPaidRent = 0
    let paidThisMonth = 0
    let nextDueDate: string | null = null
    let nextDueAmount = 0

    // Rent charges summary
    for (const chg of charges) {
      if (chg.charge_type === 'rent') {
        const outstanding = parseFloat(chg.outstanding_amount || '0')
        const paid = parseFloat(chg.paid_amount || '0')
        totalPaidRent += paid

        const isOverdue =
          chg.is_overdue || (outstanding > 0 && chg.due_date && chg.due_date < today)
        if (isOverdue && outstanding > 0) {
          totalOutstandingRent += outstanding
        }

        // Check for earliest future due date (upcoming rent)
        if (outstanding > 0 && chg.due_date && chg.due_date >= today) {
          if (!nextDueDate || chg.due_date < nextDueDate) {
            nextDueDate = chg.due_date
            nextDueAmount = outstanding
          } else if (chg.due_date === nextDueDate) {
            nextDueAmount += outstanding
          }
        }
      }
    }

    // Payments summary
    for (const pmt of payments) {
      if (pmt.status === 'completed') {
        const pDate = pmt.paid_at ? new Date(pmt.paid_at) : new Date(pmt.created_at)
        if (pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) {
          paidThisMonth += parseFloat(pmt.amount || '0')
        }
      }
    }

    // Security deposit summary
    let totalDepositAgreed = 0
    let totalDepositReceived = 0
    let totalDepositPending = 0

    if (deposits.length > 0) {
      for (const dep of deposits) {
        totalDepositAgreed += parseFloat(dep.agreed_deposit || '0')
        totalDepositReceived += parseFloat(dep.deposit_received || '0')
        totalDepositPending += Math.max(0, parseFloat(dep.outstanding_deposit || '0'))
      }
    } else {
      // Fallback from tenancies if deposits array is empty
      const tenanciesToSum =
        selectedTenancyId === 'all'
          ? allTenancies
          : allTenancies.filter((t) => t.id === selectedTenancyId)
      for (const t of tenanciesToSum) {
        if (t.security_deposit) {
          const agreed = parseFloat(t.security_deposit)
          totalDepositAgreed += agreed
          totalDepositPending += agreed
        }
      }
    }

    return {
      totalOutstandingRent,
      totalPaidRent,
      paidThisMonth,
      nextDueDate,
      nextDueAmount,
      totalDepositAgreed,
      totalDepositReceived,
      totalDepositPending,
    }
  }, [charges, payments, deposits, allTenancies, selectedTenancyId])

  // 4. Combined Ledger Calculation
  const ledgerEntries = useMemo(() => {
    const entries: Omit<LedgerEntry, 'balance'>[] = []
    const today = new Date().toISOString().split('T')[0]

    // 1. Rent Charges
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

        const propTitle = chg.property_title || tenancyMap.get(chg.tenancy)?.property_title || 'Tenancy'

        entries.push({
          id: `charge-${chg.id}`,
          date: formatDate(chg.due_date || chg.created_at),
          dateRaw: chg.due_date || chg.created_at,
          timestamp: new Date(chg.due_date || chg.created_at).getTime(),
          type: 'rent',
          propertyTitle: propTitle,
          title: 'Rent charge',
          subtitle: periodLabel ? `${periodLabel} · ${propTitle}` : propTitle,
          charged: parseFloat(chg.amount || '0'),
          paid: null,
          status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'due',
          statusLabel: isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Due',
        })
      }
    }

    // 2. Deposit Charges
    const depositCharges = charges.filter((c) => c.charge_type === 'security_deposit')
    for (const dep of depositCharges) {
      const isOverdue =
        dep.is_overdue ||
        (parseFloat(dep.outstanding_amount || '0') > 0 && dep.due_date && dep.due_date < today)
      const isPaid = dep.status === 'paid' || parseFloat(dep.outstanding_amount || '0') === 0
      const propTitle = dep.property_title || tenancyMap.get(dep.tenancy)?.property_title || 'Tenancy'

      entries.push({
        id: `charge-${dep.id}`,
        date: formatDate(dep.due_date || dep.created_at),
        dateRaw: dep.due_date || dep.created_at,
        timestamp: new Date(dep.due_date || dep.created_at).getTime(),
        type: 'deposit',
        propertyTitle: propTitle,
        title: 'Security deposit',
        subtitle: `One-time, refundable · ${propTitle}`,
        charged: parseFloat(dep.amount || '0'),
        paid: null,
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'due',
        statusLabel: isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Due',
      })
    }

    // 3. Payments
    for (const pmt of payments) {
      if (pmt.status !== 'failed') {
        const pmtDate = pmt.paid_at || pmt.created_at
        const methodDisplay = pmt.payment_method_display || pmt.payment_method.toUpperCase()
        const refDisplay = pmt.transaction_reference ? ` · ref ${pmt.transaction_reference}` : ''
        const propTitle = pmt.property_title || tenancyMap.get(pmt.tenancy)?.property_title || 'Tenancy'

        entries.push({
          id: `payment-${pmt.id}`,
          date: formatDate(pmtDate),
          dateRaw: pmtDate,
          timestamp: new Date(pmtDate).getTime() + 1,
          type: 'payment',
          propertyTitle: propTitle,
          title: 'Payment',
          subtitle: `${methodDisplay}${refDisplay} · ${propTitle}`,
          charged: null,
          paid: parseFloat(pmt.amount || '0'),
          status: 'paid',
          statusLabel: 'Paid',
          payment: pmt,
        })
      }
    }

    // Sort ascending for balance computation
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

    return result.reverse()
  }, [charges, payments, tenancyMap])

  // Filtered ledger based on ledger sub-filter
  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'all') return ledgerEntries
    if (ledgerFilter === 'rent') return ledgerEntries.filter((e) => e.type === 'rent')
    if (ledgerFilter === 'deposit') return ledgerEntries.filter((e) => e.type === 'deposit')
    if (ledgerFilter === 'payments') return ledgerEntries.filter((e) => e.type === 'payment')
    return ledgerEntries
  }, [ledgerEntries, ledgerFilter])

  const isLoading = isLoadingTenancies || isLoadingCharges || isLoadingPayments || isLoadingDeposits
  const hasNoTenancies = !isLoadingTenancies && allTenancies.length === 0
  const hasNoActiveTenancy = !isLoadingTenancies && allTenancies.length > 0 && activeTenancies.length === 0

  return (
    <div className="space-y-5 pb-10">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] pb-3.5">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
            My Payments
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tenancy Selector (When tenant has tenancies) */}
          {allTenancies.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="tenancy-filter" className="text-xs font-normal text-[#6B7280]">
                Filter by:
              </label>
              <select
                id="tenancy-filter"
                value={selectedTenancyId}
                onChange={(e) => setSelectedTenancyId(e.target.value)}
                className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-normal text-[#374151] shadow-2xs focus:border-[#408A71] focus:ring-1 focus:ring-[#408A71] cursor-pointer"
              >
                <option value="all">All Properties ({allTenancies.length})</option>
                {allTenancies.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.property_title} ({t.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/tenant/tenancy')}
          >
            My Tenancy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/tenant/applications')}
          >
            My Applications
          </Button>
        </div>
      </div>

      {/* Historical tenancy notice when no active tenancies exist */}
      {hasNoActiveTenancy && (
        <Alert variant="info" title="Historical Records">
          You currently have no active tenancies. Displaying payment records and obligations from your past or completed tenancies.
        </Alert>
      )}

      {/* Empty state when tenant has no tenancies at all */}
      {hasNoTenancies ? (
        <EmptyState
          title="No Payment Records Found"
          description="You do not have any tenancy records yet. Once a rental application is approved and a tenancy is activated, your rent schedule and payments will be displayed here."
          action={{
            label: 'Browse Properties',
            onClick: () => navigate('/app/tenant/properties'),
          }}
        />
      ) : (
        <>
          {/* 2. Financial Summary KPI Cards */}
          <section
            aria-label="Tenant financial summary"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
          >
            {/* Card 1: Outstanding Rent */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5 shadow-2xs">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  summary.totalOutstandingRent > 0
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-normal text-[#6B7280]">Outstanding Rent</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-24" />
                ) : (
                  <>
                    <p
                      className={`mt-0.5 text-xl font-medium tabular-nums ${
                        summary.totalOutstandingRent > 0 ? 'text-rose-600' : 'text-[#111827]'
                      }`}
                    >
                      {formatINR(summary.totalOutstandingRent)}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-normal truncate ${
                        summary.totalOutstandingRent > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {summary.totalOutstandingRent > 0 ? 'Overdue balance' : 'All caught up'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Card 2: Paid Rent */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-normal text-[#6B7280]">Paid Rent</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-24" />
                ) : (
                  <>
                    <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                      {formatINR(summary.totalPaidRent)}
                    </p>
                    <p className="mt-0.5 text-xs font-normal text-[#6B7280] truncate">
                      {summary.paidThisMonth > 0
                        ? `${formatINR(summary.paidThisMonth)} paid this month`
                        : 'Total rent settled'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Card 3: Next Rent Due */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-normal text-[#6B7280]">Next Rent Due</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-28" />
                ) : (
                  <>
                    <p className="mt-0.5 text-xl font-medium text-[#111827] truncate">
                      {summary.nextDueDate ? formatDate(summary.nextDueDate) : 'None'}
                    </p>
                    <p className="mt-0.5 text-xs font-normal text-[#6B7280] truncate">
                      {summary.nextDueDate
                        ? `${formatINR(summary.nextDueAmount)} upcoming rent`
                        : 'No upcoming rent due'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Card 4: Security Deposit Status */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-normal text-[#6B7280]">Security Deposit</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-32" />
                ) : (
                  <>
                    <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums truncate">
                      {formatINR(summary.totalDepositReceived)}
                      <span className="text-xs font-normal text-[#6B7280] ml-1.5">
                        of {formatINR(summary.totalDepositAgreed)}
                      </span>
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-normal truncate ${
                        summary.totalDepositPending > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {summary.totalDepositPending > 0
                        ? `${formatINR(summary.totalDepositPending)} pending collection`
                        : 'Fully collected'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* 3. Section Navigation Tabs */}
          <div className="border-b border-[#E5E7EB] pt-1">
            <nav className="flex space-x-6 overflow-x-auto no-scrollbar" aria-label="Payments tabs">
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`pb-3 text-sm font-medium border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-[#408A71] text-[#408A71]'
                    : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300'
                }`}
              >
                Payment History
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[#6B7280]">
                  {payments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('obligations')}
                className={`pb-3 text-sm font-medium border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'obligations'
                    ? 'border-[#408A71] text-[#408A71]'
                    : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300'
                }`}
              >
                Rent Obligations
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[#6B7280]">
                  {charges.filter((c) => c.charge_type === 'rent').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('deposits')}
                className={`pb-3 text-sm font-medium border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'deposits'
                    ? 'border-[#408A71] text-[#408A71]'
                    : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300'
                }`}
              >
                Security Deposit
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`pb-3 text-sm font-medium border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'ledger'
                    ? 'border-[#408A71] text-[#408A71]'
                    : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300'
                }`}
              >
                Payments Ledger
              </button>
            </nav>
          </div>

          {/* 4. Tab Content */}

          {/* TAB 1: Payment History */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[#111827]">Recorded Payments</h3>
                    <p className="text-xs font-normal text-[#6B7280] mt-0.5">
                      All rent and security deposit payments recorded by your property owner.
                    </p>
                  </div>
                </div>

                {isLoadingPayments ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-normal text-[#6B7280]">
                      No payments recorded yet. When payments are recorded by your owner, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]">
                        <tr>
                          <th className="py-3 px-4 font-medium">Payment Date</th>
                          {selectedTenancyId === 'all' && (
                            <th className="py-3 px-4 font-medium">Property</th>
                          )}
                          <th className="py-3 px-4 font-medium">Reference</th>
                          <th className="py-3 px-4 font-medium">Method</th>
                          <th className="py-3 px-4 font-medium text-right">Amount</th>
                          <th className="py-3 px-4 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6] text-[#111827]">
                        {payments.map((pmt) => {
                          const pmtDate = pmt.paid_at || pmt.created_at
                          const propTitle =
                            pmt.property_title ||
                            tenancyMap.get(pmt.tenancy)?.property_title ||
                            'Tenancy'
                          return (
                            <tr key={pmt.id} className="hover:bg-[#F9FAFB]/70 transition-colors">
                              <td className="py-3.5 px-4 font-medium">
                                {formatDate(pmtDate)}
                              </td>
                              {selectedTenancyId === 'all' && (
                                <td className="py-3.5 px-4 text-[#4B5563] truncate max-w-[180px]">
                                  {propTitle}
                                </td>
                              )}
                              <td className="py-3.5 px-4 font-mono text-xs text-[#6B7280]">
                                {pmt.transaction_reference || '—'}
                              </td>
                              <td className="py-3.5 px-4 text-[#4B5563]">
                                {pmt.payment_method_display || pmt.payment_method.toUpperCase()}
                              </td>
                              <td className="py-3.5 px-4 text-right font-medium tabular-nums text-[#111827]">
                                {formatINR(pmt.amount)}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <Badge
                                  variant={PAYMENT_STATUS_META[pmt.status]?.variant || 'neutral'}
                                  size="sm"
                                >
                                  {PAYMENT_STATUS_META[pmt.status]?.label || pmt.status}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Rent Obligations */}
          {activeTab === 'obligations' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-[#E5E7EB]">
                  <h3 className="text-sm font-medium text-[#111827]">Rent Schedule & Charges</h3>
                  <p className="text-xs font-normal text-[#6B7280] mt-0.5">
                    Monthly rent charges generated per your tenancy agreements and their payment status.
                  </p>
                </div>

                {isLoadingCharges ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : charges.filter((c) => c.charge_type === 'rent').length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-normal text-[#6B7280]">
                      No rent obligations generated yet. Charges will appear here automatically based on your rent schedule.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]">
                        <tr>
                          <th className="py-3 px-4 font-medium">Rent Period</th>
                          {selectedTenancyId === 'all' && (
                            <th className="py-3 px-4 font-medium">Property</th>
                          )}
                          <th className="py-3 px-4 font-medium">Due Date</th>
                          <th className="py-3 px-4 font-medium text-right">Rent Amount</th>
                          <th className="py-3 px-4 font-medium text-right">Paid</th>
                          <th className="py-3 px-4 font-medium text-right">Balance</th>
                          <th className="py-3 px-4 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6] text-[#111827]">
                        {charges
                          .filter((c) => c.charge_type === 'rent')
                          .map((chg) => {
                            const today = new Date().toISOString().split('T')[0]
                            const outstanding = parseFloat(chg.outstanding_amount || '0')
                            const isOverdue =
                              chg.is_overdue ||
                              (outstanding > 0 && chg.due_date && chg.due_date < today)
                            const isPaid = chg.status === 'paid' || outstanding === 0
                            const isPartiallyPaid =
                              !isPaid && parseFloat(chg.paid_amount || '0') > 0

                            const { statusLabel, statusVariant } = isPaid
                              ? { statusLabel: 'Paid', statusVariant: 'success' as BadgeVariant }
                              : isOverdue
                              ? { statusLabel: 'Overdue', statusVariant: 'danger' as BadgeVariant }
                              : isPartiallyPaid
                              ? { statusLabel: 'Partially Paid', statusVariant: 'warning' as BadgeVariant }
                              : { statusLabel: 'Upcoming', statusVariant: 'neutral' as BadgeVariant }

                            const propTitle =
                              chg.property_title ||
                              tenancyMap.get(chg.tenancy)?.property_title ||
                              'Tenancy'

                            return (
                              <tr key={chg.id} className="hover:bg-[#F9FAFB]/70 transition-colors">
                                <td className="py-3.5 px-4 font-medium">
                                  {chg.billing_period_start && chg.billing_period_end ? (
                                    <>
                                      {formatDate(chg.billing_period_start)} –{' '}
                                      {formatDate(chg.billing_period_end)}
                                    </>
                                  ) : (
                                    'Monthly Rent'
                                  )}
                                </td>
                                {selectedTenancyId === 'all' && (
                                  <td className="py-3.5 px-4 text-[#4B5563] truncate max-w-[180px]">
                                    {propTitle}
                                  </td>
                                )}
                                <td className="py-3.5 px-4 text-[#6B7280]">
                                  {formatDate(chg.due_date)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-medium tabular-nums">
                                  {formatINR(chg.amount)}
                                </td>
                                <td className="py-3.5 px-4 text-right text-emerald-700 font-medium tabular-nums">
                                  {formatINR(chg.paid_amount)}
                                </td>
                                <td
                                  className={`py-3.5 px-4 text-right font-medium tabular-nums ${
                                    outstanding > 0 && isOverdue
                                      ? 'text-rose-600'
                                      : 'text-[#111827]'
                                  }`}
                                >
                                  {formatINR(chg.outstanding_amount)}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <Badge variant={statusVariant} size="sm">
                                    {statusLabel}
                                  </Badge>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Security Deposit */}
          {activeTab === 'deposits' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-[#E5E7EB]">
                  <h3 className="text-sm font-medium text-[#111827]">Security Deposit Position</h3>
                  <p className="text-xs font-normal text-[#6B7280] mt-0.5">
                    Security deposits held, collected, and refundable across your tenancies.
                  </p>
                </div>

                {isLoadingDeposits ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : deposits.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-normal text-[#6B7280]">
                      No security deposit records found.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]">
                        <tr>
                          <th className="py-3 px-4 font-medium">Property / Tenancy</th>
                          <th className="py-3 px-4 font-medium text-right">Agreed Deposit</th>
                          <th className="py-3 px-4 font-medium text-right">Received</th>
                          <th className="py-3 px-4 font-medium text-right">Pending</th>
                          <th className="py-3 px-4 font-medium text-right">Currently Held</th>
                          <th className="py-3 px-4 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6] text-[#111827]">
                        {deposits.map((dep) => {
                          const agreed = parseFloat(dep.agreed_deposit || '0')
                          const received = parseFloat(dep.deposit_received || '0')
                          const pending = Math.max(0, agreed - received)
                          const isFullyPaid = received >= agreed && agreed > 0

                          return (
                            <tr key={dep.tenancy_id} className="hover:bg-[#F9FAFB]/70 transition-colors">
                              <td className="py-3.5 px-4 font-medium">
                                <div className="text-[#111827]">{dep.property_title}</div>
                                <div className="text-xs text-[#6B7280] font-normal">
                                  Tenancy #{dep.tenancy_id.slice(0, 8)}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right font-medium tabular-nums text-[#111827]">
                                {formatINR(dep.agreed_deposit)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-medium tabular-nums text-emerald-700">
                                {formatINR(dep.deposit_received)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-medium tabular-nums text-amber-700">
                                {formatINR(pending)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-medium tabular-nums text-[#111827]">
                                {formatINR(dep.deposit_held || dep.deposit_received)}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <Badge variant={isFullyPaid ? 'success' : 'warning'} size="sm">
                                  {isFullyPaid ? 'Fully Paid' : 'Pending Collection'}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Informational Guidance Alert */}
              <div className="rounded-xl border border-emerald-100 bg-[#EAF6F0]/60 p-4 text-xs text-[#0B493A] flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-[#408A71] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div className="space-y-1">
                  <p className="font-medium text-[#0B493A]">Security Deposit Protection & Accounting</p>
                  <p className="text-[#34745C]">
                    Security deposits are maintained in segregated accounting from ongoing monthly rent. Deposits are settled, deducted, or refunded upon lease completion in according with your signed tenancy agreement.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Combined Ledger */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
                <div className="p-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-[#111827]">Payments Ledger</h3>
                    <p className="text-xs font-normal text-[#6B7280] mt-0.5">
                      Chronological ledger of every charge and payment with a running balance.
                    </p>
                  </div>

                  {/* Ledger Filters */}
                  <div className="flex items-center gap-1.5">
                    {(['all', 'rent', 'deposit', 'payments'] as LedgerFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setLedgerFilter(filter)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                          ledgerFilter === filter
                            ? 'bg-[#408A71] text-white'
                            : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                        }`}
                      >
                        {filter === 'all'
                          ? 'All'
                          : filter === 'rent'
                            ? 'Rent'
                            : filter === 'deposit'
                              ? 'Deposit'
                              : 'Payments'}
                      </button>
                    ))}
                  </div>
                </div>

                {isLoading ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : filteredLedger.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-normal text-[#6B7280]">
                      No transactions found for the selected filter.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]">
                        <tr>
                          <th className="py-3 px-4 font-medium">Date</th>
                          <th className="py-3 px-4 font-medium">Description</th>
                          <th className="py-3 px-4 font-medium text-right">Charged</th>
                          <th className="py-3 px-4 font-medium text-right">Paid</th>
                          <th className="py-3 px-4 font-medium text-right">Running Balance</th>
                          <th className="py-3 px-4 font-medium text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6] text-[#111827]">
                        {filteredLedger.map((entry) => (
                          <tr key={entry.id} className="hover:bg-[#F9FAFB]/70 transition-colors">
                            <td className="py-3.5 px-4 font-medium text-[#6B7280]">
                              {entry.date}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-[#111827]">{entry.title}</div>
                              <div className="text-xs text-[#6B7280]">{entry.subtitle}</div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium tabular-nums text-[#111827]">
                              {entry.charged ? formatINR(entry.charged) : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium tabular-nums text-emerald-700">
                              {entry.paid ? formatINR(entry.paid) : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium tabular-nums text-[#111827]">
                              {formatINR(entry.balance)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Badge
                                variant={
                                  entry.status === 'paid'
                                    ? 'success'
                                    : entry.status === 'overdue'
                                      ? 'danger'
                                      : 'warning'
                                }
                                size="sm"
                              >
                                {entry.statusLabel}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Informational Note */}
          <div className="text-center text-xs text-[#6B7280] pt-2">
            Payments are recorded and verified by your property owner. For any billing questions or receipts, please contact your property owner.
          </div>
        </>
      )}
    </div>
  )
}

export default TenantPaymentsPage
