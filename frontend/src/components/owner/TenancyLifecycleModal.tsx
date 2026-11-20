import React, { useState } from 'react'
import { Alert, Button, Input, Modal, Skeleton, useToast } from '../ui'
import {
  useActivateTenancy,
  useCancelTenancy,
  useEndTenancy,
  useTenancySettlementPreview,
} from '../../hooks/useOwnerTenancies'
import { extractApiErrorMessage, formatINR } from '../../utils/application'
import type { TenancyDetail } from '../../types/leasing'

export type OwnerTenancyAction = 'activate' | 'cancel' | 'end'

export interface TenancyLifecycleModalProps {
  open: boolean
  tenancy: TenancyDetail | null
  action: OwnerTenancyAction | null
  onClose: () => void
}

interface DeductionEntry {
  id: string
  reason: string
  amount: string
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
  activate: {
    title: 'Activate Tenancy (Move-In)',
    confirmLabel: 'Activate Tenancy',
    loadingText: 'Activating...',
    buttonVariant: 'primary',
    description:
      'Record tenant move-in and transition this confirmed tenancy to Active status.',
    impactNote:
      'The property will be marked as occupied, any published listing will remain paused, and the tenant will be notified.',
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
 * activate (with optional move-in date), end/checkout (with optional move-out date), and cancel.
 */
const TenancyLifecycleModalForm: React.FC<
  TenancyLifecycleModalProps & { tenancy: TenancyDetail; action: OwnerTenancyAction }
> = ({
  open,
  tenancy,
  action,
  onClose,
}) => {
  const { addToast } = useToast()
  const activateMutation = useActivateTenancy()
  const cancelMutation = useCancelTenancy()
  const endMutation = useEndTenancy()

  const isPending =
    activateMutation.isPending ||
    cancelMutation.isPending ||
    endMutation.isPending

  const [actionDate, setActionDate] = useState(() => getTodayIsoDate())
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Guided Settlement state for checkout
  const { data: settlementPreview, isLoading: isLoadingPreview } = useTenancySettlementPreview(
    tenancy.id,
    open && action === 'end'
  )

  const depositHeld = parseFloat(settlementPreview?.deposit_held || '0')

  const [settleDepositUserChoice, setSettleDepositUserChoice] = useState<boolean | null>(null)
  const settleDeposit = settleDepositUserChoice !== null ? settleDepositUserChoice : depositHeld > 0

  const [deductions, setDeductions] = useState<DeductionEntry[]>([])
  const [userCustomRefund, setUserCustomRefund] = useState<string | null>(null)
  const [refundRef, setRefundRef] = useState('')

  const totalDeductions = deductions.reduce(
    (sum, d) => sum + (parseFloat(d.amount) || 0),
    0
  )
  const netRefundable = Math.max(0, depositHeld - totalDeductions)
  const refundAmount = userCustomRefund !== null ? userCustomRefund : String(netRefundable)

  const handleAddDeduction = () => {
    setDeductions((prev) => [
      ...prev,
      { id: String(Date.now()), reason: '', amount: '' },
    ])
  }

  const handleRemoveDeduction = (id: string) => {
    setDeductions((prev) => prev.filter((d) => d.id !== id))
  }

  const handleDeductionChange = (
    id: string,
    field: 'reason' | 'amount',
    val: string
  ) => {
    setDeductions((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: val } : d))
    )
  }

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
      if (action === 'activate') {
        await activateMutation.mutateAsync({
          tenancyId: tenancy.id,
          payload: actionDate ? { move_in_date: actionDate } : {},
        })
      } else if (action === 'end') {
        const cleanDeductions = deductions
          .filter((d) => d.reason.trim() && parseFloat(d.amount) > 0)
          .map((d) => ({ reason: d.reason.trim(), amount: d.amount }))

        const numRefund = parseFloat(refundAmount) || 0
        if (settleDeposit && totalDeductions + numRefund > depositHeld + 0.01) {
          setErrorMsg(
            `Total deductions (${formatINR(totalDeductions)}) and refund (${formatINR(numRefund)}) cannot exceed deposit held (${formatINR(depositHeld)}).`
          )
          return
        }

        await endMutation.mutateAsync({
          tenancyId: tenancy.id,
          payload: {
            move_out_date: actionDate || undefined,
            settle_deposit: settleDeposit,
            deductions: settleDeposit && cleanDeductions.length > 0 ? cleanDeductions : undefined,
            refund_amount: settleDeposit && numRefund > 0 ? numRefund : undefined,
            refund_reference: settleDeposit && refundRef.trim() ? refundRef.trim() : undefined,
          },
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

        {action === 'end' && (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-medium text-[#111827]">
                  Security Deposit Settlement
                </h3>
                <p className="text-[11px] text-[#6B7280]">
                  Settle deductions and refund remaining deposits held.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={settleDeposit}
                  onChange={(e) => setSettleDepositUserChoice(e.target.checked)}
                  className="rounded border-[#D1D5DB] text-[#408A71] focus:ring-[#408A71]"
                />
                <span className="font-medium text-[#374151]">Settle Deposit</span>
              </label>
            </div>

            {isLoadingPreview ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : settleDeposit ? (
              <div className="space-y-3 pt-2 border-t border-[#F3F4F6]">
                {/* Deposit Held Banner */}
                <div className="rounded-lg border border-[#DCE8E2] bg-[#F4FAF7] p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#6B7280]">Deposit Received:</span>{' '}
                    <span className="font-medium text-[#111827]">{formatINR(settlementPreview?.deposit_received)}</span>
                  </div>
                  <div>
                    <span className="text-[#6B7280]">Security Deposit Held:</span>{' '}
                    <span className="font-medium text-[#34745C]">{formatINR(depositHeld)}</span>
                  </div>
                </div>

                {/* Deductions Entries */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#374151]">
                      Deductions for Damages / Cleaning (Optional)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddDeduction}
                      className="text-xs font-medium text-[#408A71] hover:underline cursor-pointer"
                    >
                      + Add Deduction
                    </button>
                  </div>

                  {deductions.map((d, index) => (
                    <div key={d.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Reason #${index + 1} (e.g. Wall painting)`}
                        value={d.reason}
                        onChange={(e) => handleDeductionChange(d.id, 'reason', e.target.value)}
                        className="flex-1 rounded-lg border border-[#D1D5DB] px-3 py-1.5 text-xs text-[#111827] focus:border-[#408A71] focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount (₹)"
                        value={d.amount}
                        onChange={(e) => handleDeductionChange(d.id, 'amount', e.target.value)}
                        className="w-28 rounded-lg border border-[#D1D5DB] px-3 py-1.5 text-xs text-[#111827] focus:border-[#408A71] focus:outline-none text-right font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDeduction(d.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 px-1 cursor-pointer"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {deductions.length > 0 && (
                    <div className="flex items-center justify-between text-xs text-[#6B7280] pt-1">
                      <span>Total Deductions:</span>
                      <span className="font-medium text-rose-600 tabular-nums">
                        -{formatINR(totalDeductions)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Net Refundable & Refund Details */}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#374151]">Refund Due to Tenant:</span>
                    <span className="font-medium text-emerald-700 tabular-nums text-sm">
                      {formatINR(netRefundable)}
                    </span>
                  </div>

                  {netRefundable > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E5E7EB]">
                      <div>
                        <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                          Refund Amount (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={refundAmount}
                          onChange={(e) => setUserCustomRefund(e.target.value)}
                          max={netRefundable}
                          className="w-full rounded-lg border border-[#D1D5DB] px-3 py-1.5 text-xs text-[#111827] focus:border-[#408A71] focus:outline-none font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                          Payment Reference (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="UPI / NEFT reference"
                          value={refundRef}
                          onChange={(e) => setRefundRef(e.target.value)}
                          className="w-full rounded-lg border border-[#D1D5DB] px-3 py-1.5 text-xs text-[#111827] focus:border-[#408A71] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#6B7280]">
                Security deposit settlement skipped. Deposits held or pending collection will remain on file.
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}

export const TenancyLifecycleModal: React.FC<TenancyLifecycleModalProps> = ({
  open,
  tenancy,
  action,
  onClose,
}) => {
  if (!open || !tenancy || !action) return null

  return (
    <TenancyLifecycleModalForm
      key={`${tenancy.id}-${action}`}
      open={open}
      tenancy={tenancy}
      action={action}
      onClose={onClose}
    />
  )
}

export default TenancyLifecycleModal

