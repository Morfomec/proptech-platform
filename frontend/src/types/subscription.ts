/**
 * Subscription Type Definitions
 * Aligned with backend apps.subscriptions serializers and models.
 */

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'

export interface SubscriptionPlanItem {
  id: string
  name: string
  code: string
  min_properties: number
  max_properties: number | null
  monthly_price: string | null
  currency: string
  trial_duration_months: number
  is_active: boolean
  is_custom_pricing: boolean
  is_unlimited_properties: boolean
  created_at: string
  updated_at: string
}

export interface SubscriptionDetail {
  id: string
  owner_id: string
  owner_email: string
  plan: SubscriptionPlanItem
  status: SubscriptionStatus
  trial_started_at: string | null
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  started_at: string
  cancelled_at: string | null
  is_entitled_to_quota: boolean
  created_at: string
  updated_at: string
}

export interface QuotaUtilization {
  properties_count: number
  max_properties: number | null
  min_properties: number
  remaining_quota: number | null
  is_quota_exceeded: boolean
  is_entitled: boolean
  plan: SubscriptionPlanItem
}

export type SubscriptionPaymentStatus =
  | 'successful'
  | 'pending'
  | 'failed'
  | 'refunded'

export interface SubscriptionPaymentItem {
  id: string
  subscription: string
  plan: string
  plan_name: string
  plan_code: string
  amount: string
  currency: string
  payment_method: string
  transaction_reference: string | null
  status: SubscriptionPaymentStatus
  billing_period_start: string | null
  billing_period_end: string | null
  paid_at: string | null
  created_at: string
}

export interface UpgradeSubscriptionPayload {
  plan_code: string
}

export interface SubscriptionPaymentsQueryParams {
  page?: number
  page_size?: number
}

