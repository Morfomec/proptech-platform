import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useOwnerProperties } from '../../hooks/useOwnerProperties'
import { PropertyCard } from '../../components/owner/PropertyCard'
import { PropertyCardSkeleton } from '../../components/owner/PropertyCardSkeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'

/**
 * OwnerDashboardPage
 * High-level overview of the owner's property assets, portfolio metric, and recent items.
 * Route: /app/owner/dashboard
 */
export const OwnerDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, isLoading, isError, error, refetch } = useOwnerProperties({ page: 1, page_size: 20 })

  const ownerName = user?.first_name ? `${user.first_name}` : 'Owner'
  const totalProperties = data?.count ?? 0
  const recentProperties = data?.results ? data.results.slice(0, 4) : []

  return (
    <div className="space-y-8">
      {/* 1. Welcome & Header Banner */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#408A71]/10 text-[#408A71] border border-[#408A71]/20">
              Owner Workspace
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
            Welcome back, {ownerName}
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Monitor your property portfolio, occupancy statuses, and recent asset updates.
          </p>
        </div>

        {/* Quick Add Action Button */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/owner/properties/new')}
            leftIcon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Property
          </Button>
        </div>
      </section>

      {/* 2. Error State */}
      {isError && (
        <Alert
          variant="error"
          title="Failed to load portfolio overview"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>{error instanceof Error ? error.message : 'Unable to connect to property services. Please try again.'}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 3. Metric Overview Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Total Properties Card */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
              Total Properties
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#408A71]/10 text-[#408A71]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
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
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-9 w-20 bg-gray-200 animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-extrabold tracking-tight text-[#111827]">
                {totalProperties}
              </div>
            )}
            <p className="mt-1 text-xs text-[#6B7280]">
              Verified portfolio assets registered on PropTech
            </p>
          </div>
        </div>

        {/* Quick Access Card */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Portfolio Management
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              View, inspect, and update all individual real estate units across your holdings.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F3F4F6]">
            <Link
              to="/app/owner/properties"
              className="text-xs font-semibold text-[#408A71] hover:text-[#34745C] hover:underline inline-flex items-center gap-1"
            >
              Browse My Properties ({totalProperties}) &rarr;
            </Link>
          </div>
        </div>

        {/* Account Profile Card */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Owner Profile
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
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
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              Manage your owner contact information, phone numbers, and account settings.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F3F4F6]">
            <Link
              to="/app/profile"
              className="text-xs font-semibold text-[#408A71] hover:text-[#34745C] hover:underline inline-flex items-center gap-1"
            >
              Account Settings &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Recently Added Properties Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">
              Recently Added Properties
            </h2>
            <p className="text-xs text-[#6B7280]">
              Latest additions to your real estate portfolio
            </p>
          </div>
          {totalProperties > 4 && (
            <Link
              to="/app/owner/properties"
              className="text-xs font-semibold text-[#408A71] hover:text-[#34745C] hover:underline"
            >
              View all ({totalProperties}) &rarr;
            </Link>
          )}
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <PropertyCardSkeleton key={idx} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && totalProperties === 0 && (
          <EmptyState
            context="property"
            title="No properties in your portfolio yet"
            description="Add your first property asset to begin tracking units, occupancy, and rental agreements."
            action={{
              label: 'Add Property',
              onClick: () => navigate('/app/owner/properties/new'),
              variant: 'primary',
            }}
            bordered
            className="py-12 bg-white"
          />
        )}

        {/* Property Grid */}
        {!isLoading && !isError && totalProperties > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {recentProperties.map((prop) => (
              <PropertyCard key={prop.id} property={prop} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default OwnerDashboardPage