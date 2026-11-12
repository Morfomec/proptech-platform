import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import documentService from '../../services/document.service'
import { formatDate } from '../../utils/application'
import {
  formatMimeTypeLabel,
  getDocumentTypeMeta,
  isImageDocument,
  isPreviewableDocument,
} from '../../utils/document'
import { formatFileSize } from '../../utils/tenancy'
import type { DocumentItem, DocumentType } from '../../types/document'

function getCategoryBadgeClasses(type: DocumentType | string): string {
  switch (type) {
    case 'id_proof':
      return 'bg-blue-50/95 text-blue-700 border-blue-200/80'
    case 'income_proof':
      return 'bg-amber-50/95 text-amber-800 border-amber-200/80'
    case 'rental_agreement':
      return 'bg-[#ECF5F2]/95 text-[#2C6B55] border-[#CBE7DC]'
    case 'property_document':
      return 'bg-slate-100/95 text-slate-700 border-slate-200'
    default:
      return 'bg-gray-100/95 text-gray-700 border-gray-200'
  }
}

function getShortFormatLabel(mimeType: string | null | undefined, filename: string): string {
  const label = formatMimeTypeLabel(mimeType, filename)
  return label.replace(' Image', '')
}

function getFileTileStyle(mimeType: string | null | undefined, filename: string): {
  bg: string
  text: string
  badge: string
} {
  const lower = filename.toLowerCase()
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    return { bg: 'bg-rose-50', text: 'text-rose-600', badge: 'PDF' }
  }
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
    return { bg: 'bg-blue-50', text: 'text-blue-600', badge: 'DOC' }
  }
  return {
    bg: 'bg-[#F4FAF7]',
    text: 'text-[#408A71]',
    badge: getShortFormatLabel(mimeType, filename),
  }
}

export interface DocumentCardProps {
  document: DocumentItem
  scopeLabel: string
  scopeLinkTo?: string | null
  scopeLinkText?: string | null
  canEdit: boolean
  isDownloading?: boolean
  onPreview: (doc: DocumentItem) => void
  onDownload: (doc: DocumentItem) => void
  onEdit: (doc: DocumentItem) => void
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document: doc,
  scopeLabel,
  scopeLinkTo,
  scopeLinkText,
  canEdit,
  isDownloading = false,
  onPreview,
  onDownload,
  onEdit,
}) => {
  const isImage = isImageDocument(doc.mime_type, doc.original_filename)
  const canPreview = isPreviewableDocument(doc.mime_type, doc.original_filename)
  const isIdProof = doc.document_type === 'id_proof'
  const typeMeta = getDocumentTypeMeta(doc.document_type)
  const displayTitle = doc.title || doc.original_filename
  const shortFormat = getShortFormatLabel(doc.mime_type, doc.original_filename)
  const fileTile = getFileTileStyle(doc.mime_type, doc.original_filename)

  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [isRevealed, setIsRevealed] = useState<boolean>(false)
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const currentThumbKey = `${doc.id}:${doc.updated_at}`
  const thumbLoading = isImage && loadedKey !== currentThumbKey && errorKey !== currentThumbKey
  const thumbError = errorKey === currentThumbKey

  useEffect(() => {
    if (!isImage) return

    let cancelled = false
    let objectUrl: string | null = null

    documentService
      .fetchDocumentBlob(doc.id, doc.original_filename, doc.mime_type)
      .then((res) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.blob)
        setThumbUrl(objectUrl)
        setLoadedKey(currentThumbKey)
      })
      .catch(() => {
        if (!cancelled) {
          setErrorKey(currentThumbKey)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [doc.id, doc.original_filename, doc.mime_type, currentThumbKey, isImage])

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const metaParts = [
    shortFormat,
    doc.file_size_bytes ? formatFileSize(doc.file_size_bytes) : null,
    formatDate(doc.created_at),
  ].filter(Boolean)

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onPreview(doc)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPreview(doc)
        }
      }}
      className="group relative rounded-2xl border border-[#E5E7EB] bg-white p-4 flex flex-col h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/30 cursor-pointer"
    >
      {/* Top: 4:3 Thumbnail */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] bg-[#F3F4F6]">
        {isImage ? (
          thumbLoading ? (
            <div className="w-full h-full animate-pulse bg-gradient-to-r from-[#E5E7EB] via-[#F3F4F6] to-[#E5E7EB]" />
          ) : thumbUrl && !thumbError ? (
            <img
              src={thumbUrl}
              alt={displayTitle}
              onError={() => setErrorKey(currentThumbKey)}
              className={`w-full h-full object-cover object-center transition-all duration-300 ${
                isIdProof && !isRevealed ? 'blur-md scale-105' : 'group-hover:scale-[1.02]'
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#F9FAFB] text-[#9CA3AF] gap-1.5">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-[11px] font-medium">Preview unavailable</span>
            </div>
          )
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center ${fileTile.bg} ${fileTile.text} gap-2`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 shadow-2xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="text-xs font-medium tracking-wide uppercase">{fileTile.badge}</span>
          </div>
        )}

        {/* Overlaid Top-Left Category Badge */}
        <span
          className={`absolute top-2.5 left-2.5 z-10 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border backdrop-blur-xs ${getCategoryBadgeClasses(
            doc.document_type
          )}`}
        >
          {typeMeta.label}
        </span>

        {/* Overlaid Top-Right ⋮ Menu */}
        <div
          ref={menuRef}
          className="absolute top-2.5 right-2.5 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Document actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 hover:bg-white text-[#374151] border border-[#E5E7EB]/80 shadow-2xs backdrop-blur-xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 11.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-40 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg z-30">
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit(doc)
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                  >
                    Edit / Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit(doc)
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                  >
                    Replace File
                  </button>
                </>
              )}
              {canPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onPreview(doc)
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  Preview
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onDownload(doc)
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#408A71] hover:bg-[#ECF5F2] cursor-pointer"
              >
                Download
              </button>
            </div>
          )}
        </div>

        {/* ID Proof Eye Toggle (Bottom-Right) */}
        {isImage && isIdProof && thumbUrl && !thumbError && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsRevealed((prev) => !prev)
            }}
            title={isRevealed ? 'Hide ID Proof' : 'Reveal ID Proof'}
            aria-label={isRevealed ? 'Hide ID Proof' : 'Reveal ID Proof'}
            className="absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 hover:bg-white text-[#374151] border border-[#E5E7EB]/80 shadow-2xs backdrop-blur-xs transition-colors cursor-pointer"
          >
            {isRevealed ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        )}

        {/* Hover Overlay: Preview & Download Icon Buttons */}
        <div
          className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {canPreview && (
            <button
              type="button"
              onClick={() => onPreview(doc)}
              title="Preview"
              aria-label="Preview document"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 hover:bg-white text-[#111827] border border-[#E5E7EB] shadow-sm transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => onDownload(doc)}
            title="Download"
            aria-label="Download document"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#408A71] hover:bg-[#34745C] text-white shadow-sm disabled:opacity-60 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Below Thumbnail: Name, Single Meta Line, Small Scope Tag */}
      <div className="pt-3 flex-1 flex flex-col justify-between gap-1.5 min-w-0">
        <div className="min-w-0">
          <h2
            className="text-[15px] leading-snug font-medium text-[#111827] truncate mb-0"
            title={doc.original_filename}
          >
            {displayTitle}
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7280] truncate">{metaParts.join(' · ')}</p>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[11px] font-normal text-[#4B5563] truncate">
            {scopeLabel}
          </span>
          {scopeLinkTo && scopeLinkText && (
            <Link
              to={scopeLinkTo}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-[#408A71] hover:text-[#34745C] shrink-0"
            >
              {scopeLinkText} →
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}

export interface DocumentUploadTileProps {
  onClickUpload: () => void
  onDropFile: (file: File) => void
}

export const DocumentUploadTile: React.FC<DocumentUploadTileProps> = ({
  onClickUpload,
  onDropFile,
}) => {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClickUpload}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClickUpload()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) {
          onDropFile(file)
        }
      }}
      className={`rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center min-h-[250px] h-full transition-colors cursor-pointer ${
        isDragging
          ? 'border-[#408A71] bg-[#ECF5F2]'
          : 'border-[#CBE7DC] bg-[#F8FCFA] hover:border-[#408A71] hover:bg-[#ECF5F2]/60'
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-[#DCE8E2] text-[#408A71] shadow-2xs mb-2.5">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-[#111827]">Drop files or click to upload</p>
      <p className="mt-1 text-xs text-[#6B7280]">PDF, JPG, PNG, WebP up to 10 MB</p>
    </div>
  )
}
