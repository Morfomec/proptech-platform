import React from 'react'

export type SkeletonShape = 'text' | 'circular' | 'rectangular'
export type SkeletonAnimation = 'pulse' | 'shimmer' | 'none'
export type SkeletonRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: SkeletonShape
  width?: string | number
  height?: string | number
  rounded?: SkeletonRadius | string
  animation?: SkeletonAnimation
  lines?: number
  className?: string
}

const radiusClasses: Record<SkeletonRadius, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
}

const animationClasses: Record<SkeletonAnimation, string> = {
  pulse: 'animate-pulse motion-reduce:animate-none',
  shimmer: 'animate-shimmer motion-reduce:animate-none',
  none: '',
}

function normalizeDimension(val?: string | number): string | undefined {
  if (val === undefined) return undefined
  if (typeof val === 'number') return `${val}px`
  return val
}

export const Skeleton: React.FC<SkeletonProps> = ({
  shape = 'text',
  width,
  height,
  rounded,
  animation = 'pulse',
  lines,
  className = '',
  style,
  ...props
}) => {
  const animClass = animationClasses[animation]
  const baseBg = 'bg-[#F3F4F6]'

  // Multi-line text layout
  if (shape === 'text' && lines && lines > 1) {
    return (
      <div
        role="status"
        aria-label="Loading content"
        className={`w-full space-y-2.5 ${className}`}
        {...props}
      >
        {Array.from({ length: lines }).map((_, idx) => {
          const isLast = idx === lines - 1
          const itemWidth = isLast ? '70%' : normalizeDimension(width) || '100%'
          const itemHeight = normalizeDimension(height) || '1rem'
          const itemRadius = rounded
            ? radiusClasses[rounded as SkeletonRadius] || rounded
            : 'rounded-md'

          return (
            <div
              key={`skeleton-line-${idx}`}
              style={{
                width: itemWidth,
                height: itemHeight,
                ...style,
              }}
              className={`${baseBg} ${itemRadius} ${animClass}`}
            />
          )
        })}
        <span className="sr-only">Loading content...</span>
      </div>
    )
  }

  // Determine shape styles
  let shapeClass: string
  let defaultWidth: string | undefined = undefined
  let defaultHeight: string | undefined
  let defaultRadius: string

  switch (shape) {
    case 'circular':
      shapeClass = 'shrink-0 aspect-square'
      defaultRadius = 'rounded-full'
      defaultWidth = width ? undefined : '2.5rem' // 40px
      defaultHeight = height ? undefined : '2.5rem'
      break
    case 'rectangular':
      shapeClass = 'w-full'
      defaultRadius = 'rounded-xl'
      defaultHeight = height ? undefined : '8rem' // 128px
      break
    case 'text':
    default:
      shapeClass = 'w-full'
      defaultRadius = 'rounded-md'
      defaultHeight = height ? undefined : '1rem' // 16px
      break
  }

  const finalRadius = rounded
    ? radiusClasses[rounded as SkeletonRadius] || rounded
    : defaultRadius

  const finalWidth = normalizeDimension(width) || defaultWidth
  const finalHeight = normalizeDimension(height) || defaultHeight

  return (
    <div
      role="status"
      aria-label="Loading content"
      style={{
        width: finalWidth,
        height: finalHeight,
        ...style,
      }}
      className={`${baseBg} ${finalRadius} ${shapeClass} ${animClass} ${className}`}
      {...props}
    >
      <span className="sr-only">Loading content...</span>
    </div>
  )
}
