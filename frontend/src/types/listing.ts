/**
 * Listing & Saved Property TypeScript Definitions
 * Aligned with backend Listing, SavedProperty models, and API serializers.
 */

export type ListingCategory = 'residential' | 'commercial'

export type ListingPropertyType =
  | 'independent_house'
  | 'villa'
  | 'apartment'
  | 'studio_apartment'
  | 'office'
  | 'shop'
  | 'showroom'
  | 'warehouse'
  | 'other'

export type ListingFurnishingStatus = 'unfurnished' | 'semi_furnished' | 'fully_furnished'

export type ListingSortOption = 'newest' | 'rent_low_to_high' | 'rent_high_to_low'

export interface PublicListingProperty {
  id: string
  title: string
  category: ListingCategory
  property_type: ListingPropertyType | string
  address_line_1: string
  locality: string
  city: string
  district: string
  state: string
  pin_code: string
  built_up_area: string | number | null
  bedrooms: number | null
  bathrooms: string | number | null
  furnishing_status: ListingFurnishingStatus | null
  parking_spaces: number
  primary_image_url: string | null
}

export interface PublicListingItem {
  id: string
  property_id: string
  title: string
  description?: string | null
  monthly_rent: string
  security_deposit: string | null
  available_from: string | null
  status: 'published' | 'draft' | 'paused' | 'closed'
  published_at: string | null
  created_at: string
  property: PublicListingProperty
}

export interface PaginatedListingsResponse {
  count: number
  next: string | null
  previous: string | null
  results: PublicListingItem[]
}

export interface ListingFilterParams {
  city?: string
  locality?: string
  category?: ListingCategory
  property_type?: string
  min_rent?: string | number
  max_rent?: string | number
  bedrooms?: number
  furnishing_status?: ListingFurnishingStatus
  available_from?: string
  search?: string
  sort?: ListingSortOption
  page?: number
  page_size?: number
}

export interface SavedPropertyItem {
  id: string
  property_id: string
  created_at: string
  is_available: boolean
  property:
    | PublicListingProperty
    | {
        id: string
        title: string
        status: string
        is_available: boolean
        message: string
      }
  listing: {
    id: string
    title: string
    monthly_rent: string
    security_deposit: string | null
    available_from: string | null
    status: string
  } | null
}

export interface PaginatedSavedPropertiesResponse {
  count: number
  next: string | null
  previous: string | null
  results: SavedPropertyItem[]
}

export interface CreateListingPayload {
  property_id: string
  title: string
  description?: string
  monthly_rent: string | number
  security_deposit?: string | number | null
  available_from?: string | null
  publish?: boolean
  status?: 'draft' | 'published'
}

export interface UpdateListingPayload {
  title?: string
  description?: string
  monthly_rent?: string | number
  security_deposit?: string | number | null
  available_from?: string | null
}

export interface ListingOwnerSummary {
  id: string
  name: string
  avatar_url?: string | null
  role?: string
}

export interface ListingDetailPropertyImage {
  id: string
  property_id?: string
  image_url: string
  caption?: string | null
  display_order?: number
  is_primary?: boolean
}

export interface ListingDetailAmenity {
  id: string
  name: string
  icon?: string | null
  category?: string | null
}

export interface ListingDetailProperty extends PublicListingProperty {
  description?: string | null
  address_line_2?: string | null
  landmark?: string | null
  country_code?: string
  latitude?: number | string | null
  longitude?: number | string | null
  parking_details?: string | null
  status?: string
  images?: ListingDetailPropertyImage[]
  amenities?: ListingDetailAmenity[]
}

export interface ListingDetailItem {
  id: string
  property_id: string
  property: ListingDetailProperty
  owner?: ListingOwnerSummary | null
  title: string
  description: string | null
  monthly_rent: string
  security_deposit: string | null
  available_from: string | null
  status: 'draft' | 'published' | 'paused' | 'closed'
  published_at: string | null
  created_at: string
  updated_at: string
}

