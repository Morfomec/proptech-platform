import apiClient from '../api/client'
import type { ApiResponse, PaginatedResponse } from '../types/api'
import type {
  CreateRefundPayload,
  FinancialTransactionItem,
  FinancialTransactionsQueryParams,
  PaymentItem,
  PaymentRefundItem,
  PaymentsQueryParams,
  RecordPaymentPayload,
  RefundsQueryParams,
  RentChargeItem,
  RentChargesQueryParams,
  RentSummary,
  SecurityDepositItem,
} from '../types/rent'

export const rentService = {
  /**
   * Fetches portfolio-level or tenancy-scoped financial summary aggregates.
   * Connects to GET /api/v1/rent/summary/.
   */
  async getRentSummary(params?: {
    tenancy_id?: string
    property_id?: string
  }): Promise<ApiResponse<RentSummary>> {
    const response = await apiClient.get<ApiResponse<RentSummary>>(
      '/rent/summary/',
      { params }
    )
    return response.data
  },

  /**
   * Fetches security deposits breakdown across tenancies.
   * Connects to GET /api/v1/rent/security-deposits/.
   */
  async getSecurityDeposits(params?: {
    role?: string
    tenancy_id?: string
    property_id?: string
  }): Promise<ApiResponse<SecurityDepositItem[]>> {
    const response = await apiClient.get<ApiResponse<SecurityDepositItem[]>>(
      '/rent/security-deposits/',
      { params }
    )
    return response.data
  },

  /**
   * Fetches rent charges across the authenticated user's portfolio.
   * Connects to GET /api/v1/rent-charges/.
   */
  async getRentCharges(
    params?: RentChargesQueryParams
  ): Promise<PaginatedResponse<RentChargeItem>> {
    const response = await apiClient.get<PaginatedResponse<RentChargeItem>>(
      '/rent-charges/',
      { params }
    )
    return response.data
  },

  /**
   * Fetches details of a specific rent charge.
   * Connects to GET /api/v1/rent-charges/{id}/.
   */
  async getRentChargeDetail(
    chargeId: string
  ): Promise<ApiResponse<RentChargeItem>> {
    const response = await apiClient.get<ApiResponse<RentChargeItem>>(
      `/rent-charges/${chargeId}/`
    )
    return response.data
  },

  /**
   * Fetches payments recorded across the user's tenancies.
   * Connects to GET /api/v1/payments/.
   */
  async getPayments(
    params?: PaymentsQueryParams
  ): Promise<PaginatedResponse<PaymentItem>> {
    const response = await apiClient.get<PaginatedResponse<PaymentItem>>(
      '/payments/',
      { params }
    )
    return response.data
  },

  /**
   * Fetches full payment details including rent charge allocations.
   * Connects to GET /api/v1/payments/{id}/.
   */
  async getPaymentDetail(paymentId: string): Promise<ApiResponse<PaymentItem>> {
    const response = await apiClient.get<ApiResponse<PaymentItem>>(
      `/payments/${paymentId}/`
    )
    return response.data
  },

  /**
   * Records a manual payment receipt for a tenancy.
   * Connects to POST /api/v1/payments/.
   */
  async recordPayment(
    payload: RecordPaymentPayload
  ): Promise<ApiResponse<PaymentItem>> {
    const response = await apiClient.post<ApiResponse<PaymentItem>>(
      '/payments/',
      payload
    )
    return response.data
  },

  /**
   * Fetches refunds history across the portfolio.
   * Connects to GET /api/v1/refunds/.
   */
  async getRefunds(
    params?: RefundsQueryParams
  ): Promise<PaginatedResponse<PaymentRefundItem>> {
    const response = await apiClient.get<PaginatedResponse<PaymentRefundItem>>(
      '/refunds/',
      { params }
    )
    return response.data
  },

  /**
   * Creates a refund against a completed payment.
   * Connects to POST /api/v1/payments/{id}/refunds/.
   */
  async createRefund(
    payload: CreateRefundPayload
  ): Promise<ApiResponse<PaymentRefundItem>> {
    const { payment_id, ...data } = payload
    const response = await apiClient.post<ApiResponse<PaymentRefundItem>>(
      `/payments/${payment_id}/refunds/`,
      data
    )
    return response.data
  },

  /**
   * Fetches unified chronological financial transactions (payments and refunds).
   * Connects to GET /api/v1/rent/transactions/.
   */
  async getFinancialTransactions(
    params?: FinancialTransactionsQueryParams
  ): Promise<PaginatedResponse<FinancialTransactionItem>> {
    const response = await apiClient.get<PaginatedResponse<FinancialTransactionItem>>(
      '/rent/transactions/',
      { params }
    )
    return response.data
  },
}

export default rentService

