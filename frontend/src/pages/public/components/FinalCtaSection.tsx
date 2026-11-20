import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'

export interface FinalCtaSectionProps {
  isAuthenticated?: boolean
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = () => {
  const { user } = useAuth()
  const ownerDestination = user?.is_owner ? '/app/owner/dashboard' : '/owner/get-started'

  return (
    <section className="py-20 sm:py-24 bg-white text-center">
      <div className="max-w-4xl mx-auto px-6">
        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111827] mb-8">
          Ready to move or manage?
        </h2>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/properties"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white px-8 py-3.5 text-base font-semibold shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#408A71]"
          >
            Browse Properties
          </Link>

          <Link
            to={ownerDestination}
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

