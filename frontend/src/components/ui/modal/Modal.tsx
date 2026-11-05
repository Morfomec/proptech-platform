import React, { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../overlay/useOverlay'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: ModalSize
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  className?: string
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useOverlay({
    open,
    onClose,
    closeOnEscape,
    containerRef: modalRef,
  })

  if (!open || typeof document === 'undefined') {
    return null
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) {
      onClose()
    }
  }

  return createPortal(
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in-0"
    >
      <div
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative w-full ${sizeStyles[size]} bg-surface rounded-2xl border border-border shadow-2xl p-6 transition-all duration-200 animate-in zoom-in-95 focus:outline-none flex flex-col max-h-[90vh] ${className}`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between pb-4 border-b border-border/80 shrink-0 gap-4">
            <div className="min-w-0 flex-1">
              {title && (
                <h3
                  id={titleId}
                  className="text-lg md:text-xl font-bold text-heading leading-tight truncate"
                >
                  {title}
                </h3>
              )}
              {description && (
                <p
                  id={descriptionId}
                  className="text-xs md:text-sm text-muted mt-1 leading-relaxed"
                >
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 -mr-1 -mt-1 p-2 rounded-xl text-muted/70 hover:text-heading hover:bg-background transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-primary"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 text-sm text-heading leading-relaxed focus:outline-none">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="pt-4 border-t border-border/80 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

Modal.displayName = 'Modal'

export default Modal
