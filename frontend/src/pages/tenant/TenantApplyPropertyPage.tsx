import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listingService } from '../../services/listing.service'
import { useAuth } from '../../hooks/useAuth'
import { useOwnedPropertyIds } from '../../hooks/useOwnedPropertyIds'
import { useMyApplications, useSubmitApplication } from '../../hooks/useTenantWorkspace'
import { Alert, Badge, Button, Skeleton, Textarea, useToast } from '../../components/ui'
import {
  extractApiErrorMessage,
  formatDate,
  formatINR,
  getApplicationStatusMeta,
  isActiveApplicationStatus,
} from '../../utils/application'
import { getMediaUrl } from '../../utils/imageUrl'
import type { ApplicationDetail } from '../../types/leasing'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  independent_house: 'Independent House',
  villa: 'Villa',
  studio_apartment: 'Studio Apartment',
  office: 'Office',
  shop: 'Shop',
  showroom: 'Showroom',
  warehouse: 'Warehouse',
  other: 'Other',
}

const FURNISHING_LABELS: Record<string, string> = {
  fully_furnished: 'Fully Furnished',
  semi_furnished: 'Semi-Furnished',
  unfurnished: 'Unfurnished',
}

/**
 * TenantApplyPropertyPage
 * Dedicated rental application page inside TenantWorkspaceLayout at
 * `/app/tenant/properties/:id/apply`.
 * Reuses `listingService.getListing`, `useMyApplications`, and `useSubmitApplication`.
 */
export const TenantApplyPropertyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const ownedPropertyIds = useOwnedPropertyIds()

  const [message, setMessage] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedApplication, setSubmittedApplication] = useState<ApplicationDetail | null>(null)

  const {
    data: listingResponse,
    isLoading: isListingLoading,
    isError: isListingError,
  } = useQuery({
    queryKey: ['public-listing-detail', id],
    queryFn: () => listingService.getListing(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  const { data: myApplicationsData, isLoading: isAppsLoading } = useMyApplications({
    page: 1,
    page_size: 100,
  })

  const submitMutation = useSubmitApplication()

  const listing = listingResponse?.data
  const prop = listing?.property

  const isOwnProperty = Boolean(
    listing &&
      ((user?.id && listing.owner?.id && user.id === listing.owner.id) ||
        ownedPropertyIds.has(listing.property_id))
  )

  const isListingPubliclyEligible = Boolean(
    listing && listing.status === 'published' && prop?.status === 'available'
  )

  const { existingApplication, previousApplication } = useMemo(() => {
    if (!listing) return { existingApplication: null, previousApplication: null }
    const forListing = (myApplicationsData?.results ?? []).filter(
      (a) => a.listing === listing.id
    )
    return {
      existingApplication:
        forListing.find((a) => isActiveApplicationStatus(a.status)) ?? null,
      previousApplication:
        forListing.find((a) => !isActiveApplicationStatus(a.status)) ?? null,
    }
  }, [listing, myApplicationsData])

  const detailPath = `/app/tenant/properties/${listing?.id || id}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!listing || submitMutation.isPending) return
    if (isOwnProperty || !isListingPubliclyEligible || !user?.is_tenant || existingApplication) {
      return
    }

    setSubmitError(null)
    try {
      const trimmed = message.trim()
      const res = await submitMutation.mutateAsync({
        listing_id: listing.id,
        message: trimmed || undefined,
      })

      setSubmittedApplication(res.data ?? null)
      addToast({
        title: 'Application Submitted',
        description: `Your rental application for ${listing.title || prop?.title || 'this property'} has been submitted.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      setSubmitError(
        extractApiErrorMessage(err, 'Failed to submit application. Please try again.')
      )
    }
  }

  // 1. Loading State
  if (isListingLoading || (isAppsLoading && !myApplicationsData)) {
    return (
      <div className="space-y-6 pb-10">
        <Skeleton className="h-5 w-72" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-7">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  // 2. Unavailable / Not Found State
  if (isListingError || !listing || !isListingPubliclyEligible) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">
            Listing Not Available for Applications
          </h1>
          <p className="text-sm text-[#6B7280] max-w-md mx-auto">
            This property listing may have been paused, closed, or is no longer publicly available.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Button variant="primary" size="md" onClick={() => navigate('/app/tenant/properties')}>
            Browse Properties
          </Button>
          <Button variant="outline" size="md" onClick={() => navigate('/app/tenant/applications')}>
            My Applications
          </Button>
        </div>
      </div>
    )
  }

  // Property Summary Data (strictly real API values)
  const images = prop?.images && prop.images.length > 0 ? prop.images : []
  const primaryImageUrl =
    images.find((img) => img.is_primary)?.image_url ||
    prop?.primary_image_url ||
    (images.length > 0 ? images[0].image_url : null)

  const propertyTitle = listing.title || prop?.title || 'Rental Property'
  const locationText =
    [prop?.address_line_1, prop?.locality, prop?.city, prop?.district, prop?.state]
      .filter(Boolean)
      .join(', ') || 'Location unavailable'

  const propertyTypeLabel = prop?.property_type
    ? PROPERTY_TYPE_LABELS[prop.property_type] || prop.property_type
    : null

  const furnishingLabel = prop?.furnishing_status
    ? FURNISHING_LABELS[prop.furnishing_status] || prop.furnishing_status
    : null

  const rentFormatted = formatINR(listing.monthly_rent)
  const depositFormatted = formatINR(listing.security_deposit)

  const applicantName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || null

  const specSummaryItems = [
    prop?.category === 'residential' && prop?.bedrooms !== null && prop?.bedrooms !== undefined
      ? { label: 'Bedrooms', value: `${prop.bedrooms} ${prop.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}` }
      : null,
    prop?.bathrooms !== null && prop?.bathrooms !== undefined
      ? { label: 'Bathrooms', value: `${prop.bathrooms} ${Number(prop.bathrooms) === 1 ? 'Bathroom' : 'Bathrooms'}` }
      : null,
    furnishingLabel ? { label: 'Furnishing', value: furnishingLabel } : null,
    propertyTypeLabel ? { label: 'Property Type', value: propertyTypeLabel } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item))

  const activeExistingApp = existingApplication && !submittedApplication ? existingApplication : null
  const existingAppMeta = activeExistingApp
    ? getApplicationStatusMeta(activeExistingApp.status)
    : null
  const submittedAppMeta = submittedApplication
    ? getApplicationStatusMeta(submittedApplication.status)
    : null

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb & Back Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-[#6B7280] font-medium">
            <li>
              <Link to="/app/tenant/dashboard" className="hover:text-[#408A71] transition-colors">
                Overview
              </Link>
            </li>
            <li aria-hidden="true" className="text-gray-400">
              /
            </li>
            <li>
              <Link to="/app/tenant/properties" className="hover:text-[#408A71] transition-colors">
                Browse Properties
              </Link>
            </li>
            <li aria-hidden="true" className="text-gray-400">
              /
            </li>
            <li className="max-w-[180px] sm:max-w-xs truncate">
              <Link to={detailPath} className="hover:text-[#408A71] transition-colors">
                {propertyTitle}
              </Link>
            </li>
            <li aria-hidden="true" className="text-gray-400">
              /
            </li>
            <li className="text-[#111827] font-semibold">Apply for Rental</li>
          </ol>
        </nav>

        <Link
          to={detailPath}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-gray-50 text-xs font-semibold text-[#374151] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Property Details</span>
        </Link>
      </div>

      {/* Main Two-Column Desktop / Single-Column Mobile Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Application Form / Status States */}
        <section className="lg:col-span-7 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="border-b border-[#F3F4F6] pb-5">
            <h1 className="text-xl font-medium text-[#111827] tracking-tight mb-0">
              Apply for Rental
            </h1>
            <p className="mt-1.5 text-sm text-[#6B7280]">
              Review the rental terms and send your application directly to the property owner.
            </p>
          </div>

          {submittedApplication && submittedAppMeta ? (
            /* Success State */
            <div className="space-y-5">
              <Alert variant="success" title="Application Submitted">
                Your rental application has been sent to the property owner. You can monitor review updates in My Applications.
              </Alert>

              <div className="rounded-xl border border-[#CBE7DC] bg-[#F4FAF7] p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#1A382A]">
                    Application Status
                  </span>
                  <Badge variant={submittedAppMeta.variant} size="sm" dot>
                    {submittedAppMeta.label}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-[#111827]">{propertyTitle}</p>
                <p className="text-xs text-[#4B5563]">
                  Submitted on {formatDate(submittedApplication.created_at)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/app/tenant/applications')}
                >
                  My Applications
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() =>
                    navigate(`/app/tenant/applications/${submittedApplication.id}`)
                  }
                >
                  View Application Details
                </Button>
              </div>
            </div>
          ) : isOwnProperty ? (
            /* Owner Self-Application Guard */
            <div className="space-y-5">
              <Alert variant="warning" title="Own Property">
                You cannot apply to your own property listing. Manage this listing from your Owner Workspace instead.
              </Alert>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => navigate(`/app/owner/properties/${listing.property_id}`)}
                >
                  Manage Property
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => navigate(detailPath)}
                >
                  Back to Property Details
                </Button>
              </div>
            </div>
          ) : !user?.is_tenant ? (
            /* Tenant Capability Guard */
            <div className="space-y-5">
              <Alert variant="warning" title="Tenant Account Required">
                Only accounts with Tenant capability can submit rental applications.
              </Alert>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => navigate(detailPath)}
              >
                Back to Property Details
              </Button>
            </div>
          ) : activeExistingApp && existingAppMeta ? (
            /* Duplicate Application Guard */
            <div className="space-y-5">
              <Alert variant="info" title="Already Applied">
                You have already submitted a rental application for this listing. Duplicate applications are not permitted.
              </Alert>

              <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Current Status
                  </span>
                  <Badge variant={existingAppMeta.variant} size="sm" dot>
                    {existingAppMeta.label}
                  </Badge>
                </div>
                <p className="text-xs text-[#4B5563]">
                  Applied on {formatDate(activeExistingApp.created_at)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() =>
                    navigate(`/app/tenant/applications/${activeExistingApp.id}`)
                  }
                >
                  View Application Details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => navigate(detailPath)}
                >
                  Back to Property Details
                </Button>
              </div>
            </div>
          ) : (
            /* Application Form */
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              {submitError && <Alert variant="error">{submitError}</Alert>}

              {previousApplication && (
                <Alert variant="info" title="Reapplying for Listing">
                  Your previous application ({getApplicationStatusMeta(previousApplication.status).label}) remains in your history. Submitting this form creates a new application.
                </Alert>
              )}

              {/* Authenticated Applicant Account Summary */}
              {user && (
                <div className="rounded-xl border border-[#DCE8E2] bg-[#F4FAF7]/70 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#408A71]">
                    Applying As
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {applicantName && (
                      <span className="font-semibold text-[#111827]">{applicantName}</span>
                    )}
                    {user.email && (
                      <span className="text-xs text-[#4B5563]">{user.email}</span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Textarea
                  id="apply-owner-message"
                  label="Message to Property Owner"
                  hint="Optional. Introduce yourself, preferred move-in timeframe, or household details."
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share a brief note for the property owner..."
                  disabled={submitMutation.isPending}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-2 border-t border-[#F3F4F6]">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={submitMutation.isPending}
                  onClick={() => navigate(detailPath)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={submitMutation.isPending}
                  loadingText="Submitting Application..."
                >
                  Submit Application
                </Button>
              </div>
            </form>
          )}
        </section>

        {/* Right Column: Property Summary Card */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
          {/* Property Image */}
          <div className="aspect-[16/10] w-full bg-gray-100 overflow-hidden">
            {primaryImageUrl ? (
              <img
                src={getMediaUrl(primaryImageUrl)}
                alt={propertyTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            {/* Title & Location */}
            <div>
              <h2 className="text-lg font-bold text-[#111827] leading-snug">
                {propertyTitle}
              </h2>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs sm:text-sm text-[#408A71] font-medium">
                <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                </svg>
                <span>{locationText}</span>
              </p>
            </div>

            {/* Pricing */}
            <div className="rounded-xl border border-[#DCE8E2] bg-[#F4FAF7]/80 p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-[#4B5563]">Monthly Rent</span>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-[#111827]">
                    {rentFormatted ?? '—'}
                  </span>
                  {rentFormatted && (
                    <span className="text-xs font-medium text-[#6B7280]"> / month</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#DCE8E2]/80 text-xs sm:text-sm">
                <span className="text-[#4B5563]">Security Deposit</span>
                <span className="font-bold text-[#111827]">
                  {depositFormatted ?? 'Not specified'}
                </span>
              </div>
            </div>

            {/* Specifications */}
            {specSummaryItems.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {specSummaryItems.map((spec) => (
                  <div
                    key={spec.label}
                    className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                      {spec.label}
                    </p>
                    <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#111827]">
                      {spec.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default TenantApplyPropertyPage

