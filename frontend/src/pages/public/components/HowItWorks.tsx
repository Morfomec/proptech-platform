import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'

export interface HowItWorksProps {
  isAuthenticated?: boolean
}

export const HowItWorks: React.FC<HowItWorksProps> = () => {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const handleScrollToProperties = (e: React.MouseEvent) => {
    e.preventDefault()
    const propertiesEl = document.getElementById('properties')
    if (propertiesEl) {
      propertiesEl.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleOwnerClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: { pathname: '/app/owner/properties/new' } },
      })
    } else if (user?.is_owner === true) {
      navigate('/app/owner/dashboard')
    } else {
      navigate('/app/owner/properties/new')
    }
  }

  const ownerCta = !isAuthenticated
    ? { to: '/login', state: { from: { pathname: '/app/owner/properties/new' } } }
    : user?.is_owner === true
    ? { to: '/app/owner/dashboard', state: undefined }
    : { to: '/app/owner/properties/new', state: undefined }

  return (
    <section id="how-it-works" className="py-20 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#111827] tracking-tight mb-3">
            How It Works
          </h2>
          <p className="text-base sm:text-lg text-[#6B7280] leading-relaxed">
            PropTech simplifies the rental journey for everyone. Whether you&apos;re looking for
            your next home or managing a portfolio.
          </p>
        </div>

        {/* Two Large Side-by-Side Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Card: For Tenants */}
          <div className="bg-[#ECFDF5]/70 border border-[#A5E0CB]/60 rounded-3xl p-8 sm:p-10 flex flex-col justify-between transition-all hover:shadow-md">
            <div>
              {/* Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-[#408A71] text-white flex items-center justify-center shadow-xs">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-[#111827]">For Tenants</h3>
              </div>

              {/* Steps */}
              <div className="space-y-6 mb-10">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-[#408A71] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    1
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#111827] mb-1">
                      Search &amp; Filter
                    </h4>
                    <p className="text-sm text-[#4B5563] leading-relaxed">
                      Find verified rental properties that match your desired criteria and budget.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-[#408A71] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#111827] mb-1">
                      One-Click Apply
                    </h4>
                    <p className="text-sm text-[#4B5563] leading-relaxed">
                      Submit your profile and express interest in suitable properties directly.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-[#408A71] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    3
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#111827] mb-1">
                      Manage Stay
                    </h4>
                    <p className="text-sm text-[#4B5563] leading-relaxed">
                      Stay informed, manage rent, and enjoy a transparent, hassle-free rental journey.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <a
              href="#properties"
              onClick={handleScrollToProperties}
              className="w-full inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white py-3.5 px-6 font-semibold text-sm transition-colors shadow-xs"
            >
              Start Searching
            </a>
          </div>

          {/* Right Card: For Property Owners */}
          <div className="bg-[#F8FAFC] border border-gray-200 rounded-3xl p-8 sm:p-10 flex flex-col justify-between transition-all hover:shadow-md">
            <div>
              {/* Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shadow-xs">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-[#111827]">For Property Owners</h3>
              </div>

              {/* Steps */}
              <div className="space-y-6 mb-10">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    1
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#111827] mb-1">
                      List Property
                    </h4>
                    <p className="text-sm text-[#4B5563] leading-relaxed">
                      Publish your property with high-quality photos and AI-assisted descriptions.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#111827] mb-1">
                      Receive Applications
                    </h4>
                    <p className="text-sm text-[#4B5563] leading-relaxed">
                      Access verified tenant profiles, review interests, and manage enquiries effortlessly.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    3
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#111827] mb-1">
                      Track &amp; Grow
                    </h4>
                    <p className="text-sm text-[#4B5563] leading-relaxed">
                      Monitor rental activities, rent collection, and oversee property status in real time.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Link
              to={ownerCta.to}
              state={ownerCta.state}
              onClick={handleOwnerClick}
              className="w-full inline-flex items-center justify-center rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white py-3.5 px-6 font-semibold text-sm transition-colors shadow-xs cursor-pointer"
            >
              List Your Property
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks

