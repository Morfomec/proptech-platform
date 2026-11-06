import React, { useState } from 'react'
import { Badge } from '../../../components/ui/badge'

export interface PropertyListing {
  id: string | number
  title: string
  location: string
  city: string
  beds: number
  baths: number
  sqft: string
  price: string
  imageUrl: string
  fallbackImageUrl: string
  verified: boolean
  tag?: string
}

const PREVIEW_PROPERTIES: PropertyListing[] = [
  {
    id: 1,
    title: '3-BHK Apartment in Indiranagar',
    location: 'Indiranagar, Bangalore',
    city: 'Bangalore',
    beds: 3,
    baths: 2,
    sqft: '1,850 sq ft',
    price: '₹45,000',
    imageUrl:
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    verified: true,
  },
  {
    id: 2,
    title: 'Modern Studio in Bandra',
    location: 'West Bandra, Mumbai',
    city: 'Mumbai',
    beds: 1,
    baths: 1,
    sqft: '550 sq ft',
    price: '₹65,000',
    imageUrl:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
    verified: true,
  },
  {
    id: 3,
    title: 'Luxury Penthouse in Gurugram',
    location: 'Sector 54, Gurugram',
    city: 'Gurugram',
    beds: 4,
    baths: 4,
    sqft: '3,750 sq ft',
    price: '₹1,25,000',
    imageUrl:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
    fallbackImageUrl:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    verified: true,
  },
]

export const FeaturedRentals: React.FC = () => {
  // Selected modal or feedback state for details action
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null)
  const [imageErrors, setImageErrors] = useState<Record<string | number, boolean>>({})

  const handleImageError = (id: string | number) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }))
  }

  return (
    <section id="properties" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#111827] tracking-tight mb-2">
              Featured Rentals
            </h2>
            <p className="text-base text-[#6B7280]">
              Explore top-rated and listed properties in major Indian cities.
            </p>
          </div>

          <a
            href="#properties"
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
          </a>
        </div>

        {/* Data Architecture Transparency Banner */}
        <div className="mb-8 p-3.5 bg-gray-50 border border-gray-200/80 rounded-xl flex items-center justify-between gap-3 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#408A71]" aria-hidden="true" />
            <span className="font-medium text-[#111827]">Marketplace Preview:</span>
            <span>
              Sample verified listings across Bangalore, Mumbai, and Delhi NCR. Live marketplace inventory is currently expanding.
            </span>
          </div>
        </div>

        {/* Property Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {PREVIEW_PROPERTIES.map((property) => {
            const hasError = imageErrors[property.id]
            const currentImg = hasError ? property.fallbackImageUrl : property.imageUrl

            return (
              <div
                key={property.id}
                className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col group"
              >
                {/* Property Image & Badge */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
                  <img
                    src={currentImg}
                    alt={property.title}
                    onError={() => handleImageError(property.id)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {property.verified && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="success" size="sm" className="font-bold tracking-wider uppercase shadow-xs">
                        VERIFIED
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 flex flex-col flex-grow justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#111827] group-hover:text-[#408A71] transition-colors line-clamp-1 mb-1">
                      {property.title}
                    </h3>
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
                      <span className="truncate">{property.location}</span>
                    </p>

                    {/* Property Specs */}
                    <p className="text-xs font-medium text-[#6B7280] mb-4 pb-4 border-b border-gray-100">
                      {property.beds} {property.beds === 1 ? 'Bed' : 'Beds'} &middot; {property.baths}{' '}
                      {property.baths === 1 ? 'Bath' : 'Baths'} &middot; {property.sqft}
                    </p>
                  </div>

                  {/* Card Bottom: Price and CTA */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-xl font-extrabold text-[#111827]">
                        {property.price}
                      </span>
                      <span className="text-xs text-[#6B7280] font-normal">/month</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedProperty(property)}
                      className="text-sm font-semibold text-[#408A71] hover:text-[#34745C] hover:underline transition-colors focus:outline-none"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Lightweight Modal / Preview Info */}
        {selectedProperty && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in-0 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Badge variant="success" size="sm" className="mb-2">
                    VERIFIED LISTING
                  </Badge>
                  <h3 className="text-lg font-bold text-[#111827]">{selectedProperty.title}</h3>
                  <p className="text-xs text-[#6B7280]">{selectedProperty.location}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProperty(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Close dialog"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="rounded-xl overflow-hidden mb-4 aspect-[16/9]">
                <img
                  src={selectedProperty.imageUrl}
                  alt={selectedProperty.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs text-[#4B5563] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Rent:</span>
                  <span className="font-bold text-[#111827]">{selectedProperty.price}/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Configuration:</span>
                  <span className="font-semibold text-[#111827]">
                    {selectedProperty.beds} BHK &middot; {selectedProperty.sqft}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Status:</span>
                  <span className="text-emerald-700 font-semibold">Available for Viewing</span>
                </div>
              </div>

              <p className="text-xs text-[#6B7280] mb-5">
                Public property detail routing and scheduling will connect directly when the listing catalog API is enabled in the upcoming milestone.
              </p>

              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="w-full py-2.5 rounded-xl bg-[#408A71] hover:bg-[#34745C] text-white text-sm font-semibold transition-colors shadow-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default FeaturedRentals

