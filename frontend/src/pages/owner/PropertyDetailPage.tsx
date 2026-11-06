import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { propertyService } from '../../services/property.service'
import type { PropertyImageItem, PropertyStatus } from '../../types/property'
import { OWNER_PROPERTIES_QUERY_KEY } from '../../hooks/useOwnerProperties'
import { Button } from '../../components/ui/button'
import { Badge, type BadgeVariant } from '../../components/ui/badge'
import { Alert } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'
import { Modal } from '../../components/ui/modal'
import { Input } from '../../components/ui/input'
import { Checkbox } from '../../components/ui/checkbox'
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog'

const STATUS_CONFIG: Record<PropertyStatus, { variant: BadgeVariant; label: string }> = {
  draft: { variant: 'neutral', label: 'Draft' },
  available: { variant: 'success', label: 'Available' },
  occupied: { variant: 'info', label: 'Occupied' },
  maintenance: { variant: 'warning', label: 'Maintenance' },
  inactive: { variant: 'danger', label: 'Inactive' },
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

function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A'
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

export const PropertyDetailPage: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Active viewing image state
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  // Delete Property Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Add Image Modal State
  const [isAddImageOpen, setIsAddImageOpen] = useState(false)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newImageCaption, setNewImageCaption] = useState('')
  const [newImageIsPrimary, setNewImageIsPrimary] = useState(false)
  const [addImageError, setAddImageError] = useState<string | null>(null)
  const [isAddingImage, setIsAddingImage] = useState(false)

  // Primary/Delete Image Actions State
  const [imageActionError, setImageActionError] = useState<string | null>(null)
  const [actionImageId, setActionImageId] = useState<string | null>(null)

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

  // Handle Delete Property
  const handleDeleteProperty = async () => {
    if (!propertyId || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      await propertyService.deleteProperty(propertyId)
      // Invalidate relevant query caches
      await queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })
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

  // Handle Add Image
  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!propertyId || isAddingImage) return

    const cleanUrl = newImageUrl.trim()
    if (!cleanUrl) {
      setAddImageError('Please enter an image URL.')
      return
    }
    if (!/^https?:\/\/.+/i.test(cleanUrl)) {
      setAddImageError('URL must start with http:// or https://')
      return
    }

    setIsAddingImage(true)
    setAddImageError(null)

    try {
      await propertyService.addPropertyImage(propertyId, {
        image_url: cleanUrl,
        caption: newImageCaption.trim() || undefined,
        is_primary: newImageIsPrimary,
      })
      // Refresh property cache
      await queryClient.invalidateQueries({ queryKey: ['property', propertyId] })
      await queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })

      // Reset modal state
      setNewImageUrl('')
      setNewImageCaption('')
      setNewImageIsPrimary(false)
      setIsAddImageOpen(false)
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setAddImageError(err.response.data.message || 'Failed to attach image.')
      } else {
        setAddImageError('An error occurred while uploading image.')
      }
    } finally {
      setIsAddingImage(false)
    }
  }

  // Handle Set Primary Image
  const handleSetPrimaryImage = async (imageId: string) => {
    if (!propertyId) return
    setActionImageId(imageId)
    setImageActionError(null)

    try {
      await propertyService.setPrimaryImage(propertyId, imageId)
      await queryClient.invalidateQueries({ queryKey: ['property', propertyId] })
      await queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setImageActionError(err.response.data.message || 'Failed to set primary image.')
      } else {
        setImageActionError('Could not set primary image.')
      }
    } finally {
      setActionImageId(null)
    }
  }

  // Handle Delete Image
  const handleDeleteImage = async (imageId: string) => {
    if (!propertyId) return
    setActionImageId(imageId)
    setImageActionError(null)

    try {
      await propertyService.deletePropertyImage(propertyId, imageId)
      await queryClient.invalidateQueries({ queryKey: ['property', propertyId] })
      await queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })
      // Adjust active index if necessary
      setActiveImageIndex(0)
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setImageActionError(err.response.data.message || 'Failed to delete image.')
      } else {
        setImageActionError('Could not delete image.')
      }
    } finally {
      setActionImageId(null)
    }
  }

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Skeleton shape="rectangular" width={100} height={20} className="rounded" />
          <Skeleton shape="rectangular" width={140} height={20} className="rounded" />
        </div>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-2">
            <Skeleton shape="rectangular" width={320} height={36} className="rounded-lg" />
            <Skeleton shape="rectangular" width={220} height={20} className="rounded-lg" />
          </div>
          <div className="flex gap-3">
            <Skeleton shape="rectangular" width={110} height={40} className="rounded-xl" />
            <Skeleton shape="rectangular" width={110} height={40} className="rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton shape="rectangular" height={360} className="rounded-2xl" />
            <Skeleton shape="rectangular" height={180} className="rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton shape="rectangular" height={220} className="rounded-2xl" />
            <Skeleton shape="rectangular" height={220} className="rounded-2xl" />
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
            className="text-sm font-semibold text-[#408A71] hover:underline"
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
  const typeLabel = PROPERTY_TYPE_LABELS[property.property_type] || property.property_type
  const categoryLabel = property.category === 'residential' ? 'Residential' : 'Commercial'
  const furnishingLabel = property.furnishing_status
    ? FURNISHING_LABELS[property.furnishing_status] || property.furnishing_status
    : 'Not Specified'

  const images: PropertyImageItem[] = property.images || []
  const activeImage = images[activeImageIndex] || images[0]

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Breadcrumb & Navigation */}
      <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
        <Link to="/app/owner/properties" className="hover:text-[#111827] transition-colors">
          My Properties
        </Link>
        <span>/</span>
        <span className="text-[#111827] font-medium truncate max-w-xs">{property.title}</span>
      </nav>

      {/* 2. Top Header & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant={statusBadge.variant} size="md" dot>
              {statusBadge.label}
            </Badge>
            <span className="text-xs font-semibold text-[#408A71] bg-[#408A71]/10 px-2.5 py-0.5 rounded-full">
              {categoryLabel} &bull; {typeLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            {property.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-[#9CA3AF] shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
            {[property.locality, property.city, property.state].filter(Boolean).join(', ')} -{' '}
            {property.pin_code}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to={`/app/owner/properties/${property.id}/edit`}>
            <Button
              variant="outline"
              size="md"
              leftIcon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
              }
            >
              Edit Property
            </Button>
          </Link>

          <Button
            variant="danger"
            size="md"
            onClick={() => setIsDeleteDialogOpen(true)}
            leftIcon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            }
          >
            Delete
          </Button>
        </div>
      </div>

      {imageActionError && (
        <Alert variant="error" title="Image Operation Failed">
          {imageActionError}
        </Alert>
      )}

      {/* 3. Main Content Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Center 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* A. Image Gallery Viewer */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#111827]">Photo Gallery</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddImageOpen(true)}
                leftIcon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                }
              >
                Add Photo
              </Button>
            </div>

            {/* Main Image Showcase */}
            {images.length > 0 ? (
              <div className="space-y-3">
                <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl bg-gray-900 flex items-center justify-center">
                  <img
                    src={activeImage.image_url}
                    alt={activeImage.caption || property.title}
                    className="h-full w-full object-contain"
                  />
                  {activeImage.is_primary && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="success" size="sm" dot>
                        Primary Photo
                      </Badge>
                    </div>
                  )}
                  {activeImage.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white text-xs">
                      {activeImage.caption}
                    </div>
                  )}
                </div>

                {/* Active Photo Controls */}
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-[#E5E7EB] text-xs">
                  <span className="text-[#6B7280]">
                    Photo {activeImageIndex + 1} of {images.length}
                  </span>
                  <div className="flex items-center gap-2">
                    {!activeImage.is_primary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionImageId === activeImage.id}
                        onClick={() => void handleSetPrimaryImage(activeImage.id)}
                      >
                        Set as Primary
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={actionImageId === activeImage.id}
                      onClick={() => void handleDeleteImage(activeImage.id)}
                    >
                      Delete Photo
                    </Button>
                  </div>
                </div>

                {/* Thumbnails Row */}
                {images.length > 1 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                          idx === activeImageIndex
                            ? 'border-[#408A71] ring-2 ring-[#408A71]/20'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img.image_url}
                          alt={img.caption || `Thumbnail ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                        {img.is_primary && (
                          <div className="absolute top-1 left-1 h-2 w-2 rounded-full bg-[#408A71]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#E5E7EB] rounded-xl text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <svg
                    className="w-6 h-6"
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
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#111827]">No photos uploaded</h4>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Add images to showcase your property listing to prospective tenants.
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setIsAddImageOpen(true)}>
                  Upload First Photo
                </Button>
              </div>
            )}
          </div>

          {/* B. Physical Specifications Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#111827]">Property Specifications</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-[#6B7280]">Built-Up Area</span>
                <p className="text-sm font-bold text-[#111827] mt-0.5">
                  {property.built_up_area ? `${property.built_up_area} sq ft` : 'Not specified'}
                </p>
              </div>

              {property.category === 'residential' && (
                <>
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs text-[#6B7280]">Bedrooms</span>
                    <p className="text-sm font-bold text-[#111827] mt-0.5">
                      {property.bedrooms != null ? `${property.bedrooms} BHK` : 'N/A'}
                    </p>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs text-[#6B7280]">Bathrooms</span>
                    <p className="text-sm font-bold text-[#111827] mt-0.5">
                      {property.bathrooms != null ? property.bathrooms : 'N/A'}
                    </p>
                  </div>
                </>
              )}

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-[#6B7280]">Furnishing</span>
                <p className="text-sm font-bold text-[#111827] mt-0.5">{furnishingLabel}</p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-[#6B7280]">Parking Spaces</span>
                <p className="text-sm font-bold text-[#111827] mt-0.5">
                  {property.parking_spaces > 0 ? `${property.parking_spaces} slots` : 'None'}
                </p>
              </div>

              {property.parking_details && (
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 col-span-2 sm:col-span-3">
                  <span className="text-xs text-[#6B7280]">Parking Details</span>
                  <p className="text-xs font-medium text-[#111827] mt-0.5">
                    {property.parking_details}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* C. Description Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-[#111827]">Description</h2>
            {property.description ? (
              <p className="text-sm text-[#4B5563] whitespace-pre-line leading-relaxed">
                {property.description}
              </p>
            ) : (
              <p className="text-xs text-[#9CA3AF] italic">No description provided.</p>
            )}
          </div>

          {/* D. Amenities Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#111827]">Amenities</h2>
              <span className="text-xs font-semibold text-[#408A71] bg-[#408A71]/10 px-2.5 py-0.5 rounded-full">
                {property.amenities.length} configured
              </span>
            </div>

            {property.amenities.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {property.amenities.map((amenity) => (
                  <div
                    key={amenity.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-[#E5E7EB] bg-gray-50/50"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#408A71]/10 text-[#408A71] mt-0.5">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111827]">{amenity.name}</div>
                      {amenity.description && (
                        <div className="text-[11px] text-[#6B7280] line-clamp-1 mt-0.5">
                          {amenity.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#9CA3AF] italic">
                No amenities attached to this property.
              </p>
            )}
          </div>
        </div>

        {/* Right Side Column */}
        <div className="space-y-6">
          {/* A. Location & Address Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#111827]">Location Details</h2>
            <div className="text-xs space-y-2 text-[#4B5563]">
              <div>
                <strong className="text-[#111827] block mb-0.5">Street Address:</strong>
                <p>{property.address_line_1}</p>
                {property.address_line_2 && <p>{property.address_line_2}</p>}
                {property.landmark && (
                  <p className="text-gray-500 italic mt-0.5">Landmark: {property.landmark}</p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100">
                <strong className="text-[#111827] block mb-0.5">Locality & City:</strong>
                <p>
                  {property.locality}, {property.city}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <strong className="text-[#111827] block mb-0.5">District & State:</strong>
                <p>
                  {property.district}, {property.state} - {property.pin_code}
                </p>
                <p className="text-[11px] text-[#9CA3AF]">Country: {property.country_code}</p>
              </div>

              {property.latitude && property.longitude && (
                <div className="pt-2 border-t border-gray-100">
                  <strong className="text-[#111827] block mb-0.5">GPS Coordinates:</strong>
                  <p className="font-mono text-[11px] text-[#408A71]">
                    {property.latitude}, {property.longitude}
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#408A71] hover:underline mt-1.5"
                  >
                    Open in Google Maps &rarr;
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* B. Asset Metadata Card */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-base font-bold text-[#111827]">Property History</h2>
            <div className="text-xs space-y-2 text-[#6B7280]">
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span>Created</span>
                <span className="font-medium text-[#111827]">
                  {formatDate(property.created_at)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span>Last Updated</span>
                <span className="font-medium text-[#111827]">
                  {formatDate(property.updated_at)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100">
                <span>Property ID</span>
                <span className="font-mono text-[11px] text-[#111827] truncate max-w-[130px]">
                  {property.id}
                </span>
              </div>
              {property.owner && (
                <div className="pt-2">
                  <span className="block text-[#9CA3AF] text-[11px] mb-0.5">Registered Owner</span>
                  <p className="text-xs font-semibold text-[#111827]">
                    {property.owner.first_name} {property.owner.last_name}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">{property.owner.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* C. Quick Action Shortcuts */}
          <div className="rounded-2xl border border-[#408A71]/20 bg-[#408A71]/5 p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#111827]">Quick Actions</h3>
            <p className="text-xs text-[#6B7280]">
              Need to modify listing terms or update specifications?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Link to={`/app/owner/properties/${property.id}/edit`}>
                <Button variant="primary" size="sm" className="w-full">
                  Edit Property Specifications
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsAddImageOpen(true)}
              >
                Add Photo to Gallery
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Delete Property Confirmation Dialog */}
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

      {/* 5. Add Image Modal */}
      <Modal
        open={isAddImageOpen}
        onClose={() => {
          if (!isAddingImage) {
            setIsAddImageOpen(false)
            setAddImageError(null)
          }
        }}
        title="Add Photo to Gallery"
        description="Provide a direct URL to an image asset for this property."
        size="md"
      >
        <form onSubmit={handleAddImage} className="space-y-4 py-2">
          {addImageError && (
            <Alert variant="error" title="Validation Error">
              {addImageError}
            </Alert>
          )}

          <Input
            label="Image URL"
            placeholder="https://images.unsplash.com/photo-..."
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            hint="Direct HTTPS link to photo asset."
            required
          />

          <Input
            label="Caption (Optional)"
            placeholder="e.g. Master Bedroom, Living Room Balcony"
            value={newImageCaption}
            onChange={(e) => setNewImageCaption(e.target.value)}
          />

          <div className="pt-1">
            <Checkbox
              label="Designate as Primary Photo"
              description="Make this image the main display thumbnail for the property."
              checked={newImageIsPrimary}
              onChange={(e) => setNewImageIsPrimary(e.target.checked)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsAddImageOpen(false)}
              disabled={isAddingImage}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isAddingImage}>
              Upload Photo
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PropertyDetailPage
