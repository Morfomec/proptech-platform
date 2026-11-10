import React, { useRef, useState } from 'react'
import { FormSection } from './FormSection'

export interface ImageEntry {
  id?: string
  image_url: string
  caption: string
  is_primary: boolean
  file?: File
  uploaded?: boolean
  error?: string
}

export interface PropertyPhotosSectionProps {
  images: ImageEntry[]
  onFilesSelected: (files: FileList | File[]) => void
  onSetPrimary: (index: number) => void
  onRemove: (index: number) => void
  error?: string
  maxLimit?: number
}

export const PropertyPhotosSection: React.FC<PropertyPhotosSectionProps> = ({
  images,
  onFilesSelected,
  onSetPrimary,
  onRemove,
  error,
  maxLimit = 15,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      onFilesSelected(e.dataTransfer.files)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected(e.target.files)
    }
    e.target.value = ''
  }

  return (
    <FormSection
      title="Property Photos"
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      }
      action={
        <span className="text-xs text-gray-500">
          {images.length}/{maxLimit} photos selected
        </span>
      }
    >
      <div className="space-y-4">
        {/* Drag & Drop File Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
            isDragOver
              ? 'border-[#408A71] bg-[#ECF5F2]/40'
              : 'border-gray-300 hover:border-[#408A71] hover:bg-gray-50/70'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-[#ECF5F2] text-[#408A71] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-800">
              Click to upload or drag and drop files here
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              PNG, JPG or WEBP (Max 10MB each, up to {maxLimit} photos)
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

        {/* Image Grid / Thumbnails */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
            {images.map((img, idx) => (
              <div
                key={idx}
                className={`group relative aspect-4/3 rounded-lg overflow-hidden border bg-gray-100 ${
                  img.error ? 'border-red-400' : 'border-gray-200'
                }`}
              >
                <img
                  src={img.image_url}
                  alt={img.caption || `Property photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Primary Badge */}
                {img.is_primary && (
                  <div className="absolute top-1.5 left-1.5 bg-[#408A71] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                    Primary
                  </div>
                )}

                {/* Upload Success Badge */}
                {img.uploaded && !img.is_primary && (
                  <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                    Saved
                  </div>
                )}

                {/* Upload Error Badge */}
                {img.error && (
                  <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                    Error
                  </div>
                )}

                {/* Hover Actions Overlay */}
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1.5">
                  {!img.is_primary && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSetPrimary(idx)
                      }}
                      className="px-2 py-1 rounded bg-white text-gray-800 text-[11px] font-medium shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(idx)
                    }}
                    className="p-1 rounded bg-red-600 text-white shadow-xs hover:bg-red-700 transition-colors cursor-pointer"
                    title="Remove Photo"
                    aria-label="Remove Photo"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FormSection>
  )
}

export default PropertyPhotosSection

