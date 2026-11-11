import React from 'react'
import { Link } from 'react-router-dom'
import type { PropertyListItem } from '../../types/property'
import type { PublicListingProperty } from '../../types/listing'
import { Dropdown, type DropdownMenuItem } from '../ui/dropdown'
import { PropertyListingCard } from '../property/PropertyListingCard'

export interface PropertyCardListingData {
  id: string
  monthly_rent: string | number
  security_deposit?: string | number | null
  available_from?: string | null
  status: 'published' | 'draft' | 'paused' | 'closed'
  published_at?: string | null
  property?: Partial<PublicListingProperty> | null
}

export interface PropertyCardProps {
  property: PropertyListItem
  listing?: PropertyCardListingData | null
  onPublishListing?: (listingId: string, propertyId: string) => void
  onPauseListing?: (listingId: string) => void
  onResumeListing?: (listingId: string) => void
  onCloseListing?: (listingId: string) => void
  onDeleteProperty?: (propertyId: string, title: string) => void
  isActionLoading?: boolean
}

function getOwnerStatusBadge(
  listing: PropertyCardListingData | null | undefined,
  propertyStatus: PropertyListItem['status']
): React.ReactNode {
  if (listing) {
    if (listing.status === 'published') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-[#15803D] border border-emerald-200 shadow-xs backdrop-blur-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>LIVE</span>
        </span>
      )
    }
    if (listing.status === 'draft') {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50/95 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 shadow-xs backdrop-blur-xs">
          DRAFT
        </span>
      )
    }
    if (listing.status === 'paused') {
      return (
        <span className="inline-flex items-center rounded-full bg-orange-50/95 px-2.5 py-1 text-xs font-medium text-orange-700 border border-orange-200 shadow-xs backdrop-blur-xs">
          PAUSED
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100/95 px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-300 shadow-xs backdrop-blur-xs">
        CLOSED
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-200 shadow-xs backdrop-blur-xs uppercase">
      {propertyStatus}
    </span>
  )
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  listing,
  onPublishListing,
  onPauseListing,
  onResumeListing,
  onCloseListing,
  onDeleteProperty,
  isActionLoading = false,
}) => {
  const categoryLabel =
    property.category.charAt(0).toUpperCase() + property.category.slice(1)

  const primaryImageUrl =
    property.primary_image_url ||
    listing?.property?.primary_image_url ||
    (property as unknown as { images?: Array<{ image_url: string; is_primary?: boolean }> })
      .images?.find((img) => img.is_primary)?.image_url ||
    (property as unknown as { images?: Array<{ image_url: string }> }).images?.[0]
      ?.image_url ||
    null

  const isPublished = Boolean(listing && listing.status === 'published')
  const primaryTarget = isPublished
    ? `/properties/${listing!.id}`
    : `/app/owner/properties/${property.id}/edit`

  const mergedProperty: Partial<PublicListingProperty> = {
    id: property.id,
    title: property.title,
    category: property.category,
    property_type: property.property_type,
    address_line_1: property.address_line_1,
    locality: property.locality,
    city: property.city,
    state: listing?.property?.state,
    built_up_area: property.built_up_area,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    furnishing_status: listing?.property?.furnishing_status,
    parking_spaces: listing?.property?.parking_spaces,
    primary_image_url: primaryImageUrl,
  }

  // Construct context-aware dropdown items based strictly on supported backend endpoints
  const dropdownItems: DropdownMenuItem[] = []

  if (listing) {
    if (listing.status === 'draft' && onPublishListing) {
      dropdownItems.push({
        id: 'publish',
        label: 'Publish Listing',
        icon: (
          <svg
            className="w-4 h-4 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M12 4v16" />
          </svg>
        ),
        disabled: isActionLoading,
        onClick: () => onPublishListing(listing.id, property.id),
      })
    } else if (listing.status === 'published') {
      if (onPauseListing) {
        dropdownItems.push({
          id: 'pause',
          label: 'Pause Listing',
          icon: (
            <svg
              className="w-4 h-4 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
          disabled: isActionLoading,
          onClick: () => onPauseListing(listing.id),
        })
      }
      if (onCloseListing) {
        dropdownItems.push({
          id: 'close',
          label: 'Close Listing',
          icon: (
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          ),
          disabled: isActionLoading,
          onClick: () => onCloseListing(listing.id),
        })
      }
    } else if (listing.status === 'paused') {
      if (onResumeListing) {
        dropdownItems.push({
          id: 'resume',
          label: 'Resume Listing',
          icon: (
            <svg
              className="w-4 h-4 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
          disabled: isActionLoading,
          onClick: () => onResumeListing(listing.id),
        })
      }
      if (onCloseListing) {
        dropdownItems.push({
          id: 'close',
          label: 'Close Listing',
          icon: (
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          ),
          disabled: isActionLoading,
          onClick: () => onCloseListing(listing.id),
        })
      }
    }
  }

  if (dropdownItems.length > 0 && onDeleteProperty) {
    dropdownItems.push({ separator: true })
  }

  if (onDeleteProperty) {
    dropdownItems.push({
      id: 'delete',
      label: 'Delete Property',
      icon: (
        <svg
          className="w-4 h-4 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
      danger: true,
      disabled: isActionLoading,
      onClick: () => onDeleteProperty(property.id, property.title),
    })
  }

  const topLeftBadge = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECF5F2]/95 px-2.5 py-1 text-xs font-medium text-[#1A4D38] border border-[#CBE7DC] shadow-xs backdrop-blur-xs">
      {categoryLabel}
    </span>
  )

  const topRightBadge = getOwnerStatusBadge(listing, property.status)

  const footerSlot = (
    <div className="flex items-center gap-2 pt-1">
      {isPublished ? (
        <>
          <Link
            to={`/properties/${listing!.id}`}
            state={{ from: 'owner' }}
            className="flex-1 min-w-0 py-2 px-3 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 shadow-2xs truncate"
          >
            <span>View Listing</span>
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <Link
            to={`/app/owner/properties/${property.id}/edit`}
            className="py-2 px-3 rounded-xl border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 hover:border-gray-300 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center shrink-0"
          >
            Edit
          </Link>
        </>
      ) : (
        <Link
          to={`/app/owner/properties/${property.id}/edit`}
          className="flex-1 min-w-0 py-2 px-3 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 shadow-2xs truncate"
        >
          <span>Edit Property</span>
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      )}

      {dropdownItems.length > 0 && (
        <Dropdown
          placement="top-right"
          width="w-48"
          className="shrink-0"
          trigger={
            <button
              type="button"
              className="h-9 w-9 shrink-0 inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors border border-[#E5E7EB] hover:border-gray-300 cursor-pointer"
              title="More actions"
              aria-label="Open more actions menu"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          }
          items={dropdownItems}
        />
      )}
    </div>
  )

  return (
    <PropertyListingCard
      title={property.title}
      detailTo={primaryTarget}
      detailState={isPublished ? { from: 'owner' } : undefined}
      property={mergedProperty}
      monthlyRent={listing?.monthly_rent}
      showParking
      topLeftBadge={topLeftBadge}
      topRightBadge={topRightBadge}
      footerSlot={footerSlot}
      allowOverflow
    />
  )
}

export default PropertyCard
