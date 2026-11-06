import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'

export interface FinalCtaSectionProps {
  isAuthenticated?: boolean
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = () => {
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
    <section className="py-20 sm:py-24 bg-white text-center">
      <div className="max-w-4xl mx-auto px-6">
        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111827] mb-4">
          Ready to move or manage?
        </h2>

        {/* Supporting Text */}
        <p className="text-base sm:text-lg text-[#6B7280] max-w-2xl mx-auto mb-10 leading-relaxed">
          Join thousands of Indians who are already using PropTech for a better rental experience.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#properties"
            onClick={handleScrollToProperties}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white px-8 py-3.5 text-base font-semibold shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#408A71]"
          >
            Browse Properties
          </a>

          <Link
            to={ownerCta.to}
            state={ownerCta.state}
            onClick={handleOwnerClick}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-[#111827] px-8 py-3.5 text-base font-semibold shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#408A71] cursor-pointer"
          >
            List Your Property
          </Link>
        </div>
      </div>
    </section>
  )
}

export default FinalCtaSection

