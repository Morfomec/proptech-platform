import React from 'react'
import { Skeleton } from '../ui/skeleton'

export const PropertyCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-0">
      {/* Thumbnail Skeleton */}
      <Skeleton shape="rectangular" className="aspect-16/10 w-full" rounded="none" />

      {/* Details Skeleton */}
      <div className="p-5 space-y-3">
        <Skeleton shape="text" width="40%" height={14} />
        <Skeleton shape="text" width="85%" height={20} />
        <Skeleton shape="text" width="60%" height={14} />

        <div className="border-t border-[#F3F4F6] pt-3 flex justify-between">
          <Skeleton shape="text" width="35%" height={12} />
          <Skeleton shape="text" width="25%" height={12} />
        </div>
      </div>
    </div>
  )
}

export default PropertyCardSkeleton

