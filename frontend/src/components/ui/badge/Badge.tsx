import React from 'react'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  success: {
    container: 'bg-[#ECFDF5] text-[#15803D] border-[#BBF7D0]',
    dot: 'bg-[#15803D]',
  },
  warning: {
    container: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
    dot: 'bg-[#D97706]',
  },
  danger: {
    container: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
    dot: 'bg-[#DC2626]',
  },
  info: {
    container: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
    dot: 'bg-[#2563EB]',
  },
  neutral: {
    container: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
    dot: 'bg-[#9CA3AF]',
  },
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-1 font-medium',
  md: 'px-2.5 py-1 text-xs gap-1.5 font-semibold',
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon,
  children,
  className = '',
  ...props
}) => {
  const styles = variantStyles[variant]

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs select-none transition-colors ${
        styles.container
      } ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      {icon && (
        <span className="shrink-0 flex items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      )}
      {children && <span>{children}</span>}
    </span>
  )
}

Badge.displayName = 'Badge'

export default Badge
