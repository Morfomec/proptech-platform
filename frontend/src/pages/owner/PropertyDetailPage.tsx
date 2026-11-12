import React, { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { propertyService } from '../../services/property.service'
import { listingService } from '../../services/listing.service'
import documentService from '../../services/document.service'
import type { PropertyImageItem, PropertyStatus } from '../../types/property'
import type { PublicListingItem } from '../../types/listing'
import { OWNER_PROPERTIES_QUERY_KEY } from '../../hooks/useOwnerProperties'
import { useOwnerListings, OWNER_LISTINGS_QUERY_KEY } from '../../hooks/useOwnerListings'
import { useToast } from '../../components/ui/toast'
import { extractApiErrorMessage } from '../../utils/application'
import { RentalManagementCard } from '../../components/owner/RentalManagementCard'
import { Button } from '../../components/ui/button'
import { Badge, type BadgeVariant } from '../../components/ui/badge'
import { Alert } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog'
import { Dropdown, type DropdownMenuItem } from '../../components/ui/dropdown'
import { getMediaUrl } from '../../utils/imageUrl'

const STATUS_CONFIG: Record<PropertyStatus, { variant: BadgeVariant; label: string }> = {
  draft: { variant: 'neutral', label: 'Draft' },
  available: { variant: 'success', label: 'Available' },
  occupied: { variant: 'info', label: 'Occupied' },
  maintenance: { variant: 'warning', label: 'Maintenance' },
  inactive: { variant: 'danger', label: 'Inactive' },
}

const LISTING_STATUS_CONFIG: Record<
  PublicListingItem['status'],
  { variant: BadgeVariant; label: string }
> = {
  published: { variant: 'success', label: 'Published' },
  draft: { variant: 'neutral', label: 'Draft' },
  paused: { variant: 'warning', label: 'Paused' },
  closed: { variant: 'neutral', label: 'Closed' },
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  independent_house: 'Independent House',
  villa: 'Villa',
  apartment: 'Apartment',
  studio_apartment: 'Studio Apartment',
  office: 'Office',
  shop: 'Shop',
  showroom: 'Showroom',
  warehouse: 'Warehouse',
  other: 'Other',
}

const FURNISHING_LABELS: Record<string, string> = {
  unfurnished: 'Unfurnished',
  semi_furnished: 'Semi-Furnished',
  fully_furnished: 'Fully Furnished',
}

function hasValidCoordinates(lat?: string | null, lng?: string | null): boolean {
  if (!lat || !lng) return false
  const parsedLat = Number(lat)
  const parsedLng = Number(lng)
  return (
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180
  )
}

export const PropertyDetailPage: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useToast()

  // Active viewing image state
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  // Delete Property Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Controlled Property Status Transition State
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [pendingPropertyStatus, setPendingPropertyStatus] = useState<'maintenance' | 'inactive' | null>(null)

  // Listing Lifecycle State
  const [isListingActionLoading, setIsListingActionLoading] = useState(false)
  const [listingError, setListingError] = useState<string | null>(null)
  const [listingConfirmAction, setListingConfirmAction] = useState<'pause' | 'close' | null>(null)

  // Fetch Property Details
  const {
    data: property,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getProperty(propertyId!),
    enabled: Boolean(propertyId),
  })

  // Fetch Owner Listings (reusing shared cached query) to locate this property's listing
  const { data: ownerListingsData, isLoading: isLoadingListings } = useOwnerListings({
    page: 1,
    page_size: 100,
  })

  // Fetch genuine document count for this property using supported property_id filter
  const { data: propertyDocumentCount } = useQuery({
    queryKey: ['property-document-count', propertyId],
    queryFn: () =>
      documentService.getDocuments({
        property_id: propertyId!,
        page: 1,
        page_size: 1,
      }),
    select: (res) => res.count,
    enabled: Boolean(propertyId),
    staleTime: 30_000,
  })

  const propertyListing = useMemo<PublicListingItem | null>(() => {
    const listings = ownerListingsData?.results ?? []
    if (!propertyId || listings.length === 0) return null
    const matching = listings.filter(
      (item) => item.property_id === propertyId || item.property?.id === propertyId
    )
    if (matching.length === 0) return null
    return matching.find((item) => item.status !== 'closed') ?? matching[0]
  }, [ownerListingsData, propertyId])

  // Handle Delete Property
  const handleDeleteProperty = async () => {
    if (!propertyId || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      await propertyService.deleteProperty(propertyId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] }),
      ])
      navigate('/app/owner/properties', { replace: true })
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setDeleteError(err.response.data.message || 'Failed to delete property.')
      } else {
        setDeleteError('An unexpected error occurred while deleting the property.')
      }
      setIsDeleting(false)
    }
  }

  // Handle Controlled Property Status Transition (validated by backend service layer)
  const handleStatusTransition = async (targetStatus: PropertyStatus) => {
    if (!propertyId || isUpdatingStatus) return
    setIsUpdatingStatus(true)
    setStatusError(null)

    try {
      await propertyService.updateProperty(propertyId, { status: targetStatus })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['property', propertyId] }),
        queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] }),
      ])
      setPendingPropertyStatus(null)
      addToast({
        title: 'Property Status Updated',
        description: `Property is now marked as ${STATUS_CONFIG[targetStatus]?.label ?? targetStatus}.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      setStatusError(extractApiErrorMessage(err, 'Failed to update property status.'))
      setPendingPropertyStatus(null)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleRequestPropertyStatus = (targetStatus: PropertyStatus) => {
    if (targetStatus === 'maintenance' || targetStatus === 'inactive') {
      setPendingPropertyStatus(targetStatus)
      return
    }
    void handleStatusTransition(targetStatus)
  }

  // Handle Listing Lifecycle Actions (reusing listingService)
  const handlePublishOrResumeListing = async () => {
    if (!propertyListing || isListingActionLoading) return
    setIsListingActionLoading(true)
    setListingError(null)

    const wasPaused = propertyListing.status === 'paused'

    try {
      await listingService.publishListing(propertyListing.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: ['property', propertyId] }),
      ])
      addToast({
        title: wasPaused ? 'Listing Resumed' : 'Listing Published',
        description: wasPaused
          ? 'Your listing is active and visible on the public marketplace.'
          : 'Your listing is now live on the public marketplace.',
        variant: 'success',
      })
    } catch (err: unknown) {
      setListingError(extractApiErrorMessage(err, 'Failed to publish listing.'))
    } finally {
      setIsListingActionLoading(false)
    }
  }

  const handleConfirmListingAction = async () => {
    if (!propertyListing || !listingConfirmAction || isListingActionLoading) return
    setIsListingActionLoading(true)
    setListingError(null)

    try {
      if (listingConfirmAction === 'pause') {
        await listingService.pauseListing(propertyListing.id)
        addToast({
          title: 'Listing Paused',
          description: 'The listing has been temporarily removed from public view.',
          variant: 'success',
        })
      } else {
        await listingService.closeListing(propertyListing.id)
        addToast({
          title: 'Listing Closed',
          description: 'The listing has been closed.',
          variant: 'success',
        })
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [OWNER_LISTINGS_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: ['property', propertyId] }),
      ])
      setListingConfirmAction(null)
    } catch (err: unknown) {
      setListingError(
        extractApiErrorMessage(
          err,
          listingConfirmAction === 'pause' ? 'Failed to pause listing.' : 'Failed to close listing.'
        )
      )
      setListingConfirmAction(null)
    } finally {
      setIsListingActionLoading(false)
    }
  }

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
          <div className="space-y-2">
            <Skeleton shape="rectangular" width={160} height={16} className="rounded" />
            <Skeleton shape="rectangular" width={260} height={28} className="rounded-lg" />
            <Skeleton shape="rectangular" width={180} height={16} className="rounded" />
          </div>
          <div className="flex gap-2.5">
            <Skeleton shape="rectangular" width={120} height={38} className="rounded-lg" />
            <Skeleton shape="rectangular" width={40} height={38} className="rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton shape="rectangular" height={340} className="rounded-xl" />
            <Skeleton shape="rectangular" height={180} className="rounded-xl" />
          </div>
          <div className="space-y-5">
            <Skeleton shape="rectangular" height={160} className="rounded-xl" />
            <Skeleton shape="rectangular" height={200} className="rounded-xl" />
            <Skeleton shape="rectangular" height={140} className="rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  // 2. Error State
  if (isError || !property) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-6">
        <Alert variant="error" title="Failed to load property details">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>
              {error instanceof Error
                ? error.message
                : 'Unable to connect to property services or property does not exist.'}
            </span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
        <div className="text-center">
          <Link
            to="/app/owner/properties"
            className="text-sm font-medium text-[#408A71] hover:underline"
          >
            &larr; Back to My Properties
          </Link>
        </div>
      </div>
    )
  }

  const statusBadge = STATUS_CONFIG[property.status] || {
    variant: 'neutral' as BadgeVariant,
    label: property.status,
  }
  const listingBadge = propertyListing
    ? LISTING_STATUS_CONFIG[propertyListing.status]
    : null

  const typeLabel = PROPERTY_TYPE_LABELS[property.property_type] || property.property_type
  const categoryLabel = property.category === 'residential' ? 'Residential' : 'Commercial'
  const furnishingLabel = property.furnishing_status
    ? FURNISHING_LABELS[property.furnishing_status] || property.furnishing_status
    : 'Not specified'

  const images: PropertyImageItem[] = property.images || []
  const activeImage = images[activeImageIndex] || images[0]
  const hasDescription = Boolean(property.description && property.description.trim())
  const coordinatesAvailable = hasValidCoordinates(property.latitude, property.longitude)

  const headerMoreMenuItems: DropdownMenuItem[] = [
    {
      id: 'delete-property',
      label: 'Delete Property',
      danger: true,
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
          />
        </svg>
      ),
      onClick: () => setIsDeleteDialogOpen(true),
    },
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Compact Workspace Header */}
      <header className="border-b border-[#E5E7EB] pb-4 space-y-2.5">
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link to="/app/owner/properties" className="hover:text-[#111827] transition-colors">
            My Properties
          </Link>
          <span>/</span>
          <span className="text-[#111827] font-medium truncate max-w-xs">{property.title}</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0 truncate">
                {property.title}
              </h1>
              <Badge variant={statusBadge.variant} size="sm" dot>
                {statusBadge.label}
              </Badge>
              {listingBadge && (
                <Badge variant={listingBadge.variant} size="sm">
                  Listing: {listingBadge.label}
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#6B7280]">
              {[property.locality, property.city].filter(Boolean).join(', ')}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/app/owner/properties/${property.id}/edit`}
              state={{ returnTo: `/app/owner/properties/${property.id}` }}
            >
              <Button variant="primary" size="sm">
                Edit Property
              </Button>
            </Link>

            <Dropdown
              placement="bottom-right"
              width="w-48"
              items={headerMoreMenuItems}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="More property actions"
                >
                  <svg
                    className="w-4 h-4 text-[#4B5563]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                    />
                  </svg>
                </Button>
              }
            />
          </div>
        </div>
      </header>

      {/* Balanced Two-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Gallery */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-[#111827]">Property Gallery</h2>
              {images.length > 0 && (
                <span className="text-xs text-[#6B7280]">
                  Photo {activeImageIndex + 1} of {images.length}
                </span>
              )}
            </div>

            {images.length > 0 && activeImage ? (
              <div className="space-y-3">
                <div className="relative aspect-[16/10] max-h-[380px] w-full overflow-hidden rounded-lg bg-[#F3F4F6] flex items-center justify-center">
                  <img
                    src={getMediaUrl(activeImage.image_url)}
                    alt={activeImage.caption || property.title}
                    className="h-full w-full object-cover object-center"
                  />
                  {activeImage.is_primary && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-[#15803D] border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#408A71]" />
                      Primary
                    </span>
                  )}
                </div>

                {/* Compact Horizontal Thumbnail Strip */}
                {images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border transition-all cursor-pointer ${idx === activeImageIndex
                            ? 'border-[#408A71] ring-2 ring-[#408A71]/25 opacity-100'
                            : 'border-[#E5E7EB] opacity-70 hover:opacity-100'
                          }`}
                      >
                        <img
                          src={getMediaUrl(img.image_url)}
                          alt={img.caption || `Photo ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                        {img.is_primary && (
                          <span className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-[#408A71]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-[#D1D5DB] rounded-lg text-center space-y-2.5 bg-[#F9FAFB]">
                <p className="text-sm font-medium text-[#111827]">No photos added yet</p>
                <p className="text-xs text-[#6B7280] max-w-sm">
                  At least one property photo is required before a rental listing can be published.
                </p>
                <Link
                  to={`/app/owner/properties/${property.id}/edit`}
                  state={{ returnTo: `/app/owner/properties/${property.id}` }}
                >
                  <Button variant="primary" size="sm">
                    Add Photos in Edit Property
                  </Button>
                </Link>
              </div>
            )}
          </section>

          {/* Property Overview */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-medium text-[#111827]">Property Overview</h2>
              <span className="text-xs text-[#6B7280]">
                {categoryLabel} &bull; {typeLabel}
              </span>
            </div>

            {/* Compact Horizontal Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2.5">
                <span className="text-xs text-[#6B7280] block">Area</span>
                <span className="text-sm font-medium text-[#111827] mt-0.5 block">
                  {property.built_up_area ? `${property.built_up_area} sq ft` : '—'}
                </span>
              </div>

              {property.category === 'residential' && (
                <>
                  <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2.5">
                    <span className="text-xs text-[#6B7280] block">Bedrooms</span>
                    <span className="text-sm font-medium text-[#111827] mt-0.5 block">
                      {property.bedrooms != null ? `${property.bedrooms} BHK` : '—'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2.5">
                    <span className="text-xs text-[#6B7280] block">Bathrooms</span>
                    <span className="text-sm font-medium text-[#111827] mt-0.5 block">
                      {property.bathrooms != null ? property.bathrooms : '—'}
                    </span>
                  </div>
                </>
              )}

              <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2.5">
                <span className="text-xs text-[#6B7280] block">Furnishing</span>
                <span className="text-sm font-medium text-[#111827] mt-0.5 block truncate">
                  {furnishingLabel}
                </span>
              </div>

              <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-2.5">
                <span className="text-xs text-[#6B7280] block">Parking</span>
                <span className="text-sm font-medium text-[#111827] mt-0.5 block">
                  {property.parking_spaces > 0 ? `${property.parking_spaces} slots` : 'None'}
                </span>
              </div>
            </div>

            {property.parking_details && (
              <p className="text-xs text-[#6B7280]">
                <span className="font-medium text-[#374151]">Parking notes:</span>{' '}
                {property.parking_details}
              </p>
            )}

            {/* Description (only when available) */}
            {hasDescription && (
              <div className="pt-4 border-t border-[#E5E7EB] space-y-1.5">
                <h3 className="text-sm font-medium text-[#111827]">Description</h3>
                <p className="text-sm text-[#4B5563] whitespace-pre-line leading-relaxed">
                  {property.description}
                </p>
              </div>
            )}

            {/* Amenities */}
            {property.amenities.length > 0 && (
              <div className="pt-4 border-t border-[#E5E7EB] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#111827]">Amenities</h3>
                  <span className="text-xs text-[#6B7280]">{property.amenities.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {property.amenities.map((amenity) => (
                    <div
                      key={amenity.id}
                      className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-xs text-[#111827]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#408A71] shrink-0" />
                      <span className="truncate font-medium">{amenity.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Focused Management Sidebar */}
        <aside className="space-y-5">
          {/* Unified Rental Management */}
          <RentalManagementCard
            propertyId={property.id}
            propertyStatus={property.status}
            listing={propertyListing}
            isLoadingListing={isLoadingListings}
            isUpdatingPropertyStatus={isUpdatingStatus}
            isListingActionLoading={isListingActionLoading}
            propertyStatusError={statusError}
            listingError={listingError}
            onRequestPropertyStatus={handleRequestPropertyStatus}
            onPublishOrResumeListing={() => void handlePublishOrResumeListing()}
            onRequestPauseListing={() => setListingConfirmAction('pause')}
            onRequestCloseListing={() => setListingConfirmAction('close')}
          />

          {/* Location */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-2.5">
            <h2 className="text-sm font-medium text-[#111827]">Location</h2>
            <address className="not-italic text-xs text-[#4B5563] space-y-0.5 leading-relaxed">
              <p className="font-medium text-[#111827]">{property.address_line_1}</p>
              {property.address_line_2 && <p>{property.address_line_2}</p>}
              {property.landmark && <p>Near {property.landmark}</p>}
              <p>
                {[property.locality, property.city].filter(Boolean).join(', ')}
              </p>
              <p>
                {[property.district, property.state].filter(Boolean).join(', ')}
                {property.pin_code ? ` - ${property.pin_code}` : ''}
              </p>
            </address>

            {coordinatesAvailable && (
              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(
                  `${property.latitude},${property.longitude}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#408A71] hover:underline pt-1"
              >
                View on Map &rarr;
              </a>
            )}
          </section>

          {/* Related Management Navigation */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-2.5">
            <h2 className="text-sm font-medium text-[#111827]">Related Management</h2>
            <nav className="divide-y divide-[#F3F4F6] text-xs">
              <Link
                to="/app/owner/applications"
                className="flex items-center justify-between py-2 text-[#374151] hover:text-[#408A71] transition-colors"
              >
                <span className="font-medium">Applications</span>
                <span className="text-[#9CA3AF]">&rarr;</span>
              </Link>
              <Link
                to="/app/owner/tenancies"
                className="flex items-center justify-between py-2 text-[#374151] hover:text-[#408A71] transition-colors"
              >
                <span className="font-medium">Tenancies</span>
                <span className="text-[#9CA3AF]">&rarr;</span>
              </Link>
              <Link
                to="/app/owner/documents"
                className="flex items-center justify-between py-2 text-[#374151] hover:text-[#408A71] transition-colors"
              >
                <span className="font-medium">Documents</span>
                <span className="flex items-center gap-2 text-[#6B7280]">
                  {typeof propertyDocumentCount === 'number' && (
                    <span className="tabular-nums">{propertyDocumentCount}</span>
                  )}
                  <span className="text-[#9CA3AF]">&rarr;</span>
                </span>
              </Link>
            </nav>
          </section>
        </aside>
      </div>

      {/* Delete Property Confirmation Dialog */}
      <ConfirmationDialog
        open={isDeleteDialogOpen}
        onClose={() => {
          if (!isDeleting) setIsDeleteDialogOpen(false)
        }}
        onConfirm={handleDeleteProperty}
        title="Delete Property"
        description="Are you sure you want to delete this property? This action will permanently remove the property record, its attached images, and amenity associations according to the platform policy. This action cannot be reversed."
        confirmText={isDeleting ? 'Deleting...' : 'Delete Property'}
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      >
        {deleteError && (
          <div className="mt-3">
            <Alert variant="error" title="Delete Failed">
              {deleteError}
            </Alert>
          </div>
        )}
      </ConfirmationDialog>

      {/* Property Maintenance / Inactive Confirmation Dialog */}
      <ConfirmationDialog
        open={pendingPropertyStatus !== null}
        onClose={() => {
          if (!isUpdatingStatus) setPendingPropertyStatus(null)
        }}
        onConfirm={() => {
          if (pendingPropertyStatus) void handleStatusTransition(pendingPropertyStatus)
        }}
        title={
          pendingPropertyStatus === 'maintenance'
            ? 'Mark Property for Maintenance?'
            : 'Mark Property Inactive?'
        }
        description={
          pendingPropertyStatus === 'maintenance'
            ? 'Use maintenance when a property is temporarily unavailable for repairs, renovation, or preparation. Any active published listing will be paused automatically until you mark the property available and explicitly resume it.'
            : 'Marking this property inactive will hide it from the marketplace and automatically pause any active published listing until you mark the property available again.'
        }
        confirmText={
          isUpdatingStatus
            ? 'Updating...'
            : pendingPropertyStatus === 'maintenance'
              ? 'Mark for Maintenance'
              : 'Mark Inactive'
        }
        cancelText="Cancel"
        variant="warning"
        loading={isUpdatingStatus}
      />

      {/* Pause / Close Listing Confirmation Dialog */}
      <ConfirmationDialog
        open={listingConfirmAction !== null}
        onClose={() => {
          if (!isListingActionLoading) setListingConfirmAction(null)
        }}
        onConfirm={handleConfirmListingAction}
        title={listingConfirmAction === 'pause' ? 'Pause Listing?' : 'Close Listing?'}
        description={
          listingConfirmAction === 'pause'
            ? 'Pausing this listing will temporarily hide it from the public marketplace. Prospective tenants will not be able to view or apply until you resume it.'
            : 'Closing this listing will permanently end active tenant marketing for this property. To re-list in the future, you will need to create a new listing.'
        }
        confirmText={
          isListingActionLoading
            ? 'Updating...'
            : listingConfirmAction === 'pause'
              ? 'Pause Listing'
              : 'Close Listing'
        }
        cancelText="Cancel"
        variant="warning"
        loading={isListingActionLoading}
      />
    </div>
  )
}

export default PropertyDetailPage
