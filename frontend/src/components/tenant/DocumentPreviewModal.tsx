import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Modal, Spinner } from '../ui'
import { formatDateTime } from '../../utils/application'
import { formatMimeTypeLabel, getDocumentTypeMeta, isImageDocument } from '../../utils/document'
import { formatFileSize } from '../../utils/tenancy'
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
  canEdit?: boolean
  onEdit?: (doc: DocumentItem) => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  scopeLabel?: string
  scopeLinkTo?: string | null
  scopeLinkText?: string | null
}

/**
 * DocumentPreviewModal
 * Renders an authenticated Blob preview lightbox (large preview left, metadata right,
 * optional prev/next navigation, Download and Edit actions), revoking object URLs cleanly on close.
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
  canEdit = false,
  onEdit,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  scopeLabel,
  scopeLinkTo,
  scopeLinkText,
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
  const typeMeta = getDocumentTypeMeta(doc.document_type)
  const formatLabel = formatMimeTypeLabel(mimeType || doc.mime_type, doc.original_filename)

  return (
    <Modal
      open={Boolean(doc)}
      onClose={onClose}
      title={displayTitle}
      size="xl"
    >
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Large Preview Area with Prev / Next Arrows */}
        <div className="relative flex-1 min-w-0 min-h-[340px] lg:min-h-[460px] flex items-center justify-center bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] overflow-hidden p-3">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              aria-label="Previous document"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 border border-[#E5E7EB] text-[#111827] shadow-sm hover:bg-white disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="Next document"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 border border-[#E5E7EB] text-[#111827] shadow-sm hover:bg-white disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {isLoading ? (
            <div className="h-80 flex flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-xs font-medium text-[#6B7280]">Loading secure document preview...</p>
            </div>
          ) : error ? (
            <div className="max-w-sm w-full">
              <Alert variant="error" title="Preview unavailable">
                {error}
              </Alert>
            </div>
          ) : previewUrl ? (
            isImg ? (
              <img
                src={previewUrl}
                alt={doc.original_filename}
                className="max-h-[62vh] w-auto object-contain rounded-lg"
              />
            ) : (
              <iframe
                title={doc.original_filename}
                src={previewUrl}
                className="w-full h-[62vh] border-0 rounded-lg bg-white"
              />
            )
          ) : (
            <div className="text-center p-6 space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECF5F2] text-[#408A71]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#111827]">Preview not available for this file type</p>
              <p className="text-xs text-[#6B7280]">Download the file to view it locally.</p>
            </div>
          )}
        </div>

        {/* Right: Metadata Sidebar & Actions */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={typeMeta.variant} size="sm">
                {typeMeta.label}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-medium text-[#111827] break-words">{displayTitle}</h3>
              <p className="mt-1 text-xs text-[#6B7280] break-all" title={doc.original_filename}>
                {doc.original_filename}
              </p>
            </div>

            <dl className="space-y-2 border-t border-[#F3F4F6] pt-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Format</dt>
                <dd className="font-medium text-[#111827]">{formatLabel}</dd>
              </div>
              {doc.file_size_bytes ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Size</dt>
                  <dd className="font-medium text-[#111827]">{formatFileSize(doc.file_size_bytes)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-[#6B7280]">Uploaded</dt>
                <dd className="font-medium text-[#111827] text-right">{formatDateTime(doc.created_at)}</dd>
              </div>
              {doc.uploaded_by_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Uploaded by</dt>
                  <dd className="font-medium text-[#111827] text-right">{doc.uploaded_by_name}</dd>
                </div>
              )}
              {scopeLabel && (
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Scope</dt>
                  <dd className="font-medium text-[#111827] text-right">{scopeLabel}</dd>
                </div>
              )}
            </dl>

            {scopeLinkTo && scopeLinkText && (
              <Link
                to={scopeLinkTo}
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#408A71] hover:text-[#34745C]"
              >
                <span>{scopeLinkText}</span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-[#F3F4F6] pt-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full"
              isLoading={isDownloading}
              onClick={() => onDownload(doc)}
            >
              Download
            </Button>
            {canEdit && onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  onClose()
                  onEdit(doc)
                }}
              >
                Edit / Rename
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </aside>
      </div>
    </Modal>
  )
}

export default DocumentPreviewModal
