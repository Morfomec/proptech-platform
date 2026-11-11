/**
 * Domain types for Leasing (Applications & Tenancies).
 * Strictly aligned with backend serializers in apps.leasing.
 */

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

export interface ApplicationListItem {
  id: string
  listing: string
  listing_title: string
  property_id?: string
  property_title: string
  applicant: string
  applicant_name: string
  status: ApplicationStatus
  message: string | null
  tenancy_id?: string | null
  reviewed_at: string | null
  created_at: string
}

export interface ApplicationStatusHistoryItem {
  id: string
  previous_status: ApplicationStatus | string | null
  new_status: ApplicationStatus | string
  changed_by: string | null
  changed_by_name: string | null
  change_reason: string | null
  created_at: string
}

export interface ApplicationDetail extends ApplicationListItem {
  reviewed_by: string | null
  updated_at: string
  status_history: ApplicationStatusHistoryItem[]
}

export interface WithdrawApplicationPayload {
  change_reason?: string | null
}

export interface CreateApplicationPayload {
  listing_id: string
  message?: string | null
}

export type OwnerReviewApplicationStatus = 'under_review' | 'approved' | 'rejected'

export interface ReviewApplicationPayload {
  status: OwnerReviewApplicationStatus
  change_reason?: string | null
}

export type TenancyStatus =
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'ended'
  | 'cancelled'

export interface TenancyListItem {
  id: string
  property_id: string
  property_title?: string
  property_address?: string
  tenant_id: string
  tenant_name?: string
  application_id: string | null
  start_date: string | null
  end_date: string | null
  monthly_rent: string
  security_deposit: string
  status: TenancyStatus
  created_at: string
}

export interface TenancyDetail extends TenancyListItem {
  tenant_email?: string | null
  rent_due_day: number | null
  actual_move_in_date: string | null
  actual_move_out_date: string | null
  notes: string | null
  updated_at: string
}

export interface CreateTenancyPayload {
  property_id: string
  tenant_id: string
  application_id?: string | null
  start_date: string
  end_date?: string | null
  monthly_rent: string | number
  security_deposit?: string | number
  rent_due_day?: number
  notes?: string | null
}

export interface ActivateTenancyPayload {
  move_in_date?: string
}

export interface EndTenancyPayload {
  move_out_date?: string
}

