import React, { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import LandingHeader from './components/LandingHeader'
import LandingFooter from './components/LandingFooter'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/toast'
import { useSubscriptionPlans, useActivateOwnerTrial } from '../../hooks/useSubscription'
import { isUserProfile } from '../../types/auth'
import { extractApiErrorMessage } from '../../utils/application'
import { setStoredWorkspace } from '../../utils/workspace'
import type { SubscriptionPlanItem } from '../../types/subscription'

// Plan feature descriptions (property limit is dynamically prepended from backend plan data)
const planFeatureDescriptions: Record<string, string[]> = {
  starter: [
    'Property listing & discovery',
    'Tenant applications review',
    'Tenancy lifecycle management',
    'Rent & deposit tracking',
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

const getPlanTagline = (plan: SubscriptionPlanItem): string => {
  if (plan.is_unlimited_properties || !plan.max_properties) {
    return 'For commercial property enterprises and large portfolios.'
  }
  if (plan.code === 'starter') {
    return `For individual owners getting started with up to ${plan.max_properties} properties.`
  }
  if (plan.code === 'growth') {
    return `For growing portfolios needing up to ${plan.max_properties} properties.`
  }
  if (plan.code === 'pro') {
    return `For professional managers with up to ${plan.max_properties} properties.`
  }
  return `For owners managing up to ${plan.max_properties} properties.`
}

export const OwnerGetStartedPage: React.FC = () => {
  const { isAuthenticated, user, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const { data: plans, isLoading: isPlansLoading } = useSubscriptionPlans()
  const activateTrialMutation = useActivateOwnerTrial()

  const [isActivating, setIsActivating] = useState(false)

  // Ensure user profile details (including email_verified_at) are fresh
  useEffect(() => {
    if (isAuthenticated && !isUserProfile(user)) {
      void refreshProfile()
    }
  }, [isAuthenticated, user, refreshProfile])

  const isOwner = Boolean(user?.is_owner)
  const isEmailVerified = isUserProfile(user)
    ? Boolean(user.email_verified_at)
    : Boolean((user as unknown as { email_verified_at?: string })?.email_verified_at)

  // Once an owner has already activated the trial, redirect them directly to the Owner Dashboard
  if (isOwner) {
    return <Navigate to="/app/owner/dashboard" replace />
  }

  // Handle Trial Activation for authenticated, verified users
  const handleActivateTrial = async () => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: '/owner/get-started' } })
      return
    }

    if (!isEmailVerified) {
      addToast({
        title: 'Email Verification Required',
        description: 'Please verify your email address before activating your owner subscription.',
        variant: 'warning',
      })
      navigate('/resend-verification')
      return
    }

    try {
      setIsActivating(true)
      await activateTrialMutation.mutateAsync()
      setStoredWorkspace('owner')
      await refreshProfile()
      addToast({
        title: 'Owner Trial Activated!',
        description: 'Your 90-day Starter trial is now active. Welcome to your Owner Workspace.',
        variant: 'success',
      })
      navigate('/app/owner/properties/new')
    } catch (err: unknown) {
      addToast({
        title: 'Activation Failed',
        description: extractApiErrorMessage(err, 'Unable to activate owner trial at this time.'),
        variant: 'error',
      })
    } finally {
      setIsActivating(false)
    }
  }

  // Format plan prices
  const renderPlanPrice = (plan: SubscriptionPlanItem) => {
    if (plan.is_custom_pricing || !plan.monthly_price) {
      return (
        <div>
          <span className="text-2xl font-medium text-[#111827]">Custom</span>
          <span className="text-xs text-[#6B7280] ml-1 font-normal">tailored pricing</span>
        </div>
      )
    }

    const priceNum = parseFloat(plan.monthly_price)
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(priceNum)

    if (plan.code === 'starter') {
      return (
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-medium text-[#111827]">₹0</span>
            <span className="text-xs font-medium text-[#408A71] bg-[#408A71]/10 px-2 py-0.5 rounded-full">
              for 90 days
            </span>
          </div>
          <span className="text-xs text-[#6B7280] font-normal block mt-0.5">
            then {formatted}/month
          </span>
        </div>
      )
    }

    return (
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-medium text-[#111827]">{formatted}</span>
        <span className="text-xs text-[#6B7280] font-normal">/month</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111827] antialiased">
      <LandingHeader activeNav="owner-get-started" />

      <main className="flex-grow">
        {/* 1. Hero Section */}
        <section className="border-b border-[#E5E7EB] bg-gradient-to-b from-[#F0FDF4]/50 to-white py-14 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#408A71]/10 text-[#408A71] text-xs font-medium mb-6">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Owner Workspace · 90-Day Free Trial</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-[#111827] mb-5 leading-tight">
              Manage Your Properties with{' '}
              <span className="text-[#408A71]">Complete Confidence</span>
            </h1>

            <p className="text-base sm:text-lg text-[#4B5563] max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
              From listing discovery and tenant vetting to automated rent ledgers and document
              storage—PropTech provides property owners with all the tools needed to manage residential
              and commercial spaces.
            </p>

            {/* Smart User State Banner / CTAs */}
            {isOwner ? (
              <div className="max-w-xl mx-auto rounded-xl border border-[#A5E0CB] bg-[#F0FDF4] p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-[#408A71] font-medium text-sm mb-1.5">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>You already have an active owner account</span>
                </div>
                <p className="text-xs text-[#4B5563] mb-4">
                  Your owner subscription and workspaces are already configured and ready to use.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    to="/app/owner/dashboard"
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-[#408A71] hover:bg-[#34745C] text-white px-5 py-2.5 text-sm font-medium transition-colors shadow-xs"
                  >
                    Go to Owner Workspace
                    <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    to="/app/owner/subscription"
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] text-[#374151] px-5 py-2.5 text-sm font-medium transition-colors"
                  >
                    Manage Subscription
                  </Link>
                </div>
              </div>
            ) : isAuthenticated && !isEmailVerified ? (
              <div className="max-w-xl mx-auto rounded-xl border border-amber-300 bg-amber-50 p-5 text-center">
                <div className="flex items-center justify-center gap-2 text-amber-800 font-medium text-sm mb-1.5">
                  <svg className="w-5 h-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Email Verification Required</span>
                </div>
                <p className="text-xs text-amber-700 mb-4">
                  Please verify your email address to unlock owner workspace capabilities and activate your
                  90-day free trial.
                </p>
                <Link
                  to="/resend-verification"
                  className="inline-flex items-center justify-center rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 text-sm font-medium transition-colors"
                >
                  Verify Email Address
                </Link>
              </div>
            ) : isAuthenticated && isEmailVerified ? (
              <div className="max-w-xl mx-auto rounded-xl border border-[#408A71]/30 bg-white p-6 shadow-sm text-center">
                <div className="flex items-center justify-center gap-2 text-[#111827] font-medium text-base mb-1">
                  <svg className="w-5 h-5 text-[#408A71]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Ready to start your owner experience?</span>
                </div>
                <p className="text-xs text-[#6B7280] mb-5">
                  Signed in as <strong className="text-[#111827]">{user?.email}</strong>. Activate your
                  90-day Starter trial at zero cost—no payment card needed.
                </p>
                <button
                  type="button"
                  onClick={handleActivateTrial}
                  disabled={isActivating}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white px-7 py-3 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isActivating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Activating Your Trial...
                    </>
                  ) : (
                    <>
                      Activate 90-Day Free Trial
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
                <Link
                  to="/register"
                  state={{ from: '/owner/get-started' }}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white px-7 py-3.5 text-sm font-medium shadow-sm transition-colors cursor-pointer"
                >
                  Start Your 90-Day Free Trial
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  to="/login"
                  state={{ from: '/owner/get-started' }}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#D1D5DB] bg-white hover:bg-gray-50 text-[#111827] px-6 py-3.5 text-sm font-medium transition-colors cursor-pointer"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 2. Five Core Owner Benefits */}
        <section className="py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#111827] mb-3">
              Everything You Need to Manage Your Portfolio
            </h2>
            <p className="text-sm text-[#6B7280] font-normal">
              Built specifically for property owners with complete workflow isolation between owners
              and tenants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Benefit 1 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:border-[#A5E0CB] transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#408A71]/10 text-[#408A71] flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-[#111827] mb-1.5">
                Property Listing &amp; Discovery
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Publish high-visibility listings with verified photos, amenities, rental rates, and
                deposits for both residential and commercial spaces.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:border-[#A5E0CB] transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#408A71]/10 text-[#408A71] flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-[#111827] mb-1.5">
                Tenant Application Screening
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Review prospective tenant profiles, employment details, and personal references. Accept
                or decline applications with clear audit records.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:border-[#A5E0CB] transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#408A71]/10 text-[#408A71] flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-[#111827] mb-1.5">
                Tenancy Lifecycle Management
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Seamlessly convert accepted applicants into active tenancies. Record move-in dates,
                manage ongoing leases, and process smooth move-outs.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:border-[#A5E0CB] transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#408A71]/10 text-[#408A71] flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-[#111827] mb-1.5">
                Rent &amp; Deposit Tracking
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Monitor monthly rent schedules, overdue dues, security deposit collection, and record
                payment transactions with automated balance ledgers.
              </p>
            </div>

            {/* Benefit 5 */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 hover:border-[#A5E0CB] transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#408A71]/10 text-[#408A71] flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-[#111827] mb-1.5">
                Document Management
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Securely store rental agreements, property deeds, inspection logs, and KYC documents in
                one unified, organized repository.
              </p>
            </div>

            {/* Trial Assurance Card */}
            <div className="rounded-xl border border-[#408A71] bg-[#F0FDF4]/60 p-5 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#408A71] text-white flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-base font-medium text-[#111827] mb-1.5">
                  90-Day Free Trial Included
                </h3>
                <p className="text-xs text-[#4B5563] leading-relaxed">
                  Every new property owner begins with our Starter 90-day trial. Zero financial
                  commitment, no credit card required, and full feature access.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#A5E0CB]/40 text-xs font-medium text-[#408A71]">
                Zero risk · Cancel anytime
              </div>
            </div>
          </div>
        </section>

        {/* 3. Starter 90-Day Free Trial Spotlight & Policy */}
        <section className="py-14 sm:py-16 bg-[#F9FAFB] border-y border-[#E5E7EB]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#F3F4F6]">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#408A71]/10 text-[#408A71] text-xs font-medium mb-2">
                    Starter Plan
                  </div>
                  <h3 className="text-xl sm:text-2xl font-medium text-[#111827]">
                    90 Days Free Access for New Owners
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6B7280] font-normal mt-1">
                    Manage up to {plans?.find((p) => p.code === 'starter')?.max_properties ?? 5} properties with complete platform features.
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-3xl font-medium text-[#408A71]">₹0</div>
                  <div className="text-xs text-[#6B7280]">for 3 full months</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                <div>
                  <h4 className="text-xs font-medium text-[#111827] uppercase tracking-wider mb-3">
                    Trial Conditions
                  </h4>
                  <ul className="space-y-2 text-xs text-[#4B5563]">
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#408A71] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Full access to create up to {plans?.find((p) => p.code === 'starter')?.max_properties ?? 5} properties.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#408A71] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Screen applicants, manage leases, and record payments.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#408A71] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>No payment method or credit card required for MVP activation.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#408A71] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Valid for 90 days from the moment of activation.</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-[#111827] uppercase tracking-wider mb-3">
                    What Happens After Expiry?
                  </h4>
                  <ul className="space-y-2 text-xs text-[#4B5563]">
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#408A71] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        <strong>Data Preservation:</strong> Existing properties, tenancies, documents,
                        and payments are never deleted or hidden.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#408A71] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        <strong>Graceful Continuation:</strong> Your active tenancies and historical
                        records remain viewable in read-only mode.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-[#408A71] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        <strong>Easy Upgrade:</strong> Upgrade to any active plan at any time to add new
                        properties or expand quota.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. All Subscription Plans */}
        <section className="py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#111827] mb-3">
              Simple, Transparent Plans for Every Stage
            </h2>
            <p className="text-sm text-[#6B7280] font-normal">
              Scale your portfolio seamlessly. Upgrade or change your plan whenever your business needs
              grow.
            </p>
          </div>

          {isPlansLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#408A71] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans?.map((plan) => {
                const isStarter = plan.code === 'starter'
                const propertyLimitFeature = plan.max_properties
                  ? `Up to ${plan.max_properties} properties`
                  : 'Unlimited properties'
                const additionalFeatures = planFeatureDescriptions[plan.code] || [
                  'Full owner management suite',
                ]
                const features = [propertyLimitFeature, ...additionalFeatures]

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                      isStarter
                        ? 'border-[#408A71] bg-white ring-1 ring-[#408A71] shadow-sm relative'
                        : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
                    }`}
                  >
                    {isStarter && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#408A71] text-white text-[11px] font-medium px-3 py-0.5 rounded-full shadow-xs">
                        90-Day Free Trial
                      </div>
                    )}

                    <div>
                      <div className="mb-4">
                        <h3 className="text-lg font-medium text-[#111827]">{plan.name}</h3>
                        <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-2">
                          {getPlanTagline(plan)}
                        </p>
                      </div>

                      <div className="mb-5 pb-4 border-b border-[#F3F4F6]">
                        {renderPlanPrice(plan)}
                        <div className="mt-1 text-xs text-[#6B7280]">
                          {plan.is_unlimited_properties
                            ? 'Unlimited properties'
                            : `Max ${plan.max_properties} properties`}
                        </div>
                      </div>

                      <div className="space-y-2.5 mb-6">
                        <div className="text-[11px] font-medium text-[#111827] uppercase tracking-wider">
                          Features included
                        </div>
                        {features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-[#4B5563]">
                            <svg className="w-3.5 h-3.5 text-[#408A71] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#F3F4F6]">
                      {isStarter ? (
                        isOwner ? (
                          <Link
                            to="/app/owner/dashboard"
                            className="w-full inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white py-2.5 text-xs font-medium transition-colors"
                          >
                            Workspace Active
                          </Link>
                        ) : isAuthenticated && isEmailVerified ? (
                          <button
                            type="button"
                            onClick={handleActivateTrial}
                            disabled={isActivating}
                            className="w-full inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white py-2.5 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isActivating ? 'Activating...' : 'Activate Free Trial'}
                          </button>
                        ) : (
                          <Link
                            to={isAuthenticated ? '/resend-verification' : '/register'}
                            state={{ from: '/owner/get-started' }}
                            className="w-full inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white py-2.5 text-xs font-medium transition-colors"
                          >
                            Start Free Trial
                          </Link>
                        )
                      ) : (
                        <div className="text-center py-2 text-xs text-[#6B7280] bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                          Available on upgrade
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 5. Bottom Call to Action */}
        <section className="py-14 sm:py-16 bg-[#F0FDF4]/40 border-t border-[#E5E7EB] text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#111827] mb-3">
              Ready to list and manage your properties?
            </h2>
            <p className="text-sm text-[#4B5563] max-w-xl mx-auto mb-8 font-normal leading-relaxed">
              Join property owners who streamline their listings, vet prospective tenants, and track
              rental financials on PropTech.
            </p>

            {isOwner ? (
              <Link
                to="/app/owner/dashboard"
                className="inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white px-7 py-3 text-sm font-medium transition-colors shadow-xs"
              >
                Go to Owner Workspace
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : isAuthenticated && isEmailVerified ? (
              <button
                type="button"
                onClick={handleActivateTrial}
                disabled={isActivating}
                className="inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white px-7 py-3 text-sm font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isActivating ? 'Activating Your Trial...' : 'Start Your 90-Day Free Trial'}
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Link
                  to="/register"
                  state={{ from: '/owner/get-started' }}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white px-7 py-3 text-sm font-medium transition-colors shadow-xs cursor-pointer"
                >
                  Start Your 90-Day Free Trial
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  to="/login"
                  state={{ from: '/owner/get-started' }}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#D1D5DB] bg-white hover:bg-gray-50 text-[#111827] px-6 py-3 text-sm font-medium transition-colors cursor-pointer"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

export default OwnerGetStartedPage
