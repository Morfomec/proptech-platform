import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listingService } from '../../../services/listing.service'
import { useOwnedPropertyIds } from '../../../hooks/useOwnedPropertyIds'
import { useSavedPropertiesToggle } from '../../../hooks/useSavedPropertiesToggle'
import {
  PropertyListingCard,
  PropertyListingCardSkeleton,
} from '../../../components/property/PropertyListingCard'

export const FeaturedRentals: React.FC = () => {
  const ownedPropertyIds = useOwnedPropertyIds()
  const { isPropertySaved, handleToggleSave } = useSavedPropertiesToggle()

  const { data, isLoading } = useQuery({
    queryKey: ['public-featured-listings'],
    queryFn: () => listingService.getPublicListings({ page: 1, page_size: 6, sort: 'newest' }),
    staleTime: 1000 * 60 * 2,
  })

  const listings = data?.results || []

  return (
    <section id="properties" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-medium text-[#111827] tracking-tight mb-0">
              Featured Rentals
            </h2>
          </div>

          <Link
            to="/properties"
            className="text-[#408A71] hover:text-[#34745C] font-semibold text-sm flex items-center gap-1.5 transition-colors self-start md:self-auto"
          >
            <span>View all properties</span>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

        {/* Content Section: Loading Skeletons, Empty State, or Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <PropertyListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 bg-[#FAFCFB] rounded-2xl border border-gray-100 my-4 p-8 max-w-xl mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#ECF5F2] text-[#408A71] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#111827] mb-2">No properties</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              There are currently no active properties listed. Check back soon for newly published properties!
            </p>
            <Link
              to="/properties"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white font-semibold text-sm transition-all shadow-xs"
            >
              Explore portal
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => {
              const prop = listing.property
              const propertyId = prop?.id || listing.property_id
              return (
                <PropertyListingCard
                  key={listing.id}
                  title={listing.title || prop?.title || 'Rental Listing'}
                  detailTo={`/properties/${listing.id}`}
                  detailState={{ from: 'properties' }}
                  property={prop}
                  monthlyRent={listing.monthly_rent}
                  isOwned={ownedPropertyIds.has(propertyId)}
                  isSaved={isPropertySaved(propertyId)}
                  onToggleSave={(e) => handleToggleSave(e, propertyId)}
                />
              )
            })}
          </div>
        )}

        {/* Explore More CTA */}
        {listings.length > 0 && (
          <div className="mt-12 text-center">
            <Link
              to="/properties"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white font-semibold text-sm transition-all shadow-xs hover:shadow-md cursor-pointer"
            >
              <span>Explore More</span>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

export default FeaturedRentals
