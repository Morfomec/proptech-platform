import React from 'react'
import type { PropertyCategory } from '../../../types/property'
import { FormSection } from './FormSection'
import { FormField } from './FormField'

export interface PropertyBasicsSectionProps {
  title: string
  onTitleChange: (val: string) => void
  category: PropertyCategory
  onCategoryChange: (cat: PropertyCategory) => void
  propertyType: string
  onPropertyTypeChange: (val: string) => void
  builtUpArea: string
  onBuiltUpAreaChange: (val: string) => void
  description: string
  onDescriptionChange: (val: string) => void
  fieldErrors: Record<string, string>
}

const RESIDENTIAL_OPTIONS = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'independent_house', label: 'Independent House' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio_apartment', label: 'Studio Apartment' },
  { value: 'other', label: 'Other Residential' },
]

const COMMERCIAL_OPTIONS = [
  { value: 'office', label: 'Commercial Office' },
  { value: 'shop', label: 'Retail Shop' },
  { value: 'showroom', label: 'Showroom' },
  { value: 'warehouse', label: 'Warehouse / Godown' },
  { value: 'other', label: 'Other Commercial' },
]

export const PropertyBasicsSection: React.FC<PropertyBasicsSectionProps> = ({
  title,
  onTitleChange,
  category,
  onCategoryChange,
  propertyType,
  onPropertyTypeChange,
  builtUpArea,
  onBuiltUpAreaChange,
  description,
  onDescriptionChange,
  fieldErrors,
}) => {
  const currentTypeOptions = category === 'residential' ? RESIDENTIAL_OPTIONS : COMMERCIAL_OPTIONS

  return (
    <FormSection
      title="Basic Information"
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      }
    >
      <div className="space-y-4">
        {/* Property Title */}
        <FormField label="Property Title" required error={fieldErrors.title}>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Modern 3-BHK Apartment with Balcony"
            className={`h-[42px] w-full px-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
              fieldErrors.title
                ? 'border-red-400 focus:ring-red-200'
                : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
            }`}
          />
        </FormField>

        {/* Balanced 3-Column Row: Category, Property Type, Built-up Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Category Selector Tabs */}
          <FormField label="Property Category" required error={fieldErrors.category}>
            <div className="h-[42px] grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => onCategoryChange('residential')}
                className={`h-full flex items-center justify-center rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  category === 'residential'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Residential
              </button>
              <button
                type="button"
                onClick={() => onCategoryChange('commercial')}
                className={`h-full flex items-center justify-center rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  category === 'commercial'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Commercial
              </button>
            </div>
          </FormField>

          {/* Property Type Dropdown */}
          <FormField label="Property Type" required error={fieldErrors.property_type}>
            <select
              value={propertyType}
              onChange={(e) => onPropertyTypeChange(e.target.value)}
              className="h-[42px] w-full px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-hidden focus:border-[#408A71] focus:ring-1 focus:ring-[#408A71] transition-all cursor-pointer"
            >
              {currentTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Built-up Area */}
          <FormField label="Built-up Area" error={fieldErrors.built_up_area}>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={builtUpArea}
                onChange={(e) => onBuiltUpAreaChange(e.target.value)}
                placeholder="e.g. 1450"
                className={`h-[42px] w-full pl-3.5 pr-14 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                  fieldErrors.built_up_area
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                Sq. Ft.
              </span>
            </div>
          </FormField>
        </div>

        {/* Description */}
        <FormField label="Description" error={fieldErrors.description}>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe the property's key features, location highlights, and amenities..."
            className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:border-[#408A71] focus:ring-1 focus:ring-[#408A71] transition-all resize-none"
          />
        </FormField>
      </div>
    </FormSection>
  )
}

export default PropertyBasicsSection
