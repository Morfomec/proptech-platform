import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import {
  useDocuments,
  useMyApplications,
  useMyTenancies,
} from '../../hooks/useTenantWorkspace'
import { listingService } from '../../services/listing.service'
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
import { DocumentCard, DocumentUploadTile } from '../../components/documents/DocumentCard'
import { extractApiErrorMessage, formatDateTime } from '../../utils/application'
import {
  DOCUMENT_CATEGORY_TABS,
  formatMimeTypeLabel,
  getDocumentCategoryGroup,
  getDocumentTypeMeta,
  isPreviewableDocument,
} from '../../utils/document'
import { formatFileSize } from '../../utils/tenancy'
import type { DocumentCategoryGroup, DocumentItem } from '../../types/document'
import type { ApplicationListItem, TenancyListItem } from '../../types/leasing'
import type { PublicListingItem } from '../../types/listing'

const PAGE_SIZE = 20

type SortDirection = 'newest' | 'oldest'

/**
 * TenantDocumentsPage
 * Authenticated Tenant "Documents" workspace page at `/app/tenant/documents`.
 * Fetches active documents via `GET /api/v1/documents/` (scoped by backend access rules),
 * supports tenant-allowed uploads (`POST /api/v1/documents/`), authenticated preview & download
 * (`GET /api/v1/documents/{id}/download/`), and in-workspace navigation to linked records.
 */
export const TenantDocumentsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()

  const [currentPage, setCurrentPage] = useState(1)
  const [activeCategory, setActiveCategory] = useState<'all' | DocumentCategoryGroup>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [relatedFilter, setRelatedFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<SortDirection>('newest')

  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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
  } = useDocuments({ page: currentPage, page_size: PAGE_SIZE })

  const { data: applicationsData } = useMyApplications({ page: 1, page_size: 100 })
  const { data: tenanciesData } = useMyTenancies({ page: 1, page_size: 100 })
  const { data: publishedListingsData } = useQuery({
    queryKey: ['tenant', 'published-listings-index'],
    queryFn: () => listingService.getPublicListings({ page: 1, page_size: 100 }),
    staleTime: 60_000,
  })

  const documents = useMemo(() => documentsData?.results ?? [], [documentsData])
  const totalCount = documentsData?.count ?? documents.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const applications = useMemo(() => applicationsData?.results ?? [], [applicationsData])
  const tenancies = useMemo(() => tenanciesData?.results ?? [], [tenanciesData])

  const applicationMap = useMemo(() => {
    const map = new Map<string, ApplicationListItem>()
    for (const app of applications) map.set(app.id, app)
    return map
  }, [applications])

  const tenancyMap = useMemo(() => {
    const map = new Map<string, TenancyListItem>()
    for (const t of tenancies) map.set(t.id, t)
    return map
  }, [tenancies])

  const listingByPropertyId = useMemo(() => {
    const map = new Map<string, PublicListingItem>()
    for (const l of publishedListingsData?.results ?? []) {
      map.set(l.property_id, l)
    }
    return map
  }, [publishedListingsData])

  // Category counts from currently loaded page
  const categoryCounts = useMemo(() => {
    const counts: Record<'all' | DocumentCategoryGroup, number> = {
      all: documents.length,
      rental_agreements: 0,
      application_documents: 0,
      property_documents: 0,
      other_documents: 0,
    }
    for (const doc of documents) {
      counts[getDocumentCategoryGroup(doc.document_type)] += 1
    }
    return counts
  }, [documents])

  // Related filter dropdown options derived strictly from tenant's actual tenancies & applications
  const relatedFilterOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Tenancies & Applications' }]
    for (const t of tenancies) {
      const appTitle =
        t.application_id ? applicationMap.get(t.application_id)?.property_title : null
      opts.push({
        value: `tenancy:${t.id}`,
        label: `Tenancy: ${appTitle || `#${t.id.slice(0, 8)}`}`,
      })
    }
    for (const app of applications) {
      opts.push({
        value: `application:${app.id}`,
        label: `Application: ${app.property_title || app.listing_title}`,
      })
    }
    return opts
  }, [tenancies, applications, applicationMap])

  // Apply current-page search, category, relation filter & sort
  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    const list = documents.filter((doc) => {
      if (activeCategory !== 'all' && getDocumentCategoryGroup(doc.document_type) !== activeCategory) {
        return false
      }
      if (q) {
        const titleMatch = (doc.title || '').toLowerCase().includes(q)
        const filenameMatch = doc.original_filename.toLowerCase().includes(q)
        if (!titleMatch && !filenameMatch) return false
      }
      if (relatedFilter.startsWith('tenancy:')) {
        const targetId = relatedFilter.slice('tenancy:'.length)
        if (doc.tenancy !== targetId) return false
      } else if (relatedFilter.startsWith('application:')) {
        const targetId = relatedFilter.slice('application:'.length)
        if (doc.application !== targetId) return false
      }
      return true
    })

    if (sortOrder === 'oldest') {
      return [...list].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }

    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [documents, activeCategory, searchQuery, relatedFilter, sortOrder])

  const hasActiveFilters =
    activeCategory !== 'all' || searchQuery.trim() !== '' || relatedFilter !== 'all'

  const clearFilters = () => {
    setActiveCategory('all')
    setSearchQuery('')
    setRelatedFilter('all')
    setSortOrder('newest')
  }

  const handleDownload = async (doc: DocumentItem) => {
    if (downloadingId) return
    setDownloadingId(doc.id)
    try {
      const toastTitle = doc.title || doc.original_filename
      await documentService.downloadDocument(doc.id, doc.original_filename)
      addToast({
        title: 'Download Started',
        description: toastTitle,
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

  const previewIndex = previewDoc
    ? filteredDocuments.findIndex((d) => d.id === previewDoc.id)
    : -1
  const hasPrevPreview = previewIndex > 0
  const hasNextPreview = previewIndex >= 0 && previewIndex < filteredDocuments.length - 1

  const handlePrevPreview = () => {
    if (hasPrevPreview) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      void handleOpenPreview(filteredDocuments[previewIndex - 1])
    }
  }

  const handleNextPreview = () => {
    if (hasNextPreview) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      void handleOpenPreview(filteredDocuments[previewIndex + 1])
    }
  }

  const resolveRelatedMeta = (doc: DocumentItem) => {
    if (doc.tenancy) {
      const tenancy = tenancyMap.get(doc.tenancy)
      const linkedApp = tenancy?.application_id
        ? applicationMap.get(tenancy.application_id)
        : null
      return {
        label: linkedApp?.property_title
          ? `Tenancy · ${linkedApp.property_title}`
          : `Tenancy #${doc.tenancy.slice(0, 8)}`,
        linkTo: '/app/tenant/tenancy',
        linkText: 'View Tenancy',
      }
    }

    if (doc.application) {
      const app = applicationMap.get(doc.application)
      return {
        label: app
          ? `Application · ${app.property_title || app.listing_title}`
          : `Application #${doc.application.slice(0, 8)}`,
        linkTo: `/app/tenant/applications/${doc.application}`,
        linkText: 'View Application',
      }
    }

    if (doc.property) {
      const publishedListing = listingByPropertyId.get(doc.property)
      return {
        label: publishedListing?.title
          ? `Property · ${publishedListing.title}`
          : `Property #${doc.property.slice(0, 8)}`,
        linkTo: publishedListing ? `/app/tenant/properties/${publishedListing.id}` : null,
        linkText: publishedListing ? 'View Property' : null,
      }
    }

    return {
      label: 'Personal Document',
      linkTo: null,
      linkText: null,
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">Documents</h1>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setIsUploadOpen(true)}
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          }
        >
          Upload Document
        </Button>
      </div>

      {/* 2. Error State */}
      {isError && (
        <Alert variant="error" title="Failed to load documents">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>We couldn&apos;t retrieve your accessible documents right now.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 3. Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
          >
            {[1, 2, 3, 4].map((idx) => (
              <Skeleton key={idx} className="h-[260px] w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ) : totalCount === 0 ? (
        /* 4. Empty State */
        <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
          <EmptyState
            size="lg"
            title="No documents available"
            description="Upload supporting documents for your applications or tenancies, or access rental agreements shared by property owners here."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" size="md" onClick={() => setIsUploadOpen(true)}>
                  Upload Document
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/app/tenant/applications')}
                >
                  My Applications
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {/* 5. Category Tabs */}
          <div
            role="tablist"
            aria-label="Document categories"
            className="flex flex-wrap items-center gap-2"
          >
            {DOCUMENT_CATEGORY_TABS.map((tab) => {
              const isSelected = activeCategory === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#ECF5F2] border-[#408A71]/40 text-[#408A71]'
                      : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isSelected ? 'bg-[#408A71] text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {categoryCounts[tab.id]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 6. Search, Filter & Sort Toolbar */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-5">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by document name..."
                  aria-label="Search documents by filename"
                />
              </div>

              <div className="md:col-span-4">
                <Select
                  aria-label="Filter by related tenancy or application"
                  value={relatedFilter}
                  onChange={(e) => setRelatedFilter(e.target.value)}
                  options={relatedFilterOptions}
                />
              </div>

              <div className="md:col-span-3">
                <Select
                  aria-label="Sort documents by upload date"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortDirection)}
                  options={[
                    { value: 'newest', label: 'Newest First' },
                    { value: 'oldest', label: 'Oldest First' },
                  ]}
                />
              </div>
            </div>

            {totalCount > PAGE_SIZE && (
              <p className="text-[11px] text-[#6B7280]">
                Showing page {currentPage} of {totalPages} ({totalCount} total documents). Search and filters apply to the documents loaded on this page because server-side document filtering is not yet available.
              </p>
            )}
          </section>

          {/* 7. Filtered Document List or No Results State */}
          {filteredDocuments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-10">
              <EmptyState
                size="md"
                title="No matching documents"
                description="No documents on this page match your current search or filter criteria."
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Compact View Mode Toggle */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#6B7280]">
                  Showing <span className="font-medium text-[#111827]">{filteredDocuments.length}</span>{' '}
                  {filteredDocuments.length === 1 ? 'document' : 'documents'}
                </p>
                <div className="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-[#ECF5F2] text-[#408A71]'
                        : 'text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-[#ECF5F2] text-[#408A71]'
                        : 'text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    List
                  </button>
                </div>
              </div>

              {viewMode === 'grid' ? (
                <div
                  className="grid gap-5"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
                >
                  <DocumentUploadTile
                    onClickUpload={() => {
                      setDroppedFile(null)
                      setIsUploadOpen(true)
                    }}
                    onDropFile={(file) => {
                      setDroppedFile(file)
                      setIsUploadOpen(true)
                    }}
                  />
                  {filteredDocuments.map((doc) => {
                    const related = resolveRelatedMeta(doc)
                    return (
                      <DocumentCard
                        key={doc.id}
                        document={doc}
                        scopeLabel={related.label}
                        scopeLinkTo={related.linkTo}
                        scopeLinkText={related.linkText}
                        canEdit={Boolean(user?.id && doc.uploaded_by === user.id)}
                        isDownloading={downloadingId === doc.id}
                        onPreview={(d) => void handleOpenPreview(d)}
                        onDownload={(d) => void handleDownload(d)}
                        onEdit={(d) => setEditingDoc(d)}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredDocuments.map((doc) => {
                    const typeMeta = getDocumentTypeMeta(doc.document_type)
                    const related = resolveRelatedMeta(doc)
                    const canPreview = isPreviewableDocument(doc.mime_type, doc.original_filename)
                    const isDownloadingThis = downloadingId === doc.id

                    return (
                      <article
                        key={doc.id}
                        onClick={() => void handleOpenPreview(doc)}
                        className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-xs transition-shadow cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ECF5F2] text-[#408A71]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-sm font-medium text-[#111827] truncate mb-0" title={doc.original_filename}>
                                {doc.title || doc.original_filename}
                              </h2>
                              {doc.document_type !== 'other' && (
                                <Badge variant={typeMeta.variant} size="sm">
                                  {typeMeta.label}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[#6B7280] truncate">
                              {formatMimeTypeLabel(doc.mime_type, doc.original_filename)}
                              {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''} ·{' '}
                              {formatDateTime(doc.created_at)} · {related.label}
                            </p>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-2 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {hasActiveFilters && <span className="sr-only">Filtered view</span>}
                          {user?.id && doc.uploaded_by === user.id && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingDoc(doc)}>
                              Edit
                            </Button>
                          )}
                          {canPreview && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleOpenPreview(doc)}
                            >
                              Preview
                            </Button>
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
              )}
            </div>
          )}

          {/* 8. Server Pagination */}
          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}

      {/* Upload / Edit Document Modal */}
      <DocumentUploadModal
        key={`${editingDoc?.id ?? 'new'}-${droppedFile?.name ?? 'none'}-${isUploadOpen ? 'open' : 'closed'}`}
        open={isUploadOpen || Boolean(editingDoc)}
        documentToEdit={editingDoc}
        initialFile={droppedFile}
        onClose={() => {
          setIsUploadOpen(false)
          setDroppedFile(null)
          setEditingDoc(null)
        }}
      />

      {/* Authenticated Blob Preview Lightbox */}
      <DocumentPreviewModal
        document={previewDoc}
        previewUrl={previewUrl}
        mimeType={previewMimeType}
        isLoading={isPreviewLoading}
        error={previewError}
        onClose={handleClosePreview}
        onDownload={(doc) => void handleDownload(doc)}
        isDownloading={Boolean(previewDoc && downloadingId === previewDoc.id)}
        canEdit={Boolean(previewDoc && user?.id && previewDoc.uploaded_by === user.id)}
        onEdit={(doc) => setEditingDoc(doc)}
        onPrev={handlePrevPreview}
        onNext={handleNextPreview}
        hasPrev={hasPrevPreview}
        hasNext={hasNextPreview}
        scopeLabel={previewDoc ? resolveRelatedMeta(previewDoc).label : undefined}
        scopeLinkTo={previewDoc ? resolveRelatedMeta(previewDoc).linkTo : null}
        scopeLinkText={previewDoc ? resolveRelatedMeta(previewDoc).linkText : null}
      />
    </div>
  )
}

export default TenantDocumentsPage
