import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * DashboardPage
 * Temporary authenticated landing area for testing session validity and accessing the profile.
 * Route: /app/dashboard (Protected)
 */
export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const firstName = user?.first_name || ''
  const welcomeGreeting = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] antialiased">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#408A71] text-white shadow-xs group-hover:bg-[#34745C] transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                <path d="M10 6h4" />
                <path d="M10 10h4" />
                <path d="M10 14h4" />
                <path d="M10 18h4" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#111827]">
              prop<span className="text-[#408A71]">tech</span>
            </span>
          </Link>

          {/* Navigation & Logout Action */}
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              to="/"
              className="text-xs sm:text-sm font-medium text-gray-600 hover:text-[#111827] transition-colors"
            >
              Explore
            </Link>
            <Link
              to="/app/profile"
              className="text-xs sm:text-sm font-medium text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
            >
              My Profile
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-red-600 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl py-8 px-4 sm:px-6 space-y-6">
        {/* Welcome Card */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
                {welcomeGreeting}
              </h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Signed in as <span className="font-medium text-[#111827]">{user?.email ?? 'Unknown User'}</span>
              </p>
            </div>

            {/* Role Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {user?.is_tenant && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-[#15803D] border border-emerald-200/80">
                  Tenant
                </span>
              )}
              {user?.is_owner && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80">
                  Property Owner
                </span>
              )}
              {user?.is_platform_admin && (
                <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200/80">
                  Platform Admin
                </span>
              )}
              {!user?.is_tenant && !user?.is_owner && !user?.is_platform_admin && (
                <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                  Standard Member
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Quick Action Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Profile Card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#408A71] mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-[#111827]">Account Profile</h2>
              <p className="mt-1 text-sm text-[#6B7280] leading-relaxed">
                Review your account details, edit your personal information, phone number, and account biography.
              </p>
            </div>
            <div>
              <Link
                to="/app/profile"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
              >
                Manage Profile &rarr;
              </Link>
            </div>
          </div>

          {/* Explore Properties Card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#408A71] mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-[#111827]">Explore Properties</h2>
              <p className="mt-1 text-sm text-[#6B7280] leading-relaxed">
                Browse our curated public real estate listings, view property locations, and search available spaces.
              </p>
            </div>
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
              >
                Go to Landing Page &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Milestone Note */}
        <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-[#6B7280]">
          <p className="font-medium text-gray-700 mb-1">
            Authenticated Testing Environment
          </p>
          <p className="text-xs sm:text-sm">
            Property management tools, tenancy records, and match score metrics will be added in upcoming milestones.
          </p>
        </section>
      </main>
    </div>
  )
}

export default DashboardPage
