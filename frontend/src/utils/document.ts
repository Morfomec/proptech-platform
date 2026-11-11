import type { BadgeVariant } from '../components/ui/badge'
import type { DocumentCategoryGroup, DocumentType } from '../types/document'

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_DOCUMENT_FILENAME_LENGTH = 255
export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const

export interface DocumentTypeMeta {
  label: string
  variant: BadgeVariant
  categoryGroup: DocumentCategoryGroup
}

export const DOCUMENT_TYPE_META: Record<DocumentType, DocumentTypeMeta> = {
  rental_agreement: {
    label: 'Rental Agreement',
    variant: 'success',
    categoryGroup: 'rental_agreements',
  },
  id_proof: {
    label: 'ID Proof',
    variant: 'info',
    categoryGroup: 'application_documents',
  },
  income_proof: {
    label: 'Income Proof',
    variant: 'warning',
    categoryGroup: 'application_documents',
  },
  property_document: {
    label: 'Property Document',
    variant: 'neutral',
    categoryGroup: 'property_documents',
  },
  other: {
    label: 'Other Document',
    variant: 'neutral',
    categoryGroup: 'other_documents',
  },
}

export interface DocumentCategoryTab {
  id: 'all' | DocumentCategoryGroup
  label: string
}

export const DOCUMENT_CATEGORY_TABS: DocumentCategoryTab[] = [
  { id: 'all', label: 'All Documents' },
  { id: 'rental_agreements', label: 'Rental Agreements' },
  { id: 'application_documents', label: 'Application Documents' },
  { id: 'property_documents', label: 'Property Documents' },
  { id: 'other_documents', label: 'Other Documents' },
]

export function getDocumentTypeMeta(type: DocumentType | string): DocumentTypeMeta {
  if (type in DOCUMENT_TYPE_META) {
    return DOCUMENT_TYPE_META[type as DocumentType]
  }
  return {
    label: type.replace(/_/g, ' '),
    variant: 'neutral',
    categoryGroup: 'other_documents',
  }
}

export function getDocumentCategoryGroup(type: DocumentType | string): DocumentCategoryGroup {
  return getDocumentTypeMeta(type).categoryGroup
}

export function formatMimeTypeLabel(
  mimeType: string | null | undefined,
  filename: string
): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'PDF'
    case 'image/jpeg':
      return 'JPEG Image'
    case 'image/png':
      return 'PNG Image'
    case 'image/webp':
      return 'WebP Image'
    default: {
      const ext = filename.split('.').pop()?.toUpperCase()
      return ext && ext !== filename.toUpperCase() ? ext : 'File'
    }
  }
}

export function isPreviewableDocument(
  mimeType: string | null | undefined,
  filename: string
): boolean {
  const lower = filename.toLowerCase()
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return true
  if (
    mimeType?.startsWith('image/') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp')
  ) {
    return true
  }
  return false
}

export function isImageDocument(
  mimeType: string | null | undefined,
  filename: string
): boolean {
  const lower = filename.toLowerCase()
  return Boolean(
    mimeType?.startsWith('image/') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp')
  )
}

/**
 * Usability pre-check matching backend validation in `apps.documents.services.document_service`.
 * Authoritative content/magic-byte validation still runs on the backend.
 */
export function validateClientDocumentFile(file: File): string | null {
  if (!file.name || file.name.trim().length === 0) {
    return 'A valid filename is required.'
  }
  if (file.name.length > MAX_DOCUMENT_FILENAME_LENGTH) {
    return 'Filename cannot exceed 255 characters.'
  }
  const lower = file.name.toLowerCase()
  const hasAllowedExt = ALLOWED_DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext))
  if (!hasAllowedExt) {
    return 'Only PDF, JPG, JPEG, PNG and WebP files are allowed.'
  }
  if (file.size <= 0) {
    return 'The selected file is empty.'
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return 'File size cannot exceed 10 MB.'
  }
  return null
}

