import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { propertyService } from '../../services/property.service'
import type {
  AmenityItem,
  FurnishingStatus,
  PropertyDetail,
  UpdatePropertyPayload,
} from '../../types/property'
import { OWNER_PROPERTIES_QUERY_KEY } from '../../hooks/useOwnerProperties'

// Wizard Step Components
import { StepIndicator } from '../../components/owner/wizard/StepIndicator'
import { Step1BasicInfo, type Step1FormData } from '../../components/owner/wizard/Step1BasicInfo'
import { Step2Location, type Step2FormData } from '../../components/owner/wizard/Step2Location'
import { Step3Details, type Step3FormData } from '../../components/owner/wizard/Step3Details'
import { Step4PhotosReview, type ImageEntry } from '../../components/owner/wizard/Step4PhotosReview'

import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Skeleton } from '../../components/ui/skeleton'

const WIZARD_STEPS = [
  { number: 1, title: 'Basic Info', subtitle: 'Title & category' },
  { number: 2, title: 'Location', subtitle: 'Address & GPS' },
  { number: 3, title: 'Details', subtitle: 'Specs & amenities' },
  { number: 4, title: 'Photos & Review', subtitle: 'Gallery & save' },
]

interface EditPropertyFormProps {
  property: PropertyDetail
  amenitiesCatalogue: AmenityItem[]
}

const EditPropertyForm: React.FC<EditPropertyFormProps> = ({
  property,
  amenitiesCatalogue,
}) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form Data State initialized synchronously from property prop
  const [step1Data, setStep1Data] = useState<Step1FormData>(() => ({
    title: property.title || '',
    description: property.description || '',
    category: property.category || 'residential',
    property_type: property.property_type || 'independent_house',
  }))

  const [step2Data, setStep2Data] = useState<Step2FormData>(() => ({
    address_line_1: property.address_line_1 || '',
    address_line_2: property.address_line_2 || '',
    landmark: property.landmark || '',
    locality: property.locality || '',
    city: property.city || '',
    district: property.district || '',
    state: property.state || '',
    pin_code: property.pin_code || '',
    country_code: property.country_code || 'IN',
    latitude: property.latitude ? String(property.latitude) : '',
    longitude: property.longitude ? String(property.longitude) : '',
  }))

  const [step3Data, setStep3Data] = useState<Step3FormData>(() => ({
    built_up_area: property.built_up_area ? String(property.built_up_area) : '',
    bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
    bathrooms: property.bathrooms != null ? String(property.bathrooms) : '',
    furnishing_status: (property.furnishing_status || 'unfurnished') as FurnishingStatus,
    parking_spaces: String(property.parking_spaces || 0),
    parking_details: property.parking_details || '',
    amenity_ids: property.amenities ? property.amenities.map((a) => a.id) : [],
  }))

  const [images, setImages] = useState<ImageEntry[]>(() =>
    property.images && property.images.length > 0
      ? property.images.map((img) => ({
          image_url: img.image_url,
          caption: img.caption || '',
          is_primary: img.is_primary,
        }))
      : []
  )

  // Change Handlers
  const handleStep1Change = (field: keyof Step1FormData, value: string) => {
    setStep1Data((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleStep2Change = (field: keyof Step2FormData, value: string) => {
    setStep2Data((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleStep3Change = (field: keyof Step3FormData, value: string | string[]) => {
    setStep3Data((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // Client Validation Step 1
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {}
    if (!step1Data.title.trim()) {
      errors.title = 'Title is required.'
    } else if (step1Data.title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters long.'
    } else if (step1Data.title.trim().length > 200) {
      errors.title = 'Title cannot exceed 200 characters.'
    }

    if (!step1Data.property_type) {
      errors.property_type = 'Please select a property type.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Client Validation Step 2
  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {}
    if (!step2Data.address_line_1.trim()) {
      errors.address_line_1 = 'Address line 1 is required.'
    }
    if (!step2Data.locality.trim()) {
      errors.locality = 'Locality is required.'
    }
    if (!step2Data.city.trim()) {
      errors.city = 'City is required.'
    }
    if (!step2Data.district.trim()) {
      errors.district = 'District is required.'
    }
    if (!step2Data.state.trim()) {
      errors.state = 'State is required.'
    }

    const pin = step2Data.pin_code.trim()
    if (!pin) {
      errors.pin_code = 'PIN code is required.'
    } else if (!/^\d{6}$/.test(pin)) {
      errors.pin_code = 'Indian PIN code must be exactly 6 digits.'
    }

    if (step2Data.latitude.trim() && isNaN(Number(step2Data.latitude))) {
      errors.latitude = 'Latitude must be a valid decimal number.'
    }
    if (step2Data.longitude.trim() && isNaN(Number(step2Data.longitude))) {
      errors.longitude = 'Longitude must be a valid decimal number.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Client Validation Step 3
  const validateStep3 = (): boolean => {
    const errors: Record<string, string> = {}

    if (step3Data.built_up_area.trim()) {
      const area = parseFloat(step3Data.built_up_area)
      if (isNaN(area) || area <= 0) {
        errors.built_up_area = 'Built-up area must be greater than zero.'
      }
    }

    if (step1Data.category === 'residential') {
      if (step3Data.bedrooms.trim()) {
        const beds = parseInt(step3Data.bedrooms, 10)
        if (isNaN(beds) || beds < 0) {
          errors.bedrooms = 'Bedrooms cannot be negative.'
        }
      }
      if (step3Data.bathrooms.trim()) {
        const baths = parseFloat(step3Data.bathrooms)
        if (isNaN(baths) || baths < 0) {
          errors.bathrooms = 'Bathrooms cannot be negative.'
        }
      }
    }

    if (step3Data.parking_spaces.trim()) {
      const park = parseInt(step3Data.parking_spaces, 10)
      if (isNaN(park) || park < 0) {
        errors.parking_spaces = 'Parking spaces cannot be negative.'
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Step Navigation
  const handleNext = () => {
    setApiError(null)
    if (currentStep === 1 && !validateStep1()) return
    if (currentStep === 2 && !validateStep2()) return
    if (currentStep === 3 && !validateStep3()) return

    setCurrentStep((prev) => Math.min(prev + 1, 4))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setApiError(null)
    setFieldErrors({})
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Save Changes
  const handleSubmit = async () => {
    if (isSubmitting) return

    setApiError(null)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      // 1. Prepare update payload matching backend PropertyUpdateSerializer
      // Do NOT send owner, owner_id, status, or role flags
      const payload: UpdatePropertyPayload = {
        title: step1Data.title.trim(),
        description: step1Data.description.trim() || undefined,
        category: step1Data.category,
        property_type: step1Data.property_type,
        address_line_1: step2Data.address_line_1.trim(),
        address_line_2: step2Data.address_line_2.trim() || undefined,
        landmark: step2Data.landmark.trim() || undefined,
        locality: step2Data.locality.trim(),
        city: step2Data.city.trim(),
        district: step2Data.district.trim(),
        state: step2Data.state.trim(),
        pin_code: step2Data.pin_code.trim(),
        country_code: step2Data.country_code || 'IN',
        latitude: step2Data.latitude.trim() || null,
        longitude: step2Data.longitude.trim() || null,
        built_up_area: step3Data.built_up_area.trim() ? parseFloat(step3Data.built_up_area) : null,
        bedrooms:
          step1Data.category === 'residential' && step3Data.bedrooms.trim()
            ? parseInt(step3Data.bedrooms, 10)
            : null,
        bathrooms:
          step1Data.category === 'residential' && step3Data.bathrooms.trim()
            ? parseFloat(step3Data.bathrooms)
            : null,
        furnishing_status: step3Data.furnishing_status as FurnishingStatus,
        parking_spaces: step3Data.parking_spaces.trim()
          ? parseInt(step3Data.parking_spaces, 10)
          : 0,
        parking_details: step3Data.parking_details.trim() || undefined,
        amenity_ids: step3Data.amenity_ids,
      }

      // 2. Send PATCH request to backend
      await propertyService.updateProperty(property.id, payload)

      // 3. Sync newly added images if any
      const existingUrls = new Set((property.images || []).map((img) => img.image_url))
      const newImages = images.filter((img) => !existingUrls.has(img.image_url))

      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i]
        try {
          await propertyService.addPropertyImage(property.id, {
            image_url: img.image_url.trim(),
            caption: img.caption.trim() || undefined,
            display_order: (property.images?.length || 0) + i,
            is_primary: img.is_primary,
          })
        } catch {
          // Non-critical image sync failure
        }
      }

      // 4. Invalidate React Query caches
      await queryClient.invalidateQueries({ queryKey: ['property', property.id] })
      await queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })

      // 5. Navigate to Property Details view
      navigate(`/app/owner/properties/${property.id}`, { replace: true })
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        const errorData = err.response.data
        const message = errorData.message || 'Failed to update property. Please review your input.'
        setApiError(message)

        if (errorData.errors && typeof errorData.errors === 'object') {
          const mappedErrors: Record<string, string> = {}
          Object.entries(errorData.errors).forEach(([key, val]) => {
            if (Array.isArray(val) && val.length > 0) {
              mappedErrors[key] = String(val[0])
            } else if (typeof val === 'string') {
              mappedErrors[key] = val
            }
          })
          setFieldErrors(mappedErrors)
        }
      } else {
        setApiError('An unexpected network error occurred while updating the property.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* 1. Header & Back Link */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link to="/app/owner/properties" className="hover:text-[#111827] transition-colors">
            My Properties
          </Link>
          <span>/</span>
          <Link
            to={`/app/owner/properties/${property.id}`}
            className="hover:text-[#111827] transition-colors truncate max-w-xs"
          >
            {property.title}
          </Link>
          <span>/</span>
          <span className="text-[#111827] font-medium">Edit</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">
          Edit Property: {property.title}
        </h1>
        <p className="text-xs text-[#6B7280]">
          Update details, address specifications, amenities, and gallery photos.
        </p>
      </div>

      {/* 2. Top Alert Banner for API Errors */}
      {apiError && (
        <Alert variant="error" title="Submission Error">
          {apiError}
        </Alert>
      )}

      {/* 3. Wizard Step Indicator */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs">
        <StepIndicator
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={(step) => {
            if (step < currentStep) setCurrentStep(step)
          }}
        />
      </div>

      {/* 4. Active Step Content Card */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs">
        {currentStep === 1 && (
          <Step1BasicInfo
            formData={step1Data}
            errors={fieldErrors}
            onChange={handleStep1Change}
          />
        )}

        {currentStep === 2 && (
          <Step2Location
            formData={step2Data}
            errors={fieldErrors}
            onChange={handleStep2Change}
          />
        )}

        {currentStep === 3 && (
          <Step3Details
            category={step1Data.category}
            formData={step3Data}
            errors={fieldErrors}
            onChange={handleStep3Change}
          />
        )}

        {currentStep === 4 && (
          <Step4PhotosReview
            step1={step1Data}
            step2={step2Data}
            step3={step3Data}
            images={images}
            amenitiesCatalogue={amenitiesCatalogue}
            onImagesChange={setImages}
            onEditStep={(step) => setCurrentStep(step)}
          />
        )}
      </div>

      {/* 5. Navigation Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              &larr; Previous Step
            </Button>
          ) : (
            <Link to={`/app/owner/properties/${property.id}`}>
              <Button type="button" variant="ghost" size="md" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>
          )}
        </div>

        <div>
          {currentStep < 4 ? (
            <Button type="button" variant="primary" size="md" onClick={handleNext}>
              Continue to Step {currentStep + 1} &rarr;
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => void handleSubmit()}
              isLoading={isSubmitting}
            >
              Save Changes
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export const EditPropertyPage: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>()

  // Fetch Master Amenities Catalogue
  const { data: amenitiesCatalogue = [] } = useQuery({
    queryKey: ['amenities-catalogue'],
    queryFn: () => propertyService.getAmenities(),
    staleTime: 1000 * 60 * 10,
  })

  // Fetch Existing Property
  const {
    data: property,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getProperty(propertyId!),
    enabled: Boolean(propertyId),
  })

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-6">
        <Skeleton shape="rectangular" height={32} width={240} className="rounded" />
        <Skeleton shape="rectangular" height={80} className="rounded-2xl" />
        <Skeleton shape="rectangular" height={360} className="rounded-2xl" />
      </div>
    )
  }

  // Error State
  if (isError || !property) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-6">
        <Alert variant="error" title="Property Not Found">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>
              {error instanceof Error
                ? error.message
                : 'The requested property could not be loaded or you do not have permission to edit it.'}
            </span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
        <div className="text-center">
          <Link
            to="/app/owner/properties"
            className="text-sm font-semibold text-[#408A71] hover:underline"
          >
            &larr; Return to My Properties
          </Link>
        </div>
      </div>
    )
  }

  return (
    <EditPropertyForm
      key={property.id}
      property={property}
      amenitiesCatalogue={amenitiesCatalogue}
    />
  )
}

export default EditPropertyPage
