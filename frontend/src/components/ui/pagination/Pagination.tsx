import React from 'react'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (pageSize: number) => void
  totalItems?: number
  pageSizeOptions?: number[]
  showTotal?: boolean
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
  pageSizeOptions = [10, 20, 50, 100],
  showTotal = true,
  className = '',
}) => {
  // Normalize pages to be at least 1 for display calculations
  const effectiveTotalPages = Math.max(0, totalPages)
  const isZeroRecords = totalItems === 0 || effectiveTotalPages === 0
  const activePage = isZeroRecords ? 0 : Math.min(Math.max(1, currentPage), effectiveTotalPages)

  const isFirstPage = activePage <= 1
  const isLastPage = activePage >= effectiveTotalPages

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | 'ellipsis-prev' | 'ellipsis-next')[] => {
    if (effectiveTotalPages <= 7) {
      return Array.from({ length: effectiveTotalPages }, (_, i) => i + 1)
    }

    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis-next', effectiveTotalPages]
    }

    if (activePage >= effectiveTotalPages - 3) {
      return [
        1,
        'ellipsis-prev',
        effectiveTotalPages - 4,
        effectiveTotalPages - 3,
        effectiveTotalPages - 2,
        effectiveTotalPages - 1,
        effectiveTotalPages,
      ]
    }

    return [
      1,
      'ellipsis-prev',
      activePage - 1,
      activePage,
      activePage + 1,
      'ellipsis-next',
      effectiveTotalPages,
    ]
  }

  // Calculate range text (e.g. "Showing 1-10 of 45 items")
  const renderRangeText = () => {
    if (totalItems === undefined) return null

    if (isZeroRecords) {
      return <span className="text-xs text-[#6B7280]">0 of 0 records</span>
    }

    if (!pageSize) {
      return (
        <span className="text-xs text-[#6B7280]">
          Page <strong className="text-[#111827]">{activePage}</strong> of{' '}
          <strong className="text-[#111827]">{effectiveTotalPages}</strong> ({totalItems} total)
        </span>
      )
    }

    const startItem = (activePage - 1) * pageSize + 1
    const endItem = Math.min(activePage * pageSize, totalItems)

    return (
      <span className="text-xs text-[#6B7280]">
        Showing <strong className="text-[#111827]">{startItem}</strong>&ndash;
        <strong className="text-[#111827]">{endItem}</strong> of{' '}
        <strong className="text-[#111827]">{totalItems}</strong> records
      </span>
    )
  }

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 text-sm ${className}`}
    >
      {/* Left section: Summary information & page size selector */}
      <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
        {showTotal && renderRangeText()}

        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <label htmlFor="pagination-page-size" className="whitespace-nowrap font-medium">
              Rows per page:
            </label>
            <div className="relative">
              <select
                id="pagination-page-size"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label="Select rows per page"
                className="h-8 pl-2.5 pr-7 text-xs font-medium text-[#111827] bg-white border border-[#E5E7EB] rounded-lg appearance-none cursor-pointer outline-none hover:border-gray-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-colors"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option} className="text-[#111827] bg-white">
                    {option}
                  </option>
                ))}
              </select>
              <div
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B7280]"
                aria-hidden="true"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right section: Navigation controls */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* First page button */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={isFirstPage || isZeroRecords}
          aria-label="Go to first page"
          title="First page"
          className="h-8 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] hover:text-brand-primary disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:border-[#E5E7EB] disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-brand-primary"
        >
          <span className="sr-only">First page</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Previous page button */}
        <button
          type="button"
          onClick={() => onPageChange(activePage - 1)}
          disabled={isFirstPage || isZeroRecords}
          aria-label="Go to previous page"
          title="Previous page"
          className="h-8 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] hover:text-brand-primary disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:border-[#E5E7EB] disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-brand-primary gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Numbered page buttons & Ellipses */}
        {getPageNumbers().map((pageItem) => {
          if (pageItem === 'ellipsis-prev' || pageItem === 'ellipsis-next') {
            return (
              <span
                key={pageItem}
                className="w-8 h-8 flex items-center justify-center text-xs font-medium text-[#6B7280] select-none"
                aria-hidden="true"
              >
                &hellip;
              </span>
            )
          }

          const isCurrent = pageItem === activePage

          return (
            <button
              key={`page-${pageItem}`}
              type="button"
              onClick={() => onPageChange(pageItem)}
              aria-label={`Page ${pageItem}`}
              aria-current={isCurrent ? 'page' : undefined}
              className={`min-w-[32px] h-8 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center select-none focus-visible:outline-2 focus-visible:outline-brand-primary ${
                isCurrent
                  ? 'bg-brand-primary text-white font-semibold shadow-xs border border-brand-primary'
                  : 'bg-white text-[#111827] border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-brand-primary hover:border-gray-400'
              }`}
            >
              {pageItem}
            </button>
          )
        })}

        {/* Next page button */}
        <button
          type="button"
          onClick={() => onPageChange(activePage + 1)}
          disabled={isLastPage || isZeroRecords}
          aria-label="Go to next page"
          title="Next page"
          className="h-8 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] hover:text-brand-primary disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:border-[#E5E7EB] disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-brand-primary gap-1"
        >
          <span className="hidden sm:inline">Next</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Last page button */}
        <button
          type="button"
          onClick={() => onPageChange(effectiveTotalPages)}
          disabled={isLastPage || isZeroRecords}
          aria-label="Go to last page"
          title="Last page"
          className="h-8 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] hover:text-brand-primary disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:border-[#E5E7EB] disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-brand-primary"
        >
          <span className="sr-only">Last page</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  )
}

Pagination.displayName = 'Pagination'

export default Pagination
