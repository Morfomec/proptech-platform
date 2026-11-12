import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../ui/badge'
import { getMediaUrl } from '../../utils/imageUrl'
import type { PublicListingProperty } from '../../types/listing'

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

function formatRentPrice(amount?: string | number | null): string | null {
  if (amount === undefined || amount === null || amount === '') return null
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (Number.isNaN(num)) return String(amount)
  return `₹${num.toLocaleString('en-IN')}`
}

export interface PropertyListingCardProps {
  title: string
  detailTo: string
  detailState?: Record<string, unknown>
  property?: Partial<PublicListingProperty> | null
  monthlyRent?: string | number | null
  isOwned?: boolean
  isUnavailable?: boolean
  isSaved?: boolean
  saveButtonLabel?: string
  onToggleSave?: (e: React.MouseEvent<HTMLButtonElement>) => void
  showParking?: boolean
  topLeftBadge?: React.ReactNode
  topRightBadge?: React.ReactNode
  footerSlot?: React.ReactNode
  allowOverflow?: boolean
}

/**
 * Shared property listing card used across Homepage Featured Rentals,
 * Public Browse Properties, Tenant Workspace Browse Properties, Saved Properties,
 * and Owner My Properties.
 */
export const PropertyListingCard: React.FC<PropertyListingCardProps> = ({
  title,
  detailTo,
  detailState,
  property,
  monthlyRent,
  isOwned = false,
  isUnavailable = false,
  isSaved = false,
  saveButtonLabel,
  onToggleSave,
  showParking = false,
  topLeftBadge,
  topRightBadge,
  footerSlot,
  allowOverflow = false,
}) => {
  const [hasImageError, setHasImageError] = useState(false)

  const resolvedImageUrl =
    !hasImageError && property?.primary_image_url
      ? getMediaUrl(property.primary_image_url)
      : null

  const formattedRent = formatRentPrice(monthlyRent)
  const isCommercial = property?.category === 'commercial' || !property?.bedrooms

  const typeBadgeLabel =
    (property?.property_type && PROPERTY_TYPE_LABELS[property.property_type]) ||
    property?.property_type ||
    (isCommercial ? 'Commercial' : null)

  const furnishingBadgeLabel = property?.furnishing_status
    ? FURNISHING_LABELS[property.furnishing_status]
    : null

  // Primary 3-column specifications matching reference layout
  const firstSpecValue = isCommercial
    ? typeBadgeLabel || 'Commercial'
    : property?.bedrooms
      ? `${property.bedrooms} BHK`
      : '—'
  const firstSpecLabel = isCommercial ? 'Property' : 'Bedrooms'

  const bathsNumeric =
    property?.bathrooms !== undefined && property?.bathrooms !== null
      ? parseFloat(String(property.bathrooms))
      : null
  const bathsText =
    bathsNumeric !== null && !Number.isNaN(bathsNumeric)
      ? `${property?.bathrooms} ${bathsNumeric === 1 ? 'Bath' : 'Baths'}`
      : null

  const secondSpecValue = bathsText
    ? bathsText
    : (showParking || isCommercial) && property?.parking_spaces
      ? `${property.parking_spaces} ${property.parking_spaces === 1 ? 'Slot' : 'Slots'}`
      : '—'
  const secondSpecLabel =
    !bathsText && (showParking || isCommercial) && property?.parking_spaces
      ? 'Parking'
      : 'Bathrooms'

  const areaText = property?.built_up_area
    ? `${
        typeof property.built_up_area === 'number'
          ? property.built_up_area.toLocaleString('en-IN')
          : property.built_up_area
      } sq ft`
    : '—'

  const locationText =
    [property?.locality, property?.city, property?.state].filter(Boolean).join(', ') ||
    property?.address_line_1 ||
    'Location available on request'

  const heartAriaLabel =
    saveButtonLabel || (isSaved ? 'Remove from saved properties' : 'Save this property')

  return (
    <article
      className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-xs hover:-translate-y-0.5 hover:shadow-md hover:border-[#408A71]/40 transition-all duration-200 flex flex-col group relative ${
        allowOverflow ? '' : 'overflow-hidden'
      }`}
    >
      {/* Large Architectural Property Photo (4:3 ratio) */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-gray-100">
        <Link to={detailTo} state={detailState} className="block w-full h-full">
          {resolvedImageUrl ? (
            <img
              src={resolvedImageUrl}
              alt={title}
              loading="lazy"
              onError={() => setHasImageError(true)}
              className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#F4FAF7] to-[#EBF3EF] text-[#408A71]/70 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/90 shadow-2xs mb-2 text-[#408A71]">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#408A71]">No photo uploaded</span>
            </div>
          )}
        </Link>

        {/* Top-Left Ownership & Availability Badges (or custom slot) */}
        {topLeftBadge !== undefined ? (
          topLeftBadge && (
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 pointer-events-none">
              {topLeftBadge}
            </div>
          )
        ) : (
          (isOwned || isUnavailable) && (
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 pointer-events-none">
              {isOwned && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECF5F2]/95 px-2.5 py-1 text-xs font-medium text-[#1A4D38] border border-[#CBE7DC] shadow-xs backdrop-blur-xs">
                  <svg
                    className="w-3.5 h-3.5 text-[#408A71] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 10.5L12 3l9 7.5M5 10v10h14V10"
                    />
                  </svg>
                  <span>Your Property</span>
                </span>
              )}
              {isUnavailable && (
                <Badge variant="warning" size="sm" className="shadow-xs">
                  Currently Unavailable
                </Badge>
              )}
            </div>
          )
        )}

        {/* Top-Right Status Badge or Favourite / Save Heart Button */}
        {topRightBadge !== undefined ? (
          topRightBadge && <div className="absolute top-3 right-3 z-10">{topRightBadge}</div>
        ) : (
          onToggleSave && (
          <button
            type="button"
            onClick={onToggleSave}
            title={heartAriaLabel}
            aria-label={heartAriaLabel}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-md z-10 cursor-pointer ${
              isSaved
                ? 'bg-white text-red-500 hover:scale-110'
                : 'bg-white/95 text-gray-500 hover:text-red-500 hover:bg-white hover:scale-105'
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
          )
        )}
      </div>

      {/* Spacious Card Content Body */}
      <div className="p-4 flex flex-col flex-grow justify-between gap-3">
        <div className="space-y-2.5">
          {/* Title & Monthly Rent Row + Location */}
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <Link to={detailTo} state={detailState} className="min-w-0 flex-1">
                <h3 className="text-base sm:text-[17px] font-medium text-[#111827] group-hover:text-[#408A71] transition-colors line-clamp-1 mb-0">
                  {title}
                </h3>
              </Link>

              {formattedRent ? (
                <div className="text-right shrink-0 whitespace-nowrap">
                  <span className="text-base sm:text-lg font-medium text-[#111827] tabular-nums">
                    {formattedRent}
                  </span>
                  <span className="text-xs text-[#6B7280] font-normal"> / month</span>
                </div>
              ) : (
                <span className="text-xs font-normal text-[#6B7280] shrink-0">Unlisted</span>
              )}
            </div>

            <p className="mt-1 text-xs sm:text-sm text-[#6B7280] flex items-center gap-1.5 truncate mb-0">
              <svg
                className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
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
              <span className="truncate">{locationText}</span>
            </p>
          </div>

          {/* Spacious 3-Column Property Specifications */}
          <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#F3F4F6]">
            {/* Col 1: Bedrooms / Category */}
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-4 h-4 text-[#6B7280] mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <div className="min-w-0">
                <p className="text-xs sm:text-[13px] font-medium text-[#111827] truncate leading-tight mb-0">
                  {firstSpecValue}
                </p>
                <p className="text-[11px] font-normal text-[#6B7280] mt-0.5 truncate leading-tight mb-0">
                  {firstSpecLabel}
                </p>
              </div>
            </div>

            {/* Col 2: Bathrooms / Parking */}
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-4 h-4 text-[#6B7280] mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 12h16M5 12v4a3 3 0 003 3h8a3 3 0 003-3v-4M7 12V6a2 2 0 014 0"
                />
              </svg>
              <div className="min-w-0">
                <p className="text-xs sm:text-[13px] font-medium text-[#111827] truncate leading-tight mb-0">
                  {secondSpecValue}
                </p>
                <p className="text-[11px] font-normal text-[#6B7280] mt-0.5 truncate leading-tight mb-0">
                  {secondSpecLabel}
                </p>
              </div>
            </div>

            {/* Col 3: Built-up Area */}
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-4 h-4 text-[#6B7280] mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              <div className="min-w-0">
                <p className="text-xs sm:text-[13px] font-medium text-[#111827] truncate leading-tight mb-0">
                  {areaText}
                </p>
                <p className="text-[11px] font-normal text-[#6B7280] mt-0.5 truncate leading-tight mb-0">
                  Built-up Area
                </p>
              </div>
            </div>
          </div>

          {/* Property Type & Furnishing Badges */}
          {(typeBadgeLabel || furnishingBadgeLabel) && (
            <div className="flex items-center flex-wrap gap-1.5">
              {typeBadgeLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECF5F2] text-[#1A4D38] border border-[#DCE8E2] px-2.5 py-0.5 text-[11px] font-normal">
                  <svg
                    className="w-3 h-3 text-[#408A71] shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
                    />
                  </svg>
                  <span>{typeBadgeLabel}</span>
                </span>
              )}
              {furnishingBadgeLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] px-2.5 py-0.5 text-[11px] font-normal">
                  <svg
                    className="w-3 h-3 text-[#6B7280] shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 11V8a2 2 0 012-2h12a2 2 0 012 2v3M3 11h18v5H3v-5zm2 5v2m14-2v2"
                    />
                  </svg>
                  <span>{furnishingBadgeLabel}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA or custom Owner Actions slot */}
        {footerSlot ?? (
          <Link
            to={detailTo}
            state={detailState}
            className="w-full py-2 px-4 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30"
          >
            <span>View Property Details</span>
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        )}
      </div>
    </article>
  )
}

export const PropertyListingCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-xs animate-pulse flex flex-col">
    <div className="aspect-[4/3] bg-gray-200 w-full" />
    <div className="p-4 space-y-2.5 flex-1">
      <div className="space-y-1.5">
        <div className="flex justify-between items-center gap-3">
          <div className="h-5 bg-gray-200 rounded w-3/5" />
          <div className="h-5 bg-gray-200 rounded w-1/4" />
        </div>
        <div className="h-3.5 bg-gray-100 rounded w-1/2" />
      </div>
      <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[#F3F4F6]">
        <div className="h-7 bg-gray-100 rounded" />
        <div className="h-7 bg-gray-100 rounded" />
        <div className="h-7 bg-gray-100 rounded" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 bg-gray-100 rounded-full w-24" />
        <div className="h-5 bg-gray-100 rounded-full w-24" />
      </div>
      <div className="h-9 bg-gray-200 rounded-xl w-full" />
    </div>
  </div>
)

export default PropertyListingCard
