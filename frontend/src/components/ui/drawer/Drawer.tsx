import React, { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../overlay/useOverlay'

export type DrawerPlacement = 'left' | 'right'
export type DrawerSize = 'sm' | 'md' | 'lg'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  placement?: DrawerPlacement
  size?: DrawerSize
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  className?: string
}

const sizeStyles: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  placement = 'right',
  size = 'md',
  title,
  description,
  children,
  footer,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useOverlay({
    open,
    onClose,
    closeOnEscape,
    containerRef: drawerRef,
  })

  if (!open || typeof document === 'undefined') {
    return null
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) {
      onClose()
    }
  }

  const isLeft = placement === 'left'

  return createPortal(
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in-0"
    >
      <div
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={`fixed inset-y-0 ${
          isLeft ? 'left-0 border-r animate-in slide-in-from-left duration-300' : 'right-0 border-l animate-in slide-in-from-right duration-300'
        } ${sizeStyles[size]} w-full max-w-[90vw] sm:${sizeStyles[size]} bg-surface border-border shadow-2xl flex flex-col focus:outline-none ${className}`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-6 border-b border-border/80 shrink-0 gap-4">
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
                aria-label="Close drawer"
                className="shrink-0 -mr-2 -mt-2 p-2 rounded-xl text-muted/70 hover:text-heading hover:bg-background transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-primary"
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
        <div className="flex-1 overflow-y-auto p-6 text-sm text-heading leading-relaxed focus:outline-none">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-6 border-t border-border/80 flex items-center justify-end gap-3 shrink-0 bg-background/50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

Drawer.displayName = 'Drawer'

export default Drawer
