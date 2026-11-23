import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSubscriptionPlans } from '../../hooks/useSubscription'
import type { SubscriptionPlanItem } from '../../types/subscription'
import LandingHeader from './components/LandingHeader'
import LandingFooter from './components/LandingFooter'

const planFeatureDescriptions: Record<string, string[]> = {
  starter: [
    'Property listing & public discovery',
    'Tenant inquiries & digital applications',
    'Standard rental agreement documents',
    'Basic tenant payment tracking',
  ],
  pro: [
    'Everything in Starter',
    'Expanded property portfolio quota',
    'Automated rent payment tracking & receipts',
    'Tenancy renewal & cancellation workflows',
    'Priority property support',
  ],
  business: [
    'Everything in Pro',
    'Large multi-asset portfolio management',
    'Comprehensive lease document management',
    'Advanced tenancy analytics & financial history',
    'Dedicated support response time',
  ],
  enterprise: [
    'Everything in Business',
    'Unlimited property portfolio capacity',
    'Custom tailored service level agreements (SLA)',
    'Enterprise support & onboarding assistance',
  ],
}

function getPlanTagline(plan: SubscriptionPlanItem): string {
  if (plan.code === 'starter') return 'Perfect for owners getting started with their first properties.'
  if (plan.code === 'pro') return 'Ideal for growing real estate investors and independent landlords.'
  if (plan.code === 'business') return 'Designed for professional landlords with multi-property portfolios.'
  if (plan.code === 'enterprise') return 'Tailored solutions for real estate firms and enterprise portfolios.'
  return `For owners managing up to ${plan.max_properties} properties.`
}

function formatPriceINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(num)
}

interface FaqItem {
  q: string
  a: string
}

const FAQS: FaqItem[] = [
  {
    q: 'Is browsing and searching properties free for tenants?',
    a: 'Yes, 100% free. Tenants can search verified listings, view photos and specs, save properties, and apply directly without paying any platform fees.',
  },
  {
    q: 'How does the 90-day free trial work for property owners?',
    a: 'Every new property owner starts on our Starter Plan with a full 90-day free trial (up to 5 properties). You get access to the full owner management suite with zero upfront charges.',
  },
  {
    q: 'Can I upgrade or downgrade my plan later?',
    a: 'Yes. You can switch between active tiers or upgrade to higher property quotas directly from your Owner Subscription settings at any time.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'We support all major Indian credit/debit cards, UPI, and Net Banking for owner subscription renewals and tenant rent payments.',
  },
]

export const PricingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const { data: plans, isLoading: isPlansLoading } = useSubscriptionPlans()

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const isOwner = Boolean(user?.is_owner)

  const renderPlanPrice = (plan: SubscriptionPlanItem) => {
    if (plan.is_custom_pricing || !plan.monthly_price) {
      return (
        <div className="flex items-baseline">
          <span className="text-2xl font-medium tracking-tight text-[#111827]">Custom</span>
          <span className="text-xs text-[#6B7280] ml-1 font-normal">tailored pricing</span>
        </div>
      )
    }

    return (
      <div className="flex items-baseline gap-1">
        <span className="text-xs font-normal text-[#6B7280]">₹</span>
        <span className="text-2xl font-medium tracking-tight text-[#111827] tabular-nums">
          {formatPriceINR(plan.monthly_price)}
        </span>
        <span className="text-xs text-[#6B7280] font-normal">/ month</span>
      </div>
    )
  }

  const handlePlanCta = () => {
    if (!isAuthenticated) {
      navigate('/register', { state: { from: '/pricing' } })
      return
    }

    if (isOwner) {
      navigate('/app/owner/subscription')
      return
    }

    // Authenticated non-owner (Tenant): direct them to Owner Onboarding
    navigate('/owner/get-started')
  }

  const getCtaLabel = (plan: SubscriptionPlanItem) => {
    if (isOwner) {
      return 'Manage Plan'
    }
    if (plan.code === 'starter') {
      return 'Start 90-Day Free Trial'
    }
    if (plan.code === 'enterprise') {
      return 'Contact Enterprise'
    }
    return 'Get Started'
  }

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111827] antialiased">
      {/* Top Header Navigation */}
      <LandingHeader activeNav="pricing" />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 px-4 sm:px-6 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#ECF5F2] text-[#408A71] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#408A71]" />
            Simple &amp; Transparent Pricing
          </div>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#111827] max-w-2xl mx-auto">
            Flexible plans for landlords, always free for tenants.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#6B7280] max-w-xl mx-auto font-normal">
            Browse and apply to verified properties at no cost. Scale your rental portfolio with powerful property management tools.
          </p>

          {/* Audience Split Pill Banner */}
          <div className="mt-8 inline-flex items-center gap-3 p-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white shadow-2xs font-medium text-[#111827]">
              <svg className="w-3.5 h-3.5 text-[#408A71]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Tenants: Free Forever</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 text-[#6B7280] font-normal">
              <span>Owners: 90-Day Trial Included</span>
            </div>
          </div>
        </section>

        {/* Pricing Cards Section */}
        <section className="pb-16 sm:pb-24 px-4 sm:px-6 max-w-6xl mx-auto">
          {isPlansLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-[#408A71] border-t-transparent rounded-full animate-spin" />
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
                            <svg
                              className="w-3.5 h-3.5 text-[#408A71] shrink-0 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlanCta()}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                        isStarter
                          ? 'bg-[#408A71] text-white hover:bg-[#34745C] shadow-xs'
                          : 'bg-[#F9FAFB] text-[#111827] border border-[#E5E7EB] hover:bg-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {getCtaLabel(plan)}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* FAQ Section */}
        <section className="py-16 bg-[#F9FAFB] border-t border-[#E5E7EB]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-medium tracking-tight text-[#111827]">
                Frequently Asked Questions
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#6B7280] font-normal">
                Everything you need to know about our pricing and plans.
              </p>
            </div>

            <div className="space-y-3">
              {FAQS.map((faq, index) => {
                const isOpen = expandedFaq === index
                return (
                  <div
                    key={index}
                    className="border border-[#E5E7EB] rounded-xl bg-white overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isOpen ? null : index)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer"
                    >
                      <span className="text-sm font-medium text-[#111827]">{faq.q}</span>
                      <svg
                        className={`w-4 h-4 text-[#6B7280] transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs sm:text-sm text-[#6B7280] font-normal border-t border-[#F3F4F6] pt-3 leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Ready to start CTA Banner */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto text-center">
          <div className="rounded-3xl bg-[#111827] text-white p-8 sm:p-12 shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight mb-3">
              Ready to list your property or find your next rental?
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto font-normal mb-8">
              Join thousands of owners and tenants experiencing modern, transparent property management.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/properties"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-white text-[#111827] hover:bg-gray-100 transition-colors"
              >
                Browse Rentals
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate('/register', { state: { from: '/pricing' } })
                  } else if (isOwner) {
                    navigate('/app/owner/properties/add')
                  } else {
                    navigate('/owner/get-started')
                  }
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#408A71] text-white hover:bg-[#34745C] transition-colors cursor-pointer"
              >
                List a Property
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <LandingFooter isAuthenticated={isAuthenticated} />
    </div>
  )
}

export default PricingPage

