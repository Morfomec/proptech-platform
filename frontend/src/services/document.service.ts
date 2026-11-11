import apiClient from '../api/client'
import type { ApiResponse, PaginatedResponse } from '../types/api'
import type {
  DocumentItem,
  DocumentScope,
  UpdateDocumentPayload,
  UploadDocumentPayload,
} from '../types/document'
import type { PaginationParams } from './application.service'

export interface DocumentListParams extends PaginationParams {
  scope?: DocumentScope
  property_id?: string
  application_id?: string
  tenancy_id?: string
}

export interface DocumentBlobResult {
  blob: Blob
  filename: string
  mimeType: string
}

export const documentService = {
  /**
   * Fetches active documents accessible to the authenticated user.
   * Connects to GET /api/v1/documents/.
   */
  async getDocuments(
    params?: DocumentListParams
  ): Promise<PaginatedResponse<DocumentItem>> {
    const response = await apiClient.get<PaginatedResponse<DocumentItem>>(
      '/documents/',
      { params }
    )
    return response.data
  },

  /**
   * Uploads a document privately (unattached, or linked to an authorized property, application, or tenancy).
   * Connects to POST /api/v1/documents/.
   */
  async uploadDocument(
    payload: UploadDocumentPayload,
    onUploadProgress?: (percent: number) => void
  ): Promise<ApiResponse<DocumentItem>> {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('title', payload.title.trim())
    formData.append('document_type', payload.document_type)

    if (payload.property_id) {
      formData.append('property_id', payload.property_id)
    } else if (payload.application_id) {
      formData.append('application_id', payload.application_id)
    } else if (payload.tenancy_id) {
      formData.append('tenancy_id', payload.tenancy_id)
    }

    const response = await apiClient.post<ApiResponse<DocumentItem>>(
      '/documents/',
      formData,
      {
        onUploadProgress: onUploadProgress
          ? (event) => {
              if (event.total && event.total > 0) {
                const percent = Math.min(100, Math.round((event.loaded * 100) / event.total))
                onUploadProgress(percent)
              }
            }
          : undefined,
      }
    )
    return response.data
  },

  /**
   * Updates an existing document's display name and/or replaces its uploaded file.
   * Connects to PATCH /api/v1/documents/{id}/.
   */
  async updateDocument(
    documentId: string,
    payload: UpdateDocumentPayload,
    onUploadProgress?: (percent: number) => void
  ): Promise<ApiResponse<DocumentItem>> {
    if (payload.file) {
      const formData = new FormData()
      formData.append('file', payload.file)
      if (payload.title !== undefined) {
        formData.append('title', payload.title.trim())
      }
      const response = await apiClient.patch<ApiResponse<DocumentItem>>(
        `/documents/${documentId}/`,
        formData,
        {
          onUploadProgress: onUploadProgress
            ? (event) => {
                if (event.total && event.total > 0) {
                  const percent = Math.min(100, Math.round((event.loaded * 100) / event.total))
                  onUploadProgress(percent)
                }
              }
            : undefined,
        }
      )
      return response.data
    }

    const response = await apiClient.patch<ApiResponse<DocumentItem>>(
      `/documents/${documentId}/`,
      {
        title: payload.title !== undefined ? payload.title.trim() : undefined,
      }
    )
    return response.data
  },

  /**
   * Retrieves authenticated document bytes as a Blob through GET /api/v1/documents/{id}/download/.
   * Never exposes private storage URLs.
   */
  async fetchDocumentBlob(
    documentId: string,
    fallbackFilename?: string,
    fallbackMimeType?: string | null
  ): Promise<DocumentBlobResult> {
    const response = await apiClient.get<Blob>(`/documents/${documentId}/download/`, {
      responseType: 'blob',
    })

    let filename = fallbackFilename || 'document'
    const disposition = response.headers['content-disposition']
    if (typeof disposition === 'string') {
      const match = /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)["']?/i.exec(disposition)
      if (match?.[1]) {
        filename = decodeURIComponent(match[1])
      }
    }

    const mimeType =
      response.data.type ||
      (typeof response.headers['content-type'] === 'string'
        ? response.headers['content-type']
        : null) ||
      fallbackMimeType ||
      'application/octet-stream'

    return {
      blob: response.data,
      filename,
      mimeType,
    }
  },

  /**
   * Triggers a browser download using the authenticated streaming endpoint.
   */
  async downloadDocument(documentId: string, fallbackFilename?: string): Promise<void> {
    const { blob, filename } = await this.fetchDocumentBlob(documentId, fallbackFilename)

    const blobUrl = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  },
}

export default documentService
