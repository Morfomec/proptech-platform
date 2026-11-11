import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingService } from '../../services/listing.service'
import { useAuth } from '../../hooks/useAuth'
import { useOwnedPropertyIds } from '../../hooks/useOwnedPropertyIds'
import { useMyApplications } from '../../hooks/useTenantWorkspace'
import { Badge } from '../../components/ui/badge'
import { getApplicationStatusMeta } from '../../utils/application'
import LandingHeader from './components/LandingHeader'
import LandingFooter from './components/LandingFooter'
import { getMediaUrl } from '../../utils/imageUrl'
import type { ListingDetailItem } from '../../types/listing'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  independent_house: 'Independent House',
  villa: 'Villa',
  studio_apartment: 'Studio Apartment',
  office: 'Office',
  shop: 'Shop',
  showroom: 'Showroom',
  warehouse: 'Warehouse',
  other: 'Other',
}

const FURNISHING_LABELS: Record<string, string> = {
  fully_furnished: 'Fully Furnished',
  semi_furnished: 'Semi-Furnished',
  unfurnished: 'Unfurnished',
}

export interface PublicPropertyDetailPageProps {
  workspaceMode?: 'public' | 'tenant'
}

export const PublicPropertyDetailPage: React.FC<PublicPropertyDetailPageProps> = ({
  workspaceMode = 'public',
}) => {
  const isTenantWorkspace = workspaceMode === 'tenant'
  const browsePath = isTenantWorkspace ? '/app/tenant/properties' : '/properties'
  const savedPath = isTenantWorkspace ? '/app/tenant/saved-properties' : '/saved-properties'
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuth()
  const ownedPropertyIds = useOwnedPropertyIds()
  const { data: myApplicationsData } = useMyApplications({ page: 1, page_size: 100 })

  // Gallery Modal & Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

  // Scroll to top on page mount or route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, id])

  // Fetch Listing Details
  const {
    data: listingResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-listing-detail', id],
    queryFn: () => listingService.getListing(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  })

  const listing: ListingDetailItem | undefined = listingResponse?.data

  // Fetch saved properties to determine bookmark state
  const { data: savedData } = useQuery({
    queryKey: ['saved-properties'],
    queryFn: () => listingService.getSavedProperties(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  })

  const isSaved = Boolean(
    listing?.property_id &&
    savedData?.results?.some((item) => item.property_id === listing.property_id)
  )

  // Save / Bookmark Mutation using existing SavedProperty API
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!listing?.property_id) return
      if (isSaved) {
        await listingService.removeSavedProperty(listing.property_id)
      } else {
        await listingService.saveProperty(listing.property_id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-properties'] })
    },
  })

  const handleSaveToggle = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } })
      return
    }
    saveMutation.mutate()
  }

  const handleApplyClick = () => {
    const targetListingId = listing?.id || id
    const applyPath = targetListingId ? `/app/tenant/properties/${targetListingId}/apply` : '/app/tenant/properties'
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: applyPath } } })
      return
    }
    navigate(applyPath)
  }

  const isOwnProperty = Boolean(
    isAuthenticated &&
      listing &&
      ((user?.id && listing.owner?.id && user.id === listing.owner.id) ||
        ownedPropertyIds.has(listing.property_id))
  )

  const existingApplication = useMemo(() => {
    if (!listing || !isAuthenticated) return null
    return (myApplicationsData?.results ?? []).find((a) => a.listing === listing.id) ?? null
  }, [listing, isAuthenticated, myApplicationsData])

  // Format INR price helper
  const formatPrice = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined || amount === '') return '₹0'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return `₹${amount}`
    return `₹${num.toLocaleString('en-IN')}`
  }

  // Format date helper
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Not specified'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return
      if (e.key === 'Escape') setLightboxOpen(false)
      if (e.key === 'ArrowRight' && listing?.property?.images?.length) {
        setActivePhotoIndex((prev) => (prev + 1) % listing.property.images!.length)
      }
      if (e.key === 'ArrowLeft' && listing?.property?.images?.length) {
        setActivePhotoIndex(
          (prev) => (prev - 1 + listing.property.images!.length) % listing.property.images!.length
        )
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen, listing?.property?.images])

  // Navigation source state passed via React Router location state
  const navSource = (location.state as { from?: 'properties' | 'saved' | 'owner' } | null)?.from ?? null

  // Construct dynamic breadcrumb trail based strictly on workspace & navigation source
  const breadcrumbSegments = useMemo(() => {
    const propertyTitle = listing?.title || listing?.property?.title || 'Property Details'

    if (isTenantWorkspace) {
      if (navSource === 'saved') {
        return {
          trail: [
            { label: 'Overview', path: '/app/tenant/dashboard' },
            { label: 'Saved Properties', path: savedPath },
          ],
          current: propertyTitle,
        }
      }
      return {
        trail: [
          { label: 'Overview', path: '/app/tenant/dashboard' },
          { label: 'Browse Properties', path: browsePath },
        ],
        current: propertyTitle,
      }
    }

    if (navSource === 'owner') {
      return {
        trail: [
          { label: 'Owner Workspace', path: '/app/owner/dashboard' },
          { label: 'My Properties', path: '/app/owner/properties' },
        ],
        current: propertyTitle,
      }
    }

    if (navSource === 'saved') {
      return {
        trail: [
          { label: 'Home', path: '/' },
          { label: 'Saved Properties', path: '/saved-properties' },
        ],
        current: propertyTitle,
      }
    }

    if (navSource === 'properties') {
      return {
        trail: [
          { label: 'Home', path: '/' },
          { label: 'Properties', path: '/properties' },
        ],
        current: propertyTitle,
      }
    }

    // Direct access via URL or page refresh (no navigation state)
    return {
      trail: [{ label: 'Home', path: '/' }],
      current: propertyTitle,
    }
  }, [isTenantWorkspace, browsePath, savedPath, navSource, listing?.title, listing?.property?.title])

  // Loading State
  if (isLoading) {
    return (
      <div className={isTenantWorkspace ? 'pb-8' : 'min-h-screen bg-white flex flex-col'}>
        {!isTenantWorkspace && <LandingHeader activeNav="properties" />}
        <main
          className={
            isTenantWorkspace
              ? 'w-full animate-pulse'
              : 'max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full animate-pulse'
          }
        >
          <div className="h-4 bg-gray-200 rounded w-64 mb-6" />
          <div className="h-[420px] bg-gray-200 rounded-2xl w-full mb-4" />
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="h-48 bg-gray-200 rounded-2xl" />
            <div className="h-48 bg-gray-200 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-5 bg-gray-100 rounded w-1/2" />
              <div className="h-32 bg-gray-100 rounded-2xl" />
              <div className="h-40 bg-gray-100 rounded-2xl" />
            </div>
            <div className="h-80 bg-gray-100 rounded-2xl" />
          </div>
        </main>
        {!isTenantWorkspace && <LandingFooter isAuthenticated={isAuthenticated} />}
      </div>
    )
  }

  const isListingPubliclyVisible = Boolean(
    listing &&
      listing.status === 'published' &&
      listing.property?.status === 'available'
  )

  // Error / Not Found State
  if (isError || !listing || (!isOwnProperty && !isListingPubliclyVisible)) {
    return (
      <div className={isTenantWorkspace ? 'pb-8' : 'min-h-screen bg-white flex flex-col'}>
        {!isTenantWorkspace && <LandingHeader activeNav="properties" />}
        <main className="max-w-3xl mx-auto px-6 py-20 flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Property Not Found</h1>
          <p className="text-gray-500 mb-6 text-sm max-w-md">
            This property listing might have been removed, closed, or the link may be outdated.
          </p>
          <Link
            to={browsePath}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white font-semibold text-sm transition-colors"
          >
            {isTenantWorkspace ? 'Back to Browse Properties' : 'Browse Other Rentals'}
          </Link>
        </main>
        {!isTenantWorkspace && <LandingFooter isAuthenticated={isAuthenticated} />}
      </div>
    )
  }

  const prop = listing.property
  const images = prop?.images && prop.images.length > 0 ? prop.images : []
  const primaryImg =
    images.find((img) => img.is_primary)?.image_url ||
    prop?.primary_image_url ||
    (images.length > 0 ? images[0].image_url : null)

  const secondaryImages = images.filter((img) => img.image_url !== primaryImg)
  const img2 = secondaryImages[0]?.image_url || null
  const img3 = secondaryImages[1]?.image_url || null
  const remainingCount = Math.max(0, images.length - 3)

  const galleryPhotos =
    images.length > 0
      ? images.map((i) => i.image_url)
      : primaryImg
        ? [primaryImg]
        : []

  const locationText =
    [prop?.address_line_1, prop?.locality, prop?.city, prop?.district, prop?.state]
      .filter(Boolean)
      .join(', ') || 'Address available on request'

  const propertyTypeLabel =
    (prop?.property_type && PROPERTY_TYPE_LABELS[prop.property_type]) ||
    prop?.property_type ||
    'Property'

  const furnishingLabel =
    prop?.furnishing_status && FURNISHING_LABELS[prop.furnishing_status]
      ? FURNISHING_LABELS[prop.furnishing_status]
      : null

  // Build specifications list strictly from actual returned data
  const specItems: Array<{ icon: React.ReactNode; label: string; value: string }> = []

  if (prop?.bedrooms !== null && prop?.bedrooms !== undefined) {
    specItems.push({
      label: 'Bedrooms',
      value: `${prop.bedrooms} ${prop.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v11m0-4h18m0-7v11M3 11h18M7 7h3a2 2 0 012 2v2H5V9a2 2 0 012-2z" />
        </svg>
      ),
    })
  }

  if (prop?.bathrooms !== null && prop?.bathrooms !== undefined) {
    specItems.push({
      label: 'Bathrooms',
      value: `${prop.bathrooms}`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 14h16a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 012-2zm2-4V6a2 2 0 012-2h8a2 2 0 012 2v4" />
        </svg>
      ),
    })
  }

  if (prop?.built_up_area) {
    specItems.push({
      label: 'Area',
      value: `${Number(prop.built_up_area).toLocaleString('en-IN')} sqft`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
    })
  }

  if (furnishingLabel) {
    specItems.push({
      label: 'Furnishing',
      value: furnishingLabel,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v3a2 2 0 01-2 2M5 12v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
        </svg>
      ),
    })
  }

  if (propertyTypeLabel) {
    specItems.push({
      label: 'Property Type',
      value: propertyTypeLabel,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    })
  }

  if (prop?.parking_spaces !== null && prop?.parking_spaces !== undefined) {
    specItems.push({
      label: 'Parking',
      value: `${prop.parking_spaces} ${prop.parking_spaces === 1 ? 'Slot' : 'Slots'}`,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h4a3 3 0 010 6H8V7zm0 6v5" />
        </svg>
      ),
    })
  }

  // Actual description from backend only (no fake generated text)
  const actualDescription = listing.description?.trim() || prop?.description?.trim() || null

  // Owner information strictly from API
  const ownerName = listing.owner?.name || 'Property Owner'
  const ownerAvatar = listing.owner?.avatar_url || null
  const ownerRole = listing.owner?.role || 'Property Owner'

  const existingAppMeta = existingApplication
    ? getApplicationStatusMeta(existingApplication.status)
    : null

  return (
    <div className={isTenantWorkspace ? 'pb-10 font-sans' : 'min-h-screen bg-[#FDFEFE] flex flex-col font-sans'}>
      {!isTenantWorkspace && <LandingHeader activeNav="properties" />}

      <main
        className={
          isTenantWorkspace
            ? 'w-full'
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1'
        }
      >
        {/* 1. Breadcrumbs & Workspace Back Navigation */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500 font-medium truncate">
              {breadcrumbSegments.trail.map((item) => (
                <React.Fragment key={item.path}>
                  <li>
                    <Link to={item.path} className="hover:text-[#408A71] transition-colors">
                      {item.label}
                    </Link>
                  </li>
                  <li className="text-gray-400" aria-hidden="true">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </li>
                </React.Fragment>
              ))}
              <li className="text-gray-900 font-semibold truncate max-w-xs sm:max-w-md">
                {breadcrumbSegments.current}
              </li>
            </ol>
          </nav>

          {isTenantWorkspace && (
            <Link
              to={navSource === 'saved' ? savedPath : browsePath}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-gray-50 text-xs font-semibold text-[#374151] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>{navSource === 'saved' ? 'Back to Saved Properties' : 'Back to Browse Properties'}</span>
            </Link>
          )}
        </div>

        {/* 2. Top Two-Column Section: Gallery (~60%) + Summary & Pricing (~40%) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-start mb-8 sm:mb-12">
          {/* Left Column: Property Image Gallery (~60%) */}
          <div className="md:col-span-7">
            {primaryImg ? (
              <div className="space-y-2.5 sm:space-y-3">
                {/* Large Primary Image */}
                <div
                  onClick={() => {
                    const idx = galleryPhotos.indexOf(primaryImg)
                    setActivePhotoIndex(idx >= 0 ? idx : 0)
                    setLightboxOpen(true)
                  }}
                  className={`relative w-full rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group shadow-xs ${img2
                    ? 'h-52 sm:h-64 md:h-[280px] lg:h-[340px] xl:h-[380px]'
                    : 'h-60 sm:h-72 md:h-[340px] lg:h-[400px]'
                    }`}
                >
                  <img
                    src={getMediaUrl(primaryImg)}
                    alt={listing.title || prop?.title || 'Property Main View'}
                    className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>

                {/* Supporting Images */}
                {img2 && (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <div
                      onClick={() => {
                        const idx = galleryPhotos.indexOf(img2)
                        setActivePhotoIndex(idx >= 0 ? idx : 1)
                        setLightboxOpen(true)
                      }}
                      className="relative h-20 sm:h-24 md:h-28 lg:h-36 rounded-xl overflow-hidden bg-gray-100 cursor-pointer group shadow-2xs"
                    >
                      <img
                        src={getMediaUrl(img2)}
                        alt="Property View 2"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>

                    <div
                      onClick={() => {
                        const target = img3 || img2
                        const idx = galleryPhotos.indexOf(target)
                        setActivePhotoIndex(idx >= 0 ? idx : (img3 ? 2 : 1))
                        setLightboxOpen(true)
                      }}
                      className="relative h-20 sm:h-24 md:h-28 lg:h-36 rounded-xl overflow-hidden bg-gray-100 cursor-pointer group shadow-2xs"
                    >
                      <img
                        src={getMediaUrl(img3 || img2)}
                        alt="Property View 3"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {remainingCount > 0 ? (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center group-hover:bg-black/60 transition-colors">
                          <span className="text-white text-xs sm:text-sm md:text-base font-bold tracking-wide flex items-center gap-1">
                            +{remainingCount} Photos
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] sm:text-xs font-semibold">
                            View Gallery
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-52 sm:h-64 md:h-[280px] lg:h-[340px] rounded-2xl bg-gray-50 border border-gray-200 flex flex-col items-center justify-center text-gray-400">
                <svg className="w-12 h-12 sm:w-14 sm:h-14 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                <span className="text-xs sm:text-sm font-medium">No photos uploaded for this property</span>
              </div>
            )}
          </div>

          {/* Right Column: Property Summary & Pricing Card (~40%) */}
          <div className="md:col-span-5">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-6 lg:p-7 space-y-4 sm:space-y-5">
              {/* Ownership Badge (visible only to authenticated owner of this property) */}
              {isOwnProperty && (
                <div>
                  <Badge variant="success" size="sm" dot>
                    Your Property
                  </Badge>
                </div>
              )}

              {/* Property Title & Location */}
              <div>
                <h1 className="text-xl font-medium text-[#111827] tracking-tight leading-tight mb-0">
                  {listing.title || prop?.title}
                </h1>
                <p className="flex items-center gap-1.5 text-xs sm:text-sm text-[#408A71] font-medium mt-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0 text-[#408A71]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                  </svg>
                  <span>{locationText}</span>
                </p>
              </div>

              {/* Monthly Rent */}
              <div className="pt-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-medium text-[#111827] tracking-tight">
                    {formatPrice(listing.monthly_rent)}
                  </span>
                  <span className="text-xs sm:text-sm font-normal text-[#6B7280]">/ month</span>
                </div>
              </div>

              {/* Supported Specifications */}
              {specItems.length > 0 && (
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 py-4 border-y border-gray-100">
                  {specItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#ECF5F2] text-[#408A71] flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-[#6B7280] font-medium truncate uppercase tracking-wider">{item.label}</div>
                        <div className="text-xs sm:text-sm font-medium text-[#111827] truncate">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Deposit and Availability */}
              <div className="space-y-2 py-0.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7280]">Security Deposit</span>
                  <span className="font-bold text-[#111827]">
                    {listing.security_deposit ? formatPrice(listing.security_deposit) : 'Not specified'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7280]">Available From</span>
                  <span className="font-bold text-[#111827]">
                    {formatDate(listing.available_from)}
                  </span>
                </div>
              </div>

              {/* Role-, Ownership-, and Eligibility-Aware Action Buttons */}
              <div className="pt-1 space-y-2.5">
                {isOwnProperty ? (
                  <>
                    <Link
                      to={`/app/owner/properties/${listing.property_id}`}
                      className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow-md"
                    >
                      <span>Manage Property</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                    <p className="text-[11px] text-center text-[#6B7280]">
                      You are the owner of this property listing.
                    </p>
                  </>
                ) : (
                  <>
                    {isAuthenticated && existingApplication && existingAppMeta ? (
                      <div className="rounded-xl border border-[#CBE7DC] bg-[#F4FAF7] p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#1A382A]">
                            Application Submitted
                          </span>
                          <Badge variant={existingAppMeta.variant} size="sm" dot>
                            {existingAppMeta.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#4B5563]">
                          Applied on {formatDate(existingApplication.created_at)}
                        </p>
                        <Link
                          to={`/app/tenant/applications/${existingApplication.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#408A71] hover:text-[#34745C]"
                        >
                          <span>View Application Details</span>
                          <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    ) : isAuthenticated && !user?.is_tenant ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-[#4B5563]">
                        Only tenant accounts can submit rental applications.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={handleApplyClick}
                          className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] shadow-xs hover:shadow-md"
                        >
                          <span>Apply for Rent</span>
                        </button>
                        {!isAuthenticated && (
                          <p className="text-[11px] text-center text-[#6B7280]">
                            Sign in required to submit an application.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Secondary Action: Save Property */}
                    <button
                      type="button"
                      onClick={handleSaveToggle}
                      disabled={saveMutation.isPending}
                      className={`w-full py-2.5 sm:py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] ${
                        isSaved
                          ? 'border border-[#408A71] bg-[#ECF5F2] text-[#408A71]'
                          : 'border border-gray-200 bg-white hover:bg-gray-50 text-[#111827]'
                      }`}
                    >
                      <svg
                        className={`w-4 h-4 transition-colors ${
                          isSaved ? 'text-[#408A71] fill-[#408A71]' : 'text-[#408A71] fill-none'
                        }`}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                      <span>{isSaved ? 'Saved to Bookmarks' : 'Save Property'}</span>
                    </button>
                  </>
                )}
              </div>

              {/* "LISTED BY" Divider */}
              <div className="relative pt-1">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2.5 text-[#9CA3AF] font-bold tracking-wider text-[10px]">
                    LISTED BY
                  </span>
                </div>
              </div>

              {/* Owner Profile Card (Actual API Data Only) */}
              <div className="flex items-center gap-3 pt-0.5">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#ECF5F2] text-[#408A71] font-bold text-sm flex items-center justify-center shrink-0 border border-gray-100">
                  {ownerAvatar ? (
                    <img src={getMediaUrl(ownerAvatar)} alt={ownerName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{ownerName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-[#111827]">
                    {ownerName}
                  </div>
                  <div className="text-xs text-[#6B7280]">{ownerRole}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Content Below Top Section: Description, More Details, Amenities */}
        <div className="space-y-10 border-t border-gray-100 pt-10">
          {/* Property Description */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#111827]">Property Description</h2>
            {actualDescription ? (
              <div className="text-sm sm:text-base text-[#4B5563] leading-relaxed whitespace-pre-line max-w-4xl">
                {actualDescription}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No description provided for this property.</p>
            )}
          </section>

          {/* More Details Section (Strictly actual data) */}
          {(listing.published_at || listing.created_at || prop?.parking_details || prop?.category) && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#111827]">More Details</h2>
              <div className="bg-[#FAFCFB] rounded-2xl border border-gray-100 p-5 sm:p-6 max-w-4xl">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-[#6B7280] font-medium">Listing Date</div>
                    <div className="text-sm font-bold text-[#111827] mt-1">
                      {formatDate(listing.published_at || listing.created_at)}
                    </div>
                  </div>
                  {prop?.parking_details && (
                    <div>
                      <div className="text-xs text-[#6B7280] font-medium">Parking Details</div>
                      <div className="text-sm font-bold text-[#111827] mt-1">
                        {prop.parking_details}
                      </div>
                    </div>
                  )}
                  {prop?.category && (
                    <div>
                      <div className="text-xs text-[#6B7280] font-medium">Category</div>
                      <div className="text-sm font-bold text-[#111827] mt-1 capitalize">
                        {prop.category}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Amenities & Features Section (Strictly actual data) */}
          {prop?.amenities && prop.amenities.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-[#111827]">Amenities & Features</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-4xl">
                {prop.amenities.map((amenity) => (
                  <div
                    key={amenity.id}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-200/80 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#ECF5F2] text-[#408A71] flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-[#111827] truncate">{amenity.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* 4. Photo Lightbox / Modal */}
      {lightboxOpen && galleryPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in-0 duration-200"
          role="dialog"
          aria-modal="true"
        >
          {/* Lightbox Header */}
          <div className="flex items-center justify-between text-white z-10">
            <div className="text-sm sm:text-base font-semibold">
              Photo {activePhotoIndex + 1} of {galleryPhotos.length}
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Close photo viewer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Active Image with Prev / Next Controls */}
          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setActivePhotoIndex((prev) => (prev - 1 + galleryPhotos.length) % galleryPhotos.length)
              }
              className="absolute left-2 sm:left-6 p-3 rounded-full bg-black/50 hover:bg-black/75 text-white transition-colors cursor-pointer z-10"
              aria-label="Previous photo"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <img
              src={getMediaUrl(galleryPhotos[activePhotoIndex])}
              alt={`Photo ${activePhotoIndex + 1}`}
              className="max-h-[75vh] max-w-full object-contain rounded-xl select-none"
            />

            <button
              type="button"
              onClick={() => setActivePhotoIndex((prev) => (prev + 1) % galleryPhotos.length)}
              className="absolute right-2 sm:right-6 p-3 rounded-full bg-black/50 hover:bg-black/75 text-white transition-colors cursor-pointer z-10"
              aria-label="Next photo"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Bottom Thumbnails Strip */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
            {galleryPhotos.map((photo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActivePhotoIndex(idx)}
                className={`relative h-14 w-20 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${idx === activePhotoIndex ? 'border-[#408A71] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
              >
                <img src={getMediaUrl(photo)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {!isTenantWorkspace && <LandingFooter isAuthenticated={isAuthenticated} />}
    </div>
  )
}

export default PublicPropertyDetailPage
