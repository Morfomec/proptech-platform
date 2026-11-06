import React from 'react'
import type { PropertyCategory } from '../../../types/property'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Select, type SelectOption } from '../../ui/select'

export interface Step1FormData {
  title: string
  description: string
  category: PropertyCategory
  property_type: string
}

export interface Step1Props {
  formData: Step1FormData
  errors: Record<string, string>
  onChange: (field: keyof Step1FormData, value: string) => void
}

const RESIDENTIAL_OPTIONS: SelectOption[] = [
  { label: 'Independent House', value: 'independent_house' },
  { label: 'Villa', value: 'villa' },
  { label: 'Apartment', value: 'apartment' },
  { label: 'Studio Apartment', value: 'studio_apartment' },
  { label: 'Other', value: 'other' },
]

const COMMERCIAL_OPTIONS: SelectOption[] = [
  { label: 'Office', value: 'office' },
  { label: 'Shop', value: 'shop' },
  { label: 'Showroom', value: 'showroom' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Other', value: 'other' },
]

export const Step1BasicInfo: React.FC<Step1Props> = ({ formData, errors, onChange }) => {
  const propertyTypeOptions =
    formData.category === 'residential' ? RESIDENTIAL_OPTIONS : COMMERCIAL_OPTIONS

  const handleCategoryChange = (cat: PropertyCategory) => {
    onChange('category', cat)
    // Automatically select the first appropriate property type for the new category
    const defaultType = cat === 'residential' ? 'independent_house' : 'office'
    onChange('property_type', defaultType)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Basic Information</h2>
        <p className="text-xs text-[#6B7280] mt-0.5">
          Specify the core title, category, and classification for this property asset.
        </p>
      </div>

      {/* Category Selection */}
      <div className="space-y-2">
        <label className="block text-xs sm:text-sm font-medium text-[#111827]">
          Property Category <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Residential Card */}
          <div
            onClick={() => handleCategoryChange('residential')}
            className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              formData.category === 'residential'
                ? 'border-[#408A71] bg-[#408A71]/5 shadow-xs'
                : 'border-[#E5E7EB] bg-white hover:border-gray-300'
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                formData.category === 'residential'
                  ? 'bg-[#408A71] text-white'
                  : 'bg-gray-100 text-[#6B7280]'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-[#111827]">Residential</div>
              <div className="text-xs text-[#6B7280] mt-0.5">
                Houses, apartments, studios, and residential living spaces.
              </div>
            </div>
          </div>

          {/* Commercial Card */}
          <div
            onClick={() => handleCategoryChange('commercial')}
            className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              formData.category === 'commercial'
                ? 'border-[#408A71] bg-[#408A71]/5 shadow-xs'
                : 'border-[#E5E7EB] bg-white hover:border-gray-300'
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                formData.category === 'commercial'
                  ? 'bg-[#408A71] text-white'
                  : 'bg-gray-100 text-[#6B7280]'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01" />
                <path d="M16 6h.01" />
                <path d="M12 6h.01" />
                <path d="M12 10h.01" />
                <path d="M12 14h.01" />
                <path d="M16 10h.01" />
                <path d="M16 14h.01" />
                <path d="M8 10h.01" />
                <path d="M8 14h.01" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-[#111827]">Commercial</div>
              <div className="text-xs text-[#6B7280] mt-0.5">
                Office spaces, retail shops, showrooms, and warehouses.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Property Type Dropdown (Dynamically populated based on category) */}
      <Select
        label="Property Type"
        options={propertyTypeOptions}
        value={formData.property_type}
        onChange={(e) => onChange('property_type', e.target.value)}
        error={errors.property_type}
        required
      />

      {/* Property Title */}
      <Input
        label="Property Title"
        placeholder="e.g. Skyline Heights 3BHK Penthouse"
        value={formData.title}
        onChange={(e) => onChange('title', e.target.value)}
        error={errors.title}
        hint="Give your property a distinct, recognizable title (3–255 characters)."
        required
      />

      {/* Description */}
      <Textarea
        label="Description"
        placeholder="Provide a detailed overview of the property, prominent features, nearby landmarks, or highlights..."
        value={formData.description}
        onChange={(e) => onChange('description', e.target.value)}
        error={errors.description}
        rows={4}
        hint="Optional. Markdown or plain descriptive text about the unit."
      />
    </div>
  )
}

export default Step1BasicInfo

