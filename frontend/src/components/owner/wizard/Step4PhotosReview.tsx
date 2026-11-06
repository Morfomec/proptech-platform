import React, { useState } from 'react'
import type { AmenityItem } from '../../../types/property'
import { Input } from '../../ui/input'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import type { Step1FormData } from './Step1BasicInfo'
import type { Step2FormData } from './Step2Location'
import type { Step3FormData } from './Step3Details'

export interface ImageEntry {
  image_url: string
  caption: string
  is_primary: boolean
}

export interface Step4Props {
  step1: Step1FormData
  step2: Step2FormData
  step3: Step3FormData
  images: ImageEntry[]
  amenitiesCatalogue: AmenityItem[]
  onImagesChange: (images: ImageEntry[]) => void
  onEditStep: (stepNumber: number) => void
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

export const Step4PhotosReview: React.FC<Step4Props> = ({
  step1,
  step2,
  step3,
  images,
  amenitiesCatalogue,
  onImagesChange,
  onEditStep,
}) => {
  const [newUrl, setNewUrl] = useState('')
  const [newCaption, setNewCaption] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

  const handleAddImage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanUrl = newUrl.trim()

    if (!cleanUrl) {
      setUrlError('Please enter an image URL.')
      return
    }

    if (!/^https?:\/\/.+/i.test(cleanUrl)) {
      setUrlError('URL must start with http:// or https://')
      return
    }

    setUrlError(null)

    const isFirstImage = images.length === 0
    const newEntry: ImageEntry = {
      image_url: cleanUrl,
      caption: newCaption.trim(),
      is_primary: isFirstImage,
    }

    onImagesChange([...images, newEntry])
    setNewUrl('')
    setNewCaption('')
  }

  const handleRemoveImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove)
    // If the removed image was primary, designate the first remaining image as primary
    if (images[indexToRemove]?.is_primary && updated.length > 0) {
      updated[0].is_primary = true
    }
    onImagesChange(updated)
  }

  const handleSetPrimary = (indexToPrimary: number) => {
    const updated = images.map((img, idx) => ({
      ...img,
      is_primary: idx === indexToPrimary,
    }))
    onImagesChange(updated)
  }

  // Selected amenity objects
  const selectedAmenities = amenitiesCatalogue.filter((a) =>
    step3.amenity_ids.includes(a.id)
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Photos & Review</h2>
        <p className="text-xs text-[#6B7280] mt-0.5">
          Add photo links for your unit, set the primary thumbnail, and review your property details before saving.
        </p>
      </div>

      {/* 1. Photos Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
            Property Image Gallery
          </h3>
          <span className="text-xs text-[#6B7280]">
            {images.length} {images.length === 1 ? 'image' : 'images'} added
          </span>
        </div>

        {/* Image URL Input Form */}
        <div className="rounded-xl border border-[#E5E7EB] bg-gray-50/60 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Image URL"
                placeholder="https://images.example.com/property-exterior.jpg"
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value)
                  if (urlError) setUrlError(null)
                }}
                error={urlError || undefined}
                hint="Direct link to hosted JPG, PNG, or WebP photo."
              />
            </div>
            <div>
              <Input
                label="Caption (Optional)"
                placeholder="e.g. Front facade view"
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddImage}
              leftIcon={
                <svg
                  className="w-3.5 h-3.5 text-[#408A71]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Add Photo to Gallery
            </Button>
          </div>
        </div>

        {/* Image Grid / Thumbnails */}
        {images.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-xs text-[#6B7280]">
            No photos added yet. You can add image links above or save the draft and add photos later.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((img, idx) => (
              <div
                key={idx}
                className={`relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white transition-all ${
                  img.is_primary ? 'border-[#408A71] ring-2 ring-[#408A71]/20' : 'border-[#E5E7EB]'
                }`}
              >
                {/* Image Preview */}
                <div className="relative aspect-16/10 w-full overflow-hidden bg-gray-100">
                  <img
                    src={img.image_url}
                    alt={img.caption || `Property photo ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      // Fallback broken image placeholder
                      e.currentTarget.src =
                        'https://placehold.co/600x400/f3f4f6/9ca3af?text=Invalid+Image+URL'
                    }}
                  />
                  {img.is_primary && (
                    <div className="absolute top-2 left-2">
                      <Badge variant="success" size="sm" dot>
                        Primary Photo
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Caption & Controls */}
                <div className="p-3 flex items-center justify-between gap-2 border-t border-[#F3F4F6]">
                  <span className="text-xs text-[#4B5563] truncate">
                    {img.caption || `Photo ${idx + 1}`}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    {!img.is_primary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(idx)}
                        className="text-[11px] font-semibold text-[#408A71] hover:underline cursor-pointer"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="text-xs text-red-500 hover:text-red-700 p-1 cursor-pointer"
                      title="Remove image"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Review Summary Cards */}
      <div className="space-y-4 pt-4 border-t border-[#E5E7EB]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
          Review Property Summary
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Basic Info Summary */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827]">Basic Information</span>
              <button
                type="button"
                onClick={() => onEditStep(1)}
                className="text-xs text-[#408A71] font-semibold hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>
            <div className="text-xs space-y-1 text-[#4B5563]">
              <div>
                <strong className="text-[#111827]">Title:</strong> {step1.title || 'Untitled'}
              </div>
              <div>
                <strong className="text-[#111827]">Classification:</strong> {step1.category} &bull;{' '}
                {PROPERTY_TYPE_LABELS[step1.property_type] || step1.property_type.replace(/_/g, ' ')}
              </div>
              {step1.description && (
                <div className="line-clamp-2 text-gray-500 mt-1">
                  <strong className="text-[#111827]">Description:</strong> {step1.description}
                </div>
              )}
            </div>
          </div>

          {/* Location Summary */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827]">Location Details</span>
              <button
                type="button"
                onClick={() => onEditStep(2)}
                className="text-xs text-[#408A71] font-semibold hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>
            <div className="text-xs space-y-1 text-[#4B5563]">
              <div>
                <strong className="text-[#111827]">Address:</strong> {step2.address_line_1}
                {step2.address_line_2 && `, ${step2.address_line_2}`}
              </div>
              <div>
                <strong className="text-[#111827]">Area:</strong> {step2.locality}, {step2.city}
              </div>
              <div>
                <strong className="text-[#111827]">Region:</strong> {step2.district}, {step2.state} -{' '}
                {step2.pin_code} ({step2.country_code})
              </div>
              {step2.latitude && step2.longitude && (
                <div className="text-[11px] text-gray-400">
                  GPS: {step2.latitude}, {step2.longitude}
                </div>
              )}
            </div>
          </div>

          {/* Specifications Summary */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827]">Specifications</span>
              <button
                type="button"
                onClick={() => onEditStep(3)}
                className="text-xs text-[#408A71] font-semibold hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>
            <div className="text-xs space-y-1 text-[#4B5563]">
              <div>
                <strong className="text-[#111827]">Built-up Area:</strong>{' '}
                {step3.built_up_area ? `${step3.built_up_area} sq ft` : 'Not specified'}
              </div>
              {step1.category === 'residential' && (
                <div>
                  <strong className="text-[#111827]">Rooms:</strong>{' '}
                  {step3.bedrooms ? `${step3.bedrooms} BHK` : 'N/A'},{' '}
                  {step3.bathrooms ? `${step3.bathrooms} Baths` : 'N/A'}
                </div>
              )}
              <div className="capitalize">
                <strong className="text-[#111827]">Furnishing:</strong>{' '}
                {step3.furnishing_status.replace('_', ' ')}
              </div>
              <div>
                <strong className="text-[#111827]">Parking:</strong>{' '}
                {step3.parking_spaces ? `${step3.parking_spaces} slot(s)` : 'None'}
                {step3.parking_details ? ` (${step3.parking_details})` : ''}
              </div>
            </div>
          </div>

          {/* Amenities Summary */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827]">Selected Amenities</span>
              <button
                type="button"
                onClick={() => onEditStep(3)}
                className="text-xs text-[#408A71] font-semibold hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>
            {selectedAmenities.length === 0 ? (
              <p className="text-xs text-gray-400">No amenities selected.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedAmenities.map((amenity) => (
                  <span
                    key={amenity.id}
                    className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
                  >
                    {amenity.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Step4PhotosReview

