import React from 'react'
import { Link } from 'react-router-dom'
import type { PropertyStatus } from '../../types/property'
import type { PublicListingItem } from '../../types/listing'
import { formatDate, formatINR } from '../../utils/application'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { Dropdown, type DropdownMenuItem } from '../ui/dropdown'
import { Skeleton } from '../ui/skeleton'

export interface RentalManagementCardProps {
  propertyId: string
  propertyStatus: PropertyStatus
  listing: PublicListingItem | null
  isLoadingListing: boolean
  isUpdatingPropertyStatus: boolean
  isListingActionLoading: boolean
  propertyStatusError: string | null
  listingError: string | null
  onRequestPropertyStatus: (targetStatus: PropertyStatus) => void
  onPublishOrResumeListing: () => void
  onRequestPauseListing: () => void
  onRequestCloseListing: () => void
}

const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: 'Draft',
  available: 'Available',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
}

const PROPERTY_STATUS_DOTS: Record<PropertyStatus, string> = {
  draft: 'bg-gray-400',
  available: 'bg-[#408A71]',
  occupied: 'bg-blue-500',
  maintenance: 'bg-amber-500',
  inactive: 'bg-red-500',
}

const LISTING_STATUS_LABELS: Record<PublicListingItem['status'], string> = {
  published: 'Published',
  draft: 'Draft',
  paused: 'Paused',
  closed: 'Closed',
}

const LISTING_STATUS_DOTS: Record<PublicListingItem['status'], string> = {
  published: 'bg-[#408A71]',
  draft: 'bg-gray-400',
  paused: 'bg-amber-500',
  closed: 'bg-gray-400',
}

function getContextualSummary(
  propertyStatus: PropertyStatus,
  listing: PublicListingItem | null
): string {
  if (propertyStatus === 'occupied') {
    return 'Occupied under an active tenancy. Property status updates automatically when the tenancy ends.'
  }
  if (propertyStatus === 'maintenance') {
    return 'Temporarily unavailable for repairs, renovation, or preparation. Mark Available when ready; any paused listing stays paused until you resume it.'
  }
  if (propertyStatus === 'inactive') {
    return 'Hidden from the marketplace. Mark Available when you are ready to list or accept tenants again.'
  }
  if (!listing) {
    return propertyStatus === 'draft'
      ? 'Finish setup or create a rental listing to set rent, deposit, and publish.'
      : 'Property is ready. Create a rental listing to set rent, deposit, and publish.'
  }
  switch (listing.status) {
    case 'published':
      return 'Live on the public marketplace and accepting tenant applications.'
    case 'paused':
      return 'Listing is paused and hidden from public search. Resume when ready to accept applications.'
    case 'draft':
      return 'Listing is saved as a draft. Publish it to make the property visible on the marketplace.'
    case 'closed':
      return 'This listing is closed. Create a new listing to market this property again.'
    default:
      return ''
  }
}

export const RentalManagementCard: React.FC<RentalManagementCardProps> = ({
  propertyId,
  propertyStatus,
  listing,
  isLoadingListing,
  isUpdatingPropertyStatus,
  isListingActionLoading,
  propertyStatusError,
  listingError,
  onRequestPropertyStatus,
  onPublishOrResumeListing,
  onRequestPauseListing,
  onRequestCloseListing,
}) => {
  const isBusy = isUpdatingPropertyStatus || isListingActionLoading
  const monthlyRent = listing ? formatINR(listing.monthly_rent) : null
  const securityDeposit = listing ? formatINR(listing.security_deposit) : null
  const summaryText = getContextualSummary(propertyStatus, listing)

  // Secondary actions menu: only valid transitions for current property & listing states
  const secondaryMenuItems: DropdownMenuItem[] = []

  if (propertyStatus === 'available' || propertyStatus === 'inactive') {
    secondaryMenuItems.push({
      id: 'mark-maintenance',
      label: 'Mark for Maintenance',
      disabled: isBusy,
      icon: (
        <svg
          className="w-4 h-4 text-amber-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
          />
        </svg>
      ),
      onClick: () => onRequestPropertyStatus('maintenance'),
    })
  }

  if (propertyStatus === 'available' || propertyStatus === 'maintenance') {
    secondaryMenuItems.push({
      id: 'mark-inactive',
      label: 'Mark Inactive',
      disabled: isBusy,
      icon: (
        <svg
          className="w-4 h-4 text-[#6B7280]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      ),
      onClick: () => onRequestPropertyStatus('inactive'),
    })
  }

  if (listing && listing.status !== 'closed') {
    if (secondaryMenuItems.length > 0) {
      secondaryMenuItems.push({ separator: true })
    }
    secondaryMenuItems.push({
      id: 'close-listing',
      label: 'Close Listing',
      danger: true,
      disabled: isBusy,
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
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      onClick: onRequestCloseListing,
    })
  }

  // Primary contextual action
  const renderPrimaryAction = () => {
    if (propertyStatus === 'occupied') {
      return null
    }

    if (propertyStatus === 'maintenance' || propertyStatus === 'inactive') {
      return (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="flex-1"
          isLoading={isUpdatingPropertyStatus}
          disabled={isBusy}
          onClick={() => onRequestPropertyStatus('available')}
        >
          Mark as Available
        </Button>
      )
    }

    if (!listing || listing.status === 'closed') {
      return (
        <Link
          to={`/app/owner/properties/${propertyId}/edit`}
          state={{ returnTo: `/app/owner/properties/${propertyId}` }}
          className="flex-1"
        >
          <Button type="button" variant="primary" size="sm" className="w-full">
            {listing?.status === 'closed' ? 'Create New Listing' : 'Create Listing'}
          </Button>
        </Link>
      )
    }

    if (listing.status === 'draft') {
      return (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="flex-1"
          isLoading={isListingActionLoading}
          disabled={isBusy}
          onClick={onPublishOrResumeListing}
        >
          Publish Listing
        </Button>
      )
    }

    if (listing.status === 'published') {
      return (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="flex-1"
          disabled={isBusy}
          onClick={onRequestPauseListing}
        >
          Pause Listing
        </Button>
      )
    }

    if (listing.status === 'paused') {
      return (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="flex-1"
          isLoading={isListingActionLoading}
          disabled={isBusy}
          onClick={onPublishOrResumeListing}
        >
          Resume Listing
        </Button>
      )
    }

    return null
  }

  const primaryAction = renderPrimaryAction()

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-[#111827]">Rental Management</h2>
        {listing?.status === 'published' && propertyStatus === 'available' && (
          <Link
            to={`/properties/${listing.id}`}
            className="text-xs font-medium text-[#408A71] hover:underline"
          >
            View Listing &rarr;
          </Link>
        )}
      </div>

      {propertyStatusError && (
        <Alert variant="error" title="Status update failed">
          {propertyStatusError}
        </Alert>
      )}

      {listingError && (
        <Alert variant="error" title="Listing update failed">
          {listingError}
        </Alert>
      )}

      {isLoadingListing ? (
        <div className="space-y-3">
          <Skeleton shape="rectangular" height={44} className="rounded-lg" />
          <Skeleton shape="rectangular" height={36} className="rounded-lg" />
        </div>
      ) : (
        <>
          {/* Distinct Property Condition vs Listing Visibility */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs">
            <div>
              <span className="text-[#6B7280] block">Property Status</span>
              <span className="mt-1 inline-flex items-center gap-1.5 font-medium text-[#111827]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${PROPERTY_STATUS_DOTS[propertyStatus]}`}
                />
                {PROPERTY_STATUS_LABELS[propertyStatus]}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block">Listing Status</span>
              {listing ? (
                <span className="mt-1 inline-flex items-center gap-1.5 font-medium text-[#111827]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${LISTING_STATUS_DOTS[listing.status]}`}
                  />
                  {LISTING_STATUS_LABELS[listing.status]}
                </span>
              ) : (
                <span className="mt-1 block font-medium text-[#6B7280]">Not Listed</span>
              )}
            </div>
          </div>

          {/* Listing Commercial Terms (only when listing exists) */}
          {listing && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#6B7280] block">Monthly Rent</span>
                <span className="text-sm font-medium text-[#111827] mt-0.5 block tabular-nums">
                  {monthlyRent ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-[#6B7280] block">Security Deposit</span>
                <span className="text-sm font-medium text-[#111827] mt-0.5 block tabular-nums">
                  {securityDeposit ?? '—'}
                </span>
              </div>
              {listing.available_from && (
                <div className="col-span-2">
                  <span className="text-[#6B7280]">Available from </span>
                  <span className="font-medium text-[#111827]">
                    {formatDate(listing.available_from)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Contextual State Explanation */}
          <p className="text-xs text-[#6B7280] leading-relaxed">{summaryText}</p>

          {/* Primary Contextual Action + Secondary More Actions Menu */}
          {(primaryAction || secondaryMenuItems.length > 0) && (
            <div className="flex items-center gap-2 pt-1">
              {primaryAction}
              {secondaryMenuItems.length > 0 && (
                <Dropdown
                  placement="bottom-right"
                  width="w-52"
                  disabled={isBusy}
                  items={secondaryMenuItems}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      aria-label="More rental management actions"
                    >
                      More Actions
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default RentalManagementCard
