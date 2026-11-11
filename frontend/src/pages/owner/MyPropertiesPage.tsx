import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useOwnerProperties, OWNER_PROPERTIES_QUERY_KEY } from '../../hooks/useOwnerProperties'
import { useOwnerListings, OWNER_LISTINGS_QUERY_KEY } from '../../hooks/useOwnerListings'
import { propertyService } from '../../services/property.service'
import { listingService } from '../../services/listing.service'
import { PropertyCard, type PropertyCardListingData } from '../../components/owner/PropertyCard'
import { PropertyCardSkeleton } from '../../components/owner/PropertyCardSkeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Pagination } from '../../components/ui/pagination'
import { ConfirmationDialog, type ConfirmationVariant } from '../../components/ui/confirmation-dialog'
import type { PropertyCategory } from '../../types/property'

const PAGE_SIZE = 12

// Standard property type filter options
const RESIDENTIAL_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'independent_house', label: 'Independent House' },
  { value: 'studio_apartment', label: 'Studio Apartment' },
  { value: 'other', label: 'Other Residential' },
]

const COMMERCIAL_TYPES = [
  { value: 'office', label: 'Office' },
  { value: 'shop', label: 'Shop' },
  { value: 'showroom', label: 'Showroom' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'other', label: 'Other Commercial' },
]

/**
 * MyPropertiesPage
 * Comprehensive Owner Dashboard and Property Portfolio management.
 * Features summary metrics, live search & multi-attribute filtering, responsive card grid,
 * and lifecycle operations (Publish, Pause, Resume, Close, Delete).
 * Route: /app/owner/properties
 */
export const MyPropertiesPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // State: Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // State: Search & Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [categoryFilter, setCategoryFilter] = useState<'all' | PropertyCategory>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  // Active filter count (excluding default 'all')
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (categoryFilter !== 'all') count++
    if (typeFilter !== 'all') count++
    if (statusFilter !== 'all') count++
    return count
  }, [categoryFilter, typeFilter, statusFilter])

  // Click outside listener for filter panel
  useEffect(() => {
    if (!isFilterPanelOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) {
        setIsFilterPanelOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFilterPanelOpen])

  // State: Action feedback alerts
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // State: Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    variant: ConfirmationVariant
    confirmText: string
    onConfirm: () => Promise<void>
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    confirmText: 'Confirm',
    onConfirm: async () => { },
  })

  // Queries: Properties and Listings
  const {
    data: propertiesData,
    isLoading: propertiesLoading,
    isError: propertiesError,
    error: propertiesErrObj,
    refetch: refetchProperties,
  } = useOwnerProperties({ page: 1, page_size: 100 })

  const {
    data: listingsData,
    isLoading: listingsLoading,
    isError: listingsError,
    refetch: refetchListings,
  } = useOwnerListings({ page: 1, page_size: 100 })

  const isLoading = propertiesLoading || listingsLoading
  const isError = propertiesError || listingsError

  const properties = useMemo(() => propertiesData?.results ?? [], [propertiesData?.results])
  const listings = useMemo(() => listingsData?.results ?? [], [listingsData?.results])

  // Map listings by property_id for instant O(1) correlation
  const listingsByPropertyId = useMemo(() => {
    const map: Record<string, PropertyCardListingData> = {}
    listings.forEach((item) => {
      if (item.property_id) {
        map[item.property_id] = {
          id: item.id,
          monthly_rent: item.monthly_rent,
          security_deposit: item.security_deposit,
          available_from: item.available_from,
          status: item.status,
          published_at: item.published_at,
          property: item.property,
        }
      }
    })
    return map
  }, [listings])

  // Filtered and Sorted Properties
  const filteredProperties = useMemo(() => {
    return properties
      .filter((prop) => {
        // 1. Text Search (title, address, locality, city)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const titleMatch = prop.title.toLowerCase().includes(q)
          const localityMatch = prop.locality?.toLowerCase().includes(q)
          const cityMatch = prop.city?.toLowerCase().includes(q)
          const addressMatch = prop.address_line_1?.toLowerCase().includes(q)
          if (!titleMatch && !localityMatch && !cityMatch && !addressMatch) {
            return false
          }
        }

        // 2. Category Filter
        if (categoryFilter !== 'all' && prop.category !== categoryFilter) {
          return false
        }

        // 3. Property Type Filter
        if (typeFilter !== 'all' && prop.property_type !== typeFilter) {
          return false
        }

        // 4. Listing Status Filter
        if (statusFilter !== 'all') {
          const listing = listingsByPropertyId[prop.id]
          if (statusFilter === 'unlisted') {
            if (listing) return false
          } else {
            if (!listing || listing.status !== statusFilter) return false
          }
        }

        return true
      })
      .sort((a, b) => {
        const listingA = listingsByPropertyId[a.id]
        const listingB = listingsByPropertyId[b.id]
        const rentA = listingA ? parseFloat(String(listingA.monthly_rent)) || 0 : 0
        const rentB = listingB ? parseFloat(String(listingB.monthly_rent)) || 0 : 0

        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        } else if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        } else if (sortBy === 'rent_asc') {
          return rentA - rentB
        } else if (sortBy === 'rent_desc') {
          return rentB - rentA
        } else if (sortBy === 'title_asc') {
          return a.title.localeCompare(b.title)
        }
        return 0
      })
  }, [
    properties,
    searchQuery,
    categoryFilter,
    typeFilter,
    statusFilter,
    sortBy,
    listingsByPropertyId,
  ])

  // Paginate filtered properties
  const totalFiltered = filteredProperties.length
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE)
  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredProperties.slice(start, start + PAGE_SIZE)
  }, [filteredProperties, currentPage])

  // Handle Search Input Change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
    if (value.trim()) {
      setSearchParams({ search: value.trim() })
    } else {
      setSearchParams({})
    }
  }

  // Clear all filters
  const handleResetFilters = () => {
    setSearchQuery('')
    setCategoryFilter('all')
    setTypeFilter('all')
    setStatusFilter('all')
    setSortBy('newest')
    setCurrentPage(1)
    setSearchParams({})
  }

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    categoryFilter !== 'all' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortBy !== 'newest'

  // Action: Publish Listing
  const handlePublishListing = async (listingId: string, propertyId: string) => {
    // Check if property has images
    const propertyItem = properties.find((p) => p.id === propertyId)
    if (propertyItem && !propertyItem.primary_image_url) {
      setFeedback({
        type: 'error',
        message: 'A property must have at least one uploaded image before its listing can be published. Please edit the property to add photos.',
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    try {
      setActionLoading(true)
      await listingService.publishListing(listingId)
      await queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] })
      setFeedback({
        type: 'success',
        message: 'Listing published successfully! It is now live on the public marketplace.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish listing.'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setActionLoading(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Action: Pause Listing (with confirmation)
  const handlePauseListing = (listingId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Pause Listing?',
      description: 'Pausing this listing will temporarily hide it from the public marketplace. Prospective tenants will not be able to view or contact you about it until you resume the listing.',
      variant: 'warning',
      confirmText: 'Pause Listing',
      onConfirm: async () => {
        try {
          setActionLoading(true)
          await listingService.pauseListing(listingId)
          await queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] })
          setFeedback({
            type: 'success',
            message: 'Listing paused. It has been temporarily removed from public view.',
          })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to pause listing.'
          setFeedback({ type: 'error', message: msg })
        } finally {
          setActionLoading(false)
          setConfirmDialog((prev) => ({ ...prev, open: false }))
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      },
    })
  }

  // Action: Resume Listing
  const handleResumeListing = async (listingId: string) => {
    try {
      setActionLoading(true)
      await listingService.publishListing(listingId)
      await queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] })
      setFeedback({
        type: 'success',
        message: 'Listing resumed! It is now active and visible on the marketplace.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resume listing.'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setActionLoading(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Action: Close Listing (with confirmation)
  const handleCloseListing = (listingId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Close Listing?',
      description: 'Closing this listing will permanently end active tenant marketing for this property. To re-list this property in the future, you will create a new listing.',
      variant: 'warning',
      confirmText: 'Close Listing',
      onConfirm: async () => {
        try {
          setActionLoading(true)
          await listingService.closeListing(listingId)
          await queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] })
          setFeedback({
            type: 'success',
            message: 'Listing closed.',
          })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to close listing.'
          setFeedback({ type: 'error', message: msg })
        } finally {
          setActionLoading(false)
          setConfirmDialog((prev) => ({ ...prev, open: false }))
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      },
    })
  }

  // Action: Delete Property (with confirmation)
  const handleDeleteProperty = (propertyId: string, propertyTitle: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Property?',
      description: `Are you sure you want to delete "${propertyTitle}"? All associated gallery images, specifications, and listing history will be permanently deleted. This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete Property',
      onConfirm: async () => {
        try {
          setActionLoading(true)
          await propertyService.deleteProperty(propertyId)
          await queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })
          await queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] })
          setFeedback({
            type: 'success',
            message: `Property "${propertyTitle}" was deleted successfully.`,
          })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to delete property.'
          setFeedback({ type: 'error', message: msg })
        } finally {
          setActionLoading(false)
          setConfirmDialog((prev) => ({ ...prev, open: false }))
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      },
    })
  }

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E5E7EB] pb-3.5">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
            My Properties
          </h1>
        </div>

        {/* Primary Add Property CTA */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/owner/properties/new')}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add New Property
          </Button>
        </div>
      </div>

      {/* 2. Global Feedback Alert */}
      {feedback && (
        <Alert
          variant={feedback.type === 'success' ? 'success' : 'error'}
          title={feedback.type === 'success' ? 'Action Completed' : 'Operation Error'}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {/* 3. API Error Banner */}
      {isError && (
        <Alert variant="error" title="Could not retrieve portfolio records">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>
              {propertiesErrObj instanceof Error
                ? propertiesErrObj.message
                : 'Unable to connect to the backend properties and listings services.'}
            </span>
            <div className="flex gap-2">
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
          </div>
        </Alert>
      )}

      {/* 4. Compact Search & Filters Toolbar */}
      <section className="space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Box (flex-1) */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by title, address, or locality..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/20 focus:border-[#408A71] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Right Action Controls: Filters Button + Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Filters Button & Popover */}
            <div className="relative" ref={filterPanelRef}>
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 border rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-2xs ${
                  isFilterPanelOpen || activeFilterCount > 0
                    ? 'border-[#408A71] bg-[#408A71]/5 text-[#408A71]'
                    : 'border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]'
                }`}
                aria-expanded={isFilterPanelOpen}
                aria-haspopup="true"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-[#408A71] rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Filter Panel Dropdown / Popover */}
              {isFilterPanelOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl border border-[#E5E7EB] shadow-lg p-4 z-30 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
                    <span className="text-xs font-semibold text-[#111827] uppercase tracking-wider">Filters</span>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryFilter('all')
                          setTypeFilter('all')
                          setStatusFilter('all')
                          setCurrentPage(1)
                        }}
                        className="text-xs text-[#408A71] hover:underline font-medium cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="block text-xs font-medium text-[#4B5563] mb-1">
                      Category
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => {
                        setCategoryFilter(e.target.value as 'all' | PropertyCategory)
                        setTypeFilter('all')
                        setCurrentPage(1)
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/20 focus:border-[#408A71] cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                    </select>
                  </div>

                  {/* Property Type Filter */}
                  <div>
                    <label className="block text-xs font-medium text-[#4B5563] mb-1">
                      Property Type
                    </label>
                    <select
                      value={typeFilter}
                      onChange={(e) => {
                        setTypeFilter(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/20 focus:border-[#408A71] cursor-pointer"
                    >
                      <option value="all">All Property Types</option>
                      {categoryFilter !== 'commercial' && (
                        <optgroup label="Residential">
                          {RESIDENTIAL_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {categoryFilter !== 'residential' && (
                        <optgroup label="Commercial">
                          {COMMERCIAL_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Listing Status Filter */}
                  <div>
                    <label className="block text-xs font-medium text-[#4B5563] mb-1">
                      Listing Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/20 focus:border-[#408A71] cursor-pointer"
                    >
                      <option value="all">All Listing Statuses</option>
                      <option value="published">Published (Live)</option>
                      <option value="draft">Draft Listing</option>
                      <option value="paused">Paused</option>
                      <option value="closed">Closed</option>
                      <option value="unlisted">Unlisted</option>
                    </select>
                  </div>

                  {/* Close / Apply button */}
                  <div className="pt-2 border-t border-[#F3F4F6] flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsFilterPanelOpen(false)}
                      className="px-3 py-1.5 bg-[#408A71] text-white text-xs font-medium rounded-md hover:bg-[#35725D] transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Sorting Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort properties"
                className="px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/20 focus:border-[#408A71] cursor-pointer shadow-2xs"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="rent_desc">Rent: High to Low</option>
                <option value="rent_asc">Rent: Low to High</option>
                <option value="title_asc">Title: A &rarr; Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Small Result Count */}
        <div className="flex items-center justify-between text-xs text-[#6B7280] px-0.5 pt-1">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-[#111827]">{totalFiltered}</strong>{' '}
              {totalFiltered === 1 ? 'property' : 'properties'}
              {properties.length > 0 && ` (of ${properties.length} total)`}
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[#408A71] font-medium hover:underline ml-2 cursor-pointer flex items-center gap-1"
              >
                <span>✕</span> Reset filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 6. Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <PropertyCardSkeleton key={idx} />
          ))}
        </div>
      )}

      {/* 7. Zero-State Display (Total Portfolio Empty) */}
      {!isLoading && !isError && properties.length === 0 && (
        <EmptyState
          context="property"
          title="No properties in your portfolio"
          description="You have not added any properties yet. Add your first property to start managing specs, photos, and published rental listings."
          action={{
            label: 'Add Property',
            onClick: () => navigate('/app/owner/properties/new'),
            variant: 'primary',
          }}
          bordered
          className="py-16 bg-white shadow-2xs"
        />
      )}

      {/* 8. Zero-State Display (Filters Match Zero) */}
      {!isLoading && !isError && properties.length > 0 && totalFiltered === 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-2xs space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-xl text-gray-400">
            🔍
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#111827]">No matching properties</h3>
            <p className="text-xs text-[#6B7280] max-w-md mx-auto">
              No properties in your portfolio match the active search query or filter criteria. Try broadening your search or resetting filters.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            Reset All Filters
          </Button>
        </div>
      )}

      {/* 9. Property Cards Grid */}
      {!isLoading && !isError && paginatedProperties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              listing={listingsByPropertyId[property.id]}
              onPublishListing={handlePublishListing}
              onPauseListing={handlePauseListing}
              onResumeListing={handleResumeListing}
              onCloseListing={handleCloseListing}
              onDeleteProperty={handleDeleteProperty}
              isActionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* 10. Server-Side / Client Pagination Bar */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="pt-4 border-t border-[#E5E7EB]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalFiltered}
            pageSize={PAGE_SIZE}
            onPageChange={(page) => {
              setCurrentPage(page)
              window.scrollTo({ top: 300, behavior: 'smooth' })
            }}
            showTotal={true}
          />
        </div>
      )}

      {/* 11. Interactive Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        loading={actionLoading}
      />
    </div>
  )
}

export default MyPropertiesPage
