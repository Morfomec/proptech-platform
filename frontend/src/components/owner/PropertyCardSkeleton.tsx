import React from 'react'
import { Skeleton } from '../ui/skeleton'

export const PropertyCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-0 shadow-2xs">
      {/* Thumbnail Skeleton */}
      <Skeleton shape="rectangular" className="aspect-16/10 w-full" rounded="none" />

      {/* Details Skeleton */}
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex justify-between items-center">
          <Skeleton shape="text" width="30%" height={20} />
          <Skeleton shape="text" width="20%" height={14} />
        </div>
        <Skeleton shape="text" width="75%" height={18} />
        <Skeleton shape="text" width="50%" height={14} />

        <div className="flex gap-4 pt-2 border-t border-[#F3F4F6]">
          <Skeleton shape="text" width="25%" height={12} />
          <Skeleton shape="text" width="25%" height={12} />
          <Skeleton shape="text" width="25%" height={12} />
        </div>

        <div className="border-t border-[#F3F4F6] pt-3 flex justify-between items-center">
          <Skeleton shape="text" width="35%" height={12} />
          <div className="flex gap-1.5">
            <Skeleton shape="rectangular" width={28} height={28} rounded="md" />
            <Skeleton shape="rectangular" width={28} height={28} rounded="md" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default PropertyCardSkeleton
