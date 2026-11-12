import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useOwnerDocumentCount, useOwnerDocuments } from '../../hooks/useOwnerDocuments'
import { useOwnerProperties } from '../../hooks/useOwnerProperties'
import { useReceivedApplications } from '../../hooks/useOwnerApplications'
import { useManagedTenancies } from '../../hooks/useOwnerTenancies'
import documentService from '../../services/document.service'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  Pagination,
  Select,
  Skeleton,
  useToast,
} from '../../components/ui'
import { DocumentUploadModal } from '../../components/tenant/DocumentUploadModal'
import { DocumentPreviewModal } from '../../components/tenant/DocumentPreviewModal'
import { extractApiErrorMessage, formatDateTime } from '../../utils/application'
import { formatMimeTypeLabel, getDocumentTypeMeta, isPreviewableDocument } from '../../utils/document'
import { formatFileSize } from '../../utils/tenancy'
import type { DocumentItem, DocumentScope } from '../../types/document'
import type { PropertyListItem } from '../../types/property'
import type { ApplicationListItem, TenancyListItem } from '../../types/leasing'

const PAGE_SIZE = 20

type SortDirection = 'newest' | 'oldest'

const SCOPE_TABS: { id: DocumentScope; label: string }[] = [
  { id: 'all', label: 'All Documents' },
  { id: 'property', label: 'Property Documents' },
  { id: 'application', label: 'Application Documents' },
  { id: 'tenancy', label: 'Tenancy Documents' },
  { id: 'personal', label: 'Personal Documents' },
]

/**
 * OwnerDocumentsPage
 * Central Owner Workspace document management page at `/app/owner/documents`.
 * Reuses `GET /api/v1/documents/`, `POST /api/v1/documents/`, `PATCH /api/v1/documents/{id}/`,
 * and `GET /api/v1/documents/{id}/download/` with backend-enforced access control.
 */
export const OwnerDocumentsPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [currentPage, setCurrentPage] = useState(1)
  const [activeScope, setActiveScope] = useState<DocumentScope>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortDirection>('newest')

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const {
    data: documentsData,
    isLoading,
    isError,
    refetch,
  } = useOwnerDocuments({
    page: currentPage,
    page_size: PAGE_SIZE,
    ...(activeScope !== 'all' ? { scope: activeScope } : {}),
  })

  // Accurate global counts per attachment scope from the backend
  const { data: totalAllCount = 0, isLoading: isLoadingAllCount } =
    useOwnerDocumentCount('all')
  const { data: propertyDocsCount = 0, isLoading: isLoadingPropertyCount } =
    useOwnerDocumentCount('property')
  const { data: applicationDocsCount = 0, isLoading: isLoadingAppCount } =
    useOwnerDocumentCount('application')
  const { data: tenancyDocsCount = 0, isLoading: isLoadingTenancyCount } =
    useOwnerDocumentCount('tenancy')
  const { data: personalDocsCount = 0 } = useOwnerDocumentCount('personal')

  // Context maps for displaying human-readable property, application, and tenancy labels + links
  const { data: propertiesData } = useOwnerProperties({ page: 1, page_size: 100 })
  const { data: applicationsData } = useReceivedApplications({ page: 1, page_size: 100 })
  const { data: tenanciesData } = useManagedTenancies({ page: 1, page_size: 100 })

  const ownerProperties = useMemo(
    () => propertiesData?.results ?? [],
    [propertiesData]
  )
  const ownerTenancies = useMemo(
    () => tenanciesData?.results ?? [],
    [tenanciesData]
  )

  const propertyMap = useMemo(() => {
    const map = new Map<string, PropertyListItem>()
    for (const item of ownerProperties) {
      map.set(item.id, item)
    }
    return map
  }, [ownerProperties])

  const applicationMap = useMemo(() => {
    const map = new Map<string, ApplicationListItem>()
    for (const item of applicationsData?.results ?? []) {
      map.set(item.id, item)
    }
    return map
  }, [applicationsData])

  const tenancyMap = useMemo(() => {
    const map = new Map<string, TenancyListItem>()
    for (const item of ownerTenancies) {
      map.set(item.id, item)
    }
    return map
  }, [ownerTenancies])

  const documents = useMemo(() => documentsData?.results ?? [], [documentsData])
  const scopedTotalCount = documentsData?.count ?? documents.length
  const totalPages = Math.max(1, Math.ceil(scopedTotalCount / PAGE_SIZE))

  const scopeCounts: Record<DocumentScope, number> = {
    all: totalAllCount,
    property: propertyDocsCount,
    application: applicationDocsCount,
    tenancy: tenancyDocsCount,
    personal: personalDocsCount,
  }

  const resolveRelatedMeta = (doc: DocumentItem) => {
    if (doc.tenancy) {
      const tenancy = tenancyMap.get(doc.tenancy)
      const labelTitle = tenancy?.property_title || `Tenancy #${doc.tenancy.slice(0, 8)}`
      const tenantSuffix = tenancy?.tenant_name ? ` · ${tenancy.tenant_name}` : ''
      return {
        label: `Tenancy · ${labelTitle}${tenantSuffix}`,
        visibilityNote: 'Shared with tenant',
        linkTo: `/app/owner/tenancies/${doc.tenancy}`,
        linkText: 'View Tenancy',
      }
    }

    if (doc.application) {
      const app = applicationMap.get(doc.application)
      const appTitle = app?.property_title || app?.listing_title || `Application #${doc.application.slice(0, 8)}`
      const applicantSuffix = app?.applicant_name ? ` · ${app.applicant_name}` : ''
      return {
        label: `Application · ${appTitle}${applicantSuffix}`,
        visibilityNote: 'Applicant & owner access',
        linkTo: `/app/owner/applications/${doc.application}`,
        linkText: 'View Application',
      }
    }

    if (doc.property) {
      const prop = propertyMap.get(doc.property)
      return {
        label: prop?.title ? `Property · ${prop.title}` : `Property #${doc.property.slice(0, 8)}`,
        visibilityNote: 'Private to property owner',
        linkTo: `/app/owner/properties/${doc.property}`,
        linkText: 'View Property',
      }
    }

    return {
      label: 'Personal Document',
      visibilityNote: 'Private to you',
      linkTo: null,
      linkText: null,
    }
  }

  const visibleDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = !query
      ? documents
      : documents.filter((doc) => {
          const titleMatch = (doc.title ?? '').toLowerCase().includes(query)
          const filenameMatch = doc.original_filename.toLowerCase().includes(query)
          const uploaderMatch = (doc.uploaded_by_name ?? '').toLowerCase().includes(query)
          const propMatch = doc.property
            ? (propertyMap.get(doc.property)?.title ?? '').toLowerCase().includes(query)
            : false
          const tenancyMatch = doc.tenancy
            ? (
                (tenancyMap.get(doc.tenancy)?.property_title ?? '') +
                ' ' +
                (tenancyMap.get(doc.tenancy)?.tenant_name ?? '')
              )
                .toLowerCase()
                .includes(query)
            : false
          const appMatch = doc.application
            ? (
                (applicationMap.get(doc.application)?.property_title ?? '') +
                ' ' +
                (applicationMap.get(doc.application)?.applicant_name ?? '')
              )
                .toLowerCase()
                .includes(query)
            : false

          return (
            titleMatch ||
            filenameMatch ||
            uploaderMatch ||
            propMatch ||
            tenancyMatch ||
            appMatch
          )
        })

    if (sortOrder === 'oldest') {
      return [...filtered].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }

    return [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [documents, searchQuery, sortOrder, propertyMap, tenancyMap, applicationMap])

  const handleScopeChange = (scope: DocumentScope) => {
    setActiveScope(scope)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDownload = async (doc: DocumentItem) => {
    if (downloadingId) return
    setDownloadingId(doc.id)
    try {
      await documentService.downloadDocument(doc.id, doc.original_filename)
      addToast({
        title: 'Download Started',
        description: doc.title || doc.original_filename,
        variant: 'success',
      })
    } catch (err: unknown) {
      addToast({
        title: 'Download Failed',
        description: extractApiErrorMessage(err, 'Unable to download this document.'),
        variant: 'error',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleOpenPreview = async (doc: DocumentItem) => {
    setPreviewDoc(doc)
    setPreviewUrl(null)
    setPreviewMimeType(doc.mime_type)
    setPreviewError(null)
    setIsPreviewLoading(true)

    try {
      const result = await documentService.fetchDocumentBlob(
        doc.id,
        doc.original_filename,
        doc.mime_type
      )
      const url = URL.createObjectURL(result.blob)
      setPreviewUrl(url)
      setPreviewMimeType(result.mimeType)
    } catch (err: unknown) {
      setPreviewError(
        extractApiErrorMessage(err, 'Unable to load preview for this document.')
      )
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewDoc(null)
    setPreviewUrl(null)
    setPreviewError(null)
  }

  const hasAnyDocsInAccount = totalAllCount > 0 || activeScope !== 'all'

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
          Documents
        </h1>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setIsUploadOpen(true)}
          leftIcon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          }
        >
          Upload Document
        </Button>
      </div>

      {/* 2. Summary KPI Cards */}
      <section
        aria-label="Documents overview"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
      >
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">All Documents</p>
            {isLoadingAllCount ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {totalAllCount}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#15803D]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Property Documents</p>
            {isLoadingPropertyCount ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {propertyDocsCount}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Application Documents</p>
            {isLoadingAppCount ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {applicationDocsCount}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-normal text-[#6B7280]">Tenancy Documents</p>
            {isLoadingTenancyCount ? (
              <Skeleton className="mt-1 h-6 w-12" />
            ) : (
              <p className="mt-0.5 text-xl font-medium text-[#111827] tabular-nums">
                {tenancyDocsCount}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 3. Error State */}
      {isError && (
        <Alert variant="error" title="Unable to load documents">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span>We couldn&apos;t retrieve your accessible documents right now.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 4. Filter Tabs & Search Controls */}
      {(hasAnyDocsInAccount || isLoading) && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
          <div
            role="tablist"
            aria-label="Filter documents by association"
            className="flex flex-wrap items-center gap-2"
          >
            {SCOPE_TABS.map((tab) => {
              const isSelected = activeScope === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleScopeChange(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#ECF5F2] border-[#408A71]/40 text-[#408A71]'
                      : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${
                      isSelected
                        ? 'bg-[#408A71] text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {scopeCounts[tab.id]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
            <div className="md:col-span-9">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search document name, uploader, property, or tenant on page..."
                aria-label="Search documents"
              />
            </div>
            <div className="md:col-span-3">
              <Select
                aria-label="Sort documents"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortDirection)}
                options={[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'oldest', label: 'Oldest First' },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Loading / Empty / List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((idx) => (
            <Skeleton key={idx} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : !hasAnyDocsInAccount && !isError ? (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="lg"
            title="No documents yet"
            description="Upload property deeds, rental agreements, or private records here. Supporting documents uploaded by applicants and tenants on your properties will also appear automatically."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" size="md" onClick={() => setIsUploadOpen(true)}>
                  Upload Document
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/app/owner/properties')}
                >
                  My Properties
                </Button>
              </div>
            }
          />
        </div>
      ) : visibleDocuments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="md"
            title="No matching documents"
            description="No documents match the selected scope tab or search query."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveScope('all')
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
              >
                Reset Filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {visibleDocuments.map((doc) => {
              const typeMeta = getDocumentTypeMeta(doc.document_type)
              const related = resolveRelatedMeta(doc)
              const canPreview = isPreviewableDocument(doc.mime_type, doc.original_filename)
              const isDownloadingThis = downloadingId === doc.id
              const isUploader = Boolean(user?.id && doc.uploaded_by === user.id)
              const uploaderDisplay = isUploader
                ? 'You'
                : doc.uploaded_by_name || 'Authorized User'

              return (
                <article
                  key={doc.id}
                  className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 flex flex-col justify-between gap-3 hover:shadow-xs transition-shadow"
                >
                  <div className="space-y-2.5 min-w-0">
                    {/* Header: Icon + Title + Type Badge */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2
                          className="text-sm font-medium text-[#111827] truncate mb-0"
                          title={doc.title || doc.original_filename}
                        >
                          {doc.title || doc.original_filename}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant={typeMeta.variant} size="sm">
                            {typeMeta.label}
                          </Badge>
                          <span className="text-[11px] font-normal text-[#6B7280]">
                            {formatMimeTypeLabel(doc.mime_type, doc.original_filename)}
                            {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 border-t border-[#F3F4F6] pt-2 text-[11px] font-normal text-[#6B7280]">
                      {doc.title && doc.title !== doc.original_filename && (
                        <p className="truncate" title={doc.original_filename}>
                          {doc.original_filename}
                        </p>
                      )}
                      <p>
                        Uploaded {formatDateTime(doc.created_at)} · By {uploaderDisplay}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs pt-0.5">
                        <span className="font-medium text-[#4B5563] truncate">
                          {related.label}
                          <span className="font-normal text-[#9CA3AF]"> · {related.visibilityNote}</span>
                        </span>
                        {related.linkTo && related.linkText && (
                          <Link
                            to={related.linkTo}
                            className="text-[#408A71] hover:text-[#34745C] font-medium inline-flex items-center gap-0.5 shrink-0"
                          >
                            <span>{related.linkText}</span>
                            <span aria-hidden="true">→</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-[#F3F4F6]">
                    {isUploader && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDoc(doc)}
                      >
                        Edit
                      </Button>
                    )}

                    {canPreview ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleOpenPreview(doc)}
                      >
                        Preview
                      </Button>
                    ) : (
                      <span className="text-[11px] font-normal text-[#6B7280] px-1">
                        Preview unavailable
                      </span>
                    )}

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      isLoading={isDownloadingThis}
                      loadingText="Downloading..."
                      onClick={() => void handleDownload(doc)}
                    >
                      Download
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={scopedTotalCount}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}

      {/* Upload / Edit Modal */}
      <DocumentUploadModal
        key={`owner-doc-modal-${editingDoc?.id ?? 'new'}-${isUploadOpen ? 'open' : 'closed'}`}
        open={isUploadOpen || Boolean(editingDoc)}
        documentToEdit={editingDoc}
        enableOwnerAttachments
        ownerProperties={ownerProperties}
        ownerTenancies={ownerTenancies}
        defaultDocumentType="property_document"
        onClose={() => {
          setIsUploadOpen(false)
          setEditingDoc(null)
        }}
      />

      {/* Authenticated Blob Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        previewUrl={previewUrl}
        mimeType={previewMimeType}
        isLoading={isPreviewLoading}
        error={previewError}
        onClose={handleClosePreview}
        onDownload={(doc) => void handleDownload(doc)}
        isDownloading={Boolean(previewDoc && downloadingId === previewDoc.id)}
      />
    </div>
  )
}

export default OwnerDocumentsPage

