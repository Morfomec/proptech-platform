import React from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'
export type ToastPlacement =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  id?: string
  title?: string
  description?: React.ReactNode
  variant?: ToastVariant
  duration?: number // duration in ms, default 4000, 0 for sticky
  action?: ToastAction
  onDismiss?: () => void
}

export interface ToastItem extends ToastOptions {
  id: string
  createdAt: number
}

export interface ToastMethods {
  show: (options: ToastOptions) => string
  success: (title: string, description?: React.ReactNode, options?: Partial<ToastOptions>) => string
  error: (title: string, description?: React.ReactNode, options?: Partial<ToastOptions>) => string
  warning: (title: string, description?: React.ReactNode, options?: Partial<ToastOptions>) => string
  info: (title: string, description?: React.ReactNode, options?: Partial<ToastOptions>) => string
}

export interface ToastContextValue {
  toasts: ToastItem[]
  addToast: (options: ToastOptions) => string
  dismissToast: (id: string) => void
  dismissAll: () => void
  toast: ToastMethods
}
