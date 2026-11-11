import React, { useState } from 'react'
import { Alert, Button, Input, Modal, useToast } from '../ui'
import {
  useActivateTenancy,
  useCancelTenancy,
  useConfirmTenancy,
  useEndTenancy,
} from '../../hooks/useOwnerTenancies'
import { extractApiErrorMessage } from '../../utils/application'
import type { TenancyDetail } from '../../types/leasing'

export type OwnerTenancyAction = 'confirm' | 'activate' | 'cancel' | 'end'

export interface TenancyLifecycleModalProps {
  open: boolean
  tenancy: TenancyDetail | null
  action: OwnerTenancyAction | null
  onClose: () => void
}

const ACTION_CONFIG: Record<
  OwnerTenancyAction,
  {
    title: string
    confirmLabel: string
    loadingText: string
    buttonVariant: 'primary' | 'danger' | 'outline'
    description: string
    impactNote: string
    toastTitle: string
    toastDescription: string
    dateFieldLabel?: string
    dateFieldHint?: string
  }
> = {
  confirm: {
    title: 'Confirm Tenancy',
    confirmLabel: 'Confirm Tenancy',
    loadingText: 'Confirming...',
    buttonVariant: 'primary',
    description:
      'Confirm this pending tenancy agreement and reserve the property for the tenant.',
    impactNote:
      'Any published listing for this property will be paused, and the tenant will be notified.',
    toastTitle: 'Tenancy Confirmed',
    toastDescription: 'The tenancy is now confirmed and ready for move-in activation.',
  },
  activate: {
    title: 'Activate Tenancy (Move-In)',
    confirmLabel: 'Activate Tenancy',
    loadingText: 'Activating...',
    buttonVariant: 'primary',
    description:
      'Record tenant move-in and transition this confirmed tenancy to Active status.',
    impactNote:
      'The property will be marked as occupied, any active listing will be closed, and the tenant will be notified.',
    toastTitle: 'Tenancy Activated',
    toastDescription: 'Tenant move-in recorded and tenancy is now active.',
    dateFieldLabel: 'Actual Move-In Date (Optional)',
    dateFieldHint: 'Defaults to today if left blank.',
  },
  end: {
    title: 'Checkout / End Tenancy',
    confirmLabel: 'Complete Checkout',
    loadingText: 'Ending Tenancy...',
    buttonVariant: 'primary',
    description:
      'Record tenant move-out and complete this active tenancy.',
    impactNote:
      'The property will return to Available status so it can be relisted, and the tenant will be notified.',
    toastTitle: 'Tenancy Completed',
    toastDescription: 'Checkout recorded and property marked available.',
    dateFieldLabel: 'Actual Move-Out Date (Optional)',
    dateFieldHint: 'Defaults to today if left blank.',
  },
  cancel: {
    title: 'Cancel Tenancy',
    confirmLabel: 'Cancel Tenancy',
    loadingText: 'Cancelling...',
    buttonVariant: 'danger',
    description:
      'Cancel this tenancy before activation. This action cannot be undone.',
    impactNote:
      'A confirmed or pending tenancy will be permanently cancelled and the tenant will be notified.',
    toastTitle: 'Tenancy Cancelled',
    toastDescription: 'The tenancy has been cancelled.',
  },
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * TenancyLifecycleModal
 * Confirmation dialog for owner tenancy lifecycle transitions:
 * confirm, activate (with optional move-in date), end/checkout (with optional move-out date), and cancel.
 */
export const TenancyLifecycleModal: React.FC<TenancyLifecycleModalProps> = ({
  open,
  tenancy,
  action,
  onClose,
}) => {
  const { addToast } = useToast()
  const confirmMutation = useConfirmTenancy()
  const activateMutation = useActivateTenancy()
  const cancelMutation = useCancelTenancy()
  const endMutation = useEndTenancy()

  const isPending =
    confirmMutation.isPending ||
    activateMutation.isPending ||
    cancelMutation.isPending ||
    endMutation.isPending

  const [actionDate, setActionDate] = useState(() => getTodayIsoDate())
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!tenancy || !action) return null

  const config = ACTION_CONFIG[action]
  const showDateInput = action === 'activate' || action === 'end'

  const handleClose = () => {
    if (isPending) return
    setErrorMsg(null)
    onClose()
  }

  const handleConfirm = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErrorMsg(null)

    try {
      if (action === 'confirm') {
        await confirmMutation.mutateAsync(tenancy.id)
      } else if (action === 'activate') {
        await activateMutation.mutateAsync({
          tenancyId: tenancy.id,
          payload: actionDate ? { move_in_date: actionDate } : {},
        })
      } else if (action === 'end') {
        await endMutation.mutateAsync({
          tenancyId: tenancy.id,
          payload: actionDate ? { move_out_date: actionDate } : {},
        })
      } else if (action === 'cancel') {
        await cancelMutation.mutateAsync(tenancy.id)
      }

      addToast({
        title: config.toastTitle,
        description: config.toastDescription,
        variant: 'success',
      })
      onClose()
    } catch (err: unknown) {
      setErrorMsg(
        extractApiErrorMessage(
          err,
          'Unable to update tenancy status. Please review the details and try again.'
        )
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeOnBackdropClick={!isPending}
      closeOnEscape={!isPending}
      title={config.title}
      description={config.description}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isPending}
          >
            Back
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            size="sm"
            isLoading={isPending}
            loadingText={config.loadingText}
            onClick={() => void handleConfirm()}
          >
            {config.confirmLabel}
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleConfirm(e)} className="space-y-4">
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-normal text-[#6B7280]">Property</span>
            <span className="font-medium text-[#111827] truncate max-w-[260px]">
              {tenancy.property_title || 'Property'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-normal text-[#6B7280]">Tenant</span>
            <span className="font-medium text-[#111827]">
              {tenancy.tenant_name || 'Tenant'}
            </span>
          </div>
        </div>

        <Alert variant={action === 'cancel' ? 'warning' : 'info'}>
          {config.impactNote}
        </Alert>

        {showDateInput && config.dateFieldLabel && (
          <Input
            id="tenancy-lifecycle-date"
            type="date"
            label={config.dateFieldLabel}
            hint={config.dateFieldHint}
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
            disabled={isPending}
          />
        )}
      </form>
    </Modal>
  )
}

export default TenancyLifecycleModal

