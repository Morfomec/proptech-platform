import React from 'react'
import { Link } from 'react-router-dom'

export interface PropertySuccessViewProps {
  isEditMode: boolean
  data: {
    mode: 'published' | 'draft'
    propertyId: string
    listingId?: string
    title: string
    location: string
    primaryImageUrl?: string
    monthlyRent?: number | string
  }
}

export const PropertySuccessView: React.FC<PropertySuccessViewProps> = ({
  isEditMode,
  data,
}) => {
  const isPublished = data.mode === 'published' && Boolean(data.listingId)

  return (
    <div className="py-10 max-w-[460px] mx-auto px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center space-y-4">
        {/* Success Icon */}
        <div className="w-12 h-12 mx-auto rounded-full bg-[#ECF5F2] text-[#408A71] flex items-center justify-center">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {data.mode === 'published'
              ? isEditMode
                ? 'Property Updated & Published'
                : 'Property Published Successfully'
              : isEditMode
              ? 'Property Updated Successfully'
              : 'Property Saved as Draft'}
          </h2>
        </div>

        {/* Compact Property Snapshot Card */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200/80 text-left">
          {data.primaryImageUrl ? (
            <img
              src={data.primaryImageUrl}
              alt={data.title}
              className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-200 text-gray-400 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{data.title}</h3>
              <span
                className={`shrink-0 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                  data.mode === 'published'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {data.mode === 'published' ? 'Live' : 'Draft'}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{data.location}</p>
            {data.monthlyRent && (
              <p className="text-xs font-semibold text-[#408A71] mt-0.5">
                ₹{Number(data.monthlyRent).toLocaleString('en-IN')}/mo
              </p>
            )}
          </div>
        </div>

        {/* Action CTAs */}
        <div className="space-y-2 pt-1">
          {isPublished ? (
            <>
              <Link
                to={`/properties/${data.listingId}`}
                state={{ from: 'owner' }}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-[#408A71] hover:bg-[#34745C] text-white transition-colors flex items-center justify-center shadow-xs cursor-pointer"
              >
                View Listing
              </Link>
              <Link
                to="/app/owner/properties"
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors flex items-center justify-center cursor-pointer"
              >
                Back to My Properties
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/app/owner/properties"
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-[#408A71] hover:bg-[#34745C] text-white transition-colors flex items-center justify-center shadow-xs cursor-pointer"
              >
                Back to My Properties
              </Link>
              <Link
                to={`/app/owner/properties/${data.propertyId}/edit`}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors flex items-center justify-center cursor-pointer"
              >
                Edit Property
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PropertySuccessView

