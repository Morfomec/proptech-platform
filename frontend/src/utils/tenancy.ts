import type { BadgeVariant } from '../components/ui/badge'
import type { TenancyListItem, TenancyStatus } from '../types/leasing'

export interface TenancyStatusMeta {
  label: string
  variant: BadgeVariant
  description: string
  isCurrentGroup: boolean
}

export const TENANCY_STATUS_META: Record<TenancyStatus, TenancyStatusMeta> = {
  active: {
    label: 'Active Tenancy',
    variant: 'success',
    description: 'Your tenancy is currently active and move-in has been recorded.',
    isCurrentGroup: true,
  },
  confirmed: {
    label: 'Confirmed',
    variant: 'info',
    description: 'Your tenancy is confirmed and awaiting activation on move-in.',
    isCurrentGroup: true,
  },
  pending: {
    label: 'Pending',
    variant: 'warning',
    description: 'Tenancy terms have been created and await owner confirmation.',
    isCurrentGroup: true,
  },
  ended: {
    label: 'Ended',
    variant: 'neutral',
    description: 'This tenancy has concluded and move-out has been recorded.',
    isCurrentGroup: false,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'danger',
    description: 'This tenancy was cancelled prior to activation.',
    isCurrentGroup: false,
  },
}

export function getTenancyStatusMeta(status: TenancyStatus | string): TenancyStatusMeta {
  if (status in TENANCY_STATUS_META) {
    return TENANCY_STATUS_META[status as TenancyStatus]
  }
  return {
    label: status.replace(/_/g, ' '),
    variant: 'neutral',
    description: '',
    isCurrentGroup: false,
  }
}

export function isCurrentTenancyStatus(status: TenancyStatus | string): boolean {
  return status === 'active' || status === 'confirmed' || status === 'pending'
}

export function pickPrioritizedTenancy(tenancies: TenancyListItem[]): TenancyListItem | null {
  if (tenancies.length === 0) return null
  const priority: TenancyStatus[] = ['active', 'confirmed', 'pending', 'ended', 'cancelled']
  for (const status of priority) {
    const match = tenancies.find((t) => t.status === status)
    if (match) return match
  }
  return tenancies[0]
}

export function calculateContractDurationLabel(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  if (!startDate) return '—'
  if (!endDate) return 'Open-ended (no fixed end date)'

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return '—'
  }

  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (totalDays >= 365) {
    const months = Math.round(totalDays / 30.4375)
    return `${months} months (${totalDays} days)`
  }
  if (totalDays >= 60) {
    const months = Math.round(totalDays / 30.4375)
    return `${months} months (${totalDays} days)`
  }
  return `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`
}

export function calculateTenancyProgress(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): { percent: number; daysRemaining: number } | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()

  const total = end - start
  const elapsed = Math.min(total, Math.max(0, todayMs - start))
  const percent = Math.round((elapsed / total) * 100)
  const daysRemaining = Math.max(0, Math.ceil((end - todayMs) / (1000 * 60 * 60 * 24)))

  return { percent, daysRemaining }
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const OWNER_TENANCY_STATUS_META: Record<TenancyStatus, TenancyStatusMeta> = {
  pending: {
    label: 'Pending Confirmation',
    variant: 'warning',
    description: 'Tenancy terms are saved and awaiting your confirmation.',
    isCurrentGroup: true,
  },
  confirmed: {
    label: 'Upcoming',
    variant: 'info',
    description: 'Tenancy is confirmed and ready to activate upon tenant move-in.',
    isCurrentGroup: true,
  },
  active: {
    label: 'Active',
    variant: 'success',
    description: 'Tenancy is currently active and move-in has been recorded.',
    isCurrentGroup: true,
  },
  ended: {
    label: 'Completed',
    variant: 'neutral',
    description: 'Tenancy has concluded and tenant checkout has been recorded.',
    isCurrentGroup: false,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'danger',
    description: 'Tenancy was cancelled before move-in activation.',
    isCurrentGroup: false,
  },
}

export function getOwnerTenancyStatusMeta(status: TenancyStatus | string): TenancyStatusMeta {
  if (status in OWNER_TENANCY_STATUS_META) {
    return OWNER_TENANCY_STATUS_META[status as TenancyStatus]
  }
  return getTenancyStatusMeta(status)
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  rental_agreement: 'Rental Agreement',
  id_proof: 'ID Proof',
  income_proof: 'Income Proof',
  property_document: 'Property Document',
  other: 'Document',
}

