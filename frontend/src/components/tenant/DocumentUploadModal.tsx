import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Input, Modal, Select, useToast } from '../ui'
import { useUpdateDocument, useUploadDocument } from '../../hooks/useTenantWorkspace'
import { extractApiErrorMessage } from '../../utils/application'
import { formatMimeTypeLabel, validateClientDocumentFile } from '../../utils/document'
import { formatFileSize } from '../../utils/tenancy'
import type { DocumentItem, DocumentType } from '../../types/document'

export interface OwnerPropertyOption {
  id: string
  title: string
  city?: string
}

export interface OwnerTenancyOption {
  id: string
  property_title?: string
  tenant_name?: string
  status?: string
}

export interface DocumentUploadModalProps {
  open: boolean
  onClose: () => void
  documentToEdit?: DocumentItem | null
  initialFile?: File | null
  tenancyId?: string
  defaultDocumentType?: DocumentType
  allowTypeSelection?: boolean
  enableOwnerAttachments?: boolean
  ownerProperties?: OwnerPropertyOption[]
  ownerTenancies?: OwnerTenancyOption[]
}

function formatAttachmentDisplayName(doc: DocumentItem): string {
  const title = doc.title?.trim()
  if (!title) return doc.original_filename
  const dotIdx = doc.original_filename.lastIndexOf('.')
  const ext = dotIdx > 0 ? doc.original_filename.slice(dotIdx).toLowerCase() : ''
  if (ext && !title.toLowerCase().endsWith(ext)) {
    return `${title}${ext}`
  }
  return title
}

/**
 * DocumentUploadModal
 * Handles both uploading a new personal document and editing an existing uploaded document
 * (updating the Document Name and/or replacing the uploaded file).
 */
export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  open,
  onClose,
  documentToEdit = null,
  initialFile = null,
  tenancyId,
  defaultDocumentType = 'other',
  allowTypeSelection = false,
  enableOwnerAttachments = false,
  ownerProperties = [],
  ownerTenancies = [],
}) => {
  const isEditMode = Boolean(documentToEdit)
  const { addToast } = useToast()
  const uploadMutation = useUploadDocument()
  const updateMutation = useUpdateDocument()
  const isPending = uploadMutation.isPending || updateMutation.isPending

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(() =>
    documentToEdit ? null : initialFile
  )
  const [documentName, setDocumentName] = useState(() => {
    if (documentToEdit) return documentToEdit.title || documentToEdit.original_filename
    if (initialFile) return initialFile.name.replace(/\.[^/.]+$/, '')
    return ''
  })
  const [documentType, setDocumentType] = useState<DocumentType>(defaultDocumentType)
  const [attachmentScope, setAttachmentScope] = useState<'personal' | 'property' | 'tenancy'>('personal')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [selectedTenancyId, setSelectedTenancyId] = useState<string>('')
  const [nameTouched, setNameTouched] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const imageThumbnailUrl = useMemo(() => {
    if (!selectedFile) return null
    const lower = selectedFile.name.toLowerCase()
    const isImg =
      selectedFile.type.startsWith('image/') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.webp')
    return isImg ? URL.createObjectURL(selectedFile) : null
  }, [selectedFile])

  useEffect(() => {
    return () => {
      if (imageThumbnailUrl) {
        URL.revokeObjectURL(imageThumbnailUrl)
      }
    }
  }, [imageThumbnailUrl])

  const resetForm = () => {
    setSelectedFile(null)
    setDocumentName('')
    setDocumentType(defaultDocumentType)
    setAttachmentScope('personal')
    setSelectedPropertyId('')
    setSelectedTenancyId('')
    setNameTouched(false)
    setIsDragging(false)
    setUploadProgress(0)
    setErrorMsg(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    if (isPending) return
    resetForm()
    onClose()
  }

  const acceptIncomingFile = (file: File | null) => {
    setErrorMsg(null)
    if (!file) return
    const validationError = validateClientDocumentFile(file)
    if (validationError) {
      setErrorMsg(validationError)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }
    setSelectedFile(file)
    if (!documentName.trim()) {
      nameInputRef.current?.focus()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    acceptIncomingFile(file)
  }

  const handleRemoveFile = () => {
    if (isPending) return
    setSelectedFile(null)
    setErrorMsg(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleOpenPicker = () => {
    if (isPending) return
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isPending && !isDragging) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (isPending) return
    const file = e.dataTransfer.files?.[0] ?? null
    acceptIncomingFile(file)
  }

  const handleDropzoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpenPicker()
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentName(e.target.value)
    if (!nameTouched) {
      setNameTouched(true)
    }
    if (errorMsg) {
      setErrorMsg(null)
    }
  }

  const trimmedName = documentName.trim()
  const nameError =
    nameTouched && !trimmedName
      ? 'Please enter a document name before uploading.'
      : undefined

  const initialEditTitle = documentToEdit
    ? (documentToEdit.title || documentToEdit.original_filename).trim()
    : ''
  const hasEditChanges = isEditMode
    ? Boolean(selectedFile) || trimmedName !== initialEditTitle
    : true

  const canAttemptSubmit = isEditMode
    ? !isPending && hasEditChanges
    : Boolean(selectedFile) && !isPending

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErrorMsg(null)

    if (!isEditMode && !selectedFile) {
      setErrorMsg('Please attach a valid PDF or image file.')
      return
    }

    if (selectedFile) {
      const validationError = validateClientDocumentFile(selectedFile)
      if (validationError) {
        setErrorMsg(validationError)
        return
      }
    }

    if (!trimmedName) {
      setNameTouched(true)
      nameInputRef.current?.focus()
      return
    }

    setUploadProgress(0)

    try {
      if (isEditMode && documentToEdit) {
        const response = await updateMutation.mutateAsync({
          documentId: documentToEdit.id,
          payload: {
            title: trimmedName,
            ...(selectedFile ? { file: selectedFile } : {}),
          },
          onUploadProgress: (percent) => {
            setUploadProgress(percent)
          },
        })

        addToast({
          title: 'Document Updated',
          description: `${response.data?.title || response.data?.original_filename || trimmedName} has been updated.`,
          variant: 'success',
        })
      } else if (selectedFile) {
        if (enableOwnerAttachments && attachmentScope === 'property' && !selectedPropertyId) {
          setErrorMsg('Please select the property to attach this document to.')
          return
        }
        if (enableOwnerAttachments && attachmentScope === 'tenancy' && !selectedTenancyId) {
          setErrorMsg('Please select the tenancy to attach this document to.')
          return
        }

        const effectivePropertyId =
          enableOwnerAttachments && attachmentScope === 'property' ? selectedPropertyId : undefined
        const effectiveTenancyId = tenancyId
          ? tenancyId
          : enableOwnerAttachments && attachmentScope === 'tenancy'
            ? selectedTenancyId
            : undefined

        const response = await uploadMutation.mutateAsync({
          payload: {
            file: selectedFile,
            title: trimmedName,
            document_type: documentType,
            ...(effectivePropertyId ? { property_id: effectivePropertyId } : {}),
            ...(effectiveTenancyId ? { tenancy_id: effectiveTenancyId } : {}),
          },
          onUploadProgress: (percent) => {
            setUploadProgress(percent)
          },
        })

        addToast({
          title: 'Document Uploaded',
          description: `${response.data?.title || response.data?.original_filename || trimmedName} has been uploaded securely.`,
          variant: 'success',
        })
      }

      resetForm()
      onClose()
    } catch (err: unknown) {
      setUploadProgress(0)
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setErrorMsg('Your session expired. Please sign in again and retry.')
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setErrorMsg('You do not have permission to edit this document.')
      } else {
        setErrorMsg(
          extractApiErrorMessage(
            err,
            isEditMode
              ? 'Failed to update document. Please check your changes and retry.'
              : 'Failed to upload document. Please check the file and retry.'
          )
        )
      }
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeOnBackdropClick={!isPending}
      closeOnEscape={!isPending}
      title={isEditMode ? 'Edit Document' : 'Upload Document'}
      description={
        isEditMode
          ? 'Update the document name or replace the uploaded file.'
          : 'Upload a personal document to your account.'
      }
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
            <svg
              className="w-3.5 h-3.5 text-[#408A71] shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Files are stored privately and visible only to authorized parties.</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!canAttemptSubmit}
              isLoading={isPending}
              loadingText={
                uploadProgress > 0 && uploadProgress < 100
                  ? `${isEditMode ? 'Saving' : 'Uploading'} ${uploadProgress}%...`
                  : isEditMode
                    ? 'Saving...'
                    : 'Uploading...'
              }
              onClick={() => void handleSubmit()}
            >
              {isEditMode ? 'Save Changes' : 'Upload Document'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        {/* A. File Attachment */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="tenant-doc-file"
              className="text-xs font-semibold uppercase tracking-wider text-[#374151]"
            >
              {isEditMode ? 'File Attachment' : 'File Attachment *'}
            </label>
            <span className="text-[11px] text-[#6B7280]">Max 10 MB · PDF, JPG, PNG, WebP</span>
          </div>

          <input
            ref={fileInputRef}
            id="tenant-doc-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isPending}
            className="sr-only"
          />

          {selectedFile ? (
            <div className="rounded-2xl border border-[#CBE7DC] bg-[#F4FAF7]/80 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {imageThumbnailUrl ? (
                    <img
                      src={imageThumbnailUrl}
                      alt={selectedFile.name}
                      className="h-14 w-14 rounded-xl object-cover border border-[#DCE8E2] bg-white shrink-0"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white border border-[#DCE8E2] text-[#408A71]">
                      <svg
                        className="w-7 h-7"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#111827] truncate">
                      {selectedFile.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                      <span>{formatMimeTypeLabel(selectedFile.type, selectedFile.name)}</span>
                      <span>·</span>
                      <span>{formatFileSize(selectedFile.size)}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECF5F2] px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                        {isEditMode ? 'Replacement Ready' : 'Ready'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={handleOpenPicker}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={handleRemoveFile}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {isEditMode ? 'Keep Original' : 'Remove'}
                  </Button>
                </div>
              </div>

              {isPending && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-[#1A382A]">
                    <span>Uploading encrypted copy...</span>
                    <span className="tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#DCE8E2] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#408A71] transition-all duration-200"
                      style={{ width: `${Math.max(8, uploadProgress)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : isEditMode && documentToEdit ? (
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border p-4 transition-all ${
                isDragging
                  ? 'border-[#408A71] bg-[#ECF5F2]/80 ring-2 ring-[#408A71]/20'
                  : 'border-[#E5E7EB] bg-[#F9FAFB]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-[#E5E7EB] text-[#408A71]">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#111827] truncate">
                      {formatAttachmentDisplayName(documentToEdit)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                      <span>
                        {formatMimeTypeLabel(
                          documentToEdit.mime_type,
                          documentToEdit.original_filename
                        )}
                      </span>
                      {documentToEdit.file_size_bytes ? (
                        <>
                          <span>·</span>
                          <span>{formatFileSize(documentToEdit.file_size_bytes)}</span>
                        </>
                      ) : null}
                      <span className="inline-flex items-center rounded-full bg-white border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold text-[#374151]">
                        Current File
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={handleOpenPicker}
                  className="shrink-0"
                >
                  Replace File
                </Button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload document dropzone. Press Enter or Space to browse files."
              onClick={handleOpenPicker}
              onKeyDown={handleDropzoneKeyDown}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#408A71]/40 ${
                isDragging
                  ? 'border-[#408A71] bg-[#ECF5F2]/80 ring-2 ring-[#408A71]/20'
                  : 'border-[#CBD5E1] bg-[#F9FAFB]/70 hover:border-[#408A71]/60 hover:bg-[#F4FAF7]/60'
              }`}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECF5F2] text-[#408A71] shadow-2xs mb-3">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.9}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>

              <p className="text-sm font-semibold text-[#111827]">
                {isDragging ? 'Drop your file to attach' : 'Drag and drop your file here'}
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">
                or choose a file from your device
              </p>

              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenPicker()
                  }}
                >
                  Browse Files
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-[#6B7280]">
                <span className="rounded-md bg-white border border-[#E5E7EB] px-2 py-0.5 font-medium">
                  PDF, JPG, JPEG, PNG, WebP
                </span>
                <span className="rounded-md bg-white border border-[#E5E7EB] px-2 py-0.5 font-medium">
                  Up to 10 MB
                </span>
              </div>
            </div>
          )}
        </section>

        {/* B. Document Name */}
        <section>
          <Input
            ref={nameInputRef}
            id="tenant-doc-name"
            type="text"
            label="Document Name"
            required
            maxLength={255}
            value={documentName}
            onChange={handleNameChange}
            onBlur={() => setNameTouched(true)}
            disabled={isPending}
            placeholder={
              tenancyId
                ? 'e.g. Signed Rental Agreement, Move-in Inspection'
                : 'e.g. Aadhaar Card, Rental Agreement, Salary Slip'
            }
            hint={
              !nameError && !isEditMode && selectedFile && !trimmedName
                ? 'Please enter a document name before uploading.'
                : undefined
            }
            error={nameError}
          />
        </section>

        {enableOwnerAttachments && !isEditMode && (
          <section className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <Select
              id="owner-doc-scope"
              label="Attach Document To"
              value={attachmentScope}
              onChange={(e) => {
                const nextScope = e.target.value as 'personal' | 'property' | 'tenancy'
                setAttachmentScope(nextScope)
                setErrorMsg(null)
                if (nextScope === 'property') {
                  setDocumentType('property_document')
                } else if (nextScope === 'tenancy') {
                  setDocumentType('rental_agreement')
                } else {
                  setDocumentType('other')
                }
              }}
              disabled={isPending}
              options={[
                { value: 'personal', label: 'Personal (Private to you)' },
                { value: 'property', label: 'Property Record (Private to you)' },
                { value: 'tenancy', label: 'Tenancy (Shared with tenant)' },
              ]}
            />

            {attachmentScope === 'property' && (
              <Select
                id="owner-doc-property"
                label="Select Property"
                required
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                disabled={isPending}
                options={[
                  { value: '', label: 'Choose a property...' },
                  ...ownerProperties.map((p) => ({
                    value: p.id,
                    label: p.city ? `${p.title} (${p.city})` : p.title,
                  })),
                ]}
              />
            )}

            {attachmentScope === 'tenancy' && (
              <Select
                id="owner-doc-tenancy"
                label="Select Tenancy"
                required
                value={selectedTenancyId}
                onChange={(e) => setSelectedTenancyId(e.target.value)}
                disabled={isPending}
                options={[
                  { value: '', label: 'Choose a tenancy...' },
                  ...ownerTenancies.map((t) => ({
                    value: t.id,
                    label: `${t.property_title || 'Property'} — ${t.tenant_name || 'Tenant'}${t.status ? ` (${t.status})` : ''}`,
                  })),
                ]}
              />
            )}
          </section>
        )}

        {(allowTypeSelection || enableOwnerAttachments) && !isEditMode && (
          <section>
            <Select
              id="tenant-doc-type"
              label="Document Type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              disabled={isPending}
              options={[
                { value: 'property_document', label: 'Property Document' },
                { value: 'rental_agreement', label: 'Rental Agreement' },
                { value: 'id_proof', label: 'ID Proof' },
                { value: 'income_proof', label: 'Income Proof' },
                { value: 'other', label: 'Other Document' },
              ]}
            />
          </section>
        )}
      </form>
    </Modal>
  )
}

export default DocumentUploadModal
