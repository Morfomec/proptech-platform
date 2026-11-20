import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCancelSubscription,
  useMySubscription,
  useSubscriptionPayments,
  useSubscriptionPlans,
  useSubscriptionQuota,
  useUpgradeSubscription,
} from '../../hooks/useSubscription'
import {
  Alert,
  Button,
  ConfirmationDialog,
  EmptyState,
  Skeleton,
  useToast,
} from '../../components/ui'
import { extractApiErrorMessage, formatDate, formatINR } from '../../utils/application'
import type { SubscriptionPlanItem } from '../../types/subscription'

type PaymentHistoryFilter = 'all' | 'payments' | 'plan_changes'

export const OwnerSubscriptionPage: React.FC = () => {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [historyFilter, setHistoryFilter] = useState<PaymentHistoryFilter>('all')

  // Selected plan for upgrade / downgrade confirmation
  const [targetPlan, setTargetPlan] = useState<SubscriptionPlanItem | null>(null)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)

  // 1. Data Fetching
  const {
    data: subscription,
    isLoading: isLoadingSub,
    isError: isErrorSub,
    refetch: refetchSub,
  } = useMySubscription()

  const {
    data: quota,
    isLoading: isLoadingQuota,
    refetch: refetchQuota,
  } = useSubscriptionQuota()

  const {
    data: plans = [],
    isLoading: isLoadingPlans,
  } = useSubscriptionPlans()

  const {
    data: paymentsData,
    isLoading: isLoadingPayments,
  } = useSubscriptionPayments({ page: 1, page_size: 50 })

  // 2. Mutations
  const upgradeMutation = useUpgradeSubscription()
  const cancelMutation = useCancelSubscription()

  // 3. Derived Plan and Calculations
  const currentPlan = subscription?.plan
  const currentPlanCode = currentPlan?.code
  const [nowMs] = useState(() => Date.now())

  // Calculate Trial / Billing Progress
  const trialProgress = useMemo(() => {
    if (!subscription) {
      return { daysLeft: 0, totalDays: 30, elapsedDays: 0, percent: 0 }
    }

    const startDate = subscription.trial_started_at || subscription.started_at
    const endDate = subscription.trial_ends_at || subscription.current_period_end

    if (!startDate || !endDate) {
      return { daysLeft: 0, totalDays: 30, elapsedDays: 0, percent: 0 }
    }

    const startMs = new Date(startDate).getTime()
    const endMs = new Date(endDate).getTime()

    const totalDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 3600 * 24)))
    const daysLeft = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 3600 * 24)))
    const elapsedDays = Math.max(0, Math.min(totalDays, totalDays - daysLeft))
    const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))

    return { daysLeft, totalDays, elapsedDays, percent }
  }, [subscription, nowMs])

  // Quota Ratio
  const quotaRatio = useMemo(() => {
    if (!quota || quota.max_properties === null) return 0
    return Math.min(100, Math.max(0, Math.round((quota.properties_count / quota.max_properties) * 100)))
  }, [quota])

  // Payment logs
  const paymentLogs = useMemo(() => {
    return paymentsData?.results ?? []
  }, [paymentsData])

  // Plan features map for professional display (property limits are prepended dynamically from backend plan data)
  const planFeaturesMap: Record<string, string[]> = {
    starter: [
      'Rent & deposit tracking',
      'Tenant applications',
      'Document uploads & sharing',
    ],
    growth: [
      'Everything in Starter',
      'Financial activity reports',
      'Tenancy milestones tracking',
      'Priority listing visibility',
    ],
    pro: [
      'Everything in Growth',
      'Dedicated document storage',
      'Priority customer support',
      'Automated rent charge logs',
    ],
    enterprise: [
      'Everything in Pro',
      'Custom contracts & terms',
      'Dedicated account manager',
      'Custom integrations support',
    ],
  }

  // Handle Plan Change (Upgrade / Downgrade)
  const handleConfirmPlanChange = async () => {
    if (!targetPlan) return
    try {
      await upgradeMutation.mutateAsync({ plan_code: targetPlan.code })
      addToast({
        title: 'Plan Updated',
        description: `Your subscription has been switched to the ${targetPlan.name} plan.`,
        variant: 'success',
      })
      setTargetPlan(null)
    } catch (err: unknown) {
      addToast({
        title: 'Plan Change Failed',
        description: extractApiErrorMessage(err, 'Unable to switch subscription plan right now.'),
        variant: 'error',
      })
    }
  }

  // Handle Cancellation
  const handleConfirmCancellation = async () => {
    try {
      await cancelMutation.mutateAsync()
      addToast({
        title: 'Subscription Cancelled',
        description: 'Your subscription has been cancelled. Your existing properties remain intact.',
        variant: 'warning',
      })
      setIsCancelDialogOpen(false)
    } catch (err: unknown) {
      addToast({
        title: 'Cancellation Failed',
        description: extractApiErrorMessage(err, 'Unable to cancel subscription right now.'),
        variant: 'error',
      })
    }
  }

  // Scroll to available plans
  const handleScrollToPlans = () => {
    const el = document.getElementById('available-plans')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  if (isLoadingSub || isLoadingQuota) {
    return (
      <div className="space-y-5 pb-10">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isErrorSub || !subscription) {
    return (
      <div className="space-y-5 pb-10">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3.5">
          <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">Subscription</h1>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8">
          <EmptyState
            size="md"
            title="Subscription information unavailable"
            description="We could not retrieve your subscription details. Please check your network connection and retry."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  void refetchSub()
                  void refetchQuota()
                }}
              >
                Retry
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const isTrial = subscription.status === 'trialing'
  const isCancelled = subscription.status === 'cancelled'
  const isPastDue = subscription.status === 'past_due' || subscription.status === 'expired'

  return (
    <div className="space-y-5 pb-10">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] pb-3.5">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">Subscription</h1>
          <p className="text-xs font-normal text-[#6B7280] mt-0.5">
            Manage your plan, property limit and billing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/owner/properties')}
          >
            My Properties
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleScrollToPlans}
          >
            Change Plan
          </Button>
        </div>
      </div>

      {/* Cancellation or Past Due Warning Banner */}
      {isCancelled && (
        <Alert variant="warning" title="Subscription Cancelled">
          Your subscription is currently cancelled. Your existing properties remain preserved, but creating new properties requires an active subscription.
        </Alert>
      )}

      {isPastDue && (
        <Alert variant="error" title="Subscription Past Due">
          Your subscription has expired or is past due. Please renew or upgrade your plan to maintain full quota entitlement.
        </Alert>
      )}

      {/* 2. Top Information Grid: Current Plan (2fr) + Property Usage (1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Left: Current Plan & Trial/Billing Status */}
        <section className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-normal text-[#6B7280]">Current plan</span>
                <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                  <h2 className="text-xl font-medium text-[#111827] leading-tight">
                    {currentPlan?.name || 'Starter'}
                  </h2>
                  {isTrial && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Free trial
                    </span>
                  )}
                  {subscription.status === 'active' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ECF5F2] text-[#408A71] border border-[#408A71]/30">
                      Active
                    </span>
                  )}
                  {isCancelled && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                      Cancelled
                    </span>
                  )}
                </div>
                <p className="text-xs font-normal text-[#6B7280] mt-1 leading-relaxed">
                  {isTrial
                    ? `Full access during the trial. Your first charge is scheduled for ${formatDate(subscription.trial_ends_at)}.`
                    : isCancelled
                    ? `Your subscription was cancelled on ${formatDate(subscription.cancelled_at)}.`
                    : `Active plan. Next billing renewal date is ${formatDate(subscription.current_period_end)}.`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isCancelled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCancelDialogOpen(true)}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-[#E5E7EB]"
                  >
                    Cancel plan
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleScrollToPlans}
                >
                  Upgrade plan
                </Button>
              </div>
            </div>

            {/* Trial / Period Progress Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs text-[#111827]">
                <span className="font-medium text-[#111827]">
                  {isTrial
                    ? `${trialProgress.daysLeft} days left in your trial`
                    : subscription.status === 'active'
                    ? 'Current billing cycle'
                    : 'Subscription ended'}
                </span>
                <span className="font-normal text-[#6B7280]">
                  {isTrial
                    ? `Day ${trialProgress.elapsedDays} of ${trialProgress.totalDays}`
                    : `${trialProgress.percent}% of cycle`}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCancelled ? 'bg-gray-400' : 'bg-[#408A71]'
                  }`}
                  style={{ width: `${trialProgress.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Milestone Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#F3F4F6] pt-3.5 border-t border-[#F3F4F6] text-xs">
            <div className="px-0 sm:px-3 first:pl-0 last:pr-0 py-2 sm:py-0 space-y-0.5">
              <span className="text-[#6B7280] font-normal">
                {isTrial ? 'Trial started' : 'Started on'}
              </span>
              <p className="font-medium text-[#111827]">
                {formatDate(subscription.trial_started_at || subscription.started_at)}
              </p>
            </div>

            <div className="px-0 sm:px-3 first:pl-0 last:pr-0 py-2 sm:py-0 space-y-0.5">
              <span className="text-[#6B7280] font-normal">
                {isTrial ? 'Trial ends' : 'Current period ends'}
              </span>
              <p className="font-medium text-[#111827]">
                {formatDate(subscription.trial_ends_at || subscription.current_period_end)}
              </p>
            </div>

            <div className="px-0 sm:px-3 first:pl-0 last:pr-0 py-2 sm:py-0 space-y-0.5">
              <span className="text-[#6B7280] font-normal">Next billing</span>
              <p className="font-medium text-[#111827]">
                {isCancelled
                  ? 'None (Cancelled)'
                  : `${formatDate(subscription.current_period_end)} · ${
                      currentPlan?.monthly_price ? formatINR(currentPlan.monthly_price) : 'Custom'
                    }`}
              </p>
            </div>
          </div>
        </section>

        {/* Right: Property Usage Card */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div>
              <span className="text-xs font-normal text-[#6B7280]">Property usage</span>
              <p className="text-xl font-medium text-[#111827] mt-0.5 tabular-nums">
                {quota?.properties_count ?? 0} of{' '}
                {quota?.max_properties !== null && quota?.max_properties !== undefined
                  ? `${quota.max_properties} properties`
                  : 'Unlimited'}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    quota?.is_quota_exceeded ? 'bg-rose-500' : 'bg-[#408A71]'
                  }`}
                  style={{
                    width: quota?.max_properties ? `${quotaRatio}%` : '100%',
                  }}
                />
              </div>
              <p className="text-xs font-normal text-[#6B7280] leading-relaxed">
                {quota?.max_properties !== null && quota?.max_properties !== undefined ? (
                  quota.remaining_quota && quota.remaining_quota > 0 ? (
                    `${quota.remaining_quota} more ${
                      quota.remaining_quota === 1 ? 'property' : 'properties'
                    } available on this plan.`
                  ) : (
                    <span className="text-rose-600 font-medium">
                      You have reached the maximum property limit for this plan.
                    </span>
                  )
                ) : (
                  'Unlimited property slots enabled on your enterprise plan.'
                )}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (quota?.is_quota_exceeded) {
                handleScrollToPlans()
              } else {
                navigate('/app/owner/properties/new')
              }
            }}
            className="w-full justify-center border-[#E5E7EB] hover:border-[#408A71] hover:text-[#408A71]"
          >
            {quota?.is_quota_exceeded ? 'Upgrade for more properties' : 'Add property'}
          </Button>
        </section>
      </div>

      {/* 3. Available Plans Section */}
      <section
        id="available-plans"
        className="rounded-xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-5"
      >
        <div>
          <h2 className="text-base font-medium text-[#111827]">Available plans</h2>
          <p className="text-xs font-normal text-[#6B7280] mt-0.5">
            Change your plan at any time. Upgrades apply immediately.
          </p>
        </div>

        {/* Plans Grid */}
        {isLoadingPlans ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-96 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
            {plans.map((plan) => {
              const isCurrent = plan.code === currentPlanCode
              const isGrowth = plan.code === 'growth'
              const currentCount = quota?.properties_count ?? 0
              const cannotDowngrade =
                plan.max_properties !== null && currentCount > plan.max_properties

              // Calculate price display directly from backend monthly price
              let priceDisplay = 'Custom'
              if (plan.monthly_price) {
                const numericMonthly = parseFloat(plan.monthly_price)
                priceDisplay = formatINR(numericMonthly) ?? `₹${numericMonthly}`
              }

              const propertyLimitFeature = plan.max_properties
                ? `Up to ${plan.max_properties} properties`
                : 'Unlimited properties'
              const additionalFeatures = planFeaturesMap[plan.code] ?? [
                'Property management',
                'Tenant tracking',
              ]
              const features = [propertyLimitFeature, ...additionalFeatures]

              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between space-y-4 transition-all ${
                    isCurrent
                      ? 'border-[#408A71] ring-1 ring-[#408A71] bg-white shadow-xs'
                      : 'border-[#E5E7EB] bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-medium text-[#111827]">{plan.name}</h3>
                      {isCurrent ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ECF5F2] text-[#408A71]">
                          Current plan
                        </span>
                      ) : isGrowth ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
                          Most popular
                        </span>
                      ) : null}
                    </div>

                    {/* Price */}
                    <div className="min-h-[44px]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-medium text-[#111827] tabular-nums">
                          {priceDisplay}
                        </span>
                        {plan.monthly_price && (
                          <span className="text-xs font-normal text-[#6B7280]">/month</span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {plan.code === 'starter'
                          ? 'For owners just getting started.'
                          : plan.code === 'growth'
                          ? 'For growing portfolios.'
                          : plan.code === 'pro'
                          ? 'For professional managers.'
                          : 'For enterprise operations.'}
                      </p>
                    </div>

                    {/* Features list */}
                    <ul className="space-y-2 text-xs text-[#374151] pt-2 border-t border-[#F3F4F6]">
                      {features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <svg
                            className="w-4 h-4 text-[#408A71] shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div className="pt-3">
                    {isCurrent ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="w-full justify-center border-[#408A71] text-[#408A71] bg-[#ECF5F2]/40 opacity-90 cursor-default"
                      >
                        Your current plan
                      </Button>
                    ) : cannotDowngrade ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="w-full justify-center text-xs opacity-60 cursor-not-allowed text-[#6B7280]"
                        title={`You currently have ${currentCount} properties. Limit for this plan is ${plan.max_properties}.`}
                      >
                        Cannot downgrade ({currentCount} props)
                      </Button>
                    ) : (
                      <Button
                        variant={isGrowth ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setTargetPlan(plan)}
                        className={`w-full justify-center ${
                          !isGrowth ? 'border-[#E5E7EB] hover:border-[#408A71] hover:text-[#408A71]' : ''
                        }`}
                      >
                        {plan.min_properties > (currentPlan?.min_properties ?? 0)
                          ? `Upgrade to ${plan.name}`
                          : `Switch to ${plan.name}`}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs font-normal text-[#6B7280] pt-2 border-t border-[#F3F4F6]">
          Downgrading is allowed only when your property count fits the new plan&apos;s limit.
        </p>
      </section>

      {/* 4. Subscription & Payment History */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-[#111827]">Subscription &amp; payment history</h2>
            <p className="text-xs font-normal text-[#6B7280] mt-0.5">
              Plan changes, charges and invoices.
            </p>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'payments', label: 'Payments' },
                { id: 'plan_changes', label: 'Plan changes' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryFilter(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  historyFilter === tab.id
                    ? 'bg-[#ECF5F2] text-[#408A71] border border-[#408A71]'
                    : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:text-[#111827]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* History Table */}
        {isLoadingPayments ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[680px] w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                  <th className="py-2.5 px-3 font-normal">Date</th>
                  <th className="py-2.5 px-3 font-normal">Description</th>
                  <th className="py-2.5 px-3 font-normal">Plan</th>
                  <th className="py-2.5 px-3 font-normal text-right">Amount</th>
                  <th className="py-2.5 px-3 font-normal text-center">Status</th>
                  <th className="py-2.5 px-3 font-normal text-right pr-3">Invoice / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] text-[#111827]">
                {/* 1. Free Trial Initial Event Row */}
                {historyFilter !== 'payments' && (
                  <tr className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-3 text-[#6B7280] whitespace-nowrap">
                      {formatDate(subscription.trial_started_at || subscription.started_at)}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-[#111827]">Free trial started</p>
                      <p className="text-[11px] text-[#6B7280]">
                        {currentPlan?.trial_duration_months
                          ? `${currentPlan.trial_duration_months * 30} days, no card needed`
                          : 'Full access period'}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-[#111827]">
                      {subscription.plan?.name || 'Starter'}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium text-[#111827]">
                      ₹0
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ECF5F2] text-[#408A71]">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right pr-3 text-[#6B7280]">
                      –
                    </td>
                  </tr>
                )}

                {/* 2. Recorded Payment Logs */}
                {paymentLogs.map((payment) => (
                  <tr key={payment.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-3 text-[#6B7280] whitespace-nowrap">
                      {formatDate(payment.paid_at || payment.created_at)}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-[#111827]">Subscription Payment</p>
                      <p className="text-[11px] text-[#6B7280]">
                        Method: {payment.payment_method.toUpperCase()}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-[#111827]">
                      {payment.plan_name || payment.plan_code}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium text-[#111827]">
                      {formatINR(payment.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          payment.status === 'successful'
                            ? 'bg-[#ECF5F2] text-[#408A71]'
                            : payment.status === 'pending'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right pr-3 text-[#6B7280] tabular-nums">
                      {payment.transaction_reference || '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Muted footnote */}
        {paymentLogs.length === 0 && (
          <p className="text-xs text-[#6B7280] pt-2 border-t border-[#F3F4F6]">
            No payments charged yet. Your first invoice will appear here after your free trial ends on{' '}
            {formatDate(subscription.trial_ends_at || subscription.current_period_end)}.
          </p>
        )}
      </section>

      {/* Confirmation Dialog: Upgrade / Downgrade */}
      <ConfirmationDialog
        open={Boolean(targetPlan)}
        onClose={() => setTargetPlan(null)}
        onConfirm={handleConfirmPlanChange}
        title={`Switch to ${targetPlan?.name} Plan`}
        description={
          targetPlan
            ? `Are you sure you want to change your subscription from ${
                currentPlan?.name
              } to ${targetPlan.name}? Your property allowance will update to ${
                targetPlan.max_properties !== null
                  ? `${targetPlan.max_properties} properties`
                  : 'unlimited properties'
              }.`
            : ''
        }
        confirmText="Confirm Change"
        cancelText="Cancel"
        loading={upgradeMutation.isPending}
      />

      {/* Confirmation Dialog: Cancel Subscription */}
      <ConfirmationDialog
        open={isCancelDialogOpen}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={handleConfirmCancellation}
        title="Cancel Subscription"
        description="Are you sure you want to cancel your subscription? Your existing property records and tenancy data will remain safe, but you will not be able to create new properties until you reactivate."
        confirmText="Confirm Cancellation"
        cancelText="Keep Subscription"
        variant="danger"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

export default OwnerSubscriptionPage
