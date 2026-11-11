import React, { useEffect } from 'react'
import { Alert, Button, Modal, Spinner } from '../ui'
import { isImageDocument } from '../../utils/document'
import type { DocumentItem } from '../../types/document'

export interface DocumentPreviewModalProps {
  document: DocumentItem | null
  previewUrl: string | null
  mimeType: string | null
  isLoading: boolean
  error: string | null
  onClose: () => void
  onDownload: (doc: DocumentItem) => void
  isDownloading: boolean
}

/**
 * DocumentPreviewModal
 * Renders an in-memory authenticated Blob preview for images and PDFs retrieved via
 * `GET /api/v1/documents/{id}/download/`, revoking object URLs cleanly on close.
 */
export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document: doc,
  previewUrl,
  mimeType,
  isLoading,
  error,
  onClose,
  onDownload,
  isDownloading,
}) => {
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  if (!doc) return null

  const isImg = isImageDocument(mimeType || doc.mime_type, doc.original_filename)

  const displayTitle = doc.title || doc.original_filename

  return (
    <Modal
      open={Boolean(doc)}
      onClose={onClose}
      title={displayTitle}
      description={
        doc.title && doc.title !== doc.original_filename
          ? `${doc.original_filename} · Authenticated secure preview`
          : 'Authenticated secure preview'
      }
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={isDownloading}
            onClick={() => onDownload(doc)}
          >
            Download
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="h-80 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs font-medium text-[#6B7280]">Loading secure document preview...</p>
        </div>
      ) : error ? (
        <Alert variant="error" title="Preview unavailable">
          {error}
        </Alert>
      ) : previewUrl ? (
        isImg ? (
          <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] p-3">
            <img
              src={previewUrl}
              alt={doc.original_filename}
              className="max-h-[65vh] w-auto object-contain rounded-lg"
            />
          </div>
        ) : (
          <div className="h-[68vh] w-full rounded-xl overflow-hidden border border-[#E5E7EB] bg-[#F9FAFB]">
            <iframe
              title={doc.original_filename}
              src={previewUrl}
              className="w-full h-full border-0"
            />
          </div>
        )
      ) : null}
    </Modal>
  )
}

export default DocumentPreviewModal

