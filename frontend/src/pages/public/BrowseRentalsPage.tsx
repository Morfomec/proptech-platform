import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import LandingHeader from './components/LandingHeader'
import LandingFooter from './components/LandingFooter'
import { Badge } from '../../components/ui/badge'
import { listingService } from '../../services/listing.service'
import { getMediaUrl } from '../../utils/imageUrl'
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

export const BrowseRentalsPage: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
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
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({})

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

  // Query: Saved Properties (only if authenticated)
  const { data: savedData } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: () => listingService.getSavedProperties(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  })

  // Derive saved property IDs from backend response
  const savedPropertyIds = useMemo(() => {
    const ids = new Set<string>()
    if (savedData?.results) {
      savedData.results.forEach((item) => {
        if (item.property_id) {
          ids.add(item.property_id)
        }
      })
    }
    return ids
  }, [savedData])

  const isPropertySaved = (propertyId: string): boolean => {
    if (propertyId in optimisticOverrides) {
      return optimisticOverrides[propertyId]
    }
    return savedPropertyIds.has(propertyId)
  }

  // Bookmark Toggle Mutation
  const toggleSaveMutation = useMutation({
    mutationFn: async ({ propertyId, isSaved }: { propertyId: string; isSaved: boolean }) => {
      if (isSaved) {
        return listingService.removeSavedProperty(propertyId)
      } else {
        return listingService.saveProperty(propertyId)
      }
    },
    onMutate: async ({ propertyId, isSaved }) => {
      setOptimisticOverrides((prev) => ({ ...prev, [propertyId]: !isSaved }))
    },
    onError: (_err, { propertyId, isSaved }) => {
      setOptimisticOverrides((prev) => ({ ...prev, [propertyId]: isSaved }))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-properties'] })
    },
  })

  const handleHeartClick = (e: React.MouseEvent, propertyId: string) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: location.pathname + location.search },
      })
      return
    }

    const isSaved = isPropertySaved(propertyId)
    toggleSaveMutation.mutate({ propertyId, isSaved })
  }

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

  const formatPrice = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return amount
    return `₹${num.toLocaleString('en-IN')}`
  }

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
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] text-[#111827] antialiased">
      {/* 1. Consistent Top Header with dynamic navigation */}
      <LandingHeader activeNav="properties" />

      {/* 2. Main Properties Marketplace Content */}
      <main className="flex-grow max-w-7xl mx-auto px-6 py-8 md:py-12 w-full">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
            Explore Properties
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs animate-pulse"
              >
                <div className="aspect-[16/10] bg-gray-200 w-full" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-9 bg-gray-100 rounded-xl w-full pt-2" />
                </div>
              </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {displayedListings.map((listing) => {
              const prop = listing.property
              const isSaved = isPropertySaved(prop?.id || listing.property_id)
              const imageUrl = prop?.primary_image_url ? getMediaUrl(prop.primary_image_url) : null

              // Specifications: clean handling for both residential and commercial
              const isCommercial = prop?.category === 'commercial' || !prop?.bedrooms
              const bedsText = isCommercial
                ? PROPERTY_TYPE_LABELS[prop?.property_type || ''] || 'Commercial'
                : `${prop?.bedrooms} BHK`
              const bathsText = prop?.bathrooms ? `${prop.bathrooms} ${prop.bathrooms === 1 ? 'Bath' : 'Baths'}` : null
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

              return (
                <div
                  key={listing.id}
                  className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col group"
                >
                  {/* Property Image & Heart Button */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
                    <Link
                      to={`/properties/${listing.id}`}
                      state={{ from: 'properties' }}
                      className="block w-full h-full"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={listing.title}
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

                    {/* Bookmark Heart Button */}
                    <button
                      type="button"
                      onClick={(e) => handleHeartClick(e, prop?.id || listing.property_id)}
                      title={isSaved ? 'Remove from saved' : 'Save property'}
                      aria-label={isSaved ? 'Remove from saved properties' : 'Save this property'}
                      className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md z-10 ${
                        isSaved
                          ? 'bg-white text-red-500 hover:scale-110'
                          : 'bg-white/90 text-gray-500 hover:text-red-500 hover:bg-white hover:scale-105'
                      }`}
                    >
                      <svg
                        className={`w-5 h-5 transition-colors ${
                          isSaved ? 'fill-red-500 text-red-500' : 'fill-none stroke-current'
                        }`}
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
                  <div className="p-5 flex flex-col flex-grow justify-between">
                    <div>
                      {/* Title & Monthly Rent Row */}
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <Link to={`/properties/${listing.id}`} state={{ from: 'properties' }} className="line-clamp-1 flex-1">
                          <h3 className="text-base sm:text-lg font-bold text-[#111827] group-hover:text-[#408A71] transition-colors">
                            {listing.title}
                          </h3>
                        </Link>
                        <div className="text-right shrink-0">
                          <span className="text-base sm:text-lg font-extrabold text-[#111827]">
                            {formatPrice(listing.monthly_rent)}
                          </span>
                          <span className="text-xs text-[#6B7280] font-normal">/mo</span>
                        </div>
                      </div>

                      {/* Locality & City */}
                      <p className="text-xs sm:text-sm text-[#6B7280] mb-3 flex items-center gap-1.5 truncate">
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
                        <span className="truncate">
                          {[prop?.locality, prop?.city].filter(Boolean).join(', ') || 'India'}
                        </span>
                      </p>

                      {/* Property Specs (Bedrooms, Bathrooms, Sq Ft) */}
                      <div className="text-xs font-medium text-[#4B5563] mb-3 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          {bedsText}
                        </span>
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
                      </div>

                      {/* Badges Row */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        {furnishingBadgeLabel && (
                          <Badge variant="neutral" size="sm" className="bg-[#F3F4F6] text-[#4B5563] border-gray-200">
                            {furnishingBadgeLabel}
                          </Badge>
                        )}
                        {typeBadgeLabel && (
                          <Badge variant="neutral" size="sm" className="bg-[#F3F4F6] text-[#4B5563] border-gray-200">
                            {typeBadgeLabel}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* View Details Action Button */}
                    <Link
                      to={`/properties/${listing.id}`}
                      state={{ from: 'properties' }}
                      className="w-full py-2.5 rounded-xl bg-[#ECF5F2] hover:bg-[#DDF0E8] text-[#408A71] text-xs sm:text-sm font-semibold transition-colors text-center focus:outline-none focus:ring-2 focus:ring-[#408A71]/20 block"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
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

      {/* 6. Consistent Landing Footer */}
      <LandingFooter isAuthenticated={isAuthenticated} />
    </div>
  )
}

export default BrowseRentalsPage
