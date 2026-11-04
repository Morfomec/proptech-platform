import React from 'react'

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type SpinnerVariant = 'brand' | 'white' | 'neutral' | 'current'

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize
  variant?: SpinnerVariant
  label?: string
  showLabel?: boolean
  className?: string
}

const sizeConfig: Record<SpinnerSize, { dimension: number; strokeWidth: number; textSize: string }> = {
  xs: { dimension: 14, strokeWidth: 3, textSize: 'text-xs' },
  sm: { dimension: 16, strokeWidth: 3, textSize: 'text-xs' },
  md: { dimension: 24, strokeWidth: 3, textSize: 'text-sm' },
  lg: { dimension: 32, strokeWidth: 3.5, textSize: 'text-base' },
  xl: { dimension: 48, strokeWidth: 4, textSize: 'text-lg' },
}

const variantStyles: Record<SpinnerVariant, string> = {
  brand: 'text-[#408A71]',
  white: 'text-white',
  neutral: 'text-[#6B7280]',
  current: 'text-current',
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'brand',
  label = 'Loading...',
  showLabel = false,
  className = '',
  ...props
}) => {
  const { dimension, strokeWidth, textSize } = sizeConfig[size]
  const colorClass = variantStyles[variant]

  const spinnerSvg = (
    <svg
      className="animate-spin motion-reduce:animate-none shrink-0"
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )

  return (
    <div
      role="status"
      aria-label={label}
      className={`inline-flex items-center gap-2 ${colorClass} ${className}`}
      {...props}
    >
      {spinnerSvg}
      {showLabel ? (
        <span className={`font-medium ${textSize}`}>{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  )
}
