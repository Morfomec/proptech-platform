import React from 'react'
import { useAuth } from '../../hooks/useAuth'

import LandingHeader from './components/LandingHeader'
import LandingHero from './components/LandingHero'
import FeaturedRentals from './components/FeaturedRentals'
import HowItWorks from './components/HowItWorks'
import AiFeatureBanner from './components/AiFeatureBanner'
import FinalCtaSection from './components/FinalCtaSection'
import LandingFooter from './components/LandingFooter'

export interface LandingPageProps {
  onNavigate?: (path: string) => void
}

export const LandingPage: React.FC<LandingPageProps> = () => {
  const { isAuthenticated } = useAuth()

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111827] antialiased">
      {/* Clean White Sticky Navigation */}
      <LandingHeader activeNav="home" />

      {/* Main Content Area */}
      <main className="flex-grow">
        {/* 1. Hero Section — Full-Width Image with Dark Green Overlay */}
        <LandingHero isAuthenticated={isAuthenticated} />

        {/* 2. Featured Rentals Section */}
        <FeaturedRentals />

        {/* 3. How It Works Section */}
        <HowItWorks isAuthenticated={isAuthenticated} />

        {/* 4. AI-Powered Feature Banner */}
        <AiFeatureBanner />

        {/* 5. Final CTA Section */}
        <FinalCtaSection isAuthenticated={isAuthenticated} />
      </main>

      {/* 6. Four-Column Footer */}
      <LandingFooter isAuthenticated={isAuthenticated} />
    </div>
  )
}

export default LandingPage
