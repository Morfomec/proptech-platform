import React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { FurnishingStatus, PropertyCategory, AmenityItem } from '../../../types/property'
import { propertyService } from '../../../services/property.service'
import { Input } from '../../ui/input'
import { Select, type SelectOption } from '../../ui/select'
import { Checkbox } from '../../ui/checkbox'
import { Skeleton } from '../../ui/skeleton'

export interface Step3FormData {
  built_up_area: string
  bedrooms: string
  bathrooms: string
  furnishing_status: FurnishingStatus
  parking_spaces: string
  parking_details: string
  amenity_ids: string[]
}

export interface Step3Props {
  category: PropertyCategory
  formData: Step3FormData
  errors: Record<string, string>
  onChange: (field: keyof Step3FormData, value: string | string[]) => void
}

const FURNISHING_OPTIONS: SelectOption[] = [
  { label: 'Unfurnished', value: 'unfurnished' },
  { label: 'Semi-Furnished', value: 'semi_furnished' },
  { label: 'Fully Furnished', value: 'fully_furnished' },
]

const CATEGORY_TITLES: Record<string, string> = {
  building: 'Building & Structural',
  safety: 'Safety & Security',
  power_backup: 'Power Backup & Energy',
  connectivity: 'Connectivity & Communication',
  hvac: 'Climate Control / HVAC',
  appliance: 'Appliances & Kitchen',
  accessibility: 'Accessibility',
  recreation: 'Sports & Recreation',
}

export const Step3Details: React.FC<Step3Props> = ({
  category,
  formData,
  errors,
  onChange,
}) => {
  // Query master amenities catalogue
  const { data: amenities = [], isLoading: loadingAmenities } = useQuery<AmenityItem[]>({
    queryKey: ['amenities-catalogue'],
    queryFn: () => propertyService.getAmenities(),
    staleTime: 1000 * 60 * 10,
  })

  const isResidential = category === 'residential'

  const handleToggleAmenity = (id: string) => {
    const current = formData.amenity_ids
    if (current.includes(id)) {
      onChange(
        'amenity_ids',
        current.filter((item) => item !== id)
      )
    } else {
      onChange('amenity_ids', [...current, id])
    }
  }

  // Group amenities by category
  const groupedAmenities: Record<string, AmenityItem[]> = {}
  amenities.forEach((amenity) => {
    const cat = amenity.category || 'other'
    if (!groupedAmenities[cat]) {
      groupedAmenities[cat] = []
    }
    groupedAmenities[cat].push(amenity)
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Property Details & Amenities</h2>
        <p className="text-xs text-[#6B7280] mt-0.5">
          Configure size specifications, rooms, parking, and select available master amenities.
        </p>
      </div>

      {/* 1. Physical Specifications */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
          Dimensions & Rooms
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Built-Up Area (sq ft)"
            placeholder="e.g. 1450"
            value={formData.built_up_area}
            onChange={(e) => onChange('built_up_area', e.target.value)}
            error={errors.built_up_area}
            hint="Positive numerical value in sq ft."
          />

          {isResidential ? (
            <>
              <Input
                label="Bedrooms (BHK)"
                placeholder="e.g. 3"
                value={formData.bedrooms}
                onChange={(e) => onChange('bedrooms', e.target.value.replace(/\D/g, ''))}
                error={errors.bedrooms}
                hint="Number of bedrooms (0 for Studio)."
              />

              <Input
                label="Bathrooms"
                placeholder="e.g. 2 or 2.5"
                value={formData.bathrooms}
                onChange={(e) => onChange('bathrooms', e.target.value)}
                error={errors.bathrooms}
                hint="Total bathrooms available."
              />
            </>
          ) : (
            <div className="sm:col-span-2 flex items-center text-xs text-[#6B7280] bg-gray-50 rounded-xl px-4 py-3 border border-[#E5E7EB]">
              Bedrooms and bathrooms are omitted for commercial category assets.
            </div>
          )}
        </div>
      </div>

      {/* 2. Furnishing & Parking */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
          Furnishing & Parking
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Furnishing Status"
            options={FURNISHING_OPTIONS}
            value={formData.furnishing_status}
            onChange={(e) => onChange('furnishing_status', e.target.value as FurnishingStatus)}
            error={errors.furnishing_status}
          />

          <Input
            label="Parking Spaces"
            placeholder="e.g. 1 or 2"
            value={formData.parking_spaces}
            onChange={(e) => onChange('parking_spaces', e.target.value.replace(/\D/g, ''))}
            error={errors.parking_spaces}
            hint="Number of dedicated vehicle slots."
          />
        </div>

        <Input
          label="Parking Details"
          placeholder="e.g. 1 Covered car slot in basement B2, slot #14"
          value={formData.parking_details}
          onChange={(e) => onChange('parking_details', e.target.value)}
          error={errors.parking_details}
        />
      </div>

      {/* 3. Amenities Selection */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
              Amenities Catalogue
            </h3>
            <p className="text-xs text-[#6B7280]">
              Select all available amenities installed or accessible at this property asset.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#408A71] bg-[#408A71]/10 px-2.5 py-1 rounded-full">
            {formData.amenity_ids.length} selected
          </span>
        </div>

        {/* Loading Skeletons */}
        {loadingAmenities && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} shape="rectangular" height={52} className="rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty Catalogue Warning */}
        {!loadingAmenities && amenities.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-xs text-[#6B7280]">
            No master amenities are currently listed in the catalogue.
          </div>
        )}

        {/* Grouped Amenities */}
        {!loadingAmenities && amenities.length > 0 && (
          <div className="space-y-5">
            {Object.entries(groupedAmenities).map(([catKey, items]) => (
              <div key={catKey} className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  {CATEGORY_TITLES[catKey] || catKey.replace('_', ' ')}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {items.map((amenity) => {
                    const isChecked = formData.amenity_ids.includes(amenity.id)

                    return (
                      <div
                        key={amenity.id}
                        onClick={() => handleToggleAmenity(amenity.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-[#408A71] bg-[#408A71]/5 text-[#111827] font-semibold'
                            : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:border-gray-300'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onChange={() => {}} // Handled by container onClick
                          className="pointer-events-none"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{amenity.name}</span>
                          {amenity.description && (
                            <span className="text-[10px] text-gray-400 font-normal truncate">
                              {amenity.description}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Step3Details

