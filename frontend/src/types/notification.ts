/**
 * Domain types for Notifications.
 * Strictly aligned with backend serializers in apps.notifications.
 */

export type RelatedObjectType = 'application' | 'tenancy' | 'document' | null

export interface NotificationItem {
  id: string
  notification_type: string
  title: string
  message: string
  related_object_type: RelatedObjectType
  related_object_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface UnreadCountData {
  unread_count: number
}

