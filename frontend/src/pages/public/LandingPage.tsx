import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../../components/ui/avatar'
import { Dropdown, type DropdownMenuItem } from '../../components/ui/dropdown'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, isInitializing, user, logout } = useAuth()
  const navigate = useNavigate()

  const firstName = typeof user?.first_name === 'string' ? user.first_name.trim() : ''
  const lastName = typeof user?.last_name === 'string' ? user.last_name.trim() : ''
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') || firstName || user?.email || 'My Account'
  const avatarName =
    [firstName, lastName].filter(Boolean).join(' ') || firstName || user?.email || ''
  const profileImage =
    user && 'profile_image' in user ? user.profile_image || undefined : undefined

  const avatarFallback = (
    <svg
      className="w-4 h-4 text-[#408A71]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  )

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/')
    }
  }

  const dropdownMenuItems: DropdownMenuItem[] = [
    {
      id: 'user-identity',
      header: true,
      label: (
        <div className="flex flex-col py-0.5">
          <span className="text-sm font-semibold text-[#111827] truncate leading-tight">
            {fullName}
          </span>
          {user?.email && (
            <span className="text-xs text-gray-500 font-normal truncate leading-tight mt-1">
              {user.email}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: (
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
      onClick: () => navigate('/app/profile'),
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5zM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4zm10-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-9z"
          />
        </svg>
      ),
      onClick: () => navigate('/app/dashboard'),
    },
    {
      separator: true,
    },
    {
      id: 'signout',
      label: 'Sign out',
      icon: (
        <svg className="w-4 h-4 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      ),
      danger: true,
      onClick: handleLogout,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111827] antialiased">
      {/* Clean White Sticky Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="bg-[#408A71] text-white p-2 rounded-xl group-hover:bg-[#34745C] transition-colors shadow-2xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-building-2"
              >
                <path d="M10 12h4" />
                <path d="M10 8h4" />
                <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
                <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#111827]">
              prop<span className="text-[#408A71]">tech</span>
            </span>
          </Link>

          {/* Nav Items (Desktop) */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#properties"
              className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
            >
              Explore
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
            >
              Pricing
            </a>
            <a
              href="#about"
              className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
            >
              About
            </a>

            <div className="h-4 w-[1px] bg-gray-200 mx-1" aria-hidden="true" />

            {/* Auth-Aware Section */}
            {isInitializing ? (
              <div
                className="flex items-center gap-2 h-10 min-w-[50px] justify-end"
                aria-busy="true"
                aria-label="Checking authentication status"
              >
                <div className="w-[35px] h-[35px] bg-gray-100 rounded-full animate-pulse" />
              </div>
            ) : isAuthenticated ? (
              <Dropdown
                placement="bottom-right"
                width="w-[216px]"
                trigger={(isOpen) => (
                  <div
                    className={`group inline-flex items-center gap-1.5 p-1 rounded-full transition-all cursor-pointer select-none ${
                      isOpen
                        ? 'bg-gray-100 ring-2 ring-[#408A71]'
                        : 'hover:bg-gray-100/80 focus-visible:ring-2 focus-visible:ring-[#408A71]'
                    }`}
                    aria-label="User account menu"
                  >
                    <Avatar
                      name={avatarName}
                      src={profileImage}
                      size="sm"
                      fallback={avatarName ? undefined : avatarFallback}
                      className="w-[35px] h-[35px] [&>div]:w-[35px] [&>div]:h-[35px] [&>div]:text-xs rounded-full shadow-2xs"
                    />
                    <svg
                      className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 group-hover:text-gray-700 ${
                        isOpen ? 'rotate-180 text-[#408A71] group-hover:text-[#408A71]' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                )}
                items={dropdownMenuItems}
              />
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-[#111827] hover:text-[#408A71] transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-[#408A71] px-5 py-2.5 text-sm font-semibold !text-white shadow-xs transition-colors hover:bg-[#34745C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#408A71]"
                >
                  <span className="!text-white text-white font-semibold tracking-wide">
                    Get Started
                  </span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Right Controls (Account Icon + Hamburger) */}
          <div className="flex md:hidden items-center gap-2">
            {!isInitializing && isAuthenticated && (
              <Dropdown
                placement="bottom-right"
                width="w-[216px]"
                trigger={(isOpen) => (
                  <div
                    className={`group inline-flex items-center gap-1.5 p-1 rounded-full transition-all cursor-pointer select-none ${
                      isOpen
                        ? 'bg-gray-100 ring-2 ring-[#408A71]'
                        : 'hover:bg-gray-100/80 focus-visible:ring-2 focus-visible:ring-[#408A71]'
                    }`}
                    aria-label="User account menu"
                  >
                    <Avatar
                      name={avatarName}
                      src={profileImage}
                      size="sm"
                      fallback={avatarName ? undefined : avatarFallback}
                      className="w-[35px] h-[35px] [&>div]:w-[35px] [&>div]:h-[35px] [&>div]:text-xs rounded-full shadow-2xs"
                    />
                    <svg
                      className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 group-hover:text-gray-700 ${
                        isOpen ? 'rotate-180 text-[#408A71] group-hover:text-[#408A71]' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                )}
                items={dropdownMenuItems}
              />
            )}

            {/* Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg text-gray-600 hover:text-[#111827] hover:bg-gray-100 transition-colors focus:outline-none"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 shadow-lg animate-in fade-in-0 duration-200">
            <div className="flex flex-col gap-3">
              <a
                href="#properties"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-[#111827] hover:text-[#408A71] py-2 transition-colors"
              >
                Explore
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-[#111827] hover:text-[#408A71] py-2 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-[#111827] hover:text-[#408A71] py-2 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#about"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-[#111827] hover:text-[#408A71] py-2 transition-colors"
              >
                About
              </a>

              <div className="h-[1px] bg-gray-100 my-1" />

              {isInitializing ? (
                <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse my-1" />
              ) : isAuthenticated ? (
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex items-center gap-3 px-3 py-2 mb-1">
                    <Avatar
                      name={avatarName}
                      src={profileImage}
                      size="sm"
                      fallback={avatarName ? undefined : avatarFallback}
                      className="w-[35px] h-[35px] [&>div]:w-[35px] [&>div]:h-[35px] [&>div]:text-xs rounded-full shadow-2xs"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-[#111827] truncate">{fullName}</span>
                      {user?.email && (
                        <span className="text-xs text-gray-500 truncate">{user.email}</span>
                      )}
                    </div>
                  </div>

                  <Link
                    to="/app/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-[#111827] hover:text-[#408A71] hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    My Profile
                  </Link>

                  <Link
                    to="/app/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-[#111827] hover:text-[#408A71] hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5zM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4zm10-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-9z"
                      />
                    </svg>
                    Dashboard
                  </Link>

                  <div className="h-[1px] bg-gray-100 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleLogout()
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-medium text-[#111827] hover:text-[#408A71] py-2 transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex items-center justify-center rounded-xl bg-[#408A71] px-5 py-3 text-base font-semibold !text-white shadow-xs transition-colors hover:bg-[#34745C] text-center"
                  >
                    <span className="!text-white text-white font-semibold">Get Started</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

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
