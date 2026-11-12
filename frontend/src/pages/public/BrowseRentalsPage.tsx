import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import { useOwnedPropertyIds } from '../../hooks/useOwnedPropertyIds'
import { useSavedPropertiesToggle } from '../../hooks/useSavedPropertiesToggle'
import LandingHeader from './components/LandingHeader'
import LandingFooter from './components/LandingFooter'
import {
  PropertyListingCard,
  PropertyListingCardSkeleton,
} from '../../components/property/PropertyListingCard'
import { listingService } from '../../services/listing.service'
import type {
  ListingFilterParams,
  ListingSortOption,
  ListingFurnishingStatus,
} from '../../types/listing'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  independent_house: 'Independent House',
  villa: 'Villa',
  studio_apartment: 'Studio Apartment',
  office: 'Commercial Office',
  shop: 'Shop',
  showroom: 'Showroom',
  warehouse: 'Warehouse',
  other: 'Other Commercial',
}

const FURNISHING_LABELS: Record<string, string> = {
  fully_furnished: 'Fully Furnished',
  semi_furnished: 'Semi-Furnished',
  unfurnished: 'Unfurnished',
}

const RENT_BUDGET_PRESETS = [
  { label: 'All Budgets', min: undefined, max: undefined },
  { label: 'Under ₹25,000', min: undefined, max: 25000 },
  { label: '₹25,000 - ₹50,000', min: 25000, max: 50000 },
  { label: '₹50,000 - ₹1,00,000', min: 50000, max: 100000 },
  { label: 'Above ₹1,00,000', min: 100000, max: undefined },
]

const PAGE_SIZE = 9

export interface BrowseRentalsPageProps {
  workspaceMode?: 'public' | 'tenant'
}

export const BrowseRentalsPage: React.FC<BrowseRentalsPageProps> = ({
  workspaceMode = 'public',
}) => {
  const isTenantWorkspace = workspaceMode === 'tenant'
  const detailBasePath = isTenantWorkspace ? '/app/tenant/properties' : '/properties'
  const { isAuthenticated } = useAuth()
  const ownedPropertyIds = useOwnedPropertyIds()
  const { isPropertySaved, handleToggleSave } = useSavedPropertiesToggle()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // State derived from URL query params
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [activeSearch, setActiveSearch] = useState(searchParams.get('search') || '')
  const [rentPreset, setRentPreset] = useState<number | null>(null)
  const [minRentInput, setMinRentInput] = useState(searchParams.get('min_rent') || '')
  const [maxRentInput, setMaxRentInput] = useState(searchParams.get('max_rent') || '')
  const [propertyType, setPropertyType] = useState<string>(searchParams.get('property_type') || '')
  const [bedrooms, setBedrooms] = useState<string>(searchParams.get('bedrooms') || '')
  const [furnishing, setFurnishing] = useState<string>(searchParams.get('furnishing_status') || '')
  const [sortOption, setSortOption] = useState<ListingSortOption>(
    (searchParams.get('sort') as ListingSortOption) || 'newest'
  )
  const [currentPage, setCurrentPage] = useState<number>(
    parseInt(searchParams.get('page') || '1', 10) || 1
  )

  // Dropdown open states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Scroll to top on page mount or route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])

  // Close dropdown on outside click
  const dropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Apply header search updates when submitted from workspace top bar
  const headerSearchState = location.state as { headerSearch?: string; searchTs?: number } | null
  const [lastSearchTs, setLastSearchTs] = useState<number | null>(null)
  if (
    headerSearchState?.searchTs &&
    headerSearchState.searchTs !== lastSearchTs &&
    typeof headerSearchState.headerSearch === 'string'
  ) {
    setLastSearchTs(headerSearchState.searchTs)
    setSearchInput(headerSearchState.headerSearch)
    setActiveSearch(headerSearchState.headerSearch)
    setCurrentPage(1)
  }

  // Sync state changes into query parameters
  useEffect(() => {
    const params = new URLSearchParams()
    if (activeSearch) params.set('search', activeSearch)
    if (minRentInput) params.set('min_rent', minRentInput)
    if (maxRentInput) params.set('max_rent', maxRentInput)
    if (propertyType) params.set('property_type', propertyType)
    if (bedrooms) params.set('bedrooms', bedrooms)
    if (furnishing) params.set('furnishing_status', furnishing)
    if (sortOption !== 'newest') params.set('sort', sortOption)
    if (currentPage > 1) params.set('page', currentPage.toString())

    setSearchParams(params, { replace: true })
  }, [
    activeSearch,
    minRentInput,
    maxRentInput,
    propertyType,
    bedrooms,
    furnishing,
    sortOption,
    currentPage,
    setSearchParams,
  ])

  // Build filter object for API call
  const filterParams: ListingFilterParams = useMemo(() => {
    const p: ListingFilterParams = {
      page: currentPage,
      page_size: PAGE_SIZE,
      sort: sortOption,
    }
    if (activeSearch.trim()) p.search = activeSearch.trim()
    if (minRentInput) p.min_rent = Number(minRentInput)
    if (maxRentInput) p.max_rent = Number(maxRentInput)
    if (propertyType) p.property_type = propertyType
    if (bedrooms) p.bedrooms = Number(bedrooms)
    if (furnishing) p.furnishing_status = furnishing as ListingFurnishingStatus
    return p
  }, [currentPage, sortOption, activeSearch, minRentInput, maxRentInput, propertyType, bedrooms, furnishing])

  // Query: Public Listings from Backend API
  const { data: listingsData, isLoading, isError, error } = useQuery({
    queryKey: ['public-listings', filterParams],
    queryFn: () => listingService.getPublicListings(filterParams),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveSearch(searchInput)
    setCurrentPage(1)
  }

  const handleClearAllFilters = () => {
    setSearchInput('')
    setActiveSearch('')
    setRentPreset(null)
    setMinRentInput('')
    setMaxRentInput('')
    setPropertyType('')
    setBedrooms('')
    setFurnishing('')
    setSortOption('newest')
    setCurrentPage(1)
    setOpenDropdown(null)
  }

  const hasActiveFilters = Boolean(
    activeSearch ||
      minRentInput ||
      maxRentInput ||
      propertyType ||
      bedrooms ||
      furnishing ||
      sortOption !== 'newest'
  )

  const displayedListings = listingsData?.results || []
  const totalCount = listingsData?.count || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1

  // Active Rent Filter Label
  const rentFilterLabel = useMemo(() => {
    if (minRentInput && maxRentInput) {
      return `₹${parseInt(minRentInput, 10).toLocaleString('en-IN')} - ₹${parseInt(maxRentInput, 10).toLocaleString('en-IN')}`
    } else if (minRentInput) {
      return `Above ₹${parseInt(minRentInput, 10).toLocaleString('en-IN')}`
    } else if (maxRentInput) {
      return `Under ₹${parseInt(maxRentInput, 10).toLocaleString('en-IN')}`
    }
    return 'Monthly Rent'
  }, [minRentInput, maxRentInput])

  const isNotFoundError =
    (axios.isAxiosError(error) && error.response?.status === 404) ||
    (typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 404)

  const showGeneralError = isError && !isNotFoundError

  return (
    <div
      className={
        isTenantWorkspace
          ? 'text-[#111827] antialiased pb-8'
          : 'flex flex-col min-h-screen bg-[#FDFDFD] text-[#111827] antialiased'
      }
    >
      {/* 1. Consistent Top Header with dynamic navigation (public mode only) */}
      {!isTenantWorkspace && <LandingHeader activeNav="properties" />}

      {/* 2. Main Properties Marketplace Content */}
      <main
        className={
          isTenantWorkspace
            ? 'w-full'
            : 'flex-grow max-w-7xl mx-auto px-6 py-8 md:py-12 w-full'
        }
      >
        {/* Page Title */}
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
            {isTenantWorkspace ? 'Browse Properties' : 'Explore Properties'}
          </h1>
        </div>

        {/* Wide Search Bar */}
        <form onSubmit={handleSearchSubmit} className="mb-6">
          <div className="relative flex items-center bg-white rounded-2xl border border-gray-200/90 shadow-xs hover:border-gray-300 transition-all p-1.5 focus-within:ring-2 focus-within:ring-[#408A71] focus-within:border-transparent">
            <div className="pl-4 pr-2 text-gray-400">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Locality, City, or State (e.g., Koramangala, Bangalore)"
              className="w-full bg-transparent border-0 px-2 py-2.5 text-sm md:text-base text-[#111827] placeholder:text-gray-400 focus:outline-none focus:ring-0"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setActiveSearch('')
                  setCurrentPage(1)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors shadow-xs shrink-0"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Search</span>
            </button>
          </div>
        </form>

        {/* Filter Toolbar & Sort */}
        <div
          ref={dropdownRef}
          className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100"
        >
          {/* Left: Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Monthly Rent Filter */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'rent' ? null : 'rent')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
                  minRentInput || maxRentInput
                    ? 'border-[#408A71] bg-[#ECF5F2] text-[#408A71]'
                    : 'border-gray-200 bg-white text-[#374151] hover:border-gray-300'
                }`}
              >
                <span>{rentFilterLabel}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'rent' ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {openDropdown === 'rent' && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-40 animate-in fade-in-50 duration-150">
                  <div className="text-xs font-semibold text-[#111827] mb-2 uppercase tracking-wider">
                    Rent Range
                  </div>
                  <div className="space-y-1 mb-3">
                    {RENT_BUDGET_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setRentPreset(idx)
                          setMinRentInput(preset.min ? preset.min.toString() : '')
                          setMaxRentInput(preset.max ? preset.max.toString() : '')
                          setCurrentPage(1)
                          setOpenDropdown(null)
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          rentPreset === idx
                            ? 'bg-[#ECF5F2] text-[#408A71] font-semibold'
                            : 'text-[#374151] hover:bg-gray-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Min ₹"
                      value={minRentInput}
                      onChange={(e) => {
                        setRentPreset(null)
                        setMinRentInput(e.target.value)
                      }}
                      className="w-1/2 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-[#408A71] outline-none"
                    />
                    <span className="text-gray-400 text-xs">-</span>
                    <input
                      type="number"
                      placeholder="Max ₹"
                      value={maxRentInput}
                      onChange={(e) => {
                        setRentPreset(null)
                        setMaxRentInput(e.target.value)
                      }}
                      className="w-1/2 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-[#408A71] outline-none"
                    />
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMinRentInput('')
                        setMaxRentInput('')
                        setRentPreset(null)
                        setCurrentPage(1)
                        setOpenDropdown(null)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPage(1)
                        setOpenDropdown(null)
                      }}
                      className="px-3 py-1 bg-[#408A71] text-white rounded-lg text-xs font-semibold hover:bg-[#34745C]"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Property Type Filter (Both Residential and Commercial) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
                  propertyType
                    ? 'border-[#408A71] bg-[#ECF5F2] text-[#408A71]'
                    : 'border-gray-200 bg-white text-[#374151] hover:border-gray-300'
                }`}
              >
                <span>{propertyType ? PROPERTY_TYPE_LABELS[propertyType] || propertyType : 'Property Type'}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'type' ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {openDropdown === 'type' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-40 animate-in fade-in-50 duration-150 max-h-72 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setPropertyType('')
                      setCurrentPage(1)
                      setOpenDropdown(null)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      !propertyType ? 'bg-[#ECF5F2] text-[#408A71] font-semibold' : 'text-[#374151] hover:bg-gray-50'
                    }`}
                  >
                    All Property Types
                  </button>
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPropertyType(key)
                        setCurrentPage(1)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        propertyType === key ? 'bg-[#ECF5F2] text-[#408A71] font-semibold' : 'text-[#374151] hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Bedrooms Filter (BHK) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'bedrooms' ? null : 'bedrooms')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
                  bedrooms
                    ? 'border-[#408A71] bg-[#ECF5F2] text-[#408A71]'
                    : 'border-gray-200 bg-white text-[#374151] hover:border-gray-300'
                }`}
              >
                <span>{bedrooms ? `${bedrooms} BHK` : 'Bedrooms (BHK)'}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'bedrooms' ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {openDropdown === 'bedrooms' && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-40 animate-in fade-in-50 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setBedrooms('')
                      setCurrentPage(1)
                      setOpenDropdown(null)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      !bedrooms ? 'bg-[#ECF5F2] text-[#408A71] font-semibold' : 'text-[#374151] hover:bg-gray-50'
                    }`}
                  >
                    Any Bedrooms
                  </button>
                  {['1', '2', '3', '4'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setBedrooms(val)
                        setCurrentPage(1)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        bedrooms === val ? 'bg-[#ECF5F2] text-[#408A71] font-semibold' : 'text-[#374151] hover:bg-gray-50'
                      }`}
                    >
                      {val === '4' ? '4+ BHK' : `${val} BHK`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Furnishing Filter */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'furnishing' ? null : 'furnishing')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
                  furnishing
                    ? 'border-[#408A71] bg-[#ECF5F2] text-[#408A71]'
                    : 'border-gray-200 bg-white text-[#374151] hover:border-gray-300'
                }`}
              >
                <span>{furnishing ? FURNISHING_LABELS[furnishing] || furnishing : 'Furnishing'}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${openDropdown === 'furnishing' ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {openDropdown === 'furnishing' && (
                <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-40 animate-in fade-in-50 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setFurnishing('')
                      setCurrentPage(1)
                      setOpenDropdown(null)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      !furnishing ? 'bg-[#ECF5F2] text-[#408A71] font-semibold' : 'text-[#374151] hover:bg-gray-50'
                    }`}
                  >
                    All Furnishing
                  </button>
                  {Object.entries(FURNISHING_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setFurnishing(key)
                        setCurrentPage(1)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        furnishing === key ? 'bg-[#ECF5F2] text-[#408A71] font-semibold' : 'text-[#374151] hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs sm:text-sm font-semibold text-[#408A71] hover:text-[#34745C] hover:underline px-2 py-1 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Right: Sort Dropdown */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="text-[#6B7280]">Sort by:</span>
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value as ListingSortOption)
                  setCurrentPage(1)
                }}
                className="appearance-none bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-3 py-2 pr-8 text-xs sm:text-sm font-semibold text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#408A71] cursor-pointer shadow-2xs"
              >
                <option value="newest">Newest First</option>
                <option value="rent_low_to_high">Rent: Low to High</option>
                <option value="rent_high_to_low">Rent: High to Low</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div className="text-sm text-[#4B5563] mb-6 font-medium">
          <strong className="text-[#111827] font-bold">{totalCount}</strong> properties found
          {activeSearch ? (
            <span>
              {' '}
              matching &ldquo;<span className="text-[#111827] font-semibold">{activeSearch}</span>&rdquo;
            </span>
          ) : null}
        </div>

        {/* 3. Listings Grid / Loading / Empty / Error States */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <PropertyListingCardSkeleton key={i} />
            ))}
          </div>
        ) : showGeneralError ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 my-8 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#111827] mb-1">Failed to load properties</h3>
            <p className="text-sm text-gray-500 mb-4">
              {error instanceof Error ? error.message : 'Please check your connection and try again.'}
            </p>
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['public-listings'] })}
              className="px-4 py-2 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : displayedListings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200/90 my-8 p-8 max-w-xl mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#ECF5F2] text-[#408A71] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#111827] mb-2">No properties found</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {hasActiveFilters
                ? "We couldn't find any active property listings matching your search or filter criteria. Try expanding your search location or clearing filters."
                : 'There are currently no active property listings published on the platform. Please check back later!'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-5 py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {displayedListings.map((listing) => {
              const prop = listing.property
              const propertyId = prop?.id || listing.property_id
              return (
                <PropertyListingCard
                  key={listing.id}
                  title={listing.title}
                  detailTo={`${detailBasePath}/${listing.id}`}
                  detailState={{ from: 'properties' }}
                  property={prop}
                  monthlyRent={listing.monthly_rent}
                  isOwned={ownedPropertyIds.has(propertyId)}
                  isSaved={isPropertySaved(propertyId)}
                  onToggleSave={(e) => handleToggleSave(e, propertyId)}
                />
              )
            })}
          </div>
        )}

        {/* 4. Left-Bottom Pagination Controls (Left-aligned when there are multiple pages) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-start gap-2 mt-8 mb-8">
            {/* Prev Button */}
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium transition-colors shadow-2xs"
              aria-label="Previous page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Page Pill Buttons */}
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
              ) {
                const isActive = pageNum === currentPage
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => {
                      setCurrentPage(pageNum)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all shadow-2xs ${
                      isActive
                        ? 'bg-[#408A71] text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-[#374151] hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              } else if (
                (pageNum === 2 && currentPage > 3) ||
                (pageNum === totalPages - 1 && currentPage < totalPages - 2)
              ) {
                return (
                  <span key={pageNum} className="w-6 text-center text-gray-400 font-bold select-none">
                    ...
                  </span>
                )
              }
              return null
            })}

            {/* Next Button */}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium transition-colors shadow-2xs"
              aria-label="Next page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* 6. Consistent Landing Footer (public mode only) */}
      {!isTenantWorkspace && <LandingFooter isAuthenticated={isAuthenticated} />}
    </div>
  )
}

export default BrowseRentalsPage
