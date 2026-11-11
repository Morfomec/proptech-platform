import apiClient from '../api/client'
import type { ApiResponse, PaginatedResponse } from '../types/api'
import type { NotificationItem, UnreadCountData } from '../types/notification'
import type { PaginationParams } from './application.service'

export interface NotificationListParams extends PaginationParams {
  is_read?: boolean
}

export const notificationService = {
  /**
   * Fetches notifications scoped to the authenticated recipient.
   * Connects to GET /api/v1/notifications/.
   */
  async getNotifications(
    params?: NotificationListParams
  ): Promise<PaginatedResponse<NotificationItem>> {
    const response = await apiClient.get<PaginatedResponse<NotificationItem>>(
      '/notifications/',
      { params }
    )
    return response.data
  },

  /**
   * Fetches the authenticated user's unread notification count.
   * Connects to GET /api/v1/notifications/unread-count/.
   */
  async getUnreadCount(): Promise<ApiResponse<UnreadCountData>> {
    const response = await apiClient.get<ApiResponse<UnreadCountData>>(
      '/notifications/unread-count/'
    )
    return response.data
  },

  /**
   * Marks a single notification as read.
   * Connects to POST /api/v1/notifications/{id}/read/.
   */
  async markAsRead(notificationId: string): Promise<ApiResponse<NotificationItem>> {
    const response = await apiClient.post<ApiResponse<NotificationItem>>(
      `/notifications/${notificationId}/read/`
    )
    return response.data
  },

  /**
   * Marks all notifications for the current user as read.
   * Connects to POST /api/v1/notifications/read-all/.
   */
  async markAllAsRead(): Promise<ApiResponse<{ updated_count?: number } | null>> {
    const response = await apiClient.post<ApiResponse<{ updated_count?: number } | null>>(
      '/notifications/read-all/'
    )
    return response.data
  },
}

export default notificationService

