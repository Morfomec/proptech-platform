import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  Input,
  Pagination,
  Skeleton,
} from '../../components/ui'
import { formatDate, formatINR } from '../../utils/application'
import { getMediaUrl } from '../../utils/imageUrl'
import { getTenancyStatusMeta } from '../../utils/tenancy'
import type { TenancyListItem, TenancyStatus } from '../../types/leasing'
import type { PaymentItem, RentChargeItem, SecurityDepositItem } from '../../types/rent'

const PAGE_SIZE = 20

type StatusFilter = 'all' | TenancyStatus

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Proposals' },
  { id: 'confirmed', label: 'Upcoming' },
  { id: 'ended', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
]

interface TenantOverviewMetrics {
  totalOverdueRent: number
  overdueTenanciesCount: number
  nextDueDate: string | null
  nextDueTotalAmount: number
  nextDueTenanciesCount: number
  totalDepositAgreed: number
  totalDepositReceived: number
  totalDepositPending: number
  paidThisMonth: number
  lastPaymentDate: string | null
  tenancyDuesMap: Record<
    string,
    {
      overdueRent: number
      pendingDeposit: number
      hasDues: boolean
      overduePeriodLabel: string
      nextDueDate: string | null
    }
  >
}

/**
 * Calculates summary metrics across ACTIVE tenancies only using rent charges,
 * payments, and security deposits data.
 */
function computeTenantOverviewSummary(
  activeTenancies: TenancyListItem[],
  charges: RentChargeItem[],
  payments: PaymentItem[],
  deposits: SecurityDepositItem[]
): TenantOverviewMetrics {
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const activeIds = new Set(activeTenancies.map((t) => t.id))

  const duesMap: Record<
    string,
    {
      overdueRent: number
      pendingDeposit: number
      hasDues: boolean
      overduePeriodLabel: string
      nextDueDate: string | null
    }
  > = {}

  for (const t of activeTenancies) {
    duesMap[t.id] = {
      overdueRent: 0,
      pendingDeposit: 0,
      hasDues: false,
      overduePeriodLabel: '',
      nextDueDate: null,
    }
  }

  let totalOverdueRent = 0
  const overdueTenancyIds = new Set<string>()

  // Process rent charges for active tenancies
  for (const chg of charges) {
    const tid = chg.tenancy
    if (!tid || !activeIds.has(tid)) continue

    const outstanding = parseFloat(chg.outstanding_amount || '0')
    const isOverdue =
      chg.is_overdue || (outstanding > 0 && chg.due_date && chg.due_date < today)

    if (chg.charge_type === 'rent') {
      if (isOverdue && outstanding > 0) {
        totalOverdueRent += outstanding
        overdueTenancyIds.add(tid)
        if (duesMap[tid]) {
          duesMap[tid].overdueRent += outstanding
          duesMap[tid].hasDues = true
          if (!duesMap[tid].overduePeriodLabel && chg.billing_period_start) {
            const d = new Date(chg.billing_period_start)
            duesMap[tid].overduePeriodLabel = d.toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })
          }
        }
      } else if (outstanding > 0 && chg.due_date && chg.due_date >= today) {
        if (duesMap[tid]) {
          if (!duesMap[tid].nextDueDate || chg.due_date < duesMap[tid].nextDueDate!) {
            duesMap[tid].nextDueDate = chg.due_date
          }
        }
      }
    }
  }

  // Identify earliest upcoming due date across active tenancies
  let earliestDueDate: string | null = null
  for (const tid of activeIds) {
    const dDate = duesMap[tid]?.nextDueDate
    if (dDate) {
      if (!earliestDueDate || dDate < earliestDueDate) {
        earliestDueDate = dDate
      }
    }
  }

  // If no future charge is recorded yet, derive the next recurring calendar due date from rent_due_day
  if (!earliestDueDate && activeTenancies.length > 0) {
    let earliestDerived: string | null = null
    for (const t of activeTenancies) {
      const dueDay = (t as { rent_due_day?: number | null }).rent_due_day || 1
      let d = new Date(now.getFullYear(), now.getMonth(), dueDay)
      if (d < now) {
        d = new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
      }
      const iso = d.toISOString().split('T')[0]
      if (!duesMap[t.id].nextDueDate) {
        duesMap[t.id].nextDueDate = iso
      }
      if (!earliestDerived || iso < earliestDerived) {
        earliestDerived = iso
      }
    }
    earliestDueDate = earliestDerived
  }

  // Calculate sum due on earliestDueDate
  let nextDueTotalAmount = 0
  let nextDueTenanciesCount = 0
  if (earliestDueDate) {
    for (const t of activeTenancies) {
      if (duesMap[t.id]?.nextDueDate === earliestDueDate) {
        nextDueTotalAmount += parseFloat(t.monthly_rent || '0')
        nextDueTenanciesCount += 1
      }
    }
  }

  // Security deposits
  let totalDepositAgreed = 0
  let totalDepositReceived = 0
  let totalDepositPending = 0

  const depositsByTenancy = new Map<string, SecurityDepositItem>()
  for (const dep of deposits) {
    if (activeIds.has(dep.tenancy_id)) {
      depositsByTenancy.set(dep.tenancy_id, dep)
    }
  }

  for (const t of activeTenancies) {
    const agreed = parseFloat(t.security_deposit || '0')
    totalDepositAgreed += agreed

    const dep = depositsByTenancy.get(t.id)
    if (dep) {
      const rec = parseFloat(dep.deposit_received || '0')
      const pend = parseFloat(dep.outstanding_deposit || '0')
      totalDepositReceived += rec
      totalDepositPending += pend
      if (duesMap[t.id]) {
        duesMap[t.id].pendingDeposit = pend
        if (pend > 0) duesMap[t.id].hasDues = true
      }
    } else {
      const depCharge = charges.find(
        (c) => c.tenancy === t.id && c.charge_type === 'security_deposit'
      )
      if (depCharge) {
        const rec = parseFloat(depCharge.paid_amount || '0')
        const pend = parseFloat(depCharge.outstanding_amount || '0')
        totalDepositReceived += rec
        totalDepositPending += pend
        if (duesMap[t.id]) {
          duesMap[t.id].pendingDeposit = pend
          if (pend > 0) duesMap[t.id].hasDues = true
        }
      } else {
        totalDepositPending += agreed
        if (duesMap[t.id] && agreed > 0) {
          duesMap[t.id].pendingDeposit = agreed
          duesMap[t.id].hasDues = true
        }
      }
    }
  }

  // Paid this month & last payment date
  let paidThisMonth = 0
  let lastPaymentDate: string | null = null

  for (const pmt of payments) {
    const tid = pmt.tenancy
    if (!tid || !activeIds.has(tid)) continue
    if (pmt.status !== 'completed') continue

    const pmtDateStr = pmt.paid_at || pmt.created_at
    if (pmtDateStr) {
      if (!lastPaymentDate || pmtDateStr > lastPaymentDate) {
        lastPaymentDate = pmtDateStr
      }
      const d = new Date(pmtDateStr)
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        paidThisMonth += parseFloat(pmt.amount || '0')
      }
    }
  }

  return {
    totalOverdueRent,
    overdueTenanciesCount: overdueTenancyIds.size,
    nextDueDate: earliestDueDate,
    nextDueTotalAmount,
    nextDueTenanciesCount,
    totalDepositAgreed,
    totalDepositReceived,
    totalDepositPending,
    paidThisMonth,
    lastPaymentDate,
    tenancyDuesMap: duesMap,
  }
}

/**
 * TenantTenancyPage
 * Tenant Workspace tenancy list view at `/app/tenant/tenancy`.
 * Shows financial summary cards across active tenancies, "Active" default filter,
 * "Has dues" filter, and money-status blocks on cards.
 */
export const TenantTenancyPage: React.FC = () => {
  const navigate = useNavigate()

  const [currentPage, setCurrentPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('active')
  const [hasDuesOnly, setHasDuesOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Tenancies Query
  const {
    data: tenanciesData,
    isLoading: isLoadingTenancies,
    isError,
    refetch,
  } = useMyTenancies({ page: 1, page_size: 100 })

  const allTenancies = useMemo(() => tenanciesData?.results ?? [], [tenanciesData])
  const activeTenancies = useMemo(
    () => allTenancies.filter((t) => t.status === 'active'),
    [allTenancies]
  )

  // 2. Read-only charges, payments, and deposits across all tenancies for the tenant
  const { data: rentChargesData, isLoading: isLoadingCharges } = useTenantRentCharges()
  const { data: tenancyPaymentsData, isLoading: isLoadingPayments } = useTenantPayments()
  const { data: tenancyDeposits = [], isLoading: isLoadingDeposits } = useTenantSecurityDeposits()

  const rawCharges = useMemo(() => rentChargesData?.results ?? [], [rentChargesData])
  const rawPayments = useMemo(() => tenancyPaymentsData?.results ?? [], [tenancyPaymentsData])

  const isLoadingRent = isLoadingCharges || isLoadingPayments || isLoadingDeposits

  // 3. Compute Summary Metrics
  const metrics = useMemo(() => {
    return computeTenantOverviewSummary(
      activeTenancies,
      rawCharges,
      rawPayments,
      tenancyDeposits
    )
  }, [activeTenancies, rawCharges, rawPayments, tenancyDeposits])

  const tabCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: allTenancies.length,
      pending: 0,
      confirmed: 0,
      active: 0,
      ended: 0,
      cancelled: 0,
      rejected: 0,
    }
    for (const item of allTenancies) {
      counts[item.status] = (counts[item.status] ?? 0) + 1
    }
    return counts
  }, [allTenancies])

  // 4. Filter & Sort Tenancies
  const filteredTenancies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return allTenancies.filter((item) => {
      if (hasDuesOnly && !metrics.tenancyDuesMap[item.id]?.hasDues) {
        return false
      }
      if (activeStatus !== 'all' && item.status !== activeStatus) {
        return false
      }
      if (!query) return true
      const titleMatch = (item.property_title ?? '').toLowerCase().includes(query)
      const addressMatch = (item.property_address ?? '').toLowerCase().includes(query)
      return titleMatch || addressMatch
    })
  }, [allTenancies, activeStatus, hasDuesOnly, searchQuery, metrics.tenancyDuesMap])

  // Sort order: tenancies with dues first, then other active ones, then upcoming, completed, and cancelled
  const sortedTenancies = useMemo(() => {
    return [...filteredTenancies].sort((a, b) => {
      const aActive = a.status === 'active'
      const bActive = b.status === 'active'
      const aDues = aActive && Boolean(metrics.tenancyDuesMap[a.id]?.hasDues)
      const bDues = bActive && Boolean(metrics.tenancyDuesMap[b.id]?.hasDues)

      // 1. Dues first
      if (aDues && !bDues) return -1
      if (!aDues && bDues) return 1

      // 2. Active next
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1

      // 3. Status order: confirmed (upcoming) -> ended (completed) -> cancelled
      const statusWeight: Record<string, number> = {
        confirmed: 1,
        ended: 2,
        cancelled: 3,
        pending: 4,
      }
      const weightA = statusWeight[a.status] ?? 9
      const weightB = statusWeight[b.status] ?? 9
      return weightA - weightB
    })
  }, [filteredTenancies, metrics.tenancyDuesMap])

  const totalPages = Math.max(1, Math.ceil(sortedTenancies.length / PAGE_SIZE))
  const visibleTenancies = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedTenancies.slice(start, start + PAGE_SIZE)
  }, [sortedTenancies, currentPage])

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
    <div className="space-y-5 pb-10">
      {/* 1. Header Bar */}
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

      {/* 2. Summary KPI Cards (Across Active Tenancies Only) */}
      <section
        aria-label="Active tenancies financial summary"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
      >
        {/* Card 1: Total outstanding */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              metrics.totalOverdueRent > 0
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
            <p className="text-xs font-normal text-[#6B7280]">Total outstanding</p>
            {isLoadingTenancies || isLoadingRent ? (
              <Skeleton className="mt-1 h-6 w-24" />
            ) : (
              <>
                <p
                  className={`mt-1 text-xl font-medium tabular-nums leading-snug ${
                    metrics.totalOverdueRent > 0 ? 'text-rose-600' : 'text-[#111827]'
                  }`}
                >
                  {formatINR(metrics.totalOverdueRent)}
                </p>
                {metrics.totalOverdueRent > 0 ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-700 truncate">
                    <span>Overdue · {metrics.overdueTenanciesCount} {metrics.overdueTenanciesCount === 1 ? 'tenancy' : 'tenancies'}</span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setHasDuesOnly(true)
                        setActiveStatus('all')
                        setCurrentPage(1)
                      }}
                      className="font-medium underline hover:text-rose-800 cursor-pointer shrink-0"
                    >
                      View dues
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs font-normal text-emerald-700">
                    All caught up
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Card 2: Next rent due */}
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
          <div className="min-w-0 flex-1">
            <p className="text-xs font-normal text-[#6B7280]">Next rent due</p>
            {isLoadingTenancies || isLoadingRent ? (
              <Skeleton className="mt-1 h-6 w-28" />
            ) : (
              <>
                <p className="mt-1 text-xl font-medium text-[#111827] leading-snug truncate">
                  {metrics.nextDueDate ? formatDate(metrics.nextDueDate) : 'None'}
                </p>
                <p className="mt-1 text-xs font-normal text-[#6B7280] truncate">
                  {metrics.nextDueDate
                    ? `${formatINR(metrics.nextDueTotalAmount)} across ${metrics.nextDueTenanciesCount} active`
                    : 'No upcoming rent due'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Card 3: Security deposits */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
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
            <p className="text-xs font-normal text-[#6B7280]">Security deposits</p>
            {isLoadingTenancies || isLoadingRent ? (
              <Skeleton className="mt-1 h-6 w-32" />
            ) : (
              <>
                <p className="mt-1 text-xl font-medium text-[#111827] tabular-nums leading-snug truncate">
                  {formatINR(metrics.totalDepositReceived)}
                  <span className="text-xs font-normal text-[#6B7280] ml-1.5">
                    of {formatINR(metrics.totalDepositAgreed)}
                  </span>
                </p>
                <p
                  className={`mt-1 text-xs font-normal truncate ${
                    metrics.totalDepositPending > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {metrics.totalDepositPending > 0
                    ? `${formatINR(metrics.totalDepositPending)} still to pay`
                    : 'Fully paid'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Card 4: Paid this month */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
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
            <p className="text-xs font-normal text-[#6B7280]">Paid this month</p>
            {isLoadingTenancies || isLoadingRent ? (
              <Skeleton className="mt-1 h-6 w-24" />
            ) : (
              <>
                <p className="mt-1 text-xl font-medium text-[#111827] tabular-nums leading-snug">
                  {formatINR(metrics.paidThisMonth)}
                </p>
                <p className="mt-1 text-xs font-normal text-[#6B7280] truncate">
                  {metrics.lastPaymentDate
                    ? `Last payment on ${formatDate(metrics.lastPaymentDate)}`
                    : 'No payments recorded yet'}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2b. Pending Proposals Notification Banner */}
      {tabCounts.pending > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-amber-900">
                Action Required: {tabCounts.pending} Tenancy Proposal{tabCounts.pending > 1 ? 's' : ''} Awaiting Your Approval
              </p>
              <p className="text-xs text-amber-700">
                A property owner has proposed agreement terms for your rental application. Please review and accept or reject.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveStatus('pending')
              setCurrentPage(1)
            }}
            className="px-3.5 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900 text-xs sm:text-sm font-medium hover:bg-amber-50 transition-colors shrink-0 cursor-pointer"
          >
            Review Proposals
          </button>
        </div>
      )}

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
      {(hasAnyTenancyInAccount || isLoadingTenancies) && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Filter tenancies by status"
              className="flex flex-wrap items-center gap-2"
            >
              {STATUS_TABS.map((tab) => {
                const isSelected = activeStatus === tab.id && !hasDuesOnly
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setHasDuesOnly(false)
                      handleStatusChange(tab.id)
                    }}
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

              {/* Removable "Has dues" Chip */}
              {hasDuesOnly && (
                <button
                  type="button"
                  onClick={() => setHasDuesOnly(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border bg-rose-50 border-rose-300 text-rose-700 transition-colors cursor-pointer hover:bg-rose-100"
                >
                  <span>Has dues</span>
                  <span className="text-rose-500 hover:text-rose-700 font-bold ml-0.5">✕</span>
                </button>
              )}
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
      {isLoadingTenancies ? (
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
            title={
              hasDuesOnly
                ? 'No tenancies with dues yet'
                : activeStatus === 'all'
                ? 'No matching tenancies'
                : `No ${STATUS_TABS.find((t) => t.id === activeStatus)?.label.toLowerCase() || activeStatus} tenancies yet`
            }
            description="No tenancy records match your active filter or search query."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveStatus('active')
                  setHasDuesOnly(false)
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

              const dueInfo = metrics.tenancyDuesMap[tenancy.id]
              const isActive = tenancy.status === 'active'
              const isOverdue = isActive && dueInfo && dueInfo.overdueRent > 0
              const isCompleted = tenancy.status === 'ended'
              const isCancelled = tenancy.status === 'cancelled'
              const isUpcoming = tenancy.status === 'confirmed'

              const footerText = tenancy.end_date
                ? `${formatINR(tenancy.monthly_rent)}/mo · ends ${formatDate(tenancy.end_date)}`
                : `${formatINR(tenancy.monthly_rent)}/mo · since ${formatDate(tenancy.start_date)}`

              return (
                <article
                  key={tenancy.id}
                  className={`rounded-xl border border-[#E5E7EB] bg-white overflow-hidden flex flex-col justify-between hover:shadow-xs transition-shadow ${
                    isCancelled ? 'opacity-75' : isCompleted ? 'opacity-85' : ''
                  }`}
                >
                  <div>
                    {/* Top Property Photo + Status Badge */}
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

                    {/* Card Body */}
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

                      {/* Money-Status Block */}
                      {isActive ? (
                        isOverdue ? (
                          <div className="rounded-lg bg-rose-50/70 border border-rose-200 p-2.5 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-rose-700">Overdue</span>
                              <span className="text-sm font-bold text-rose-800 tabular-nums">
                                {formatINR(dueInfo.overdueRent)}
                              </span>
                            </div>
                            <p className="text-[11px] text-rose-700 truncate">
                              Rent for {dueInfo.overduePeriodLabel || 'current cycle'}
                              {dueInfo.pendingDeposit > 0
                                ? ` · deposit ${formatINR(dueInfo.pendingDeposit)} also pending`
                                : ''}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-2.5 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-emerald-800">All paid</span>
                              <span className="text-xs font-medium text-emerald-700">
                                Next due{' '}
                                {dueInfo?.nextDueDate ? formatDate(dueInfo.nextDueDate) : 'soon'}
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-700">
                              {formatINR(tenancy.monthly_rent)} rent
                            </p>
                          </div>
                        )
                      ) : isUpcoming ? (
                        <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-2.5 space-y-0.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-blue-800">Upcoming</span>
                            <span className="font-medium text-blue-700">
                              Starts {formatDate(tenancy.start_date)}
                            </span>
                          </div>
                          <p className="text-[11px] text-blue-700 truncate">
                            {formatINR(tenancy.monthly_rent)}/mo · Deposit{' '}
                            {formatINR(tenancy.security_deposit)}
                          </p>
                        </div>
                      ) : isCompleted ? (
                        <div className="rounded-lg bg-gray-50 border border-[#E5E7EB] p-2.5 text-xs text-[#6B7280]">
                          This tenancy has ended. No payments are due.
                        </div>
                      ) : (
                        <div className="rounded-lg bg-gray-50 border border-[#E5E7EB] p-2.5 text-xs text-[#6B7280]">
                          This tenancy was cancelled. No payments are due.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Short Muted Line + View Details */}
                  <div className="px-3.5 pb-3.5 pt-2 flex items-center justify-between gap-2 border-t border-[#F3F4F6]">
                    <span className="text-[11px] font-normal text-[#6B7280] truncate">
                      {footerText}
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
                totalItems={sortedTenancies.length}
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
