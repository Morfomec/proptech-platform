import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { useOwnedPropertyIds } from '../../hooks/useOwnedPropertyIds'
import LandingHeader from './components/LandingHeader'
import LandingFooter from './components/LandingFooter'
import {
  PropertyListingCard,
  PropertyListingCardSkeleton,
} from '../../components/property/PropertyListingCard'
import { listingService } from '../../services/listing.service'
import type { SavedPropertyItem, PublicListingProperty } from '../../types/listing'

type SavedSortOption = 'recently_saved' | 'oldest_saved' | 'rent_asc' | 'rent_desc'

export interface SavedPropertiesPageProps {
  workspaceMode?: 'public' | 'tenant'
}

export const SavedPropertiesPage: React.FC<SavedPropertiesPageProps> = ({
  workspaceMode = 'public',
}) => {
  const isTenantWorkspace = workspaceMode === 'tenant'
  const browsePath = isTenantWorkspace ? '/app/tenant/properties' : '/properties'
  const detailBasePath = isTenantWorkspace ? '/app/tenant/properties' : '/properties'
  const { isAuthenticated, isInitializing } = useAuth()
  const ownedPropertyIds = useOwnedPropertyIds()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SavedSortOption>('recently_saved')
  const [currentPage, setCurrentPage] = useState(1)
  const [accumulatedItems, setAccumulatedItems] = useState<SavedPropertyItem[]>([])
  const [hasMorePages, setHasMorePages] = useState(false)
  const [removedPropertyIds, setRemovedPropertyIds] = useState<Set<string>>(new Set())

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  // Fetch Saved Properties query
  const {
    data: savedData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['saved-properties', currentPage],
    queryFn: () => listingService.getSavedProperties({ page: currentPage }),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  // Append items on page load
  useEffect(() => {
    if (savedData?.results) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccumulatedItems((prev) => {
        if (currentPage === 1) {
          return savedData.results
        }
        const existingIds = new Set(prev.map((item) => item.id))
        const newItems = savedData.results.filter((item) => !existingIds.has(item.id))
        return [...prev, ...newItems]
      })
      setHasMorePages(Boolean(savedData.next))
    }
  }, [savedData, currentPage])

  // Remove bookmark mutation
  const removeMutation = useMutation({
    mutationFn: (propertyId: string) => listingService.removeSavedProperty(propertyId),
    onMutate: async (propertyId: string) => {
      // Optimistic update
      setRemovedPropertyIds((prev) => new Set(prev).add(propertyId))
    },
    onError: (_err, propertyId) => {
      // Rollback optimistic removal
      setRemovedPropertyIds((prev) => {
        const next = new Set(prev)
        next.delete(propertyId)
        return next
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-properties'] })
    },
  })

  const handleRemove = (e: React.MouseEvent, propertyId: string) => {
    e.preventDefault()
    e.stopPropagation()
    removeMutation.mutate(propertyId)
  }

  // Filter and sort items locally
  const visibleItems = useMemo(() => {
    return accumulatedItems.filter((item) => !removedPropertyIds.has(item.property_id))
  }, [accumulatedItems, removedPropertyIds])

  const filteredAndSortedItems = useMemo(() => {
    let result = [...visibleItems]

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase()
      result = result.filter((item) => {
        const prop = item.property as PublicListingProperty
        const titleMatch = (prop?.title || '').toLowerCase().includes(q)
        const listingTitleMatch = (item.listing?.title || '').toLowerCase().includes(q)
        const localityMatch = (prop?.locality || '').toLowerCase().includes(q)
        const cityMatch = (prop?.city || '').toLowerCase().includes(q)
        const addressMatch = (prop?.address_line_1 || '').toLowerCase().includes(q)
        return titleMatch || listingTitleMatch || localityMatch || cityMatch || addressMatch
      })
    }

    // Sort order
    result.sort((a, b) => {
      if (sortOption === 'recently_saved') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortOption === 'oldest_saved') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      if (sortOption === 'rent_asc') {
        const rentA = a.listing?.monthly_rent ? parseFloat(a.listing.monthly_rent) : Infinity
        const rentB = b.listing?.monthly_rent ? parseFloat(b.listing.monthly_rent) : Infinity
        return rentA - rentB
      }
      if (sortOption === 'rent_desc') {
        const rentA = a.listing?.monthly_rent ? parseFloat(a.listing.monthly_rent) : -Infinity
        const rentB = b.listing?.monthly_rent ? parseFloat(b.listing.monthly_rent) : -Infinity
        return rentB - rentA
      }
      return 0
    })

    return result
  }, [visibleItems, searchTerm, sortOption])

  const handleLoadMore = () => {
    if (hasMorePages && !isFetching) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  return (
    <div
      className={
        isTenantWorkspace
          ? 'pb-8'
          : 'min-h-screen bg-[#F9FAFB] flex flex-col justify-between'
      }
    >
      {/* Top Navigation (public mode only) */}
      {!isTenantWorkspace && <LandingHeader activeNav="saved" />}

      {/* Main Content Area */}
      <main
        className={
          isTenantWorkspace
            ? 'w-full'
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full flex-1'
        }
      >
        {/* Page Header */}
        <div
          className={
            isTenantWorkspace
              ? 'border-b border-[#E5E7EB] pb-3.5 mb-4'
              : 'border-b border-[#E5E7EB] pb-3.5 mb-5'
          }
        >
          <h1
            className={
              isTenantWorkspace
                ? 'text-xl font-medium tracking-tight text-[#111827] mb-0'
                : 'text-xl sm:text-2xl font-medium tracking-tight text-[#111827] mb-0'
            }
          >
            Saved Properties
          </h1>
        </div>

        {/* Controls Toolbar: Search & Sort */}
        {isAuthenticated && (
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/90 shadow-2xs mb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full sm:w-80 md:w-96">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, locality or city..."
                className="w-full pl-10 pr-9 py-2.5 text-sm bg-gray-50/80 border border-gray-200 rounded-xl text-[#111827] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Sorting Dropdown */}
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3">
              <label htmlFor="saved-sort" className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">
                Sort by:
              </label>
              <div className="relative">
                <select
                  id="saved-sort"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SavedSortOption)}
                  className="appearance-none bg-white border border-gray-200 text-xs sm:text-sm text-[#111827] font-medium py-2.5 pl-3.5 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] cursor-pointer"
                >
                  <option value="recently_saved">Recently Saved</option>
                  <option value="rent_asc">Rent: Low to High</option>
                  <option value="rent_desc">Rent: High to Low</option>
                  <option value="oldest_saved">Oldest Saved</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Section */}
        {!isAuthenticated && !isInitializing ? (
          /* Unauthenticated State */
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200/90 my-6 p-8 max-w-xl mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#ECF5F2] text-[#408A71] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#111827] mb-2">Sign in to view saved properties</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Bookmark your favourite homes and commercial spaces to track their availability, compare rents, and review details anytime.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-6 py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                Sign In
              </button>
              <Link
                to="/properties"
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition-colors cursor-pointer"
              >
                Browse Rentals
              </Link>
            </div>
          </div>
        ) : isError ? (
          /* Error State */
          <div className="text-center py-16 bg-white rounded-2xl border border-red-100 my-6 p-8 max-w-xl mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-2">Unable to load saved properties</h3>
            <p className="text-sm text-gray-500 mb-6">
              We encountered a connection issue while loading your saved collection. Please try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-5 py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : isLoading && currentPage === 1 ? (
          /* Loading Skeletons matching 3-column Listing Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <PropertyListingCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200/90 my-6 p-8 max-w-xl mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#ECF5F2] text-[#408A71] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#111827] mb-2">
              {searchTerm.trim() ? 'No matching saved properties' : 'No saved properties yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {searchTerm.trim()
                ? `We couldn't find any saved properties matching "${searchTerm}". Try a different keyword or clear your search.`
                : 'Browse our property catalog and click the heart icon on any listing to save it to this collection.'}
            </p>
            {searchTerm.trim() ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-5 py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                Clear Search
              </button>
            ) : (
              <Link
                to={browsePath}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <span>Browse Properties</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            )}
          </div>
        ) : (
          /* Responsive 3-Column Property Card Grid matching Browse Listings */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAndSortedItems.map((item) => {
              const prop = item.property as PublicListingProperty
              const listing = item.listing
              const isAvailable = item.is_available && listing && listing.status === 'published'
              const detailTarget = `${detailBasePath}/${listing?.id || item.property_id}`
              const displayTitle = listing?.title || prop?.title || 'Property'

              return (
                <PropertyListingCard
                  key={item.id}
                  title={displayTitle}
                  detailTo={detailTarget}
                  detailState={{ from: 'saved' }}
                  property={prop}
                  monthlyRent={listing?.monthly_rent}
                  isOwned={ownedPropertyIds.has(item.property_id)}
                  isUnavailable={!isAvailable}
                  isSaved
                  saveButtonLabel="Remove from saved properties"
                  onToggleSave={(e) => handleRemove(e, item.property_id)}
                  showParking
                />
              )
            })}
          </div>
        )}

        {/* Load More Properties Control */}
        {isAuthenticated && hasMorePages && (
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isFetching}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-white border border-gray-200 hover:border-[#408A71] text-[#111827] hover:text-[#408A71] font-semibold text-sm transition-all shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isFetching ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#408A71] border-t-transparent rounded-full animate-spin" />
                  <span>Loading more properties...</span>
                </>
              ) : (
                <>
                  <span>Load More Properties</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </main>

      {/* Footer (public mode only) */}
      {!isTenantWorkspace && <LandingFooter isAuthenticated={isAuthenticated} />}
    </div>
  )
}

export default SavedPropertiesPage

