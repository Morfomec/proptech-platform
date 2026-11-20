import apiClient from '../api/client'
import type { ApiResponse, PaginatedResponse } from '../types/api'
import type {
  QuotaUtilization,
  SubscriptionDetail,
  SubscriptionPaymentItem,
  SubscriptionPaymentsQueryParams,
  SubscriptionPlanItem,
  UpgradeSubscriptionPayload,
} from '../types/subscription'

export const subscriptionService = {
  /**
   * Public/Owner retrieval of all active subscription plan tiers.
   * Connects to GET /api/v1/subscription-plans/.
   */
  async getActivePlans(): Promise<ApiResponse<SubscriptionPlanItem[]>> {
    const response = await apiClient.get<ApiResponse<SubscriptionPlanItem[]>>(
      '/subscription-plans/'
    )
    return response.data
  },

  /**
   * Explicitly activates the Starter 90-day trial for a verified user and grants owner capability.
   * Connects to POST /api/v1/subscriptions/activate-trial/.
   */
  async activateOwnerTrial(): Promise<ApiResponse<SubscriptionDetail>> {
    const response = await apiClient.post<ApiResponse<SubscriptionDetail>>(
      '/subscriptions/activate-trial/',
      {}
    )
    return response.data
  },

  /**
   * Retrieves the authenticated owner's current subscription and trial details.
   * Connects to GET /api/v1/subscriptions/me/.
   */
  async getMySubscription(): Promise<ApiResponse<SubscriptionDetail>> {
    const response = await apiClient.get<ApiResponse<SubscriptionDetail>>(
      '/subscriptions/me/'
    )
    return response.data
  },

  /**
   * Retrieves the owner's property count vs plan limits and quota entitlement.
   * Connects to GET /api/v1/subscriptions/quota/.
   */
  async getQuotaUtilization(): Promise<ApiResponse<QuotaUtilization>> {
    const response = await apiClient.get<ApiResponse<QuotaUtilization>>(
      '/subscriptions/quota/'
    )
    return response.data
  },

  /**
   * Upgrades or switches the owner's subscription to a new active plan.
   * Connects to POST /api/v1/subscriptions/upgrade/.
   */
  async upgradeSubscription(
    payload: UpgradeSubscriptionPayload
  ): Promise<ApiResponse<SubscriptionDetail>> {
    const response = await apiClient.post<ApiResponse<SubscriptionDetail>>(
      '/subscriptions/upgrade/',
      payload
    )
    return response.data
  },

  /**
   * Cancels the owner's active subscription.
   * Connects to POST /api/v1/subscriptions/cancel/.
   */
  async cancelSubscription(): Promise<ApiResponse<SubscriptionDetail>> {
    const response = await apiClient.post<ApiResponse<SubscriptionDetail>>(
      '/subscriptions/cancel/',
      {}
    )
    return response.data
  },

  /**
   * Retrieves the owner's subscription payment and billing logs.
   * Connects to GET /api/v1/subscriptions/payments/.
   */
  async getSubscriptionPayments(
    params?: SubscriptionPaymentsQueryParams
  ): Promise<PaginatedResponse<SubscriptionPaymentItem>> {
    const response = await apiClient.get<
      PaginatedResponse<SubscriptionPaymentItem> | ApiResponse<SubscriptionPaymentItem[]>
    >('/subscriptions/payments/', { params })

    // Normalizes paginated vs unpaginated array fallback
    const resData = response.data as unknown
    if (
      resData &&
      typeof resData === 'object' &&
      'results' in resData &&
      Array.isArray((resData as PaginatedResponse<SubscriptionPaymentItem>).results)
    ) {
      const paginated = resData as PaginatedResponse<SubscriptionPaymentItem>
      return {
        success: true,
        message: paginated.message || 'Payment history retrieved.',
        count: paginated.count,
        next: paginated.next,
        previous: paginated.previous,
        results: paginated.results,
      }
    }

    if (
      resData &&
      typeof resData === 'object' &&
      'data' in resData &&
      Array.isArray((resData as ApiResponse<SubscriptionPaymentItem[]>).data)
    ) {
      const items = (resData as ApiResponse<SubscriptionPaymentItem[]>).data ?? []
      return {
        success: true,
        message: 'Payment history retrieved.',
        count: items.length,
        next: null,
        previous: null,
        results: items,
      }
    }

    return {
      success: true,
      message: 'No records found.',
      count: 0,
      next: null,
      previous: null,
      results: [],
    }
  },
}

export default subscriptionService
