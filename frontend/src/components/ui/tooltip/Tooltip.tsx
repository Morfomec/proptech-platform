import React, { useId, useState } from 'react'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content: React.ReactNode
  placement?: TooltipPlacement
  disabled?: boolean
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
  className?: string
}

const placementStyles: Record<
  TooltipPlacement,
  {
    container: string
    arrow: string
  }
> = {
  top: {
    container: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    arrow: 'top-full left-1/2 -translate-x-1/2 border-t-[#111827] border-l-transparent border-r-transparent border-b-transparent border-4',
  },
  bottom: {
    container: 'top-full left-1/2 -translate-x-1/2 mt-2',
    arrow: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#111827] border-l-transparent border-r-transparent border-t-transparent border-4',
  },
  left: {
    container: 'right-full top-1/2 -translate-y-1/2 mr-2',
    arrow: 'left-full top-1/2 -translate-y-1/2 border-l-[#111827] border-t-transparent border-b-transparent border-r-transparent border-4',
  },
  right: {
    container: 'left-full top-1/2 -translate-y-1/2 ml-2',
    arrow: 'right-full top-1/2 -translate-y-1/2 border-r-[#111827] border-t-transparent border-b-transparent border-l-transparent border-4',
  },
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = 'top',
  disabled = false,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const tooltipId = useId()

  if (disabled || !content) {
    return children
  }

  const { container, arrow } = placementStyles[placement]

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {/* Clone child to attach aria-describedby for assistive tech */}
      {React.cloneElement(children, {
        'aria-describedby': isVisible ? tooltipId : undefined,
      } as React.HTMLAttributes<HTMLElement>)}

      {isVisible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 px-2.5 py-1 text-xs font-medium text-white bg-[#111827] rounded-lg shadow-md whitespace-nowrap pointer-events-none transition-opacity duration-150 animate-in fade-in-0 zoom-in-95 ${container} ${className}`}
        >
          {content}
          <span className={`absolute w-0 h-0 ${arrow}`} aria-hidden="true" />
        </span>
      )}
    </span>
  )
}

Tooltip.displayName = 'Tooltip'

export default Tooltip
