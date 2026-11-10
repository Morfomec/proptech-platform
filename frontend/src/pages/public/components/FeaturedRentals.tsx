import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '../../../components/ui/badge'
import { listingService } from '../../../services/listing.service'
import { getMediaUrl } from '../../../utils/imageUrl'

export const FeaturedRentals: React.FC = () => {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['public-featured-listings'],
    queryFn: () => listingService.getPublicListings({ page: 1, page_size: 6, sort: 'newest' }),
    staleTime: 1000 * 60 * 2,
  })

  const listings = data?.results || []

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }))
  }

  const formatPrice = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return amount
    return `₹${num.toLocaleString('en-IN')}`
  }

  return (
    <section id="properties" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#111827] tracking-tight">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs animate-pulse"
              >
                <div className="aspect-[16/10] bg-gray-200 w-full" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-9 bg-gray-100 rounded-xl w-full pt-2" />
                </div>
              </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {listings.map((listing) => {
              const prop = listing.property
              const propId = prop?.id || listing.id
              const hasImgError = imageErrors[propId]
              const currentImg =
                !hasImgError && prop?.primary_image_url
                  ? getMediaUrl(prop.primary_image_url)
                  : null

              const isCommercial = prop?.category === 'commercial' || !prop?.bedrooms
              const locationText = [prop?.locality, prop?.city, prop?.state]
                .filter(Boolean)
                .join(', ') || prop?.address_line_1 || 'Location available on request'

              return (
                <div
                  key={listing.id}
                  className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col group"
                >
                  {/* Property Image & Badge */}
                  <Link
                    to={`/properties/${listing.id}`}
                    state={{ from: 'properties' }}
                    className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100 block"
                  >
                    {currentImg ? (
                      <img
                        src={currentImg}
                        alt={listing.title || prop?.title || 'Property listing'}
                        onError={() => handleImageError(propId)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 text-gray-400">
                        <svg
                          className="h-10 w-10 text-gray-300 mb-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
                        </svg>
                        <span className="text-xs font-medium text-gray-400">No photo uploaded</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <Badge variant="success" size="sm" className="font-bold tracking-wider uppercase shadow-xs">
                        VERIFIED
                      </Badge>
                    </div>
                  </Link>

                  {/* Card Body */}
                  <div className="p-5 flex flex-col flex-grow justify-between">
                    <div>
                      <Link to={`/properties/${listing.id}`} state={{ from: 'properties' }}>
                        <h3 className="text-lg font-bold text-[#111827] group-hover:text-[#408A71] transition-colors line-clamp-1 mb-1">
                          {listing.title || prop?.title || 'Rental Listing'}
                        </h3>
                      </Link>
                      <p className="text-sm text-[#6B7280] mb-3 flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4 text-gray-400 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.75}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="truncate">{locationText}</span>
                      </p>

                      {/* Property Specs */}
                      <p className="text-xs font-medium text-[#6B7280] mb-4 pb-4 border-b border-gray-100">
                        {isCommercial ? (
                          <>
                            <span className="capitalize">{prop?.property_type || 'Commercial'}</span>
                            {prop?.built_up_area && ` · ${prop.built_up_area} sq ft`}
                          </>
                        ) : (
                          <>
                            {prop?.bedrooms || 0} {prop?.bedrooms === 1 ? 'Bed' : 'Beds'} &middot;{' '}
                            {prop?.bathrooms || 0} {prop?.bathrooms === 1 ? 'Bath' : 'Baths'}
                            {prop?.built_up_area && ` · ${prop.built_up_area} sq ft`}
                          </>
                        )}
                      </p>
                    </div>

                    {/* Card Bottom: Price and CTA */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-xl font-extrabold text-[#111827]">
                          {formatPrice(listing.monthly_rent)}
                        </span>
                        <span className="text-xs text-[#6B7280] font-normal">/month</span>
                      </div>

                      <Link
                        to={`/properties/${listing.id}`}
                        state={{ from: 'properties' }}
                        className="text-sm font-semibold text-[#408A71] hover:text-[#34745C] hover:underline transition-colors focus:outline-hidden cursor-pointer"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
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
