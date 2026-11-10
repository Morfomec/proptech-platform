import React from 'react'
import type { FurnishingStatus, PropertyCategory } from '../../../types/property'
import { FormSection } from './FormSection'
import { FormField } from './FormField'

export interface PropertySpecificationsSectionProps {
  category: PropertyCategory
  bedrooms: string
  onBedroomsChange: (val: string) => void
  bathrooms: string
  onBathroomsChange: (val: string) => void
  furnishingStatus: FurnishingStatus
  onFurnishingStatusChange: (val: FurnishingStatus) => void
  parkingDetails: string
  onParkingDetailsChange: (val: string) => void
  fieldErrors: Record<string, string>
}

const FURNISHING_OPTIONS: { value: FurnishingStatus; label: string }[] = [
  { value: 'unfurnished', label: 'Unfurnished' },
  { value: 'semi_furnished', label: 'Semi-Furnished' },
  { value: 'fully_furnished', label: 'Fully Furnished' },
]

export const PropertySpecificationsSection: React.FC<PropertySpecificationsSectionProps> = ({
  category,
  bedrooms,
  onBedroomsChange,
  bathrooms,
  onBathroomsChange,
  furnishingStatus,
  onFurnishingStatusChange,
  parkingDetails,
  onParkingDetailsChange,
  fieldErrors,
}) => {
  return (
    <FormSection
      title="Property Specifications"
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      }
    >
      {category === 'residential' ? (
        <div className="space-y-4">
          {/* Row 1: Bedrooms & Bathrooms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Bedrooms */}
            <FormField label="Bedrooms" error={fieldErrors.bedrooms}>
              <input
                type="number"
                min="0"
                step="1"
                value={bedrooms}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || (!val.includes('.') && parseInt(val, 10) >= 0)) {
                    onBedroomsChange(val)
                  }
                }}
                placeholder="e.g. 2"
                className={`h-[42px] w-full px-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                  fieldErrors.bedrooms
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
                }`}
              />
            </FormField>

            {/* Bathrooms */}
            <FormField label="Bathrooms" error={fieldErrors.bathrooms}>
              <input
                type="number"
                min="0"
                step="any"
                value={bathrooms}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || parseFloat(val) >= 0) {
                    onBathroomsChange(val)
                  }
                }}
                placeholder="e.g. 2 or 1.5"
                className={`h-[42px] w-full px-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                  fieldErrors.bathrooms
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
                }`}
              />
            </FormField>
          </div>

          {/* Row 2: Furnishing Status & Parking Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField label="Furnishing Status" error={fieldErrors.furnishing_status}>
              <div className="h-[42px] grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-lg">
                {FURNISHING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onFurnishingStatusChange(opt.value)}
                    className={`h-full flex items-center justify-center rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      furnishingStatus === opt.value
                        ? 'bg-white text-gray-900 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="Parking Details" error={fieldErrors.parking_details}>
              <input
                type="text"
                value={parkingDetails}
                onChange={(e) => onParkingDetailsChange(e.target.value)}
                placeholder="e.g. 1 Covered Car, 2 Bike Slots"
                className="h-[42px] w-full px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-[#408A71] focus:ring-1 focus:ring-[#408A71] transition-all"
              />
            </FormField>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FormField label="Parking & Access Details" error={fieldErrors.parking_details}>
            <input
              type="text"
              value={parkingDetails}
              onChange={(e) => onParkingDetailsChange(e.target.value)}
              placeholder="e.g. 10 Dedicated parking slots, 24/7 service vehicle access"
              className="h-[42px] w-full px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-[#408A71] focus:ring-1 focus:ring-[#408A71] transition-all"
            />
          </FormField>
        </div>
      )}
    </FormSection>
  )
}

export default PropertySpecificationsSection
