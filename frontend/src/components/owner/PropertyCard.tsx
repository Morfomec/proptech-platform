import React from 'react'
import { Link } from 'react-router-dom'
import type { PropertyListItem } from '../../types/property'
import { Dropdown, type DropdownMenuItem } from '../ui/dropdown'
import { getMediaUrl } from '../../utils/imageUrl'

export interface PropertyCardListingData {
  id: string
  monthly_rent: string | number
  security_deposit?: string | number | null
  available_from?: string | null
  status: 'published' | 'draft' | 'paused' | 'closed'
  published_at?: string | null
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

/**
 * Formats property type enum value into human-readable string.
 */
function formatPropertyType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
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
  const categoryLabel = property.category.charAt(0).toUpperCase() + property.category.slice(1)
  const typeLabel = formatPropertyType(property.property_type)

  const primaryImageUrl =
    property.primary_image_url ||
    (property as unknown as { images?: Array<{ image_url: string; is_primary?: boolean }> }).images?.find(
      (img) => img.is_primary
    )?.image_url ||
    (property as unknown as { images?: Array<{ image_url: string }> }).images?.[0]?.image_url ||
    null

  const isPublished = Boolean(listing && listing.status === 'published')
  const primaryTarget = isPublished
    ? `/properties/${listing!.id}`
    : `/app/owner/properties/${property.id}/edit`

  // Construct context-aware dropdown items based strictly on supported backend endpoints
  const dropdownItems: DropdownMenuItem[] = []

  if (listing) {
    if (listing.status === 'draft' && onPublishListing) {
      dropdownItems.push({
        id: 'publish',
        label: 'Publish Listing',
        icon: (
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
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
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          ),
          disabled: isActionLoading,
          onClick: () => onCloseListing(listing.id),
        })
      }
    }
  }

  // Separator before destructive delete
  if (dropdownItems.length > 0 && onDeleteProperty) {
    dropdownItems.push({ separator: true })
  }

  if (onDeleteProperty) {
    dropdownItems.push({
      id: 'delete',
      label: 'Delete Property',
      icon: (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      danger: true,
      disabled: isActionLoading,
      onClick: () => onDeleteProperty(property.id, property.title),
    })
  }

  return (
    <article className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white transition-all duration-200 hover:border-[#408A71]/50 hover:shadow-md relative">
      {/* 1. Property Image & Badges */}
      <div className="relative aspect-16/10 w-full overflow-hidden rounded-t-2xl bg-gray-100">
        <Link to={primaryTarget} className="block w-full h-full">
          {primaryImageUrl ? (
            <img
              src={getMediaUrl(primaryImageUrl)}
              alt={property.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
              loading="lazy"
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
              <span className="text-[11px] font-medium text-gray-400">No photo uploaded</span>
            </div>
          )}
        </Link>

        {/* Top-Left Category & Type Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-black/60 text-white backdrop-blur-xs shadow-xs uppercase tracking-wider">
            {categoryLabel}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-white/90 text-gray-800 shadow-xs">
            {typeLabel}
          </span>
        </div>

        {/* Top-Right Listing / Property Status Badge */}
        <div className="absolute top-3 right-3">
          {listing ? (
            listing.status === 'published' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            ) : listing.status === 'draft' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                DRAFT
              </span>
            ) : listing.status === 'paused' ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200 shadow-2xs">
                PAUSED
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300 shadow-2xs">
                CLOSED
              </span>
            )
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200 shadow-2xs uppercase">
              {property.status}
            </span>
          )}
        </div>
      </div>

      {/* 2. Property Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Monthly Rent */}
          <div className="flex items-baseline justify-between">
            {listing ? (
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-extrabold text-[#111827]">
                  ₹{Number(listing.monthly_rent).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-[#6B7280]">/ month</span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-gray-400 italic">
                Unlisted Property
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-[#111827] line-clamp-1 group-hover:text-[#408A71] transition-colors">
            <Link to={primaryTarget} state={isPublished ? { from: 'owner' } : undefined}>
              {property.title}
            </Link>
          </h3>

          {/* Locality & City */}
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <svg
              className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="truncate">
              {[property.locality, property.city].filter(Boolean).join(', ') || 'Location details not set'}
            </span>
          </div>

          {/* Physical Specifications */}
          <div className="flex items-center gap-4 pt-2.5 text-xs text-[#4B5563] border-t border-[#F3F4F6]">
            {property.category === 'residential' ? (
              <>
                <div className="flex items-center gap-1" title="Bedrooms">
                  <span>🛏️</span>
                  <span>{property.bedrooms ?? '--'} Beds</span>
                </div>
                <div className="flex items-center gap-1" title="Bathrooms">
                  <span>🚿</span>
                  <span>{property.bathrooms ?? '--'} Baths</span>
                </div>
                <div className="flex items-center gap-1" title="Built-up Area">
                  <span>📐</span>
                  <span>
                    {property.built_up_area
                      ? `${Number(property.built_up_area).toLocaleString('en-IN')} sq ft`
                      : '--'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1" title="Commercial Type">
                  <span>🏢</span>
                  <span>{typeLabel}</span>
                </div>
                <div className="flex items-center gap-1" title="Built-up Area">
                  <span>📐</span>
                  <span>
                    {property.built_up_area
                      ? `${Number(property.built_up_area).toLocaleString('en-IN')} sq ft`
                      : '--'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 3. Card Footer Actions */}
        <div className="flex items-center gap-2 border-t border-[#F3F4F6] pt-3 mt-auto">
          {isPublished && (
            <Link
              to={`/properties/${listing!.id}`}
              state={{ from: 'owner' }}
              className="flex-1 min-w-0 h-9 inline-flex items-center justify-center px-2.5 sm:px-3 text-xs font-semibold rounded-lg bg-[#408A71] text-white hover:bg-[#34745C] transition-colors shadow-2xs text-center truncate"
            >
              View Listing
            </Link>
          )}
          <Link
            to={`/app/owner/properties/${property.id}/edit`}
            className="flex-1 min-w-0 h-9 inline-flex items-center justify-center px-2.5 sm:px-3 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors text-center truncate"
          >
            Edit Property
          </Link>

          {/* Contextual More Actions Dropdown */}
          {dropdownItems.length > 0 && (
            <Dropdown
              placement="top-right"
              width="w-48"
              className="shrink-0"
              trigger={
                <button
                  type="button"
                  className="h-9 w-9 shrink-0 inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 hover:border-gray-300 cursor-pointer"
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
      </div>
    </article>
  )
}

export default PropertyCard
