import React, { useState } from 'react'
import { Modal } from '../modal/Modal'
import { Button } from '../button/Button'
import type { ButtonProps } from '../button/Button'

export type ConfirmationVariant = 'default' | 'danger' | 'warning'

export interface ConfirmationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: ConfirmationVariant
  loading?: boolean
  disabled?: boolean
  confirmButtonProps?: Partial<ButtonProps>
  cancelButtonProps?: Partial<ButtonProps>
}

const variantConfig: Record<
  ConfirmationVariant,
  {
    buttonVariant: 'primary' | 'danger'
    iconColor: string
    iconBg: string
    icon: React.ReactNode
  }
> = {
  default: {
    buttonVariant: 'primary',
    iconColor: 'text-brand-primary',
    iconBg: 'bg-brand-soft',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  danger: {
    buttonVariant: 'danger',
    iconColor: 'text-[#DC2626]',
    iconBg: 'bg-[#FEF2F2]',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
  warning: {
    buttonVariant: 'primary',
    iconColor: 'text-[#D97706]',
    iconBg: 'bg-[#FFFBEB]',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading: controlledLoading,
  disabled = false,
  confirmButtonProps,
  cancelButtonProps,
}) => {
  const [internalLoading, setInternalLoading] = useState(false)
  const isBusy = controlledLoading ?? internalLoading
  const config = variantConfig[variant]

  const handleConfirm = async () => {
    try {
      setInternalLoading(true)
      const result = onConfirm()
      if (result instanceof Promise) {
        await result
      }
      setInternalLoading(false)
      onClose()
    } catch {
      // If the confirm action throws/rejects, do not close the dialog so the user can retry
      setInternalLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={isBusy ? () => {} : onClose}
      size="sm"
      closeOnBackdropClick={!isBusy}
      closeOnEscape={!isBusy}
      showCloseButton={!isBusy}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isBusy || disabled}
            {...cancelButtonProps}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={config.buttonVariant}
            onClick={handleConfirm}
            isLoading={isBusy}
            disabled={disabled}
            {...confirmButtonProps}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-2xl shrink-0 ${config.iconBg} ${config.iconColor}`}>
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-heading leading-tight mb-1.5">{title}</h4>
          {description && (
            <p className="text-xs md:text-sm text-muted leading-relaxed mb-2">{description}</p>
          )}
          {children}
        </div>
      </div>
    </Modal>
  )
}

ConfirmationDialog.displayName = 'ConfirmationDialog'

export default ConfirmationDialog
