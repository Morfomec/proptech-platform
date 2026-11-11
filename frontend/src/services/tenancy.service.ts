import apiClient from '../api/client'
import type { ApiResponse, PaginatedResponse } from '../types/api'
import type {
  ActivateTenancyPayload,
  CreateTenancyPayload,
  EndTenancyPayload,
  TenancyDetail,
  TenancyListItem,
  TenancyStatus,
} from '../types/leasing'
import type { PaginationParams } from './application.service'

export interface ManagedTenanciesParams extends PaginationParams {
  status?: TenancyStatus
}

export const tenancyService = {
  /**
   * Fetches the authenticated tenant's tenancies.
   * Connects to GET /api/v1/tenancies/me/.
   */
  async getMyTenancies(
    params?: PaginationParams
  ): Promise<PaginatedResponse<TenancyListItem>> {
    const response = await apiClient.get<PaginatedResponse<TenancyListItem>>(
      '/tenancies/me/',
      { params }
    )
    return response.data
  },

  /**
   * Fetches tenancies managed by the authenticated property owner.
   * Connects to GET /api/v1/tenancies/managed/.
   */
  async getManagedTenancies(
    params?: ManagedTenanciesParams
  ): Promise<PaginatedResponse<TenancyListItem>> {
    const response = await apiClient.get<PaginatedResponse<TenancyListItem>>(
      '/tenancies/managed/',
      { params }
    )
    return response.data
  },

  /**
   * Fetches detailed view of a specific tenancy accessible to the user.
   * Connects to GET /api/v1/tenancies/{id}/.
   */
  async getTenancyDetail(tenancyId: string): Promise<ApiResponse<TenancyDetail>> {
    const response = await apiClient.get<ApiResponse<TenancyDetail>>(
      `/tenancies/${tenancyId}/`
    )
    return response.data
  },

  /**
   * Creates a pending tenancy agreement for an owner's property.
   * Connects to POST /api/v1/tenancies/.
   */
  async createTenancy(
    payload: CreateTenancyPayload
  ): Promise<ApiResponse<TenancyDetail>> {
    const response = await apiClient.post<ApiResponse<TenancyDetail>>(
      '/tenancies/',
      payload
    )
    return response.data
  },

  /**
   * Confirms a pending tenancy (pending -> confirmed).
   * Connects to POST /api/v1/tenancies/{id}/confirm/.
   */
  async confirmTenancy(tenancyId: string): Promise<ApiResponse<TenancyDetail>> {
    const response = await apiClient.post<ApiResponse<TenancyDetail>>(
      `/tenancies/${tenancyId}/confirm/`,
      {}
    )
    return response.data
  },

  /**
   * Activates a confirmed tenancy upon tenant move-in (confirmed -> active).
   * Connects to POST /api/v1/tenancies/{id}/activate/.
   */
  async activateTenancy(
    tenancyId: string,
    payload?: ActivateTenancyPayload
  ): Promise<ApiResponse<TenancyDetail>> {
    const response = await apiClient.post<ApiResponse<TenancyDetail>>(
      `/tenancies/${tenancyId}/activate/`,
      payload ?? {}
    )
    return response.data
  },

  /**
   * Cancels a pending or confirmed tenancy (pending|confirmed -> cancelled).
   * Connects to POST /api/v1/tenancies/{id}/cancel/.
   */
  async cancelTenancy(tenancyId: string): Promise<ApiResponse<TenancyDetail>> {
    const response = await apiClient.post<ApiResponse<TenancyDetail>>(
      `/tenancies/${tenancyId}/cancel/`,
      {}
    )
    return response.data
  },

  /**
   * Ends an active tenancy upon tenant checkout/move-out (active -> ended).
   * Connects to POST /api/v1/tenancies/{id}/end/.
   */
  async endTenancy(
    tenancyId: string,
    payload?: EndTenancyPayload
  ): Promise<ApiResponse<TenancyDetail>> {
    const response = await apiClient.post<ApiResponse<TenancyDetail>>(
      `/tenancies/${tenancyId}/end/`,
      payload ?? {}
    )
    return response.data
  },
}

export default tenancyService

