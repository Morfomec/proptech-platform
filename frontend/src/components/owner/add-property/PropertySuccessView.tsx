import React from 'react'
import { Link } from 'react-router-dom'
import { getMediaUrl } from '../../../utils/imageUrl'
import type { PropertyStatus } from '../../../types/property'

export type SuccessListingStatus = 'published' | 'draft' | 'paused' | 'closed'

export interface PropertySuccessViewProps {
  isEditMode: boolean
  onEditAgain?: () => void
  data: {
    mode: 'published' | 'draft'
    listingStatus?: SuccessListingStatus | null
    propertyStatus?: PropertyStatus | null
    propertyId: string
    listingId?: string
    title: string
    location: string
    primaryImageUrl?: string
    monthlyRent?: number | string
    securityDeposit?: number | string
  }
}

interface StatusBadgeMeta {
  label: string
  classes: string
  dot?: boolean
}

function resolveStatusBadge(
  listingStatus?: SuccessListingStatus | null,
  propertyStatus?: PropertyStatus | null,
  mode?: 'published' | 'draft'
): StatusBadgeMeta {
  const effectiveListingStatus =
    listingStatus ?? (mode === 'published' ? 'published' : null)

  if (effectiveListingStatus === 'published') {
    return {
      label: 'Live',
      classes: 'bg-emerald-50 text-[#15803D] border-emerald-200',
      dot: true,
    }
  }
  if (effectiveListingStatus === 'paused') {
    return {
      label: 'Paused',
      classes: 'bg-orange-50 text-orange-700 border-orange-200',
    }
  }
  if (effectiveListingStatus === 'closed') {
    return {
      label: 'Closed',
      classes: 'bg-gray-100 text-gray-700 border-gray-300',
    }
  }
  if (effectiveListingStatus === 'draft') {
    return {
      label: 'Draft',
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  }

  switch (propertyStatus) {
    case 'available':
      return {
        label: 'Available',
        classes: 'bg-[#ECF5F2] text-[#1A4D38] border-[#CBE7DC]',
      }
    case 'occupied':
      return {
        label: 'Occupied',
        classes: 'bg-blue-50 text-blue-700 border-blue-200',
      }
    case 'maintenance':
      return {
        label: 'Maintenance',
        classes: 'bg-orange-50 text-orange-700 border-orange-200',
      }
    case 'inactive':
      return {
        label: 'Inactive',
        classes: 'bg-gray-100 text-gray-600 border-gray-200',
      }
    default:
      return {
        label: 'Draft',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
      }
  }
}

export const PropertySuccessView: React.FC<PropertySuccessViewProps> = ({
  isEditMode,
  onEditAgain,
  data,
}) => {
  const effectiveStatus = data.listingStatus ?? (data.mode === 'published' ? 'published' : null)
  const isPublished = effectiveStatus === 'published' && Boolean(data.listingId)
  const badgeMeta = resolveStatusBadge(data.listingStatus, data.propertyStatus, data.mode)
  const resolvedImageUrl = data.primaryImageUrl ? getMediaUrl(data.primaryImageUrl) : null

  const headingText = isPublished
    ? isEditMode
      ? 'Property Updated Successfully'
      : 'Property Published Successfully'
    : isEditMode
      ? 'Property Updated Successfully'
      : 'Property Saved as Draft'

  const subtitleText = isPublished
    ? 'Your listing is live on the marketplace and ready for prospective tenants.'
    : effectiveStatus === 'paused'
      ? 'Your property changes have been saved. The listing remains paused until resumed.'
      : effectiveStatus === 'closed'
        ? 'Your property changes have been saved. The listing remains closed.'
        : 'Your property changes are saved. You can review or publish anytime from My Properties.'

  return (
    <div className="py-10 sm:py-14 max-w-[580px] mx-auto px-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs p-6 sm:p-8 text-center space-y-6">
        {/* Success Check Icon */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#ECF5F2] text-[#408A71] border border-[#DCE8E2] flex items-center justify-center">
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-[#111827] mb-0">
            {headingText}
          </h1>
          <p className="text-sm font-normal text-[#6B7280] max-w-md mx-auto">
            {subtitleText}
          </p>
        </div>

        {/* Property Summary Snapshot Card */}
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 sm:p-5 text-left flex items-center gap-4">
          {resolvedImageUrl ? (
            <img
              src={resolvedImageUrl}
              alt={data.title}
              className="w-20 h-20 sm:w-24 sm:h-20 rounded-xl object-cover object-center shrink-0 border border-[#E5E7EB] bg-white"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-20 rounded-xl bg-gradient-to-br from-[#F4FAF7] to-[#EBF3EF] text-[#408A71]/70 flex items-center justify-center shrink-0 border border-[#DCE8E2]">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
                />
              </svg>
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <h2 className="text-base font-medium text-[#111827] truncate mb-0">
                {data.title}
              </h2>
              <span
                className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${badgeMeta.classes}`}
              >
                {badgeMeta.dot && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                <span>{badgeMeta.label}</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm font-normal text-[#6B7280] flex items-center gap-1.5 truncate mb-0">
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
              <span className="truncate">{data.location}</span>
            </p>

            {data.monthlyRent ? (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pt-0.5">
                <p className="text-base font-medium text-[#111827] tabular-nums mb-0">
                  ₹{Number(data.monthlyRent).toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-[#6B7280]"> / month</span>
                </p>
                {data.securityDeposit !== undefined &&
                  data.securityDeposit !== '' &&
                  Number(data.securityDeposit) > 0 && (
                    <span className="text-xs font-normal text-[#6B7280] tabular-nums">
                      Deposit ₹{Number(data.securityDeposit).toLocaleString('en-IN')}
                    </span>
                  )}
              </div>
            ) : (
              <p className="text-xs font-normal text-[#6B7280] pt-0.5 mb-0">
                Unlisted property
              </p>
            )}
          </div>
        </div>

        {/* Action CTAs */}
        {(() => {
          const editButtonClass =
            'w-full py-2.5 px-4 text-sm font-medium rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 hover:border-gray-300 text-[#374151] transition-colors flex items-center justify-center gap-2 cursor-pointer'
          const editButtonContent = (
            <>
              <svg
                className="w-4 h-4 text-[#6B7280] shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span>Edit Property</span>
            </>
          )
          const editActionButton = onEditAgain ? (
            <button type="button" onClick={onEditAgain} className={editButtonClass}>
              {editButtonContent}
            </button>
          ) : (
            <Link to={`/app/owner/properties/${data.propertyId}/edit`} className={editButtonClass}>
              {editButtonContent}
            </Link>
          )

          return (
            <div className="space-y-2.5 pt-1">
              {isPublished ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Link
                      to={`/properties/${data.listingId}`}
                      state={{ from: 'owner' }}
                      className="w-full py-2.5 px-4 text-sm font-medium rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>View Listing</span>
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
                    <Link
                      to="/app/owner/properties"
                      className="w-full py-2.5 px-4 text-sm font-medium rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 hover:border-gray-300 text-[#374151] transition-colors flex items-center justify-center cursor-pointer"
                    >
                      Back to My Properties
                    </Link>
                  </div>
                  {editActionButton}
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Link
                    to="/app/owner/properties"
                    className="w-full py-2.5 px-4 text-sm font-medium rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white transition-colors flex items-center justify-center shadow-2xs cursor-pointer"
                  >
                    Back to My Properties
                  </Link>
                  {editActionButton}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default PropertySuccessView
