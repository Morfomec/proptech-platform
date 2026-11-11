/**
 * Domain types for Documents.
 * Strictly aligned with backend serializers in apps.documents.
 */

export type DocumentType =
  | 'rental_agreement'
  | 'id_proof'
  | 'income_proof'
  | 'property_document'
  | 'other'

export type DocumentCategoryGroup =
  | 'rental_agreements'
  | 'application_documents'
  | 'property_documents'
  | 'other_documents'

export type DocumentScope = 'all' | 'property' | 'application' | 'tenancy' | 'personal'

export interface DocumentItem {
  id: string
  uploaded_by: string
  uploaded_by_name?: string
  property: string | null
  application: string | null
  tenancy: string | null
  document_type: DocumentType
  title: string
  original_filename: string
  mime_type: string | null
  file_size_bytes: number | null
  status: string
  created_at: string
  updated_at: string
}

export interface UploadDocumentPayload {
  file: File
  title: string
  document_type: DocumentType
  property_id?: string | null
  application_id?: string | null
  tenancy_id?: string | null
}

export interface UpdateDocumentPayload {
  title?: string
  file?: File
}
