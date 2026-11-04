import React, { useCallback, useMemo, useState } from 'react'
import { ToastContext } from './ToastContext'
import { ToastCard } from './ToastCard'
import type { ToastContextValue, ToastItem, ToastOptions, ToastPlacement } from './types'

export interface ToastProviderProps {
  children: React.ReactNode
  placement?: ToastPlacement
  defaultDuration?: number
}

const placementClasses: Record<ToastPlacement, string> = {
  'top-right': 'top-5 right-5 items-end',
  'top-left': 'top-5 left-5 items-start',
  'bottom-right': 'bottom-5 right-5 items-end',
  'bottom-left': 'bottom-5 left-5 items-start',
  'top-center': 'top-5 left-1/2 -translate-x-1/2 items-center',
  'bottom-center': 'bottom-5 left-1/2 -translate-x-1/2 items-center',
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  placement = 'top-right',
  defaultDuration = 4000,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => {
      const item = prev.find((t) => t.id === id)
      if (item?.onDismiss) {
        item.onDismiss()
      }
      return prev.filter((t) => t.id !== id)
    })
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const addToast = useCallback(
    (options: ToastOptions): string => {
      const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const duration = options.duration !== undefined ? options.duration : defaultDuration

      setToasts((prev) => {
        // Prevent duplicate toasts with the exact same title & description within 2 seconds
        const isDuplicate = prev.some(
          (t) =>
            t.title === options.title &&
            t.description === options.description &&
            Date.now() - t.createdAt < 2000
        )
        if (isDuplicate) {
          return prev
        }

        const newToast: ToastItem = {
          ...options,
          id,
          duration,
          createdAt: Date.now(),
        }

        return [...prev, newToast]
      })

      return id
    },
    [defaultDuration]
  )

  const contextValue: ToastContextValue = useMemo(() => {
    return {
      toasts,
      addToast,
      dismissToast,
      dismissAll,
      toast: {
        show: (options: ToastOptions) => addToast(options),
        success: (title: string, description?: React.ReactNode, options?: Partial<ToastOptions>) =>
          addToast({ ...options, title, description, variant: 'success' }),
        error: (title: string, description?: React.ReactNode, options?: Partial<ToastOptions>) =>
          addToast({ ...options, title, description, variant: 'error' }),
        warning: (title: string, description?: React.ReactNode, options?: Partial<ToastOptions>) =>
          addToast({ ...options, title, description, variant: 'warning' }),
        info: (title: string, description?: React.ReactNode, options?: Partial<ToastOptions>) =>
          addToast({ ...options, title, description, variant: 'info' }),
      },
    }
  }, [toasts, addToast, dismissToast, dismissAll])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Viewport / Container */}
      <aside
        aria-label="Notifications"
        className={`fixed z-50 pointer-events-none flex flex-col gap-2.5 max-w-sm w-full p-4 ${placementClasses[placement]}`}
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} toast={item} onDismiss={dismissToast} />
        ))}
      </aside>
    </ToastContext.Provider>
  )
}
