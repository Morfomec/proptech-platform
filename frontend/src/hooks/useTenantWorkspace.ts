import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import applicationService, { type PaginationParams } from '../services/application.service'
import tenancyService from '../services/tenancy.service'
import documentService from '../services/document.service'
import notificationService, { type NotificationListParams } from '../services/notification.service'
import { listingService } from '../services/listing.service'
import { useAuth } from './useAuth'
import type {
  CreateApplicationPayload,
  WithdrawApplicationPayload,
} from '../types/leasing'
import type { UpdateDocumentPayload, UploadDocumentPayload } from '../types/document'

export const TENANT_QUERY_KEYS = {
  myApplications: ['tenant', 'applications'] as const,
  applicationDetail: (applicationId: string) =>
    ['tenant', 'applications', 'detail', applicationId] as const,
  myTenancies: ['tenant', 'tenancies'] as const,
  tenancyDetail: (tenancyId: string) =>
    ['tenant', 'tenancies', 'detail', tenancyId] as const,
  documents: ['tenant', 'documents'] as const,
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  savedProperties: ['saved-properties'] as const,
}

export function useMyApplications(params?: PaginationParams) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...TENANT_QUERY_KEYS.myApplications, params],
    queryFn: () => applicationService.getMyApplications(params),
    enabled: isAuthenticated && Boolean(user?.is_tenant),
    staleTime: 30_000,
  })
}

export function useApplicationDetail(applicationId?: string) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: TENANT_QUERY_KEYS.applicationDetail(applicationId ?? ''),
    queryFn: () => applicationService.getApplicationDetail(applicationId!),
    enabled: isAuthenticated && Boolean(user?.is_tenant) && Boolean(applicationId),
    staleTime: 30_000,
  })
}

export function useSubmitApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateApplicationPayload) =>
      applicationService.submitApplication(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.myApplications })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.notifications })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.unreadCount })
    },
  })
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      applicationId,
      payload,
    }: {
      applicationId: string
      payload?: WithdrawApplicationPayload
    }) => applicationService.withdrawApplication(applicationId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.myApplications })
      queryClient.invalidateQueries({
        queryKey: TENANT_QUERY_KEYS.applicationDetail(variables.applicationId),
      })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.notifications })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.unreadCount })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.myTenancies })
    },
  })
}

export function useMyTenancies(params?: PaginationParams) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: [...TENANT_QUERY_KEYS.myTenancies, params],
    queryFn: () => tenancyService.getMyTenancies(params),
    enabled: isAuthenticated && Boolean(user?.is_tenant),
    staleTime: 30_000,
  })
}

export function useTenancyDetail(tenancyId?: string) {
  const { isAuthenticated, user } = useAuth()
  return useQuery({
    queryKey: TENANT_QUERY_KEYS.tenancyDetail(tenancyId ?? ''),
    queryFn: () => tenancyService.getTenancyDetail(tenancyId!),
    enabled: isAuthenticated && Boolean(user?.is_tenant) && Boolean(tenancyId),
    staleTime: 30_000,
  })
}

export function useDocuments(params?: PaginationParams) {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: [...TENANT_QUERY_KEYS.documents, params],
    queryFn: () => documentService.getDocuments(params),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
}

export interface UploadDocumentVariables {
  payload: UploadDocumentPayload
  onUploadProgress?: (percent: number) => void
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variables: UploadDocumentVariables | UploadDocumentPayload) => {
      if ('payload' in variables) {
        return documentService.uploadDocument(
          variables.payload,
          variables.onUploadProgress
        )
      }
      return documentService.uploadDocument(variables)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.documents })
      queryClient.invalidateQueries({ queryKey: ['owner', 'documents'] })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.notifications })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.unreadCount })
    },
  })
}

export interface UpdateDocumentVariables {
  documentId: string
  payload: UpdateDocumentPayload
  onUploadProgress?: (percent: number) => void
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, payload, onUploadProgress }: UpdateDocumentVariables) =>
      documentService.updateDocument(documentId, payload, onUploadProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.documents })
      queryClient.invalidateQueries({ queryKey: ['owner', 'documents'] })
    },
  })
}

export function useSavedPropertiesCount() {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: TENANT_QUERY_KEYS.savedProperties,
    queryFn: () => listingService.getSavedProperties({ page: 1, page_size: 1 }),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
}

export function useNotifications(params?: NotificationListParams) {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: [...TENANT_QUERY_KEYS.notifications, params],
    queryFn: () => notificationService.getNotifications(params),
    enabled: isAuthenticated,
    staleTime: 15_000,
  })
}

export function useUnreadNotificationCount() {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: TENANT_QUERY_KEYS.unreadCount,
    queryFn: () => notificationService.getUnreadCount(),
    enabled: isAuthenticated,
    staleTime: 15_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.notifications })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.unreadCount })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.notifications })
      queryClient.invalidateQueries({ queryKey: TENANT_QUERY_KEYS.unreadCount })
    },
  })
}

