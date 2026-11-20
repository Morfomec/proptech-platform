import React, { useState, useMemo } from 'react'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Pagination,
  Select,
  Skeleton,
  type BadgeVariant,
} from '../../components/ui'
import {
  useOwnerFinancialTransactions,
  useOwnerRentCharges,
  useOwnerRentSummary,
  useOwnerSecurityDeposits,
} from '../../hooks/useOwnerRent'
import { useManagedTenancies } from '../../hooks/useOwnerTenancies'
import { useOwnerProperties } from '../../hooks/useOwnerProperties'
import { formatDate, formatDateTime, formatINR } from '../../utils/application'
import { RecordPaymentModal } from '../../components/owner/RecordPaymentModal'
import { PaymentDetailModal } from '../../components/owner/PaymentDetailModal'
import type {
  RentChargeStatus,
} from '../../types/rent'

const CHARGE_STATUS_META: Record<
  RentChargeStatus,
  { label: string; variant: BadgeVariant }
> = {
  paid: { label: 'Paid', variant: 'success' },
  partially_paid: { label: 'Partially Paid', variant: 'warning' },
  unpaid: { label: 'Unpaid', variant: 'neutral' },
  waived: { label: 'Waived', variant: 'neutral' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
}

const CHARGE_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'waived', label: 'Waived' },
  { value: 'cancelled', label: 'Cancelled' },
]

type ActiveTab = 'charges' | 'deposits' | 'transactions'

const PAGE_SIZE = 20

/**
 * OwnerRentPage
 * Complete Owner Portal Rent & Payments dashboard and ledger.
 * Route: /app/owner/rent
 */
export const OwnerRentPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('charges')

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [recordTenancyId, setRecordTenancyId] = useState<string | undefined>(undefined)
  const [recordInitialAmount, setRecordInitialAmount] = useState<string | undefined>(undefined)
  const [recordInitialChargeType, setRecordInitialChargeType] = useState<'rent' | 'security_deposit'>('rent')

  // Filter state for Charges (Rent Ledger - strictly rent-only)
  const [chargesPage, setChargesPage] = useState(1)
  const [chargeStatusFilter, setChargeStatusFilter] = useState<string>('all')
  const [chargePropertyFilter, setChargePropertyFilter] = useState<string>('all')
  const [chargeTenancyFilter, setChargeTenancyFilter] = useState<string>('all')
  const [dueDateFrom, setDueDateFrom] = useState('')
  const [dueDateTo, setDueDateTo] = useState('')

  // Filter state for Payment Transactions
  const [txPage, setTxPage] = useState(1)
  const [txPropertyFilter, setTxPropertyFilter] = useState<string>('all')
  const [txTenancyFilter, setTxTenancyFilter] = useState<string>('all')
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all')

  // Summary KPI Query
  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: isErrorSummary,
    refetch: refetchSummary,
  } = useOwnerRentSummary()

  // Properties and Tenancies for dropdown filtering
  const { data: propertiesData } = useOwnerProperties({ page: 1, page_size: 100 })
  const { data: tenanciesData } = useManagedTenancies({ page: 1, page_size: 100 })

  const properties = useMemo(() => propertiesData?.results ?? [], [propertiesData?.results])
  const tenancies = useMemo(() => tenanciesData?.results ?? [], [tenanciesData?.results])

  // Rent Charges Query (strictly rent-only for Rent Ledger)
  const {
    data: chargesData,
    isLoading: isLoadingCharges,
    isError: isErrorCharges,
    refetch: refetchCharges,
  } = useOwnerRentCharges({
    page: chargesPage,
    page_size: PAGE_SIZE,
    status: chargeStatusFilter !== 'all' ? chargeStatusFilter : undefined,
    charge_type: 'rent',
    property_id: chargePropertyFilter !== 'all' ? chargePropertyFilter : undefined,
    tenancy_id: chargeTenancyFilter !== 'all' ? chargeTenancyFilter : undefined,
    due_date_from: dueDateFrom || undefined,
    due_date_to: dueDateTo || undefined,
  })

  // Security Deposits Query
  const {
    data: securityDeposits = [],
    isLoading: isLoadingDeposits,
    isError: isErrorDeposits,
    refetch: refetchDeposits,
  } = useOwnerSecurityDeposits()

  // Unified Transactions Query
  const {
    data: transactionsData,
    isLoading: isLoadingTx,
    isError: isErrorTx,
    refetch: refetchTx,
  } = useOwnerFinancialTransactions({
    page: txPage,
    page_size: PAGE_SIZE,
    property_id: txPropertyFilter !== 'all' ? txPropertyFilter : undefined,
    tenancy_id: txTenancyFilter !== 'all' ? txTenancyFilter : undefined,
    transaction_type: txTypeFilter !== 'all' ? txTypeFilter : undefined,
  })

  const charges = chargesData?.results ?? []
  const totalChargesCount = chargesData?.count ?? 0
  const totalChargesPages = Math.max(1, Math.ceil(totalChargesCount / PAGE_SIZE))

  const transactions = transactionsData?.results ?? []
  const totalTxCount = transactionsData?.count ?? 0
  const totalTxPages = Math.max(1, Math.ceil(totalTxCount / PAGE_SIZE))

  const propertyOptions = useMemo(
    () => [
      { value: 'all', label: 'All Properties' },
      ...properties.map((p) => ({ value: p.id, label: p.title })),
    ],
    [properties]
  )

  const tenancyOptions = useMemo(
    () => [
      { value: 'all', label: 'All Tenancies' },
      ...tenancies
        .filter((t) => t.status !== 'cancelled')
        .map((t) => ({
          value: t.id,
          label: `${t.property_title} — ${t.tenant_name}${t.status && t.status !== 'active' ? ` (${t.status.charAt(0).toUpperCase() + t.status.slice(1)})` : ''}`,
        })),
    ],
    [tenancies]
  )

  const handleOpenRecordPayment = (
    tenancyId?: string,
    initialAmount?: string,
    chargeType: 'rent' | 'security_deposit' = 'rent'
  ) => {
    setRecordTenancyId(tenancyId)
    setRecordInitialAmount(initialAmount)
    setRecordInitialChargeType(chargeType)
    setIsRecordModalOpen(true)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
          Rent & Payments
        </h1>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenRecordPayment()}
          >
            + Record Payment
          </Button>
        </div>
      </div>

      {/* 2. Top Summary KPI Row: Two Distinct Financial Zones */}
      <section aria-label="Financial Summary" className="space-y-4">
        {isLoadingSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
              <Skeleton className="h-4 w-36" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
              <Skeleton className="h-4 w-36" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            </div>
          </div>
        ) : isErrorSummary ? (
          <Alert variant="error" title="Summary Error">
            <span>Unable to retrieve rent summary aggregates.</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={() => void refetchSummary()}
            >
              Retry
            </Button>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Zone A: Monthly Rent Health */}
            <div className="lg:col-span-7 rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <h2 className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">
                    Monthly Rent Health
                  </h2>
                </div>
                {summary?.upcoming_rent && parseFloat(summary.upcoming_rent) > 0 && (
                  <span className="text-[11px] font-normal text-[#6B7280] bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-0.5 rounded-md">
                    Upcoming Next Cycle: {formatINR(summary.upcoming_rent)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Rent Collected This Month */}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-normal text-[#6B7280] truncate">Collected This Month</p>
                    <p className="mt-0.5 text-lg font-medium text-[#111827] tabular-nums">
                      {formatINR(summary?.rent_collected_this_month || summary?.total_collected)}
                    </p>
                  </div>
                </div>

                {/* Rent Pending */}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-normal text-[#6B7280] truncate">Rent Pending</p>
                    <p className="mt-0.5 text-lg font-medium text-[#111827] tabular-nums">
                      {formatINR(summary?.rent_pending || summary?.outstanding_rent)}
                    </p>
                  </div>
                </div>

                {/* Overdue Rent */}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-normal text-[#6B7280] truncate">Overdue Rent</p>
                    <p className="mt-0.5 text-lg font-medium text-rose-600 tabular-nums">
                      {formatINR(summary?.overdue_rent)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone B: Security Deposit Position */}
            <div className="lg:col-span-5 rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  <h2 className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">
                    Security Deposit Position
                  </h2>
                </div>
                <span className="text-[11px] font-normal text-[#6B7280]">
                  Security Deposit Position
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Deposits Held */}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#34745C]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-normal text-[#6B7280] truncate">Deposits Held</p>
                    <p className="mt-0.5 text-lg font-medium text-[#34745C] tabular-nums">
                      {formatINR(summary?.security_deposits_held) ?? '₹0.00'}
                    </p>
                  </div>
                </div>

                {/* Pending Deposit Collection */}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-normal text-[#6B7280] truncate">Pending Collection</p>
                    <p className="mt-0.5 text-lg font-medium text-[#111827] tabular-nums">
                      {formatINR(summary?.pending_deposit_collection || summary?.total_deposits_outstanding) ?? '₹0.00'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Navigation Tabs: Three-tab navigation */}
      <div className="border-b border-[#E5E7EB]">
        <nav className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('charges')}
            className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors cursor-pointer ${
              activeTab === 'charges'
                ? 'border-[#408A71] text-[#408A71]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300'
            }`}
          >
            Rent Ledger
            {totalChargesCount > 0 && (
              <span className="ml-2 rounded-full bg-[#ECF5F2] text-[#408A71] px-2 py-0.5 text-xs font-semibold">
                {totalChargesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deposits')}
            className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors cursor-pointer ${
              activeTab === 'deposits'
                ? 'border-[#408A71] text-[#408A71]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300'
            }`}
          >
            Security Deposits
            {securityDeposits.length > 0 && (
              <span className="ml-2 rounded-full bg-[#ECF5F2] text-[#408A71] px-2 py-0.5 text-xs font-semibold">
                {securityDeposits.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors cursor-pointer ${
              activeTab === 'transactions'
                ? 'border-[#408A71] text-[#408A71]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-gray-300'
            }`}
          >
            Payment Transactions
            {totalTxCount > 0 && (
              <span className="ml-2 rounded-full bg-[#ECF5F2] text-[#408A71] px-2 py-0.5 text-xs font-semibold">
                {totalTxCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* 4. Tab Content */}

      {/* TAB 1: RENT CHARGES */}
      {activeTab === 'charges' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-1 md:col-span-1 xl:col-span-3">
              <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                Property
              </label>
              <Select
                options={propertyOptions}
                value={chargePropertyFilter}
                onChange={(e) => {
                  setChargePropertyFilter(e.target.value)
                  setChargesPage(1)
                }}
              />
            </div>

            <div className="sm:col-span-1 md:col-span-1 xl:col-span-4">
              <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                Tenancy
              </label>
              <Select
                options={tenancyOptions}
                value={chargeTenancyFilter}
                onChange={(e) => {
                  setChargeTenancyFilter(e.target.value)
                  setChargesPage(1)
                }}
              />
            </div>

            <div className="sm:col-span-1 md:col-span-1 xl:col-span-2">
              <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                Status
              </label>
              <Select
                options={CHARGE_STATUS_OPTIONS}
                value={chargeStatusFilter}
                onChange={(e) => {
                  setChargeStatusFilter(e.target.value)
                  setChargesPage(1)
                }}
              />
            </div>

            <div className="sm:col-span-2 md:col-span-2 xl:col-span-3">
              <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                Due Date Range
              </label>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="min-w-0 flex-1">
                  <Input
                    type="date"
                    placeholder="From"
                    value={dueDateFrom}
                    onChange={(e) => {
                      setDueDateFrom(e.target.value)
                      setChargesPage(1)
                    }}
                  />
                </div>
                <span className="text-[#9CA3AF] text-xs shrink-0">–</span>
                <div className="min-w-0 flex-1">
                  <Input
                    type="date"
                    placeholder="To"
                    value={dueDateTo}
                    onChange={(e) => {
                      setDueDateTo(e.target.value)
                      setChargesPage(1)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Charges Table */}
          {isLoadingCharges ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : isErrorCharges ? (
            <Alert variant="error" title="Charges Error">
              <span>Failed to load rent charges.</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-3"
                onClick={() => void refetchCharges()}
              >
                Retry
              </Button>
            </Alert>
          ) : charges.length === 0 ? (
            <EmptyState
              title="No rent charges found"
              description="No financial obligations match your current filter selections. Active tenancies automatically incur monthly rent charges."
            />
          ) : (
            <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                  <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                    <tr>
                      <th className="py-3 px-3 text-center font-normal w-12 text-[#6B7280]">S.No.</th>
                      <th className="py-3 px-3.5 font-normal">Property & Tenant</th>
                      <th className="py-3 px-3.5 font-normal">Billing Period</th>
                      <th className="py-3 px-3.5 font-normal">Due Date</th>
                      <th className="py-3 px-3.5 font-normal text-right">Rent Amount</th>
                      <th className="py-3 px-3.5 font-normal text-right">Paid</th>
                      <th className="py-3 px-3.5 font-normal text-right">Outstanding</th>
                      <th className="py-3 px-3.5 font-normal text-center">Status</th>
                      <th className="py-3 px-3.5 font-normal text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                    {charges.map((charge, idx) => {
                      const sNo = (chargesPage - 1) * PAGE_SIZE + idx + 1
                      const statusMeta =
                        CHARGE_STATUS_META[charge.status] || {
                          label: charge.status,
                          variant: 'neutral' as BadgeVariant,
                        }
                      const hasOutstanding = parseFloat(charge.outstanding_amount || '0') > 0

                      return (
                        <tr key={charge.id} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                          <td className="py-3 px-3 text-center text-[#6B7280] tabular-nums font-normal">
                            {sNo}
                          </td>
                          <td className="py-3 px-3.5">
                            <p className="font-medium text-[#111827] text-xs">
                              <span className="text-[#6B7280] font-normal mr-1">Property:</span>
                              {charge.property_title}
                            </p>
                            <p className="font-medium text-[#111827] text-xs mt-1">
                              <span className="text-[#6B7280] font-normal mr-1">Tenant:</span>
                              {charge.tenant_name}
                            </p>
                          </td>
                          <td className="py-3 px-3.5 text-[#6B7280]">
                            {formatDate(charge.billing_period_start)} –{' '}
                            {formatDate(charge.billing_period_end)}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className={charge.is_overdue ? 'text-red-700 font-medium' : 'text-[#4B5563]'}>
                              {formatDate(charge.due_date)}
                            </span>
                            {charge.is_overdue && (
                              <div className="mt-0.5">
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                                  Overdue
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right font-medium tabular-nums">
                            {formatINR(charge.amount)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-medium tabular-nums text-emerald-700">
                            {formatINR(charge.paid_amount)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-medium tabular-nums">
                            <span className={hasOutstanding ? 'text-amber-700 font-semibold' : 'text-[#6B7280]'}>
                              {formatINR(charge.outstanding_amount)}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <Badge variant={statusMeta.variant} size="sm" dot={charge.is_overdue}>
                              {statusMeta.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-3.5 text-right pr-4 whitespace-nowrap">
                            {hasOutstanding ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenRecordPayment(
                                    charge.tenancy,
                                    charge.outstanding_amount,
                                    charge.charge_type === 'security_deposit' ? 'security_deposit' : 'rent'
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[#408A71] text-[#408A71] hover:bg-[#408A71]/10 transition-colors cursor-pointer"
                              >
                                Record Payment
                              </button>
                            ) : (
                              <span className="text-xs text-[#9CA3AF] italic">
                                Paid in full
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalChargesPages > 1 && (
                <div className="border-t border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-[#6B7280]">
                    Showing {charges.length} of {totalChargesCount} charges
                  </span>
                  <Pagination
                    currentPage={chargesPage}
                    totalPages={totalChargesPages}
                    onPageChange={(p) => setChargesPage(p)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SECURITY DEPOSITS */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          {isLoadingDeposits ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : isErrorDeposits ? (
            <Alert variant="error" title="Security Deposits Error">
              <span>Failed to load security deposit records.</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-3"
                onClick={() => void refetchDeposits()}
              >
                Retry
              </Button>
            </Alert>
          ) : securityDeposits.length === 0 ? (
            <EmptyState
              title="No security deposits found"
              description="No active security deposit obligations found for your tenancies."
            />
          ) : (
            <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                  <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                    <tr>
                      <th className="py-3 px-3 text-center font-normal w-12 text-[#6B7280]">S.No.</th>
                      <th className="py-3 px-3.5 font-normal">Property & Tenant</th>
                      <th className="py-3 px-3.5 font-normal text-right">Agreed Deposit</th>
                      <th className="py-3 px-3.5 font-normal text-right">Received</th>
                      <th className="py-3 px-3.5 font-normal text-right">Pending Collection</th>
                      <th className="py-3 px-3.5 font-normal text-right">Adjustments</th>
                      <th className="py-3 px-3.5 font-normal text-right">Refunds</th>
                      <th className="py-3 px-3.5 font-normal text-right">Deposits Held</th>
                      <th className="py-3 px-3.5 font-normal text-center">Status</th>
                      <th className="py-3 px-3.5 font-normal text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                    {securityDeposits.map((dep, idx) => {
                      const hasOutstanding = parseFloat(dep.outstanding_deposit || '0') > 0
                      const statusVariant: BadgeVariant =
                        dep.status === 'paid'
                          ? 'success'
                          : dep.status === 'partially_paid'
                          ? 'warning'
                          : 'neutral'

                      return (
                        <tr key={dep.tenancy_id} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                          <td className="py-3 px-3 text-center text-[#6B7280] tabular-nums font-normal">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3.5">
                            <p className="font-medium text-[#111827] text-xs">
                              <span className="text-[#6B7280] font-normal mr-1">Property:</span>
                              {dep.property_title}
                            </p>
                            <p className="font-medium text-[#111827] text-xs mt-1">
                              <span className="text-[#6B7280] font-normal mr-1">Tenant:</span>
                              {dep.tenant_name}
                            </p>
                          </td>
                          <td className="py-3 px-3.5 text-right font-medium tabular-nums text-[#111827]">
                            {formatINR(dep.agreed_deposit)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-medium tabular-nums text-emerald-700">
                            {formatINR(dep.deposit_received)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-medium tabular-nums">
                            {hasOutstanding ? (
                              <span className="text-amber-700">{formatINR(dep.outstanding_deposit)}</span>
                            ) : (
                              <span className="text-[#6B7280]">₹0.00</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right tabular-nums text-[#6B7280]">
                            {formatINR(dep.adjustments)}
                          </td>
                          <td className="py-3 px-3.5 text-right tabular-nums">
                            {parseFloat(dep.refunds || '0') > 0 ? (
                              <span className="text-rose-600 font-medium">{formatINR(dep.refunds)}</span>
                            ) : (
                              <span className="text-[#6B7280]">₹0.00</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right font-medium tabular-nums text-[#34745C]">
                            {formatINR(dep.deposit_held)}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <Badge variant={statusVariant} size="sm">
                              {dep.status_display}
                            </Badge>
                          </td>
                          <td className="py-3 px-3.5 text-right pr-4">
                            {hasOutstanding ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRecordTenancyId(dep.tenancy_id)
                                  setRecordInitialAmount(dep.outstanding_deposit)
                                  setRecordInitialChargeType('security_deposit')
                                  setIsRecordModalOpen(true)
                                }}
                              >
                                Record Deposit
                              </Button>
                            ) : (
                              <span className="text-[#9CA3AF] text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
              <div className="w-full sm:w-56">
                <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                  Property
                </label>
                <Select
                  options={propertyOptions}
                  value={txPropertyFilter}
                  onChange={(e) => {
                    setTxPropertyFilter(e.target.value)
                    setTxPage(1)
                  }}
                />
              </div>

              <div className="w-full sm:w-56">
                <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                  Tenancy
                </label>
                <Select
                  options={tenancyOptions}
                  value={txTenancyFilter}
                  onChange={(e) => {
                    setTxTenancyFilter(e.target.value)
                    setTxPage(1)
                  }}
                />
              </div>

              <div className="w-full sm:w-48">
                <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                  Transaction Type
                </label>
                <Select
                  options={[
                    { value: 'all', label: 'All Transactions' },
                    { value: 'rent_payment', label: 'Rent Payments' },
                    { value: 'deposit_payment', label: 'Security Deposits' },
                    { value: 'refund', label: 'Refunds' },
                  ]}
                  value={txTypeFilter}
                  onChange={(e) => {
                    setTxTypeFilter(e.target.value)
                    setTxPage(1)
                  }}
                />
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenRecordPayment()}
            >
              + Record Payment
            </Button>
          </div>

          {/* Transactions Table */}
          {isLoadingTx ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : isErrorTx ? (
            <Alert variant="error" title="Transactions Error">
              <span>Failed to load transaction history.</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-3"
                onClick={() => void refetchTx()}
              >
                Retry
              </Button>
            </Alert>
          ) : transactions.length === 0 ? (
            <EmptyState
              title="No transactions recorded"
              description="No financial transactions match your selected filters. Record payments or issue refunds to build an audit history."
              action={{
                label: 'Record First Payment',
                onClick: () => handleOpenRecordPayment(),
              }}
            />
          ) : (
            <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                  <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                    <tr>
                      <th className="py-3 px-3 text-center font-normal w-12 text-[#6B7280]">S.No.</th>
                      <th className="py-3 px-3.5 font-normal">Type</th>
                      <th className="py-3 px-3.5 font-normal">Date</th>
                      <th className="py-3 px-3.5 font-normal">Tenant & Property</th>
                      <th className="py-3 px-3.5 font-normal">Method / Ref</th>
                      <th className="py-3 px-3.5 font-normal text-right">Amount</th>
                      <th className="py-3 px-3.5 font-normal text-center">Status</th>
                      <th className="py-3 px-3.5 font-normal text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                    {transactions.map((tx, idx) => {
                      const sNo = (txPage - 1) * PAGE_SIZE + idx + 1
                      const isRefund = tx.transaction_type === 'refund'
                      const isDeposit = tx.transaction_type === 'deposit_payment'

                      return (
                        <tr key={tx.id} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                          <td className="py-3 px-3 text-center text-[#6B7280] tabular-nums font-normal">
                            {sNo}
                          </td>
                          <td className="py-3 px-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                                isRefund
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : isDeposit
                                  ? 'bg-teal-50 text-[#34745C] border-teal-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {tx.transaction_type_display}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-[#6B7280]">
                            {formatDateTime(tx.date)}
                          </td>
                          <td className="py-3 px-3.5">
                            <p className="font-medium text-[#111827] text-xs">
                              <span className="text-[#6B7280] font-normal mr-1">Tenant:</span>
                              {tx.tenant_name}
                            </p>
                            <p className="font-medium text-[#111827] text-xs mt-0.5">
                              <span className="text-[#6B7280] font-normal mr-1">Property:</span>
                              {tx.property_title}
                            </p>
                          </td>
                          <td className="py-3 px-3.5">
                            <p className="text-[#4B5563]">
                              {tx.payment_method_display || tx.payment_method}
                            </p>
                            {tx.transaction_reference && (
                              <p className="font-mono text-[11px] text-[#6B7280] mt-0.5">
                                {tx.transaction_reference}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right tabular-nums font-medium">
                            <span className={isRefund ? 'text-rose-600' : 'text-emerald-700'}>
                              {isRefund ? `-${formatINR(tx.amount)}` : `+${formatINR(tx.amount)}`}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <Badge
                              variant={
                                tx.status === 'completed'
                                  ? 'success'
                                  : tx.status === 'pending'
                                  ? 'warning'
                                  : 'danger'
                              }
                              size="sm"
                            >
                              {tx.status_display}
                            </Badge>
                          </td>
                          <td className="py-3 px-3.5 text-right pr-4">
                            <button
                              type="button"
                              onClick={() => {
                                if (tx.payment_id) {
                                  setSelectedPaymentId(tx.payment_id)
                                }
                              }}
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

              {totalTxPages > 1 && (
                <div className="border-t border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-[#6B7280]">
                    Showing {transactions.length} of {totalTxCount} transactions
                  </span>
                  <Pagination
                    currentPage={txPage}
                    totalPages={totalTxPages}
                    onPageChange={(p) => setTxPage(p)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <RecordPaymentModal
        open={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        initialTenancyId={recordTenancyId}
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

export default OwnerRentPage
