import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOwnerProperties } from '../../hooks/useOwnerProperties'
import { PropertyCard } from '../../components/owner/PropertyCard'
import { PropertyCardSkeleton } from '../../components/owner/PropertyCardSkeleton'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/empty-state'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Pagination } from '../../components/ui/pagination'

const PAGE_SIZE = 12

/**
 * MyPropertiesPage
 * Displays the owner's complete real estate portfolio with server-side pagination.
 * Route: /app/owner/properties
 */
export const MyPropertiesPage: React.FC = () => {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)

  const { data, isLoading, isError, error, refetch } = useOwnerProperties({
    page: currentPage,
    page_size: PAGE_SIZE,
  })

  const totalItems = data?.count ?? 0
  const totalPages = Math.ceil(totalItems / PAGE_SIZE)
  const properties = data?.results ?? []

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="My Properties"
        description="View and manage the operational status, specifications, and images of your real estate portfolio."
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/owner/properties/new')}
            leftIcon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Property
          </Button>
        }
      />

      {/* 2. Portfolio Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          <span>Total registered properties:</span>
          {isLoading ? (
            <span className="h-4 w-8 bg-gray-200 animate-pulse rounded" />
          ) : (
            <strong className="text-sm font-bold text-[#111827]">{totalItems}</strong>
          )}
        </div>

        {totalItems > 0 && !isLoading && (
          <div className="text-xs text-[#6B7280]">
            Page <strong className="text-[#111827]">{currentPage}</strong> of{' '}
            <strong className="text-[#111827]">{Math.max(1, totalPages)}</strong>
          </div>
        )}
      </div>

      {/* 3. Error Banner */}
      {isError && (
        <Alert
          variant="error"
          title="Could not retrieve properties"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>{error instanceof Error ? error.message : 'An error occurred while connecting to the properties API.'}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 4. Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <PropertyCardSkeleton key={idx} />
          ))}
        </div>
      )}

      {/* 5. Zero-State Display */}
      {!isLoading && !isError && properties.length === 0 && (
        <EmptyState
          context="property"
          title="No properties in your portfolio"
          description="You have not added any properties yet. Once added, you will be able to manage occupancy, units, and photos here."
          action={{
            label: 'Add Property',
            onClick: () => navigate('/app/owner/properties/new'),
            variant: 'primary',
          }}
          bordered
          className="py-16 bg-white"
        />
      )}

      {/* 6. Property Cards Grid */}
      {!isLoading && !isError && properties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      {/* 7. Server-Side Pagination */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="pt-4 border-t border-[#E5E7EB]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
            showTotal={true}
          />
        </div>
      )}
    </div>
  )
}

export default MyPropertiesPage