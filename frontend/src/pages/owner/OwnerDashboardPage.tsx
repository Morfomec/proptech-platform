import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOwnerProperties } from '../../hooks/useOwnerProperties'
import { useOwnerListings } from '../../hooks/useOwnerListings'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'

/**
 * OwnerDashboardPage (Overview)
 * Portfolio summary dashboard displaying high-level portfolio metrics and
 * quick navigation to My Properties for individual property management.
 * Route: /app/owner/dashboard
 */
export const OwnerDashboardPage: React.FC = () => {
  const navigate = useNavigate()

  // Queries: Portfolio Properties and Listings
  const {
    data: propertiesData,
    isLoading: propertiesLoading,
    isError: propertiesError,
    error: propertiesErr,
    refetch: refetchProperties,
  } = useOwnerProperties({ page: 1, page_size: 100 })

  const {
    data: listingsData,
    isLoading: listingsLoading,
    isError: listingsError,
    error: listingsErr,
    refetch: refetchListings,
  } = useOwnerListings({ page: 1, page_size: 100 })

  const isLoading = propertiesLoading || listingsLoading
  const isError = propertiesError || listingsError

  // Portfolio Summary Metrics
  const metrics = useMemo(() => {
    const totalProps = propertiesData?.count ?? propertiesData?.results?.length ?? 0
    const listings = listingsData?.results ?? []
    const activeListings = listings.filter((l) => l.status === 'published').length
    const draftListings = listings.filter((l) => l.status === 'draft').length
    const pausedListings = listings.filter((l) => l.status === 'paused').length

    return {
      totalProps,
      activeListings,
      draftListings,
      pausedListings,
    }
  }, [propertiesData, listingsData])

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header Banner */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
            Overview
          </h1>
        </div>

        {/* Primary Add Property Action */}
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
        <Alert variant="error" title="Failed to load portfolio overview">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>
              {propertiesErr instanceof Error
                ? propertiesErr.message
                : listingsErr instanceof Error
                ? listingsErr.message
                : 'Unable to connect to property services. Please try again.'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchProperties()
                void refetchListings()
              }}
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 3. Portfolio Summary Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Metric 1: Total Properties */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-2xs hover:border-[#408A71]/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
              Total Properties
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#408A71]/10 text-[#408A71]">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton shape="text" width={48} height={32} />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
                {metrics.totalProps}
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Active Listings */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-2xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Active Listings
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton shape="text" width={48} height={32} />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                {metrics.activeListings}
              </div>
            )}
          </div>
        </div>

        {/* Metric 3: Draft Listings */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-2xs hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Draft Listings
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton shape="text" width={48} height={32} />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-700">
                {metrics.draftListings}
              </div>
            )}
          </div>
        </div>

        {/* Metric 4: Paused Listings */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-2xs hover:border-orange-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-700">
              Paused Listings
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <Skeleton shape="text" width={48} height={32} />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-orange-700">
                {metrics.pausedListings}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Navigation Card to My Properties */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xs hover:border-[#408A71]/30 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#408A71]/10 text-[#408A71]">
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
                aria-hidden="true"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                My Properties
              </h2>
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/owner/properties')}
            rightIcon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            }
          >
            Go to My Properties
          </Button>
        </div>
      </section>
    </div>
  )
}

export default OwnerDashboardPage
