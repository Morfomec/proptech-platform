import React, { useMemo } from 'react'
import type { AmenityItem } from '../../../types/property'
import { FormSection } from './FormSection'

export interface AmenitiesSectionProps {
  catalogue: AmenityItem[]
  selectedIds: string[]
  onToggle: (id: string) => void
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
}

function formatAmenityCategory(category: string): string {
  if (!category) return 'General'
  const acronyms = new Set(['hvac', 'cctv', 'ac', 'wifi'])
  return category
    .split('_')
    .map((word) => {
      const lower = word.toLowerCase()
      if (acronyms.has(lower)) return lower.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

export const AmenitiesSection: React.FC<AmenitiesSectionProps> = ({
  catalogue,
  selectedIds,
  onToggle,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}) => {
  const amenityGroups = useMemo(() => {
    const groups: Record<string, AmenityItem[]> = {}
    if (!catalogue || catalogue.length === 0) return groups

    catalogue.forEach((item) => {
      const rawCat = item.category || 'general'
      const formattedCat = formatAmenityCategory(rawCat)
      if (!groups[formattedCat]) {
        groups[formattedCat] = []
      }
      groups[formattedCat].push(item)
    })
    return groups
  }, [catalogue])

  return (
    <FormSection
      title="Amenities & Features"
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      }
      action={
        selectedIds.length > 0 ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#ECF5F2] text-[#408A71] border border-[#408A71]/20">
            {selectedIds.length} selected
          </span>
        ) : undefined
      }
    >
      {/* Loading State */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-5 h-5 border-2 border-[#408A71] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Loading amenities catalogue...</p>
        </div>
      )}

      {/* Error State with Retry */}
      {!isLoading && isError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-700">
          <div>
            <p className="font-semibold text-red-800">Failed to load amenities</p>
            <p className="mt-0.5 text-red-600">
              {errorMessage || 'Could not fetch master amenities.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-medium transition-colors cursor-pointer self-start sm:self-auto shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && catalogue.length === 0 && (
        <div className="py-6 text-center text-xs text-gray-500">
          No amenities available in the catalogue.
        </div>
      )}

      {/* Dynamic Catalogue */}
      {!isLoading && !isError && catalogue.length > 0 && (
        <div className="space-y-4">
          {Object.entries(amenityGroups).map(([groupTitle, items]) => {
            if (items.length === 0) return null
            return (
              <div key={groupTitle} className="space-y-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {groupTitle}
                </span>
                <div className="flex flex-wrap gap-2">
                  {items.map((amenity) => {
                    const isSelected = selectedIds.includes(amenity.id)
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => onToggle(amenity.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[#ECF5F2] border-[#408A71] text-[#2D6653] font-semibold shadow-2xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3.5 h-3.5 text-[#408A71]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <span>{amenity.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </FormSection>
  )
}

export default AmenitiesSection

