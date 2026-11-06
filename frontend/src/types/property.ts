/**
 * Property Types & Interfaces
 * Strictly aligned with backend Property model, PropertyStatus, and serializers.
 */

export type PropertyCategory = 'residential' | 'commercial'

/**
 * Controlled property status values strictly matching backend PropertyStatus.
 * Do not introduce 'reserved' or 'archived'.
 */
export type PropertyStatus =
  | 'draft'
  | 'available'
  | 'occupied'
  | 'maintenance'
  | 'inactive'

export type PropertyType =
  | 'independent_house'
  | 'villa'
  | 'apartment'
  | 'studio_apartment'
  | 'office'
  | 'shop'
  | 'showroom'
  | 'warehouse'
  | 'other'

export type FurnishingStatus = 'unfurnished' | 'semi_furnished' | 'fully_furnished'

export type AmenityCategory =
  | 'building'
  | 'safety'
  | 'hvac'
  | 'power_backup'
  | 'connectivity'
  | 'recreation'
  | 'appliance'
  | 'accessibility'

export interface AmenityItem {
  id: string
  name: string
  category: AmenityCategory | string
  description?: string
  is_active?: boolean
}

export interface PropertyOwnerSummary {
  id: string
  email: string
  first_name: string
  last_name: string
}

export interface PropertyAmenitySummary {
  id: string
  name: string
  category: AmenityCategory | string
  description?: string
}

/**
 * Full property representation returned by GET /api/v1/properties/{id}/.
 * Serialized by backend PropertyDetailSerializer.
 */
export interface PropertyDetail {
  id: string
  owner: PropertyOwnerSummary
  title: string
  description: string | null
  category: PropertyCategory
  property_type: PropertyType | string
  address_line_1: string
  address_line_2: string | null
  landmark: string | null
  locality: string
  city: string
  district: string
  state: string
  pin_code: string
  country_code: string
  latitude: string | null
  longitude: string | null
  built_up_area: string | number | null
  bedrooms: number | null
  bathrooms: string | number | null
  furnishing_status: FurnishingStatus | null
  parking_spaces: number
  parking_details: string | null
  status: PropertyStatus
  images: PropertyImageItem[]
  amenities: PropertyAmenitySummary[]
  created_at: string
  updated_at: string
}

/**
 * Compact property item returned by GET /api/v1/properties/ and GET /api/v1/properties/me/.
 * Serialized by backend PropertyListSerializer.
 */
export interface PropertyListItem {
  id: string
  title: string
  category: PropertyCategory
  property_type: PropertyType | string
  city: string
  locality: string
  status: PropertyStatus
  primary_image_url: string | null
  created_at: string
}

/**
 * Standard Django REST Framework paginated response.
 */
export interface PaginatedPropertiesResponse {
  count: number
  next: string | null
  previous: string | null
  results: PropertyListItem[]
}

/**
 * Query parameters supported by paginated list endpoints.
 */
export interface FetchPropertiesParams {
  page?: number
  page_size?: number
}

/**
 * Request payload for creating a property via POST /api/v1/properties/.
 * Strictly matches PropertyCreateSerializer.
 */
export interface CreatePropertyPayload {
  title: string
  description?: string
  category: PropertyCategory
  property_type: PropertyType | string
  address_line_1: string
  address_line_2?: string
  landmark?: string
  locality: string
  city: string
  district: string
  state: string
  pin_code: string
  country_code?: string
  latitude?: string | null
  longitude?: string | null
  built_up_area?: string | number | null
  bedrooms?: number | null
  bathrooms?: string | number | null
  furnishing_status?: FurnishingStatus
  parking_spaces?: number
  parking_details?: string
  status?: PropertyStatus
  amenity_ids?: string[]
}

/**
 * Request payload for updating a property via PATCH/PUT /api/v1/properties/{id}/.
 * Strictly matches PropertyUpdateSerializer.
 */
export interface UpdatePropertyPayload {
  title?: string
  description?: string
  category?: PropertyCategory
  property_type?: PropertyType | string
  address_line_1?: string
  address_line_2?: string
  landmark?: string
  locality?: string
  city?: string
  district?: string
  state?: string
  pin_code?: string
  country_code?: string
  latitude?: string | null
  longitude?: string | null
  built_up_area?: string | number | null
  bedrooms?: number | null
  bathrooms?: string | number | null
  furnishing_status?: FurnishingStatus
  parking_spaces?: number
  parking_details?: string
  amenity_ids?: string[]
}

/**
 * Request payload for POST /api/v1/properties/{property_id}/images/.
 */
export interface AddPropertyImagePayload {
  image_url: string
  caption?: string
  display_order?: number
  is_primary?: boolean
}

/**
 * Image record returned by POST /api/v1/properties/{property_id}/images/.
 */
export interface PropertyImageItem {
  id: string
  property_id: string
  image_url: string
  caption: string | null
  display_order: number
  is_primary: boolean
  created_at: string
}
