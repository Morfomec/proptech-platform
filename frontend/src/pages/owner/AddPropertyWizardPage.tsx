import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import { OWNER_PROPERTIES_QUERY_KEY } from '../../hooks/useOwnerProperties'
import { propertyService } from '../../services/property.service'
import { listingService } from '../../services/listing.service'
import type {
  AmenityItem,
  CreatePropertyPayload,
  FurnishingStatus,
  PropertyCategory,
} from '../../types/property'
import type { CreateListingPayload, PublicListingItem } from '../../types/listing'

import {
  PropertyBasicsSection,
  PropertySpecificationsSection,
  PropertyLocationSection,
  AmenitiesSection,
  PropertyPhotosSection,
  RentalTermsSection,
  FormActionBar,
  PropertySuccessView,
  type ImageEntry,
} from '../../components/owner/add-property'

export type { ImageEntry }

const MAX_IMAGES_LIMIT = 15
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Extracts DRF backend validation errors into field-specific errors,
 * clean global messages, and a deduped list of unique readable messages.
 */
function extractApiErrors(data: unknown): {
  fieldErrors: Record<string, string>
  globalError: string | null
  uniqueErrors: string[]
} {
  const fieldErrors: Record<string, string> = {}
  let globalError: string | null = null

  if (!data || typeof data !== 'object') {
    const fallback = typeof data === 'string' && data.trim() ? data.trim() : null
    return {
      fieldErrors,
      globalError: fallback,
      uniqueErrors: fallback ? [fallback] : [],
    }
  }

  const raw = data as Record<string, unknown>
  const errorsPayload =
    raw.errors && typeof raw.errors === 'object'
      ? (raw.errors as Record<string, unknown>)
      : raw

  const processEntry = (key: string, val: unknown) => {
    if (typeof val === 'string' && val.trim()) {
      if (['non_field_errors', 'detail', '__all__'].includes(key)) {
        globalError = globalError ? `${globalError} | ${val.trim()}` : val.trim()
      } else {
        fieldErrors[key] = val.trim()
      }
    } else if (Array.isArray(val) && val.length > 0) {
      const first = val[0]
      if (typeof first === 'string' && first.trim()) {
        if (['non_field_errors', 'detail', '__all__'].includes(key)) {
          globalError = globalError ? `${globalError} | ${first.trim()}` : first.trim()
        } else {
          fieldErrors[key] = first.trim()
        }
      } else if (typeof first === 'object' && first !== null) {
        processEntry(key, first)
      }
    } else if (val && typeof val === 'object' && val !== null) {
      for (const [subKey, subVal] of Object.entries(val)) {
        processEntry(subKey, subVal)
      }
    }
  }

  for (const [key, val] of Object.entries(errorsPayload)) {
    if (key === 'success' || key === 'status_code') continue
    if (key === 'message' && typeof val === 'string' && val.trim() && val !== 'Request failed.') {
      if (!globalError) globalError = val.trim()
      continue
    }
    processEntry(key, val)
  }

  // Cross-map coordinates
  if (fieldErrors.coordinates) {
    if (!fieldErrors.latitude) fieldErrors.latitude = fieldErrors.coordinates
    if (!fieldErrors.longitude) fieldErrors.longitude = fieldErrors.coordinates
    delete fieldErrors.coordinates
  }

  // Deduplicate property and image error messages
  if (fieldErrors.property && fieldErrors.images && fieldErrors.property === fieldErrors.images) {
    delete fieldErrors.property
  } else if (fieldErrors.property && fieldErrors.property.toLowerCase().includes('image')) {
    fieldErrors.images = fieldErrors.property
    delete fieldErrors.property
  }

  // Fallback for global message
  if (!globalError && typeof raw.message === 'string' && raw.message.trim() && raw.message !== 'Request failed.') {
    globalError = raw.message.trim()
  } else if (!globalError && typeof raw.detail === 'string' && raw.detail.trim()) {
    globalError = raw.detail.trim()
  }

  // Collect unique error strings for clean, deduped user display
  const errorSet = new Set<string>()
  if (globalError) errorSet.add(globalError)
  Object.values(fieldErrors).forEach((msg) => {
    if (msg) errorSet.add(msg)
  })

  return { fieldErrors, globalError, uniqueErrors: Array.from(errorSet) }
}

export const AddPropertyWizardPage: React.FC = () => {
  const navigate = useNavigate()
  const { propertyId } = useParams<{ propertyId?: string }>()
  const isEditMode = Boolean(propertyId)
  const queryClient = useQueryClient()
  const { refreshProfile } = useAuth()

  // Master amenities catalogue query (fetched exclusively from backend)
  const {
    data: amenitiesCatalogue = [],
    isLoading: isLoadingAmenities,
    isError: isAmenitiesError,
    error: amenitiesError,
    refetch: refetchAmenities,
  } = useQuery<AmenityItem[]>({
    queryKey: ['amenities-catalogue'],
    queryFn: () => propertyService.getAmenities(),
    staleTime: 1000 * 60 * 10,
  })

  // Fetch existing property for edit mode
  const {
    data: existingProperty,
    isLoading: isLoadingProperty,
    isError: isPropertyError,
    error: propertyFetchError,
    refetch: refetchProperty,
  } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getProperty(propertyId!),
    enabled: isEditMode,
  })

  // Fetch owner listings to find associated listing for rent/terms
  const { data: ownerListings } = useQuery({
    queryKey: ['owner-listings', propertyId],
    queryFn: async () => {
      const res = await listingService.getOwnerListings()
      return res.results || []
    },
    enabled: isEditMode,
  })

  // Submission & Validation State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittingAction, setSubmittingAction] = useState<'publish' | 'draft' | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [uniqueErrors, setUniqueErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [geoLocating, setGeoLocating] = useState(false)

  // Persisted IDs for safe retries without duplicating records
  const [persistedPropertyId, setPersistedPropertyId] = useState<string | null>(null)
  const [persistedListingId, setPersistedListingId] = useState<string | null>(null)
  const [listingStatus, setListingStatus] = useState<string | null>(null)

  // Success screen state
  const [successData, setSuccessData] = useState<{
    mode: 'published' | 'draft'
    propertyId: string
    listingId?: string
    title: string
    location: string
    primaryImageUrl?: string
    monthlyRent?: number | string
  } | null>(null)

  // Form Fields State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<PropertyCategory>('residential')
  const [propertyType, setPropertyType] = useState('apartment')
  const [builtUpArea, setBuiltUpArea] = useState('')
  const [description, setDescription] = useState('')

  // Specifications
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [furnishingStatus, setFurnishingStatus] = useState<FurnishingStatus>('unfurnished')
  const [parkingDetails, setParkingDetails] = useState('')

  // Amenities
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([])

  // Location
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [locality, setLocality] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [state, setState] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  // Rental Details
  const [monthlyRent, setMonthlyRent] = useState('')
  const [securityDeposit, setSecurityDeposit] = useState('')
  const [availableFrom, setAvailableFrom] = useState('')

  // Images state (local binary files ready to upload + previews)
  const [images, setImages] = useState<ImageEntry[]>([])

  // Populate existing property state in edit mode
  const populatedPropertyIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (existingProperty && populatedPropertyIdRef.current !== existingProperty.id) {
      populatedPropertyIdRef.current = existingProperty.id
      setPersistedPropertyId(existingProperty.id)
      setTitle(existingProperty.title || '')
      setCategory(existingProperty.category || 'residential')
      setPropertyType(existingProperty.property_type || 'apartment')
      setBuiltUpArea(existingProperty.built_up_area ? String(existingProperty.built_up_area) : '')
      setDescription(existingProperty.description || '')
      setBedrooms(existingProperty.bedrooms != null ? String(existingProperty.bedrooms) : '')
      setBathrooms(existingProperty.bathrooms != null ? String(existingProperty.bathrooms) : '')
      setFurnishingStatus((existingProperty.furnishing_status || 'unfurnished') as FurnishingStatus)
      setParkingDetails(existingProperty.parking_details || '')
      setSelectedAmenityIds(existingProperty.amenities ? existingProperty.amenities.map((a) => a.id) : [])
      setAddressLine1(existingProperty.address_line_1 || '')
      setAddressLine2(existingProperty.address_line_2 || '')
      setLocality(existingProperty.locality || '')
      setCity(existingProperty.city || '')
      setDistrict(existingProperty.district || '')
      setState(existingProperty.state || '')
      setPinCode(existingProperty.pin_code || '')
      setLatitude(existingProperty.latitude ? String(existingProperty.latitude) : '')
      setLongitude(existingProperty.longitude ? String(existingProperty.longitude) : '')

      if (existingProperty.images && existingProperty.images.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setImages(
          existingProperty.images.map((img) => ({
            id: img.id,
            image_url: img.image_url,
            caption: img.caption || '',
            is_primary: img.is_primary,
            uploaded: true,
          }))
        )
      }
    }
  }, [existingProperty])

  // Populate existing listing state in edit mode
  const populatedListingRef = useRef(false)
  useEffect(() => {
    if (ownerListings && existingProperty && !populatedListingRef.current) {
      const matched = ownerListings.find((l: PublicListingItem) => {
        if (l.property_id) return l.property_id === existingProperty.id
        if (l.property?.id) return l.property.id === existingProperty.id
        return false
      })
      if (matched) {
        populatedListingRef.current = true
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPersistedListingId(matched.id)
        setListingStatus(matched.status || null)
        if (matched.monthly_rent != null) setMonthlyRent(String(matched.monthly_rent))
        if (matched.security_deposit != null) setSecurityDeposit(String(matched.security_deposit))
        if (matched.available_from) setAvailableFrom(matched.available_from.slice(0, 10))
      }
    }
  }, [ownerListings, existingProperty])

  // Category switch handler
  const handleCategoryChange = (newCat: PropertyCategory) => {
    setCategory(newCat)
    if (newCat === 'residential') {
      setPropertyType('apartment')
    } else {
      setPropertyType('office')
    }
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.category
      delete next.property_type
      return next
    })
  }

  // Amenity toggle
  const handleToggleAmenity = (id: string) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Current GPS Position
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
        setFieldErrors((prev) => {
          const next = { ...prev }
          delete next.latitude
          delete next.longitude
          delete next.coordinates
          return next
        })
      },
      (err) => {
        setGeoLocating(false)
        setApiError(`Could not retrieve location: ${err.message}`)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // File Upload Handlers
  const processFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    let availableSlots = MAX_IMAGES_LIMIT - images.length
    if (availableSlots <= 0) {
      setApiError(`A maximum of ${MAX_IMAGES_LIMIT} photos is allowed per property.`)
      return
    }

    const newEntries: ImageEntry[] = []
    let hasSizeError = false
    let hasTypeError = false

    files.forEach((file) => {
      if (availableSlots <= 0) return

      if (!ALLOWED_MIME_TYPES.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
        hasTypeError = true
        return
      }

      if (file.size > MAX_IMAGE_BYTES) {
        hasSizeError = true
        return
      }

      const previewUrl = URL.createObjectURL(file)
      newEntries.push({
        image_url: previewUrl,
        caption: file.name.replace(/\.[^/.]+$/, ''),
        is_primary: images.length === 0 && newEntries.length === 0,
        file,
        uploaded: false,
      })
      availableSlots--
    })

    if (hasSizeError) {
      setApiError('One or more files exceeded the 10MB limit and were skipped.')
    } else if (hasTypeError) {
      setApiError('Only JPG, PNG, and WEBP image formats are supported.')
    }

    if (newEntries.length > 0) {
      setImages((prev) => {
        const combined = [...prev, ...newEntries]
        if (!combined.some((img) => img.is_primary) && combined.length > 0) {
          combined[0].is_primary = true
        }
        return combined
      })
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next.images
        delete next.property
        return next
      })
      if (!hasSizeError && !hasTypeError) {
        setApiError(null)
      }
    }
  }

  const handleSetPrimary = (index: number) => {
    const target = images[index]
    const propId = persistedPropertyId || propertyId
    if (target?.id && propId) {
      propertyService.setPrimaryImage(propId, target.id).catch((err) => {
        console.error('Failed to set primary image on server', err)
      })
    }
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        is_primary: i === index,
      }))
    )
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index]
      if (target?.file && target.image_url.startsWith('blob:')) {
        URL.revokeObjectURL(target.image_url)
      }
      const propId = persistedPropertyId || propertyId
      if (target?.id && propId) {
        propertyService.deletePropertyImage(propId, target.id).catch((err) => {
          console.error('Failed to delete image on server', err)
        })
      }
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length > 0 && !updated.some((img) => img.is_primary)) {
        updated[0].is_primary = true
      }
      return updated
    })
  }

  // Quick Rent Multiplier for Deposit
  const handleSetDepositMultiplier = (multiplier: number) => {
    const rentNum = parseFloat(monthlyRent)
    if (!isNaN(rentNum) && rentNum > 0) {
      setSecurityDeposit(String(Math.round(rentNum * multiplier)))
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next.security_deposit
        return next
      })
    }
  }

  // Parse parking spaces from free text
  const computeParkingSpaces = (str: string): number => {
    const matches = str.match(/\d+/g)
    if (matches && matches.length > 0) {
      return matches.reduce((acc, curr) => acc + parseInt(curr, 10), 0)
    }
    return 0
  }

  // Form Submission
  const handleSubmit = async (wantsPublish: boolean) => {
    if (isSubmitting) return

    setApiError(null)
    setUniqueErrors([])
    setFieldErrors({})

    // Pre-flight check: If publishing immediately, user must have selected at least 1 photo
    const hasAnyImageToUpload = images.length > 0 || images.some((img) => img.uploaded)
    if (wantsPublish && !hasAnyImageToUpload) {
      const msg = 'A property must have at least one uploaded photo before its listing can be published.'
      setApiError(msg)
      setUniqueErrors([msg])
      setFieldErrors({ images: 'Please select at least one property photo.' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setIsSubmitting(true)
    setSubmittingAction(wantsPublish ? 'publish' : 'draft')

    try {
      // 1. Prepare Creation Payload
      const cleanAddressLine1 = addressLine1.trim()
      const cleanLocality = locality.trim()
      const cleanCity = city.trim()
      const cleanDistrict = district.trim() || cleanCity
      const cleanState = state.trim()
      const cleanPinCode = pinCode.trim()

      const payload: CreatePropertyPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        property_type: propertyType,
        address_line_1: cleanAddressLine1,
        address_line_2: addressLine2.trim() || undefined,
        locality: cleanLocality,
        city: cleanCity,
        district: cleanDistrict,
        state: cleanState,
        pin_code: cleanPinCode,
        country_code: 'IN',
        latitude: latitude.trim() || null,
        longitude: longitude.trim() || null,
        built_up_area: builtUpArea.trim() ? parseFloat(builtUpArea) : null,
        bedrooms: category === 'residential' && bedrooms.trim() ? parseInt(bedrooms, 10) : null,
        bathrooms: category === 'residential' && bathrooms.trim() ? parseFloat(bathrooms) : null,
        furnishing_status: furnishingStatus || null,
        parking_spaces: computeParkingSpaces(parkingDetails),
        parking_details: parkingDetails.trim() || undefined,
        amenity_ids: selectedAmenityIds,
      }

      // 2. Create or Update Property asset (Operation 1)
      let activePropertyId: string | null = persistedPropertyId
      try {
        if (!activePropertyId) {
          const createRes = await propertyService.createProperty(payload)
          activePropertyId = createRes.data?.id || null
          if (!activePropertyId) {
            throw new Error('Property creation did not return a valid property ID.')
          }
          setPersistedPropertyId(activePropertyId)
        } else {
          await propertyService.updateProperty(activePropertyId, payload)
        }
      } catch (propErr) {
        let errMsg = 'Failed to save property details'
        if (axios.isAxiosError(propErr) && propErr.response?.data) {
          const { fieldErrors: pFields, globalError: pGlobal } = extractApiErrors(propErr.response.data)
          setFieldErrors(pFields)
          errMsg = Object.values(pFields)[0] || pGlobal || errMsg
        } else if (propErr instanceof Error) {
          errMsg = propErr.message
        }
        setApiError(`Failed to save property: ${errMsg}`)
        setUniqueErrors([errMsg])
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setIsSubmitting(false)
        setSubmittingAction(null)
        return
      }

      // 3. Upload gallery images (Operation 2)
      const nextImages = images.map((img) => ({ ...img }))
      let imageUploadFailure: string | null = null

      if (nextImages.length > 0) {
        for (let i = 0; i < nextImages.length; i++) {
          const currentImg = nextImages[i]
          if (currentImg.uploaded) continue // Do not re-upload already uploaded images

          try {
            if (currentImg.file) {
              const uploadRes = await propertyService.addPropertyImage(activePropertyId, {
                file: currentImg.file,
                caption: currentImg.caption.trim() || undefined,
                display_order: i,
                is_primary: currentImg.is_primary,
              })
              // eslint-disable-next-line react-hooks/immutability
              nextImages[i] = {
                ...currentImg,
                uploaded: true,
                error: undefined,
                id: uploadRes.data?.id || currentImg.id,
                image_url: uploadRes.data?.image_url || currentImg.image_url,
              }
            }
          } catch (uploadErr) {
            let errMsg = 'Image upload failed'
            if (axios.isAxiosError(uploadErr) && uploadErr.response?.data) {
              const { fieldErrors: imgFieldErrors, globalError: imgGlobalError } =
                extractApiErrors(uploadErr.response.data)
              errMsg = imgFieldErrors.file || imgFieldErrors.image || imgGlobalError || errMsg
            } else if (uploadErr instanceof Error) {
              errMsg = uploadErr.message
            }
            nextImages[i] = {
              ...currentImg,
              error: errMsg,
            }
            imageUploadFailure = `Failed to upload image "${currentImg.caption || `Photo ${i + 1}`}": ${errMsg}`
            break // Stop on first image failure so user can resolve and retry
          }
        }
        setImages(nextImages)
      }

      // If an image upload failed, halt before listing creation to prevent orphan draft listings
      if (imageUploadFailure) {
        setApiError(imageUploadFailure)
        setUniqueErrors([imageUploadFailure])
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setIsSubmitting(false)
        setSubmittingAction(null)
        return
      }

      // Confirm that at least one photo succeeded if publish is requested
      const hasUploadedImages = nextImages.some((img) => img.uploaded)
      if (wantsPublish && !hasUploadedImages) {
        const msg = 'A property must have at least one uploaded photo before its listing can be published.'
        setApiError(msg)
        setUniqueErrors([msg])
        setFieldErrors({ images: 'Please select and upload at least one property photo.' })
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setIsSubmitting(false)
        setSubmittingAction(null)
        return
      }

      // 4. Create or Update Listing (Operation 3)
      let activeListingId: string | null = persistedListingId
      const shouldCreateListing = wantsPublish || Boolean(monthlyRent.trim())

      if (shouldCreateListing) {
        const rentAmount = monthlyRent.trim() ? parseFloat(monthlyRent) : 0
        const depositAmount = securityDeposit.trim() ? parseFloat(securityDeposit) : 0
        const availFrom = availableFrom.trim() || null

        try {
          if (!activeListingId) {
            const listingPayload: CreateListingPayload = {
              property_id: activePropertyId,
              title: title.trim(),
              description: description.trim() || undefined,
              monthly_rent: rentAmount,
              security_deposit: depositAmount,
              available_from: availFrom,
              status: wantsPublish ? 'published' : 'draft',
              publish: wantsPublish,
            }
            const listingRes = await listingService.createListing(listingPayload)
            activeListingId = listingRes.data?.id || null
            if (activeListingId) {
              setPersistedListingId(activeListingId)
            }
          } else {
            await listingService.updateListing(activeListingId, {
              title: title.trim(),
              description: description.trim() || undefined,
              monthly_rent: rentAmount,
              security_deposit: depositAmount,
              available_from: availFrom,
            })
            if (wantsPublish) {
              await listingService.publishListing(activeListingId)
            }
          }
        } catch (listingErr) {
          let errMsg = 'Failed to create listing'
          if (axios.isAxiosError(listingErr) && listingErr.response?.data) {
            const { fieldErrors: lFields, globalError: lGlobal } = extractApiErrors(listingErr.response.data)
            setFieldErrors(lFields)
            errMsg = Object.values(lFields)[0] || lGlobal || errMsg
          } else if (listingErr instanceof Error) {
            errMsg = listingErr.message
          }
          setApiError(`Failed to ${wantsPublish ? 'publish' : 'save'} listing: ${errMsg}`)
          setUniqueErrors([errMsg])
          window.scrollTo({ top: 0, behavior: 'smooth' })
          setIsSubmitting(false)
          setSubmittingAction(null)
          return
        }
      }

      // 5. Confirm that listing is published when wantsPublish is true (Operation 4)
      if (wantsPublish && activeListingId) {
        try {
          const verifyRes = await listingService.getListing(activeListingId)
          if (verifyRes.data?.status !== 'published') {
            await listingService.publishListing(activeListingId)
          }
        } catch (verifyErr) {
          console.warn('Listing status confirmation warning:', verifyErr)
        }
      }

      // 6. Invalidate caches and refresh owner session
      await queryClient.invalidateQueries({ queryKey: [OWNER_PROPERTIES_QUERY_KEY] })
      await refreshProfile()

      // 7. Presentation Success View
      const primaryPhoto =
        nextImages.find((img) => img.is_primary && img.uploaded)?.image_url ||
        nextImages.find((img) => img.uploaded)?.image_url
      setSuccessData({
        mode: wantsPublish ? 'published' : 'draft',
        propertyId: activePropertyId,
        listingId: activeListingId ?? undefined,
        title: title.trim(),
        location: [locality, city].filter(Boolean).join(', ') || cleanAddressLine1,
        primaryImageUrl: primaryPhoto,
        monthlyRent: monthlyRent.trim() ? parseFloat(monthlyRent) : undefined,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during submission.'
      setApiError(msg)
      setUniqueErrors([msg])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setIsSubmitting(false)
      setSubmittingAction(null)
    }
  }

  // Address summary for map
  const fullAddressSummary = [addressLine1, locality, city, district, state, pinCode]
    .filter(Boolean)
    .join(', ')

  // Formatted price preview
  const formattedRentPreview = useMemo(() => {
    const val = parseFloat(monthlyRent)
    if (isNaN(val) || val <= 0) return null
    return `₹${val.toLocaleString('en-IN')}`
  }, [monthlyRent])

  // Success Confirmation Screen
  if (successData) {
    return <PropertySuccessView isEditMode={isEditMode} data={successData} />
  }

  // Loading state for edit mode
  if (isEditMode && isLoadingProperty) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center space-y-4 text-center">
        <div className="w-8 h-8 border-3 border-[#408A71] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading property details...</p>
      </div>
    )
  }

  // Error state for edit mode
  if (isEditMode && (isPropertyError || !existingProperty)) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl text-sm">
          <p className="font-semibold">Property Not Found</p>
          <p className="text-xs text-red-700 mt-1">
            {propertyFetchError instanceof Error
              ? propertyFetchError.message
              : 'The requested property could not be loaded or you do not have permission to edit it.'}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void refetchProperty()}
              className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-900 rounded-md cursor-pointer transition-colors"
            >
              Retry
            </button>
            <Link
              to="/app/owner/properties"
              className="text-xs font-medium text-[#408A71] hover:underline"
            >
              &larr; Return to My Properties
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* 1. Header Navigation & Breadcrumbs */}
      <div className="space-y-2">
        <nav className="flex items-center gap-2 text-xs text-gray-500">
          <Link to="/app/owner/dashboard" className="hover:text-[#408A71] transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/app/owner/properties" className="hover:text-[#408A71] transition-colors">
            My Properties
          </Link>
          <span>/</span>
          {isEditMode ? (
            <>
              <span className="text-gray-500 truncate max-w-[150px]">{title || 'Property'}</span>
              <span>/</span>
              <span className="text-gray-900 font-medium">Edit</span>
            </>
          ) : (
            <span className="text-gray-900 font-medium">Add Property</span>
          )}
        </nav>

        <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
          <button
            type="button"
            onClick={() => navigate('/app/owner/properties')}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Back to My Properties"
            aria-label="Back to My Properties"
          >
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {isEditMode ? `Edit Property: ${title || 'Property'}` : 'Add New Property'}
            </h1>
          </div>
        </div>
      </div>

      {/* 2. User-Friendly Error Alert Banner */}
      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl text-sm flex items-start gap-3 shadow-xs">
          <div className="w-5 h-5 text-red-500 shrink-0 mt-0.5">
            <svg
              className="w-5 h-5"
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
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-red-900 text-sm">{apiError}</h4>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-red-400 hover:text-red-700 p-1 rounded-lg hover:bg-red-100/60 transition-colors cursor-pointer shrink-0"
                aria-label="Dismiss error banner"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {uniqueErrors.length > 1 && (
              <ul className="list-disc list-inside text-xs space-y-1 text-red-700 pt-0.5">
                {uniqueErrors
                  .filter((msg) => msg !== apiError)
                  .map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 3. Section 1: Basic Information */}
      <PropertyBasicsSection
        title={title}
        onTitleChange={(val) => {
          setTitle(val)
          if (fieldErrors.title) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.title
              return next
            })
          }
        }}
        category={category}
        onCategoryChange={handleCategoryChange}
        propertyType={propertyType}
        onPropertyTypeChange={setPropertyType}
        builtUpArea={builtUpArea}
        onBuiltUpAreaChange={(val) => {
          setBuiltUpArea(val)
          if (fieldErrors.built_up_area) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.built_up_area
              return next
            })
          }
        }}
        description={description}
        onDescriptionChange={setDescription}
        fieldErrors={fieldErrors}
      />

      {/* 4. Section 2: Property Specifications */}
      <PropertySpecificationsSection
        category={category}
        bedrooms={bedrooms}
        onBedroomsChange={(val) => {
          setBedrooms(val)
          if (fieldErrors.bedrooms) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.bedrooms
              return next
            })
          }
        }}
        bathrooms={bathrooms}
        onBathroomsChange={(val) => {
          setBathrooms(val)
          if (fieldErrors.bathrooms) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.bathrooms
              return next
            })
          }
        }}
        furnishingStatus={furnishingStatus}
        onFurnishingStatusChange={setFurnishingStatus}
        parkingDetails={parkingDetails}
        onParkingDetailsChange={setParkingDetails}
        fieldErrors={fieldErrors}
      />

      {/* 5. Section 3: Property Location */}
      <PropertyLocationSection
        addressLine1={addressLine1}
        onAddressLine1Change={(val) => {
          setAddressLine1(val)
          if (fieldErrors.address_line_1) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.address_line_1
              return next
            })
          }
        }}
        addressLine2={addressLine2}
        onAddressLine2Change={setAddressLine2}
        locality={locality}
        onLocalityChange={(val) => {
          setLocality(val)
          if (fieldErrors.locality) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.locality
              return next
            })
          }
        }}
        city={city}
        onCityChange={(val) => {
          setCity(val)
          if (fieldErrors.city) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.city
              return next
            })
          }
        }}
        district={district}
        onDistrictChange={setDistrict}
        state={state}
        onStateChange={(val) => {
          setState(val)
          if (fieldErrors.state) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.state
              return next
            })
          }
        }}
        pinCode={pinCode}
        onPinCodeChange={(val) => {
          setPinCode(val)
          if (fieldErrors.pin_code) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.pin_code
              return next
            })
          }
        }}
        latitude={latitude}
        longitude={longitude}
        onCoordinateChange={(lat, lng) => {
          setLatitude(lat)
          setLongitude(lng)
        }}
        onDetectLocation={handleFetchCurrentPosition}
        isDetectingLocation={geoLocating}
        fullAddressSummary={fullAddressSummary}
        fieldErrors={fieldErrors}
      />

      {/* 6. Section 4: Amenities & Features */}
      <AmenitiesSection
        catalogue={amenitiesCatalogue}
        selectedIds={selectedAmenityIds}
        onToggle={handleToggleAmenity}
        isLoading={isLoadingAmenities}
        isError={isAmenitiesError}
        errorMessage={amenitiesError instanceof Error ? amenitiesError.message : undefined}
        onRetry={() => void refetchAmenities()}
      />

      {/* 7. Section 5: Property Photos */}
      <PropertyPhotosSection
        images={images}
        onFilesSelected={processFiles}
        onSetPrimary={handleSetPrimary}
        onRemove={handleRemoveImage}
        error={fieldErrors.images || fieldErrors.property}
        maxLimit={MAX_IMAGES_LIMIT}
      />

      {/* 8. Section 6: Pricing & Rental Terms */}
      <RentalTermsSection
        monthlyRent={monthlyRent}
        onMonthlyRentChange={(val) => {
          setMonthlyRent(val)
          if (fieldErrors.monthly_rent) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.monthly_rent
              return next
            })
          }
        }}
        securityDeposit={securityDeposit}
        onSecurityDepositChange={(val) => {
          setSecurityDeposit(val)
          if (fieldErrors.security_deposit) {
            setFieldErrors((prev) => {
              const next = { ...prev }
              delete next.security_deposit
              return next
            })
          }
        }}
        onSetDepositMultiplier={handleSetDepositMultiplier}
        availableFrom={availableFrom}
        onAvailableFromChange={setAvailableFrom}
        formattedRentPreview={formattedRentPreview}
        fieldErrors={fieldErrors}
      />

      {/* 9. Bottom Action Bar */}
      <FormActionBar
        isEditMode={isEditMode}
        listingStatus={listingStatus}
        isSubmitting={isSubmitting}
        submittingAction={submittingAction}
        imageCount={images.length}
        onCancel={() => navigate('/app/owner/properties')}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default AddPropertyWizardPage
