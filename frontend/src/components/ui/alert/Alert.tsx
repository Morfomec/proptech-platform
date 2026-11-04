import React from 'react'

export type AlertVariant = 'success' | 'warning' | 'error' | 'info'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
  children?: React.ReactNode
  onClose?: () => void
  icon?: React.ReactNode
  hideIcon?: boolean
}

const variantStyles: Record<
  AlertVariant,
  {
    container: string
    title: string
    body: string
    iconColor: string
    closeButton: string
  }
> = {
  success: {
    container: 'bg-[#ECFDF5] border-[#BBF7D0]',
    title: 'text-[#15803D]',
    body: 'text-[#15803D]/90',
    iconColor: 'text-[#15803D]',
    closeButton: 'text-[#15803D] hover:bg-[#D1FAE5]',
  },
  warning: {
    container: 'bg-[#FFFBEB] border-[#FDE68A]',
    title: 'text-[#D97706]',
    body: 'text-[#D97706]/90',
    iconColor: 'text-[#D97706]',
    closeButton: 'text-[#D97706] hover:bg-[#FEF3C7]',
  },
  error: {
    container: 'bg-[#FEF2F2] border-[#FECACA]',
    title: 'text-[#DC2626]',
    body: 'text-[#DC2626]/90',
    iconColor: 'text-[#DC2626]',
    closeButton: 'text-[#DC2626] hover:bg-[#FEE2E2]',
  },
  info: {
    container: 'bg-[#EFF6FF] border-[#BFDBFE]',
    title: 'text-[#2563EB]',
    body: 'text-[#2563EB]/90',
    iconColor: 'text-[#2563EB]',
    closeButton: 'text-[#2563EB] hover:bg-[#DBEAFE]',
  },
}

const DefaultIcons: Record<AlertVariant, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  icon,
  hideIcon = false,
  className = '',
  ...props
}) => {
  const styles = variantStyles[variant]
  const renderedIcon = icon || (!hideIcon ? DefaultIcons[variant] : null)
  const isPolite = variant === 'info' || variant === 'success'

  return (
    <div
      role={isPolite ? 'status' : 'alert'}
      aria-live={isPolite ? 'polite' : 'assertive'}
      className={`relative flex items-start gap-3.5 p-4 rounded-xl border shadow-xs transition-all ${
        styles.container
      } ${className}`}
      {...props}
    >
      {renderedIcon && (
        <span className={`shrink-0 mt-0.5 ${styles.iconColor}`} aria-hidden="true">
          {renderedIcon}
        </span>
      )}

      <div className="flex-1 min-w-0">
        {title && <h4 className={`text-sm font-semibold mb-1 leading-snug ${styles.title}`}>{title}</h4>}
        {children && <div className={`text-xs md:text-sm leading-relaxed ${styles.body}`}>{children}</div>}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className={`shrink-0 -mr-1 -mt-1 p-1 rounded-lg transition-colors cursor-pointer ${styles.closeButton}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

Alert.displayName = 'Alert'

export default Alert
