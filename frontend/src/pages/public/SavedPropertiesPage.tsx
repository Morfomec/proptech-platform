import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import LandingHeader from './components/LandingHeader'
import LandingFooter from './components/LandingFooter'
import { Badge } from '../../components/ui/badge'
import { listingService } from '../../services/listing.service'
import { getMediaUrl } from '../../utils/imageUrl'
import type { SavedPropertyItem, PublicListingProperty } from '../../types/listing'

type SavedSortOption = 'recently_saved' | 'oldest_saved' | 'rent_asc' | 'rent_desc'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  independent_house: 'Independent House',
  villa: 'Villa',
  studio_apartment: 'Studio Apartment',
  office: 'Commercial Office',
  shop: 'Shop',
  showroom: 'Showroom',
  warehouse: 'Warehouse',
  other: 'Commercial Space',
}

const FURNISHING_LABELS: Record<string, string> = {
  fully_furnished: 'Fully Furnished',
  semi_furnished: 'Semi-Furnished',
  unfurnished: 'Unfurnished',
}

const formatPrice = (amount?: string | number | null) => {
  if (amount === undefined || amount === null || amount === '') return null
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return amount
  return `₹${num.toLocaleString('en-IN')}`
}

export const SavedPropertiesPage: React.FC = () => {
  const { isAuthenticated, isInitializing } = useAuth()
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
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-between">
      {/* Top Navigation */}
      <LandingHeader activeNav="saved" />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full flex-1">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111827] tracking-tight">
            Saved Properties
          </h1>
        </div>

        {/* Controls Toolbar: Search & Sort */}
        {isAuthenticated && (
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
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
          /* Loading Skeletons in Responsive 2-column Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs animate-pulse flex flex-col"
              >
                <div className="aspect-[16/10] bg-gray-200 w-full" />
                <div className="p-5 space-y-3.5 flex-1">
                  <div className="flex justify-between items-center gap-4">
                    <div className="h-5 bg-gray-200 rounded w-2/3" />
                    <div className="h-5 bg-gray-200 rounded w-1/4" />
                  </div>
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-4 bg-gray-100 rounded w-4/5" />
                  <div className="h-10 bg-gray-100 rounded-xl w-full pt-2" />
                </div>
              </div>
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
                to="/properties"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <span>Browse Rentals</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            )}
          </div>
        ) : (
          /* Responsive Two-Column Property Card Grid on Desktop */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {filteredAndSortedItems.map((item) => {
              const prop = item.property as PublicListingProperty
              const listing = item.listing
              const isAvailable = item.is_available && listing && listing.status === 'published'
              const detailTarget = `/properties/${listing?.id || item.property_id}`

              // Specifications
              const isCommercial = prop?.category === 'commercial' || !prop?.bedrooms
              const bedsText = isCommercial
                ? PROPERTY_TYPE_LABELS[prop?.property_type || ''] || 'Commercial'
                : prop?.bedrooms
                  ? `${prop.bedrooms} BHK`
                  : null
              const bathsText = prop?.bathrooms
                ? `${prop.bathrooms} ${parseFloat(String(prop.bathrooms)) === 1 ? 'Bath' : 'Baths'}`
                : null
              const sqftText = prop?.built_up_area
                ? `${typeof prop.built_up_area === 'number' ? prop.built_up_area.toLocaleString('en-IN') : prop.built_up_area} sq ft`
                : null

              const typeBadgeLabel =
                PROPERTY_TYPE_LABELS[prop?.property_type] ||
                prop?.property_type ||
                (isCommercial ? 'Commercial' : 'Residential')
              const furnishingBadgeLabel = prop?.furnishing_status
                ? FURNISHING_LABELS[prop.furnishing_status]
                : null

              const locationText =
                [prop?.locality, prop?.city].filter(Boolean).join(', ') ||
                prop?.address_line_1 ||
                'Location available on request'

              const displayTitle = listing?.title || prop?.title || 'Property'
              const imageUrl = prop?.primary_image_url ? getMediaUrl(prop.primary_image_url) : null

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col group"
                >
                  {/* Property Image & Save/Unsave Indicator */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
                    <Link to={detailTarget} state={{ from: 'saved' }} className="block w-full h-full">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={displayTitle}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 text-gray-400">
                          <svg
                            className="h-10 w-10 text-gray-300 mb-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                            />
                          </svg>
                          <span className="text-xs font-medium text-gray-400">No photo uploaded</span>
                        </div>
                      )}
                    </Link>

                    {/* Status Badge (if unavailable) */}
                    {!isAvailable && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="warning" size="sm" className="font-semibold shadow-xs">
                          Currently Unavailable
                        </Badge>
                      </div>
                    )}

                    {/* Save/Unsave Indicator Heart Button */}
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, item.property_id)}
                      title="Remove from saved properties"
                      aria-label="Remove from saved properties"
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 text-red-500 hover:scale-110 flex items-center justify-center transition-all shadow-md z-10 cursor-pointer"
                    >
                      <svg
                        className="w-5 h-5 fill-red-500 text-red-500"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-5 sm:p-6 flex flex-col flex-grow justify-between">
                    <div>
                      {/* Property Title & Monthly Rent */}
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <Link to={detailTarget} state={{ from: 'saved' }} className="flex-1">
                          <h3 className="text-base sm:text-lg font-bold text-[#111827] group-hover:text-[#408A71] transition-colors line-clamp-1">
                            {displayTitle}
                          </h3>
                        </Link>
                        {listing?.monthly_rent ? (
                          <div className="text-right shrink-0">
                            <span className="text-base sm:text-lg font-extrabold text-[#111827]">
                              {formatPrice(listing.monthly_rent)}
                            </span>
                            <span className="text-xs text-[#6B7280] font-normal">/month</span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-gray-500">Unlisted</span>
                        )}
                      </div>

                      {/* Property Location */}
                      <p className="text-xs sm:text-sm text-[#6B7280] mb-3.5 flex items-center gap-1.5 truncate">
                        <svg
                          className="w-3.5 h-3.5 text-gray-400 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.75}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.75}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="truncate">{locationText}</span>
                      </p>

                      {/* Supported Property Specifications */}
                      <div className="text-xs font-medium text-[#4B5563] mb-3 flex items-center gap-2 flex-wrap">
                        {bedsText && (
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            {bedsText}
                          </span>
                        )}
                        {bathsText && (
                          <>
                            <span className="text-gray-300">&middot;</span>
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              {bathsText}
                            </span>
                          </>
                        )}
                        {sqftText && (
                          <>
                            <span className="text-gray-300">&middot;</span>
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                              </svg>
                              {sqftText}
                            </span>
                          </>
                        )}
                        {prop?.parking_spaces ? (
                          <>
                            <span className="text-gray-300">&middot;</span>
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              Parking: {prop.parking_spaces}
                            </span>
                          </>
                        ) : null}
                      </div>

                      {/* Badges: Category & Furnishing */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        {typeBadgeLabel && (
                          <Badge variant="neutral" size="sm" className="bg-[#F3F4F6] text-[#4B5563] border-gray-200">
                            {typeBadgeLabel}
                          </Badge>
                        )}
                        {furnishingBadgeLabel && (
                          <Badge variant="neutral" size="sm" className="bg-[#F3F4F6] text-[#4B5563] border-gray-200">
                            {furnishingBadgeLabel}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* View Details Button */}
                    <div className="pt-2 border-t border-gray-100">
                      <Link
                        to={detailTarget}
                        state={{ from: 'saved' }}
                        className="w-full py-2.5 rounded-xl bg-[#ECF5F2] hover:bg-[#DDF0E8] text-[#408A71] text-xs sm:text-sm font-semibold transition-colors text-center block focus:outline-none focus:ring-2 focus:ring-[#408A71]/20 cursor-pointer"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
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

      {/* Footer */}
      <LandingFooter isAuthenticated={isAuthenticated} />
    </div>
  )
}

export default SavedPropertiesPage

