import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'

export interface LandingHeroProps {
  isAuthenticated?: boolean
}

export const LandingHero: React.FC<LandingHeroProps> = () => {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const primaryHeroImage =
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2000&q=85'
  const fallbackHeroImage =
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=85'

  const [bgImage, setBgImage] = useState<string>(primaryHeroImage)

  const handleImageError = () => {
    if (bgImage !== fallbackHeroImage) {
      setBgImage(fallbackHeroImage)
    }
  }

  const handleScrollToProperties = (e: React.MouseEvent) => {
    e.preventDefault()
    const propertiesSection = document.getElementById('properties')
    if (propertiesSection) {
      propertiesSection.scrollIntoView({ behavior: 'smooth' })
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
    <section className="relative w-full min-h-[580px] sm:min-h-[620px] lg:min-h-[680px] flex items-center justify-center overflow-hidden">
      {/* Background Photography with Natural Daylight & Floor-to-Ceiling Windows */}
      <img
        src={bgImage}
        alt="Modern luxury penthouse interior with floor-to-ceiling windows overlooking city skyline"
        onError={handleImageError}
        className="absolute inset-0 w-full h-full object-cover object-center"
        loading="eager"
      />

      {/* Controlled Dark Green Gradient Overlay ensuring high contrast & readability */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0A231C]/85 via-[#0A231C]/75 to-[#0A231C]/90"
        aria-hidden="true"
      />

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 sm:py-24 md:py-28 text-center flex flex-col items-center">
        {/* Introductory Label */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-[#A5E0CB] text-xs font-semibold tracking-wider uppercase border border-white/15 mb-6 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A5E0CB]" aria-hidden="true" />
          FIND YOUR PLACE · MANAGE WITH EASE
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.15] max-w-3xl">
          Find a Home. Manage Your Property.{' '}
          <span className="text-[#A5E0CB]">All in One Place.</span>
        </h1>

        {/* Supporting Text */}
        <p className="text-base sm:text-lg md:text-xl text-gray-200/90 max-w-2xl mx-auto mb-10 font-normal leading-relaxed">
          Discover rental properties that fit your needs or manage your properties
          with confidence, all on one platform.
        </p>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <a
            href="#properties"
            onClick={handleScrollToProperties}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white px-8 py-3.5 text-base font-semibold shadow-md transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#408A71]"
          >
            Find a Home
          </a>

          <Link
            to={ownerCta.to}
            state={ownerCta.state}
            onClick={handleOwnerClick}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white hover:bg-gray-100 text-[#111827] px-8 py-3.5 text-base font-semibold shadow-md transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
          >
            I&apos;m a Property Owner
          </Link>
        </div>
      </div>
    </section>
  )
}

export default LandingHero

