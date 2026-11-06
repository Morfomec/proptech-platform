import apiClient from '../api/client'
import type { ApiResponse } from '../types/api'
import type {
  AddPropertyImagePayload,
  AmenityItem,
  CreatePropertyPayload,
  FetchPropertiesParams,
  PaginatedPropertiesResponse,
  PropertyDetail,
  PropertyImageItem,
  UpdatePropertyPayload,
} from '../types/property'

export interface CreatedPropertyData {
  id: string
  title: string
  status: string
  [key: string]: unknown
}

/**
 * Property Service
 * Handles API communication for property management, creation, updates, and images.
 */
export const propertyService = {
  /**
   * Retrieve the authenticated owner's properties.
   * Connects to GET /api/v1/properties/me/ (or GET /api/v1/properties/).
   */
  async getMyProperties(params?: FetchPropertiesParams): Promise<PaginatedPropertiesResponse> {
    const response = await apiClient.get<PaginatedPropertiesResponse>('/api/v1/properties/me/', {
      params: {
        page: params?.page ?? 1,
        page_size: params?.page_size ?? 20,
      },
    })
    return response.data
  },

  /**
   * Retrieve complete property details by ID.
   * Connects to GET /api/v1/properties/{property_id}/.
   */
  async getProperty(propertyId: string): Promise<PropertyDetail> {
    const response = await apiClient.get<ApiResponse<PropertyDetail>>(
      `/api/v1/properties/${propertyId}/`
    )
    if (!response.data.data) {
      throw new Error(response.data.message || 'Property not found')
    }
    return response.data.data
  },

  /**
   * Create a new property asset in draft status.
   * Connects to POST /api/v1/properties/.
   */
  async createProperty(payload: CreatePropertyPayload): Promise<ApiResponse<CreatedPropertyData>> {
    const response = await apiClient.post<ApiResponse<CreatedPropertyData>>(
      '/api/v1/properties/',
      payload
    )
    return response.data
  },

  /**
   * Update an existing property asset.
   * Connects to PATCH /api/v1/properties/{property_id}/.
   */
  async updateProperty(
    propertyId: string,
    payload: UpdatePropertyPayload
  ): Promise<ApiResponse<PropertyDetail>> {
    const response = await apiClient.patch<ApiResponse<PropertyDetail>>(
      `/api/v1/properties/${propertyId}/`,
      payload
    )
    return response.data
  },

  /**
   * Delete an existing property asset.
   * Connects to DELETE /api/v1/properties/{property_id}/.
   */
  async deleteProperty(propertyId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/properties/${propertyId}/`)
    return response.data
  },

  /**
   * Retrieve all gallery images for a property.
   * Connects to GET /api/v1/properties/{property_id}/images/.
   */
  async getPropertyImages(propertyId: string): Promise<PropertyImageItem[]> {
    const response = await apiClient.get<ApiResponse<PropertyImageItem[]>>(
      `/api/v1/properties/${propertyId}/images/`
    )
    return response.data.data ?? []
  },

  /**
   * Add an image asset to a property's gallery.
   * Connects to POST /api/v1/properties/{property_id}/images/.
   */
  async addPropertyImage(
    propertyId: string,
    payload: AddPropertyImagePayload
  ): Promise<ApiResponse<PropertyImageItem>> {
    const response = await apiClient.post<ApiResponse<PropertyImageItem>>(
      `/api/v1/properties/${propertyId}/images/`,
      payload
    )
    return response.data
  },

  /**
   * Delete a specific image from a property's gallery.
   * Connects to DELETE /api/v1/properties/{property_id}/images/{image_id}/.
   */
  async deletePropertyImage(
    propertyId: string,
    imageId: string
  ): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `/api/v1/properties/${propertyId}/images/${imageId}/`
    )
    return response.data
  },

  /**
   * Designate a specific image as the primary photo.
   * Connects to POST /api/v1/properties/{property_id}/images/{image_id}/primary/.
   */
  async setPrimaryImage(
    propertyId: string,
    imageId: string
  ): Promise<ApiResponse<PropertyImageItem>> {
    const response = await apiClient.post<ApiResponse<PropertyImageItem>>(
      `/api/v1/properties/${propertyId}/images/${imageId}/primary/`
    )
    return response.data
  },

  /**
   * Retrieve active master amenities catalogue.
   * Connects to GET /api/v1/amenities/.
   */
  async getAmenities(): Promise<AmenityItem[]> {
    const response = await apiClient.get<ApiResponse<AmenityItem[]>>('/api/v1/amenities/')
    return response.data.data ?? []
  },
}

export default propertyService
