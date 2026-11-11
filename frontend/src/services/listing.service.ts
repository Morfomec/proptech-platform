import axios from 'axios'
import apiClient from '../api/client'
import type { ApiResponse } from '../types/api'
import type {
  CreateListingPayload,
  ListingDetailItem,
  ListingFilterParams,
  PaginatedListingsResponse,
  PaginatedSavedPropertiesResponse,
  SavedPropertyItem,
  UpdateListingPayload,
} from '../types/listing'

export const listingService = {
  /**
   * Fetch public marketplace listings with search, filtering, and sorting.
   * Connects to GET /api/v1/listings/.
   */
  async getPublicListings(params?: ListingFilterParams): Promise<PaginatedListingsResponse> {
    const cleanParams: Record<string, unknown> = {}
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && value !== null) {
          cleanParams[key] = value
        }
      })
    }
    try {
      const response = await apiClient.get<PaginatedListingsResponse>('/listings/', {
        params: cleanParams,
      })
      return response.data
    } catch (error: unknown) {
      // Gracefully treat 404 (e.g., page out of bounds or empty listing filter set) as an empty results list
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          count: 0,
          next: null,
          previous: null,
          results: [],
        }
      }
      throw error
    }
  },

  /**
   * Retrieve all listings for properties owned by the authenticated owner.
   * Connects to GET /api/v1/listings/me/.
   */
  async getOwnerListings(params?: {
    page?: number
    page_size?: number
    status?: string
  }): Promise<PaginatedListingsResponse> {
    const response = await apiClient.get<PaginatedListingsResponse>('/listings/me/', {
      params,
    })
    return response.data
  },

  /**
   * Retrieve single listing detail by ID.
   * Connects to GET /api/v1/listings/{id}/.
   */
  async getListing(id: string): Promise<ApiResponse<ListingDetailItem>> {
    const response = await apiClient.get<ApiResponse<ListingDetailItem>>(`/listings/${id}/`)
    return response.data
  },

  /**
   * Create a new listing (draft or immediately published).
   * Connects to POST /api/v1/listings/.
   */
  async createListing(payload: CreateListingPayload): Promise<ApiResponse<ListingDetailItem>> {
    const response = await apiClient.post<ApiResponse<ListingDetailItem>>('/listings/', payload)
    return response.data
  },

  /**
   * Update editable fields of an existing listing.
   * Connects to PATCH /api/v1/listings/{id}/.
   */
  async updateListing(id: string, payload: UpdateListingPayload): Promise<ApiResponse<ListingDetailItem>> {
    const response = await apiClient.patch<ApiResponse<ListingDetailItem>>(`/listings/${id}/`, payload)
    return response.data
  },

  /**
   * Publish a draft or paused listing.
   * Connects to POST /api/v1/listings/{id}/publish/.
   */
  async publishListing(id: string): Promise<ApiResponse<ListingDetailItem>> {
    const response = await apiClient.post<ApiResponse<ListingDetailItem>>(`/listings/${id}/publish/`)
    return response.data
  },

  /**
   * Pause a published listing.
   * Connects to POST /api/v1/listings/{id}/pause/.
   */
  async pauseListing(id: string): Promise<ApiResponse<ListingDetailItem>> {
    const response = await apiClient.post<ApiResponse<ListingDetailItem>>(`/listings/${id}/pause/`)
    return response.data
  },

  /**
   * Close an open listing.
   * Connects to POST /api/v1/listings/{id}/close/.
   */
  async closeListing(id: string): Promise<ApiResponse<ListingDetailItem>> {
    const response = await apiClient.post<ApiResponse<ListingDetailItem>>(`/listings/${id}/close/`)
    return response.data
  },

  /**
   * Retrieve all saved properties for the authenticated user.
   * Connects to GET /api/v1/saved-properties/.
   */
  async getSavedProperties(params?: { page?: number; page_size?: number }): Promise<PaginatedSavedPropertiesResponse> {
    const response = await apiClient.get<PaginatedSavedPropertiesResponse>('/saved-properties/', { params })
    return response.data
  },

  /**
   * Save / bookmark a property for the authenticated user.
   * Connects to POST /api/v1/saved-properties/.
   */
  async saveProperty(propertyId: string): Promise<ApiResponse<SavedPropertyItem>> {
    const response = await apiClient.post<ApiResponse<SavedPropertyItem>>('/saved-properties/', {
      property_id: propertyId,
    })
    return response.data
  },

  /**
   * Remove a saved property bookmark for the authenticated user.
   * Connects to DELETE /api/v1/saved-properties/{property_id}/.
   */
  async removeSavedProperty(propertyId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`/saved-properties/${propertyId}/`)
    return response.data
  },
}


