import axios from 'axios'
import type { BadgeVariant } from '../components/ui/badge'
import type { ApiErrorResponse } from '../types/api'
import type { ApplicationStatus } from '../types/leasing'

export interface ApplicationStatusMeta {
  label: string
  variant: BadgeVariant
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, ApplicationStatusMeta> = {
  submitted: {
    label: 'Submitted',
    variant: 'info',
  },
  under_review: {
    label: 'Under Review',
    variant: 'warning',
  },
  approved: {
    label: 'Approved',
    variant: 'success',
  },
  rejected: {
    label: 'Rejected',
    variant: 'danger',
  },
  withdrawn: {
    label: 'Withdrawn',
    variant: 'neutral',
  },
  tenancy_cancelled: {
    label: 'Tenancy Cancelled',
    variant: 'warning',
  },
}

export function getApplicationStatusMeta(status: string): ApplicationStatusMeta {
  if (status in APPLICATION_STATUS_META) {
    return APPLICATION_STATUS_META[status as ApplicationStatus]
  }
  return {
    label: status.replace(/_/g, ' '),
    variant: 'neutral',
  }
}

/**
 * Matches backend eligibility rule in `apps.leasing.services.withdraw_application`:
 * Only applications in `submitted` or `under_review` status can be withdrawn.
 */
export function isWithdrawableApplication(status: ApplicationStatus | string): boolean {
  return status === 'submitted' || status === 'under_review'
}

/**
 * Matches backend partial unique constraint & eligibility rule:
 * Only one active application (`submitted`, `under_review`, or `approved`) is allowed per listing.
 */
export function isActiveApplicationStatus(status: ApplicationStatus | string): boolean {
  return (
    status === 'submitted' ||
    status === 'under_review' ||
    status === 'approved'
  )
}

/**
 * Matches backend eligibility rule in `apps.leasing.services.review_application`:
 * Only applications in `submitted` or `under_review` status can be reviewed by the owner.
 */
export function isReviewableApplication(status: ApplicationStatus | string): boolean {
  return status === 'submitted' || status === 'under_review'
}

export function formatINR(value?: string | number | null): string | null {
  if (value === undefined || value === null || value === '') return null
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(num)) return null
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined
    if (data?.message) return data.message
    if (data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
      const firstValue = Object.values(data.errors)[0]
      if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
        return firstValue[0]
      }
      if (typeof firstValue === 'string') {
        return firstValue
      }
    }
  } else if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

