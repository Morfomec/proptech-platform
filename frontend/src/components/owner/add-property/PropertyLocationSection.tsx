import React from 'react'
import { FormSection } from './FormSection'
import { FormField } from './FormField'
import { PropertyMapPreview } from '../PropertyMapPreview'

export interface PropertyLocationSectionProps {
  addressLine1: string
  onAddressLine1Change: (val: string) => void
  addressLine2: string
  onAddressLine2Change: (val: string) => void
  locality: string
  onLocalityChange: (val: string) => void
  city: string
  onCityChange: (val: string) => void
  district: string
  onDistrictChange: (val: string) => void
  state: string
  onStateChange: (val: string) => void
  pinCode: string
  onPinCodeChange: (val: string) => void
  latitude: string
  longitude: string
  onCoordinateChange: (lat: string, lng: string) => void
  onDetectLocation: () => void
  isDetectingLocation: boolean
  fullAddressSummary: string
  fieldErrors: Record<string, string>
}

export const PropertyLocationSection: React.FC<PropertyLocationSectionProps> = ({
  addressLine1,
  onAddressLine1Change,
  addressLine2,
  onAddressLine2Change,
  locality,
  onLocalityChange,
  city,
  onCityChange,
  district,
  onDistrictChange,
  state,
  onStateChange,
  pinCode,
  onPinCodeChange,
  latitude,
  longitude,
  onCoordinateChange,
  onDetectLocation,
  isDetectingLocation,
  fullAddressSummary,
  fieldErrors,
}) => {
  return (
    <FormSection
      title="Property Location"
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
      action={
        <button
          type="button"
          onClick={onDetectLocation}
          disabled={isDetectingLocation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          {isDetectingLocation ? (
            <span className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-3.5 h-3.5 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.071 7.071l-1.414-1.414M8.343 8.343L6.929 6.929m10.142 0l-1.414 1.414M8.343 15.657l-1.414 1.414"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
          <span>{isDetectingLocation ? 'Detecting...' : 'Use Current Location'}</span>
        </button>
      }
    >
      <div className="space-y-4">
        {/* Address Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
          <FormField
            label="Address Line 1"
            required
            error={fieldErrors.address_line_1}
            className="md:col-span-2"
          >
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => onAddressLine1Change(e.target.value)}
              placeholder="e.g. Flat 402, Green Valley Apartments"
              className={`h-[42px] w-full px-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                fieldErrors.address_line_1
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
              }`}
            />
          </FormField>

          <FormField label="Locality / Area" required error={fieldErrors.locality}>
            <input
              type="text"
              value={locality}
              onChange={(e) => onLocalityChange(e.target.value)}
              placeholder="e.g. Indiranagar"
              className={`h-[42px] w-full px-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                fieldErrors.locality
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
              }`}
            />
          </FormField>

          <FormField label="Landmark / Line 2">
            <input
              type="text"
              value={addressLine2}
              onChange={(e) => onAddressLine2Change(e.target.value)}
              placeholder="e.g. Near Metro Station Pillar 124"
              className="h-[42px] w-full px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-[#408A71] focus:ring-1 focus:ring-[#408A71] transition-all"
            />
          </FormField>

          <FormField label="City" required error={fieldErrors.city}>
            <input
              type="text"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="e.g. Bangalore"
              className={`h-[42px] w-full px-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                fieldErrors.city
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
              }`}
            />
          </FormField>

          <FormField label="State" required error={fieldErrors.state}>
            <input
              type="text"
              value={state}
              onChange={(e) => onStateChange(e.target.value)}
              placeholder="e.g. Karnataka"
              className={`h-[42px] w-full px-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                fieldErrors.state
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
              }`}
            />
          </FormField>

          <FormField label="PIN Code" required error={fieldErrors.pin_code}>
            <input
              type="text"
              maxLength={6}
              value={pinCode}
              onChange={(e) => onPinCodeChange(e.target.value)}
              placeholder="e.g. 560038"
              className={`h-[42px] w-full px-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                fieldErrors.pin_code
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
              }`}
            />
          </FormField>

          <FormField label="District">
            <input
              type="text"
              value={district}
              onChange={(e) => onDistrictChange(e.target.value)}
              placeholder="e.g. Bangalore Urban"
              className="h-[42px] w-full px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-[#408A71] focus:ring-1 focus:ring-[#408A71] transition-all"
            />
          </FormField>
        </div>

        {/* Embedded Interactive Vector Map Preview */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium text-gray-700">Map Pin</span>
            <span>
              {latitude && longitude ? `${latitude}, ${longitude}` : 'Click map to set location'}
            </span>
          </div>
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <PropertyMapPreview
              latitude={latitude}
              longitude={longitude}
              addressSummary={fullAddressSummary}
              onCoordinateChange={onCoordinateChange}
            />
          </div>
        </div>
      </div>
    </FormSection>
  )
}

export default PropertyLocationSection
