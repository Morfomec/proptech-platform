import type { BadgeVariant } from '../components/ui/badge'
import type { NotificationItem } from '../types/notification'

export type NotificationIconKind = 'application' | 'tenancy' | 'document' | 'general'

export interface NotificationTypeMeta {
  label: string
  variant: BadgeVariant
  iconKind: NotificationIconKind
}

const NOTIFICATION_TYPE_MAP: Record<string, NotificationTypeMeta> = {
  application_submitted: {
    label: 'Application',
    variant: 'info',
    iconKind: 'application',
  },
  application_under_review: {
    label: 'Under Review',
    variant: 'warning',
    iconKind: 'application',
  },
  application_approved: {
    label: 'Approved',
    variant: 'success',
    iconKind: 'application',
  },
  application_rejected: {
    label: 'Rejected',
    variant: 'danger',
    iconKind: 'application',
  },
  application_withdrawn: {
    label: 'Withdrawn',
    variant: 'neutral',
    iconKind: 'application',
  },
  tenancy_created: {
    label: 'Tenancy',
    variant: 'info',
    iconKind: 'tenancy',
  },
  tenancy_confirmed: {
    label: 'Tenancy Confirmed',
    variant: 'success',
    iconKind: 'tenancy',
  },
  tenancy_activated: {
    label: 'Tenancy Active',
    variant: 'success',
    iconKind: 'tenancy',
  },
  tenancy_cancelled: {
    label: 'Tenancy Cancelled',
    variant: 'danger',
    iconKind: 'tenancy',
  },
  tenancy_ended: {
    label: 'Tenancy Ended',
    variant: 'neutral',
    iconKind: 'tenancy',
  },
  document_uploaded: {
    label: 'Document',
    variant: 'info',
    iconKind: 'document',
  },
}

export function getNotificationTypeMeta(notificationType: string): NotificationTypeMeta {
  if (NOTIFICATION_TYPE_MAP[notificationType]) {
    return NOTIFICATION_TYPE_MAP[notificationType]
  }
  if (notificationType.startsWith('application_')) {
    return { label: 'Application', variant: 'info', iconKind: 'application' }
  }
  if (notificationType.startsWith('tenancy_')) {
    return { label: 'Tenancy', variant: 'info', iconKind: 'tenancy' }
  }
  if (notificationType.startsWith('document_')) {
    return { label: 'Document', variant: 'info', iconKind: 'document' }
  }
  return { label: 'Update', variant: 'neutral', iconKind: 'general' }
}

export interface NotificationTarget {
  path: string
  label: string
}

/**
 * Resolves a safe Tenant Workspace destination route only for explicitly supported
 * backend related object types (`application`, `tenancy`, `document`).
 */
export function getTenantNotificationTarget(
  item: NotificationItem
): NotificationTarget | null {
  if (item.related_object_type === 'application' && item.related_object_id) {
    return {
      path: `/app/tenant/applications/${item.related_object_id}`,
      label: 'View Application',
    }
  }
  if (item.related_object_type === 'tenancy' && item.related_object_id) {
    return {
      path: '/app/tenant/tenancy',
      label: 'View Tenancy',
    }
  }
  if (item.related_object_type === 'document' && item.related_object_id) {
    return {
      path: '/app/tenant/documents',
      label: 'View Documents',
    }
  }
  return null
}

/**
 * Resolves a safe Owner Workspace destination route only for explicitly supported
 * backend related object types (`application`, `tenancy`, `document`).
 */
export function getOwnerNotificationTarget(
  item: NotificationItem
): NotificationTarget | null {
  if (item.related_object_type === 'application' && item.related_object_id) {
    return {
      path: `/app/owner/applications/${item.related_object_id}`,
      label: 'View Application',
    }
  }
  if (item.related_object_type === 'tenancy' && item.related_object_id) {
    return {
      path: `/app/owner/tenancies/${item.related_object_id}`,
      label: 'View Tenancy',
    }
  }
  if (item.related_object_type === 'document' && item.related_object_id) {
    return {
      path: '/app/owner/documents',
      label: 'View Documents',
    }
  }
  return null
}

export function formatNotificationDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

