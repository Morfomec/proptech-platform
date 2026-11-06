import React from 'react'
import { Link } from 'react-router-dom'
import type { PropertyListItem, PropertyStatus } from '../../types/property'
import { Badge, type BadgeVariant } from '../ui/badge'

export interface PropertyCardProps {
  property: PropertyListItem
}

/**
 * Maps controlled backend property status to badge variant and label.
 */
function getStatusBadgeConfig(status: PropertyStatus): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 'available':
      return { variant: 'success', label: 'Available' }
    case 'occupied':
      return { variant: 'info', label: 'Occupied' }
    case 'draft':
      return { variant: 'neutral', label: 'Draft' }
    case 'maintenance':
      return { variant: 'warning', label: 'Maintenance' }
    case 'inactive':
      return { variant: 'danger', label: 'Inactive' }
    default:
      return { variant: 'neutral', label: status }
  }
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

/**
 * Formats ISO date string into readable format.
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateString
  }
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const { variant, label } = getStatusBadgeConfig(property.status)
  const categoryLabel = property.category.charAt(0).toUpperCase() + property.category.slice(1)
  const typeLabel = formatPropertyType(property.property_type)

  return (
    <Link to={`/app/owner/properties/${property.id}`} className="block h-full focus:outline-none focus:ring-2 focus:ring-[#408A71] rounded-2xl">
      <article className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white transition-all duration-200 hover:border-[#408A71]/40 hover:shadow-md h-full">
        {/* Property Thumbnail Image */}
        <div className="relative aspect-16/10 w-full overflow-hidden bg-gray-100">
          {property.primary_image_url ? (
            <img
              src={property.primary_image_url}
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

          {/* Status Badge Tag */}
          <div className="absolute top-3 right-3">
            <Badge variant={variant} size="sm" dot>
              {label}
            </Badge>
          </div>
        </div>

        {/* Property Details */}
        <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
          <div className="space-y-1.5">
            {/* Category & Type */}
            <div className="text-[11px] font-semibold text-[#408A71] uppercase tracking-wider">
              {categoryLabel} &bull; {typeLabel}
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-[#111827] line-clamp-1 group-hover:text-[#408A71] transition-colors">
              {property.title}
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
                {[property.locality, property.city].filter(Boolean).join(', ')}
              </span>
            </div>
          </div>

          {/* Footer Meta */}
          <div className="flex items-center justify-between border-t border-[#F3F4F6] pt-3 text-xs text-[#9CA3AF]">
            <span>Added {formatDate(property.created_at)}</span>
            <span className="text-[11px] font-medium text-[#408A71] group-hover:underline">
              View Details &rarr;
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

export default PropertyCard

