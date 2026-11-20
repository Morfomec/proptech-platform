/**
 * Rent & Payments Domain Types
 * Strictly aligned with backend DRF apps.rent models, serializers, and endpoints.
 */

export type RentChargeType =
  | 'rent'
  | 'security_deposit'
  | 'late_fee'
  | 'utility'
  | 'maintenance'
  | 'other'

export type RentChargeStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'waived'
  | 'cancelled'

export interface RentChargeItem {
  id: string
  tenancy: string
  property_id: string
  property_title: string
  tenant_id: string
  tenant_name: string
  charge_type: RentChargeType
  charge_type_display: string
  billing_period_start: string
  billing_period_end: string
  due_date: string
  amount: string
  paid_amount: string
  outstanding_amount: string
  status: RentChargeStatus
  status_display: string
  is_overdue: boolean
  description?: string | null
  created_at: string
  updated_at: string
}

export interface RentSummary {
  total_billed: string
  total_collected: string
  rent_collected_this_month?: string
  outstanding_rent: string
  rent_pending?: string
  overdue_rent: string
  upcoming_rent?: string
  total_active_rent_charges: number
  currency: string
  security_deposits_held?: string
  pending_deposit_collection?: string
  total_deposits_agreed?: string
  total_deposits_received?: string
  total_deposits_outstanding?: string
  total_deposits_refunded?: string
}

export interface SecurityDepositItem {
  tenancy_id: string
  property_id: string
  property_title: string
  tenant_id: string
  tenant_name: string
  tenant_email: string
  agreed_deposit: string
  deposit_received: string
  outstanding_deposit: string
  adjustments: string
  refunds: string
  deposit_held: string
  status: string
  status_display: string
  due_date?: string | null
  charge_id?: string | null
}

export type PaymentMethod =
  | 'upi'
  | 'bank_transfer'
  | 'card'
  | 'net_banking'
  | 'cash'
  | 'cheque'
  | 'other'

export type PaymentStatus = 'pending' | 'completed' | 'failed'

export interface PaymentAllocationItem {
  id: string
  rent_charge: string
  rent_charge_id: string
  charge_type: string
  billing_period_start: string
  billing_period_end: string
  allocated_amount: string
  allocated_at: string
  created_at: string
}

export interface PaymentItem {
  id: string
  tenancy: string
  property_title: string
  tenant_name: string
  amount: string
  currency: string
  payment_type?: 'rent' | 'security_deposit'
  payment_type_display?: string
  payment_method: PaymentMethod
  payment_method_display: string
  transaction_reference?: string | null
  status: PaymentStatus
  paid_at?: string | null
  notes?: string | null
  allocations?: PaymentAllocationItem[]
  created_at: string
  updated_at: string
}

export type PaymentRefundStatus = 'pending' | 'completed' | 'failed'

export interface PaymentAllocationReversalItem {
  id: string
  allocation: string
  rent_charge: string
  reversed_amount: string
  created_at: string
}

export interface PaymentRefundItem {
  id: string
  payment: string
  property_title?: string
  tenant_name?: string
  amount: string
  currency: string
  reason: string
  status: PaymentRefundStatus
  refund_reference?: string | null
  processed_at?: string | null
  created_by: string
  created_by_name: string
  allocation_reversals: PaymentAllocationReversalItem[]
  created_at: string
  updated_at: string
}

export interface RecordPaymentPayload {
  tenancy_id: string
  amount: string | number
  payment_method: PaymentMethod
  currency?: string
  transaction_reference?: string
  status?: PaymentStatus
  paid_at?: string
  notes?: string
  target_charge_type?: 'rent' | 'security_deposit'
  rent_charge_id?: string
}

export interface CreateRefundPayload {
  payment_id: string
  amount: string | number
  reason: string
  currency?: string
  refund_reference?: string
  status?: PaymentRefundStatus
}

export interface RentChargesQueryParams {
  role?: 'owner' | 'tenant'
  tenancy_id?: string
  property_id?: string
  status?: string
  charge_type?: string
  due_date_from?: string
  due_date_to?: string
  page?: number
  page_size?: number
}

export interface PaymentsQueryParams {
  role?: 'owner' | 'tenant'
  tenancy_id?: string
  page?: number
  page_size?: number
}

export interface RefundsQueryParams {
  role?: 'owner' | 'tenant'
  payment_id?: string
  status?: PaymentRefundStatus
  page?: number
  page_size?: number
}

export type FinancialTransactionType = 'rent_payment' | 'deposit_payment' | 'refund'

export interface FinancialTransactionItem {
  id: string
  transaction_type: FinancialTransactionType
  transaction_type_display: string
  tenancy_id: string
  property_id: string
  property_title: string
  tenant_id: string
  tenant_name: string
  tenant_email: string
  amount: string
  currency: string
  payment_method: string
  payment_method_display: string
  transaction_reference?: string | null
  date: string
  status: string
  status_display: string
  notes?: string | null
  payment_id?: string | null
}

export interface FinancialTransactionsQueryParams {
  role?: 'owner' | 'tenant'
  tenancy_id?: string
  property_id?: string
  transaction_type?: string
  page?: number
  page_size?: number
}

export interface TenancySettlementPreview {
  tenancy_id: string
  agreed_deposit: string
  deposit_received: string
  prior_refunds: string
  deposit_held: string
  max_refundable_amount: string
  status: string
}

export interface EndTenancyPayload {
  move_out_date?: string
  settle_deposit?: boolean
  deductions?: Array<{ reason: string; amount: string | number }>
  refund_amount?: string | number | null
  refund_reference?: string | null
}


