import apiClient from '../api/client'
import type { ApiResponse, PaginatedResponse } from '../types/api'
import type {
  ApplicationDetail,
  ApplicationListItem,
  CreateApplicationPayload,
  ReviewApplicationPayload,
  WithdrawApplicationPayload,
} from '../types/leasing'

export interface PaginationParams {
  page?: number
  page_size?: number
}

export interface ReceivedApplicationsParams extends PaginationParams {
  status?: string
}

export const applicationService = {
  /**
   * Fetches the authenticated tenant's rental applications.
   * Connects to GET /api/v1/applications/me/.
   */
  async getMyApplications(
    params?: PaginationParams
  ): Promise<PaginatedResponse<ApplicationListItem>> {
    const response = await apiClient.get<PaginatedResponse<ApplicationListItem>>(
      '/applications/me/',
      { params }
    )
    return response.data
  },

  /**
   * Fetches detailed application record including status history.
   * Connects to GET /api/v1/applications/{id}/.
   */
  async getApplicationDetail(
    applicationId: string
  ): Promise<ApiResponse<ApplicationDetail>> {
    const response = await apiClient.get<ApiResponse<ApplicationDetail>>(
      `/applications/${applicationId}/`
    )
    return response.data
  },

  /**
   * Submits a rental application for a published listing.
   * Connects to POST /api/v1/applications/.
   */
  async submitApplication(
    payload: CreateApplicationPayload
  ): Promise<ApiResponse<ApplicationDetail>> {
    const response = await apiClient.post<ApiResponse<ApplicationDetail>>(
      '/applications/',
      payload
    )
    return response.data
  },

  /**
   * Withdraws a pending ('submitted' or 'under_review') application owned by the tenant.
   * Connects to POST /api/v1/applications/{id}/withdraw/.
   */
  async withdrawApplication(
    applicationId: string,
    payload?: WithdrawApplicationPayload
  ): Promise<ApiResponse<ApplicationDetail>> {
    const response = await apiClient.post<ApiResponse<ApplicationDetail>>(
      `/applications/${applicationId}/withdraw/`,
      payload ?? {}
    )
    return response.data
  },

  /**
   * Fetches rental applications received for listings owned by the authenticated owner.
   * Connects to GET /api/v1/applications/received/.
   */
  async getReceivedApplications(
    params?: ReceivedApplicationsParams
  ): Promise<PaginatedResponse<ApplicationListItem>> {
    const response = await apiClient.get<PaginatedResponse<ApplicationListItem>>(
      '/applications/received/',
      { params }
    )
    return response.data
  },

  /**
   * Reviews a pending rental application ('under_review', 'approved', or 'rejected').
   * Connects to POST /api/v1/applications/{id}/review/.
   */
  async reviewApplication(
    applicationId: string,
    payload: ReviewApplicationPayload
  ): Promise<ApiResponse<ApplicationDetail>> {
    const response = await apiClient.post<ApiResponse<ApplicationDetail>>(
      `/applications/${applicationId}/review/`,
      payload
    )
    return response.data
  },
}

export default applicationService

