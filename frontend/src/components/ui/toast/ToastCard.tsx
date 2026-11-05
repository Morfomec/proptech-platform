import React, { useEffect } from 'react'
import type { ToastItem } from './types'

interface ToastCardProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

const variantConfig = {
  success: {
    borderLeft: 'border-l-4 border-l-[#15803D]',
    iconColor: 'text-[#15803D] bg-[#ECFDF5]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    borderLeft: 'border-l-4 border-l-[#DC2626]',
    iconColor: 'text-[#DC2626] bg-[#FEF2F2]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  warning: {
    borderLeft: 'border-l-4 border-l-[#D97706]',
    iconColor: 'text-[#D97706] bg-[#FFFBEB]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  info: {
    borderLeft: 'border-l-4 border-l-[#2563EB]',
    iconColor: 'text-[#2563EB] bg-[#EFF6FF]',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

export const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss }) => {
  const config = variantConfig[toast.variant || 'info']

  useEffect(() => {
    const duration = toast.duration !== undefined ? toast.duration : 4000
    if (duration <= 0) return

    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, duration)

    return () => {
      clearTimeout(timer)
    }
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-3 w-full max-w-sm bg-surface rounded-xl p-4 shadow-lg border border-border transition-all duration-200 ${config.borderLeft}`}
    >
      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${config.iconColor}`}>
        {config.icon}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        {toast.title && (
          <h4 className="text-sm font-semibold text-heading leading-tight mb-1">
            {toast.title}
          </h4>
        )}
        {toast.description && (
          <div className="text-xs text-muted leading-relaxed">
            {toast.description}
          </div>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              onDismiss(toast.id)
            }}
            className="mt-2 text-xs font-semibold text-brand-primary hover:text-brand-hover hover:underline cursor-pointer"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg text-muted/60 hover:text-heading hover:bg-background transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
