import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import { OWNER_PROPERTIES_QUERY_KEY } from '../../hooks/useOwnerProperties'
import { propertyService } from '../../services/property.service'
import type {
  AmenityItem,
  CreatePropertyPayload,
  FurnishingStatus,
  PropertyCategory,
} from '../../types/property'
import { PropertyMapPreview } from '../../components/owner/PropertyMapPreview'

export interface ImageEntry {
  image_url: string
  caption: string
  is_primary: boolean
}

// Approved DBML Property Types
const RESIDENTIAL_OPTIONS = [
  { value: 'independent_house', label: 'Independent House' },
  { value: 'villa', label: 'Villa' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'studio_apartment', label: 'Studio Apartment' },
  { value: 'other', label: 'Other' },
]

const COMMERCIAL_OPTIONS = [
  { value: 'office', label: 'Office' },
  { value: 'shop', label: 'Shop' },
  { value: 'showroom', label: 'Showroom' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'other', label: 'Other' },
]

// Fallback standard amenities grouped by display categories
const FALLBACK_AMENITIES: { id: string; name: string; group: string }[] = [
  // General & Interior
  { id: 'wifi', name: 'Wi-Fi', group: 'GENERAL & INTERIOR' },
  { id: 'ac', name: 'AC', group: 'GENERAL & INTERIOR' },
  { id: 'pool', name: 'Pool', group: 'GENERAL & INTERIOR' },
  { id: 'gym', name: 'Gym', group: 'GENERAL & INTERIOR' },
  { id: 'elevator', name: 'Elevator', group: 'GENERAL & INTERIOR' },
  // Safety & Security
  { id: 'cctv', name: 'CCTV', group: 'SAFETY & SECURITY' },
  { id: 'security-247', name: '24/7 Security', group: 'SAFETY & SECURITY' },
  { id: 'intercom', name: 'Intercom', group: 'SAFETY & SECURITY' },
  { id: 'fire-alarm', name: 'Fire Alarm', group: 'SAFETY & SECURITY' },
  // Other Features
  { id: 'pet-friendly', name: 'Pet Friendly', group: 'OTHER FEATURES' },
  { id: 'garden', name: 'Garden', group: 'OTHER FEATURES' },
]

export const AddPropertyWizardPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refreshProfile } = useAuth()

  // Master amenities catalogue query
  const { data: amenitiesCatalogue = [] } = useQuery<AmenityItem[]>({
    queryKey: ['amenities-catalogue'],
    queryFn: () => propertyService.getAmenities(),
    staleTime: 1000 * 60 * 10,
  })

  // Submission & validation state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [geoLocating, setGeoLocating] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<PropertyCategory>('residential')
  const [propertyType, setPropertyType] = useState('apartment')
  const [builtUpArea, setBuiltUpArea] = useState('')
  const [description, setDescription] = useState('')

  // Details
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [furnishingStatus, setFurnishingStatus] = useState<FurnishingStatus>('unfurnished')
  const [parkingDetails, setParkingDetails] = useState('')

  // Amenities
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([])

  // Location
  const [searchLocation, setSearchLocation] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [locality, setLocality] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [state, setState] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  // Images state (clean initial state with zero sample images)
  const [images, setImages] = useState<ImageEntry[]>([])

  // New Image URL input state
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [imageCaptionInput, setImageCaptionInput] = useState('')

  // Map amenities into groups
  const amenityGroups = React.useMemo(() => {
    if (amenitiesCatalogue && amenitiesCatalogue.length > 0) {
      const groups: Record<string, { id: string; name: string }[]> = {
        'GENERAL & INTERIOR': [],
        'SAFETY & SECURITY': [],
        'OTHER FEATURES': [],
      }

      amenitiesCatalogue.forEach((item) => {
        const cat = (item.category || '').toLowerCase()
        if (['building', 'appliance', 'hvac', 'connectivity'].includes(cat)) {
          groups['GENERAL & INTERIOR'].push({ id: item.id, name: item.name })
        } else if (['safety', 'power_backup', 'accessibility'].includes(cat)) {
          groups['SAFETY & SECURITY'].push({ id: item.id, name: item.name })
        } else {
          groups['OTHER FEATURES'].push({ id: item.id, name: item.name })
        }
      })

      // If any group has items, return it
      const hasItems = Object.values(groups).some((arr) => arr.length > 0)
      if (hasItems) return groups
    }

    // Fallback standard groups matching screenshot
    const fallbackGroups: Record<string, { id: string; name: string }[]> = {
      'GENERAL & INTERIOR': [],
      'SAFETY & SECURITY': [],
      'OTHER FEATURES': [],
    }
    FALLBACK_AMENITIES.forEach((item) => {
      fallbackGroups[item.group].push({ id: item.id, name: item.name })
    })
    return fallbackGroups
  }, [amenitiesCatalogue])

  // Handlers
  const handleCategoryChange = (newCat: PropertyCategory) => {
    setCategory(newCat)
    if (newCat === 'residential') {
      setPropertyType('apartment')
    } else {
      setPropertyType('office')
    }
  }

  const handleToggleAmenity = (id: string) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleFetchCurrentPosition = () => {
    if (!navigator.geolocation) {
      setApiError('Geolocation is not supported by your browser.')
      return
    }

    setGeoLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6))
        setLongitude(pos.coords.longitude.toFixed(6))
        setGeoLocating(false)
        setLocationConfirmed(true)
      },
      (err) => {
        setGeoLocating(false)
        setApiError(`Could not fetch location coordinates: ${err.message}`)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const handleAddImageUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanUrl = imageUrlInput.trim()
    if (!cleanUrl) return

    const isFirst = images.length === 0
    setImages((prev) => [
      ...prev,
      {
        image_url: cleanUrl,
        caption: imageCaptionInput.trim(),
        is_primary: isFirst,
      },
    ])
    setImageUrlInput('')
    setImageCaptionInput('')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        if (result) {
          setImages((prev) => [
            ...prev,
            {
              image_url: result,
              caption: file.name.replace(/\.[^/.]+$/, ''),
              is_primary: prev.length === 0,
            },
          ])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSetPrimaryImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        is_primary: i === index,
      }))
    )
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const filtered = prev.filter((_, i) => i !== index)
      if (filtered.length > 0 && !filtered.some((img) => img.is_primary)) {
        filtered[0].is_primary = true
      }
      return filtered
    })
  }

  const handleGenerateAiDescription = () => {
    setAiGenerating(true)
    setTimeout(() => {
      const catLabel = category === 'residential' ? 'residential' : 'commercial'
      const areaText = builtUpArea ? `${builtUpArea} sq. ft.` : 'generously proportioned'
      const generated = `Exceptional ${catLabel} opportunity featuring a modern ${propertyType.replace('_', ' ')} spanning ${areaText}. Thoughtfully designed with superior natural illumination, premium interior finishes, and direct access to essential neighborhood hubs and major arterial transport links.`
      setDescription(generated)
      setAiGenerating(false)
    }, 600)
  }

  // Parse total parking spaces from parkingDetails
  const computeParkingSpaces = (str: string): number => {
    const matches = str.match(/\d+/g)
    if (matches && matches.length > 0) {
      return matches.reduce((acc, curr) => acc + parseInt(curr, 10), 0)
    }
    return 0
  }

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!title.trim()) {
      errors.title = 'Property title is required.'
    } else if (title.trim().length < 3) {
      errors.title = 'Property title must be at least 3 characters.'
    }

    if (!propertyType) {
      errors.property_type = 'Please select a property type.'
    }

    if (!addressLine1.trim()) {
      errors.address_line_1 = 'Address line 1 is required.'
    }
    if (!locality.trim()) {
      errors.locality = 'Locality is required.'
    }
    if (!city.trim()) {
      errors.city = 'City is required.'
    }
    if (!district.trim()) {
      errors.district = 'District is required.'
    }
    if (!state.trim()) {
      errors.state = 'State is required.'
    }
    if (!pinCode.trim()) {
      errors.pin_code = 'PIN code is required.'
    }

    if (builtUpArea.trim()) {
      const area = parseFloat(builtUpArea)
      if (isNaN(area) || area <= 0) {
        errors.built_up_area = 'Built-up area must be greater than zero.'
      }
    }

    // Coordinates cross-field check
    const hasLat = Boolean(latitude.trim())
    const hasLng = Boolean(longitude.trim())
    if (hasLat !== hasLng) {
      errors.coordinates = 'Both latitude and longitude must be provided, or both left blank.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Form Submission
  const handleSubmit = async () => {
    if (isSubmitting) return

    setApiError(null)
    setFieldErrors({})

    if (!validateForm()) {
      setApiError('Please fill in all required fields marked in red.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Prepare creation payload strictly matching backend PropertyCreateSerializer
      // Map valid UUIDs for amenities (only UUIDs are accepted by backend)
      const validAmenityUuids = selectedAmenityIds.filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      )

      const payload: CreatePropertyPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        property_type: propertyType,
        address_line_1: addressLine1.trim(),
        address_line_2: addressLine2.trim() || undefined,
        locality: locality.trim(),
        city: city.trim(),
        district: district.trim(),
        state: state.trim(),
        pin_code: pinCode.trim(),
        country_code: 'IN',
        latitude: latitude.trim() || null,
        longitude: longitude.trim() || null,
        built_up_area: builtUpArea.trim() ? parseFloat(builtUpArea) : null,
        bedrooms: category === 'residential' && bedrooms.trim() ? parseInt(bedrooms, 10) : null,
        bathrooms: category === 'residential' && bathrooms.trim() ? parseFloat(bathrooms) : null,
        furnishing_status: furnishingStatus,
        parking_spaces: computeParkingSpaces(parkingDetails),
        parking_details: parkingDetails.trim() || undefined,
        amenity_ids: validAmenityUuids.length > 0 ? validAmenityUuids : undefined,
      }

      // 2. POST /api/v1/properties/
      const createResponse = await propertyService.createProperty(payload)
      const createdPropertyId = createResponse.data?.id

      // 3. Attach gallery images via POST /api/v1/properties/{id}/images/
      if (createdPropertyId && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const img = images[i]
          // Only send valid URLs over network (ignore local base64 if not accepted)
          if (img.image_url.startsWith('http://') || img.image_url.startsWith('https://')) {
            try {
              await propertyService.addPropertyImage(createdPropertyId, {
                image_url: img.image_url.trim(),
                caption: img.caption.trim() || undefined,
                display_order: i,
                is_primary: img.is_primary,
              })
            } catch {
              // Non-critical image attachment failure shouldn't abort property creation
            }
          }
        }
      }

      // 4. Invalidate React Query cache for properties
      await queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })

      // 5. Refresh user session so newly activated is_owner capability is reflected
      await refreshProfile()

      // 6. Navigate to Owner Dashboard or Properties
      navigate('/app/owner/dashboard', { replace: true })
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        const errorData = err.response.data
        const message = errorData.message || 'Failed to create property. Please review your input.'

        if (errorData.errors && typeof errorData.errors === 'object') {
          const mapped: Record<string, string> = {}
          for (const [key, val] of Object.entries(errorData.errors)) {
            if (Array.isArray(val) && val.length > 0) {
              mapped[key] = String(val[0])
            } else if (typeof val === 'string') {
              mapped[key] = val
            }
          }
          setFieldErrors(mapped)
        }

        setApiError(message)
      } else {
        setApiError('A network error occurred. Please check your connection and try again.')
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Display summary address
  const fullAddressSummary = [addressLine1, locality, city, district, state, pinCode]
    .filter(Boolean)
    .join(', ')

  const hasAddress = Boolean(fullAddressSummary.trim())

  const latNum = parseFloat(latitude)
  const lngNum = parseFloat(longitude)
  const hasCoordinates = !isNaN(latNum) && !isNaN(lngNum)

  const formattedLat = hasCoordinates
    ? `${Math.abs(latNum).toFixed(4)}° ${latNum >= 0 ? 'N' : 'S'}`
    : '--'
  const formattedLng = hasCoordinates
    ? `${Math.abs(lngNum).toFixed(4)}° ${lngNum >= 0 ? 'E' : 'W'}`
    : '--'

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
            Add New Property
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
            Complete the details below to list your property on the portal.
          </p>
        </div>

        {/* Top-Right Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            to="/app/owner/properties"
            className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg transition-colors shadow-2xs"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-medium text-white bg-[#408A71] hover:bg-[#34745C] disabled:bg-[#408A71]/60 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <span className="text-base leading-none font-bold">+</span>
                Save Property
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Error Alert Banner */}
      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="font-semibold">{apiError}</p>
          </div>
        </div>
      )}

      {/* CARD 1: Basic Information */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xs p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#408A71]/10 text-[#408A71] flex items-center justify-center shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-[#111827]">
            Basic Information
          </h2>
        </div>

        {/* Property Title */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#374151]">
            Property Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Modern Villa in Sunset Valley"
            className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all ${
              fieldErrors.title ? 'border-red-400 bg-red-50/20' : 'border-[#D1D5DB]'
            }`}
          />
          {fieldErrors.title && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.title}</p>
          )}
        </div>

        {/* Category & Property Type Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Property Category */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#374151]">
              Property Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 p-1 bg-[#F3F4F6] rounded-lg border border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => handleCategoryChange('residential')}
                className={`py-2 text-xs sm:text-sm font-medium rounded-md transition-all cursor-pointer ${
                  category === 'residential'
                    ? 'bg-white text-[#408A71] shadow-2xs font-semibold border border-[#D1E7DD]'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                Residential
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('commercial')}
                className={`py-2 text-xs sm:text-sm font-medium rounded-md transition-all cursor-pointer ${
                  category === 'commercial'
                    ? 'bg-white text-[#408A71] shadow-2xs font-semibold border border-[#D1E7DD]'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                Commercial
              </button>
            </div>
          </div>

          {/* Property Type Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#374151]">
              Property Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all cursor-pointer"
              >
                {(category === 'residential' ? RESIDENTIAL_OPTIONS : COMMERCIAL_OPTIONS).map(
                  (opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  )
                )}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <svg
                  className="w-4 h-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Built-up Area */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#374151]">
            Built-up Area
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              value={builtUpArea}
              onChange={(e) => setBuiltUpArea(e.target.value)}
              placeholder="0.00"
              className={`w-full pr-16 px-3.5 py-2.5 bg-white border rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all ${
                fieldErrors.built_up_area ? 'border-red-400 bg-red-50/20' : 'border-[#D1D5DB]'
              }`}
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#6B7280] pointer-events-none">
              Sq. Ft.
            </div>
          </div>
          {fieldErrors.built_up_area && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.built_up_area}</p>
          )}
        </div>

        {/* Description with AI generation option */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-semibold text-[#374151]">
                Description
              </label>
              <p className="text-[11px] text-[#6B7280]">
                Craft a compelling story for your property to attract tenants.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateAiDescription}
              disabled={aiGenerating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#408A71] bg-[#408A71]/10 hover:bg-[#408A71]/20 rounded-md transition-colors cursor-pointer"
            >
              <span className="text-sm">✨</span>
              {aiGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the property's unique features, neighborhood, proximity to services, etc."
            className="w-full px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all"
          />
        </div>
      </section>

      {/* TWO-COLUMN ROW: Property Details (Left) & Amenities (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* CARD 2: Property Details */}
        <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xs p-5 sm:p-6 space-y-5 h-full">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#408A71]/10 text-[#408A71] flex items-center justify-center shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-[#111827]">
              Property Details
            </h2>
          </div>

          {/* Bedrooms & Bathrooms */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#374151]">
                Bedrooms
              </label>
              <input
                type="number"
                min="0"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                placeholder="3"
                className="w-full px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#374151]">
                Bathrooms
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                placeholder="2"
                className="w-full px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all"
              />
            </div>
          </div>

          {/* Furnishing Status */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#374151]">
              Furnishing Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'fully_furnished', label: 'Fully Furnished' },
                  { value: 'semi_furnished', label: 'Semi-Furnished' },
                  { value: 'unfurnished', label: 'Unfurnished' },
                ] as const
              ).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFurnishingStatus(f.value)}
                  className={`py-2 px-1 text-center text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                    furnishingStatus === f.value
                      ? 'border-[#408A71] bg-[#408A71]/10 text-[#408A71] font-semibold ring-1 ring-[#408A71]'
                      : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parking Details */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#374151]">
              Parking Details
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.9 2 11v5c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" />
                  <path d="M9 17h6" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
              </div>
              <input
                type="text"
                value={parkingDetails}
                onChange={(e) => setParkingDetails(e.target.value)}
                placeholder="e.g. 2 Covered, 1 Open"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all"
              />
            </div>
          </div>
        </section>

        {/* CARD 3: Amenities */}
        <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xs p-5 sm:p-6 space-y-5 h-full">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#408A71]/10 text-[#408A71] flex items-center justify-center shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-[#111827]">
              Amenities
            </h2>
          </div>

          {/* Grouped Amenities Chips */}
          <div className="space-y-4">
            {Object.entries(amenityGroups).map(([groupTitle, items]) => {
              if (items.length === 0) return null
              return (
                <div key={groupTitle} className="space-y-2">
                  <h3 className="text-[11px] font-bold text-[#6B7280] tracking-wider uppercase">
                    {groupTitle}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => {
                      const isSelected = selectedAmenityIds.includes(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleToggleAmenity(item.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#408A71] bg-[#408A71]/10 text-[#408A71] font-semibold ring-1 ring-[#408A71]'
                              : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]'
                          }`}
                        >
                          {item.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* CARD 4: Location (2-Column inside: Form on left, Map on right) */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xs p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#408A71]/10 text-[#408A71] flex items-center justify-center shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-[#111827]">
            Location
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Search & Address Summary */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search Location Bar */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#374151]">
                Search Location
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none">
                  <svg
                    className="w-4 h-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  placeholder="e.g. Mavoor Road, Kozhikode, Kerala 673016"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 focus:border-[#408A71] transition-all"
                />
              </div>
            </div>

            {/* Structured Address Fields */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. Door No. 4/120, Mavoor Road"
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-1 focus:ring-[#408A71] ${
                    fieldErrors.address_line_1 ? 'border-red-400' : 'border-[#D1D5DB]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Locality <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Palayam / Arayidathupalam"
                    className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-1 focus:ring-[#408A71]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Kozhikode"
                    className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-1 focus:ring-[#408A71]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    District <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Kozhikode"
                    className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-1 focus:ring-[#408A71]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Kerala"
                    className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-1 focus:ring-[#408A71]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    PIN Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="e.g. 673016"
                    className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-1 focus:ring-[#408A71]"
                  />
                </div>
              </div>
            </div>

            {/* SELECTED ADDRESS Box */}
            <div className="bg-[#EBF5F1] border border-[#C5E8DC] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#408A71] tracking-wider uppercase">
                  Selected Address
                </span>
                <button
                  type="button"
                  onClick={handleFetchCurrentPosition}
                  disabled={geoLocating}
                  className="text-[11px] text-[#408A71] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>📍</span>
                  {geoLocating ? 'Detecting...' : 'Detect GPS'}
                </button>
              </div>

              {hasAddress ? (
                <p className="text-xs text-[#111827] leading-relaxed font-semibold">
                  {fullAddressSummary}
                </p>
              ) : (
                <p className="text-xs text-[#6B7280] italic leading-relaxed">
                  No address entered yet. Enter street address, locality, and city above or use GPS detection.
                </p>
              )}

              <div className="flex items-center gap-4 text-[11px] text-[#4B5563]">
                <div>
                  <span className="font-semibold text-gray-500 uppercase tracking-wider">
                    Latitude:{' '}
                  </span>
                  <span className="font-mono text-[#111827]">{formattedLat}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-500 uppercase tracking-wider">
                    Longitude:{' '}
                  </span>
                  <span className="font-mono text-[#111827]">{formattedLng}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLocationConfirmed(true)}
                className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  locationConfirmed
                    ? 'bg-[#34745C] text-white'
                    : 'bg-[#408A71] hover:bg-[#34745C] text-white'
                }`}
              >
                {locationConfirmed ? (
                  <>
                    <span>✓</span> Location Confirmed
                  </>
                ) : (
                  'Confirm Location'
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Isolated Map Preview */}
          <div className="lg:col-span-7">
            <PropertyMapPreview
              latitude={latitude}
              longitude={longitude}
              onCoordinateChange={(newLat, newLng) => {
                setLatitude(newLat)
                setLongitude(newLng)
              }}
              addressSummary={fullAddressSummary}
            />
          </div>
        </div>
      </section>

      {/* CARD 5: Rental Details (Preview Only - Disabled) */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#408A71]/10 text-[#408A71] flex items-center justify-center shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-[#111827]">
              Rental Details
            </h2>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium rounded-md">
            <span>ℹ️</span> Coming with Listing Setup
          </div>
        </div>

        <p className="text-xs text-[#6B7280]">
          Physical properties are catalogued separately from rental listings. Monthly rent, deposit, and lease availability are configured when publishing a listing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Monthly Rent */}
          <div className="space-y-1.5 opacity-75">
            <label className="block text-xs font-semibold text-[#6B7280]">
              Monthly Rent ($)
            </label>
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder="0.00"
                className="w-full pr-16 px-3.5 py-2.5 bg-gray-50 border border-[#E5E7EB] rounded-lg text-sm text-gray-500 cursor-not-allowed"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                / month
              </div>
            </div>
          </div>

          {/* Security Deposit */}
          <div className="space-y-1.5 opacity-75">
            <label className="block text-xs font-semibold text-[#6B7280]">
              Security Deposit ($)
            </label>
            <input
              type="text"
              disabled
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-[#E5E7EB] rounded-lg text-sm text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Available From */}
          <div className="space-y-1.5 opacity-75">
            <label className="block text-xs font-semibold text-[#6B7280]">
              Available from
            </label>
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder="mm/dd/yyyy"
                className="w-full pr-10 px-3.5 py-2.5 bg-gray-50 border border-[#E5E7EB] rounded-lg text-sm text-gray-500 cursor-not-allowed"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <svg
                  className="w-4 h-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CARD 6: Property Media */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xs p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#408A71]/10 text-[#408A71] flex items-center justify-center shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-[#111827]">
            Property Media
          </h2>
        </div>

        {/* Drag and drop upload target area */}
        <label className="border-2 border-dashed border-[#D1D5DB] hover:border-[#408A71] bg-[#F9FAFB] hover:bg-[#EBF5F1]/30 rounded-xl p-8 text-center transition-all cursor-pointer block">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <div className="w-12 h-12 mx-auto rounded-full bg-[#408A71]/10 text-[#408A71] flex items-center justify-center mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m16 16-4-4-4 4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#111827]">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            PNG, JPG or WEBP (MAX. 10MB)
          </p>
        </label>

        {/* Or add by Image URL row */}
        <div className="p-3.5 bg-gray-50 rounded-xl border border-[#E5E7EB] space-y-2">
          <span className="text-xs font-semibold text-gray-700">Or add by Image URL:</span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="https://example.com/property-photo.jpg"
              className="flex-1 px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-1 focus:ring-[#408A71]"
            />
            <input
              type="text"
              value={imageCaptionInput}
              onChange={(e) => setImageCaptionInput(e.target.value)}
              placeholder="Caption (e.g. Master Bedroom)"
              className="sm:w-48 px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-xs text-[#111827] focus:outline-hidden focus:ring-1 focus:ring-[#408A71]"
            />
            <button
              type="button"
              onClick={handleAddImageUrl}
              className="px-3.5 py-2 bg-[#408A71] hover:bg-[#34745C] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              + Add Image
            </button>
          </div>
        </div>

        {/* Gallery Thumbnails Row */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="group relative aspect-4/3 rounded-lg overflow-hidden border border-[#E5E7EB] bg-gray-100 shadow-2xs"
              >
                <img
                  src={img.image_url}
                  alt={img.caption || `Property image ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Primary Badge */}
                {img.is_primary && (
                  <div className="absolute top-2 left-2 bg-[#408A71] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs tracking-wider">
                    PRIMARY
                  </div>
                )}

                {/* Caption Banner */}
                {img.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate pointer-events-none">
                    {img.caption}
                  </div>
                )}

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="p-1 rounded bg-white/90 text-red-600 hover:bg-white transition-colors cursor-pointer"
                      title="Remove image"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>

                  {!img.is_primary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryImage(idx)}
                      className="w-full py-1 text-[10px] font-semibold bg-white/95 text-[#408A71] hover:bg-white rounded transition-colors text-center cursor-pointer"
                    >
                      Set Primary
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Quick Add More Card */}
            <label className="aspect-4/3 rounded-lg border-2 border-dashed border-[#D1D5DB] hover:border-[#408A71] flex flex-col items-center justify-center text-gray-400 hover:text-[#408A71] transition-colors cursor-pointer bg-gray-50/50">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-xl font-bold">+</span>
              <span className="text-[10px] font-medium">Add more</span>
            </label>
          </div>
        )}
      </section>

      {/* Page Footer */}
      <footer className="pt-6 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
        <p>&copy; 2024 PropTech Solutions Inc. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-[#111827] transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-[#111827] transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-[#111827] transition-colors">
            Cookie Policy
          </a>
        </div>
      </footer>
    </div>
  )
}

export default AddPropertyWizardPage
