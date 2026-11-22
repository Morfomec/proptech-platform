import React, { useState } from 'react'
import { Button, Input, Modal, Textarea, useToast } from '../ui'
import { useUpdateTenancyTerms } from '../../hooks/useOwnerTenancies'
import { extractApiErrorMessage } from '../../utils/application'
import type { TenancyDetail } from '../../types/leasing'

export interface UpdateTenancyTermsModalProps {
  open: boolean
  tenancy: TenancyDetail | null
  onClose: () => void
  onUpdated?: () => void
}

/**
 * Inner form keyed by tenancy ID & updated timestamp so state initializes cleanly without useEffect.
 */
const UpdateTenancyTermsModalForm: React.FC<
  UpdateTenancyTermsModalProps & { tenancy: TenancyDetail }
> = ({ open, tenancy, onClose, onUpdated }) => {
  const { addToast } = useToast()
  const updateMutation = useUpdateTenancyTerms()

  const [startDate, setStartDate] = useState(tenancy.start_date || '')
  const [endDate, setEndDate] = useState(tenancy.end_date || '')
  const [monthlyRent, setMonthlyRent] = useState(
    tenancy.monthly_rent ? String(tenancy.monthly_rent) : ''
  )
  const [securityDeposit, setSecurityDeposit] = useState(
    tenancy.security_deposit ? String(tenancy.security_deposit) : '0.00'
  )
  const [rentDueDay, setRentDueDay] = useState(
    tenancy.rent_due_day ? String(tenancy.rent_due_day) : '1'
  )
  const [notes, setNotes] = useState(tenancy.notes || '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleClose = () => {
    if (updateMutation.isPending) return
    setErrorMsg(null)
    onClose()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErrorMsg(null)

    if (!startDate) {
      setErrorMsg('Please select a tenancy start date.')
      return
    }
    if (endDate && endDate < startDate) {
      setErrorMsg('End date cannot be earlier than the start date.')
      return
    }

    const parsedRent = Number(monthlyRent)
    if (!monthlyRent.trim() || Number.isNaN(parsedRent) || parsedRent < 0) {
      setErrorMsg('Please enter a valid non-negative monthly rent amount.')
      return
    }

    const parsedDeposit = securityDeposit.trim() ? Number(securityDeposit) : 0
    if (Number.isNaN(parsedDeposit) || parsedDeposit < 0) {
      setErrorMsg('Security deposit must be a valid non-negative amount.')
      return
    }

    const parsedDueDay = Number(rentDueDay)
    if (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 28) {
      setErrorMsg('Rent due day must be a whole number between 1 and 28.')
      return
    }

    try {
      await updateMutation.mutateAsync({
        tenancyId: tenancy.id,
        payload: {
          start_date: startDate,
          end_date: endDate.trim() ? endDate.trim() : null,
          monthly_rent: monthlyRent.trim(),
          security_deposit: securityDeposit.trim() || '0.00',
          rent_due_day: parsedDueDay,
          notes: notes.trim() ? notes.trim() : null,
        },
      })

      addToast({
        title: 'Tenancy Terms Updated',
        description:
          'Revised terms have been submitted. The tenant has been notified to review and approve the proposal.',
        variant: 'success',
      })

      onClose()
      if (onUpdated) {
        onUpdated()
      }
    } catch (err: unknown) {
      setErrorMsg(
        extractApiErrorMessage(
          err,
          'Could not update tenancy terms. Please check the values and try again.'
        )
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeOnBackdropClick={!updateMutation.isPending}
      closeOnEscape={!updateMutation.isPending}
      title="Edit Tenancy Terms"
      description="Update agreement terms. Doing so resets status to Pending Approval, requiring renewed tenant acceptance."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={updateMutation.isPending}
            loadingText="Updating..."
            onClick={() => void handleSubmit()}
          >
            Update & Request Approval
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <span className="font-medium">Important:</span> Updating any terms will require the tenant ({tenancy.tenant_name || 'Tenant'}) to review and accept the proposal again before the tenancy can be confirmed.
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            type="date"
            label="Start Date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={updateMutation.isPending}
          />

          <Input
            type="date"
            label="End Date (Optional)"
            hint="Leave blank for open-ended"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={updateMutation.isPending}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            type="number"
            step="0.01"
            min="0"
            label="Monthly Rent (₹)"
            required
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            disabled={updateMutation.isPending}
          />

          <Input
            type="number"
            step="0.01"
            min="0"
            label="Security Deposit (₹)"
            hint="Refundable deposit amount"
            value={securityDeposit}
            onChange={(e) => setSecurityDeposit(e.target.value)}
            disabled={updateMutation.isPending}
          />
        </div>

        <Input
          type="number"
          min={1}
          max={28}
          label="Rent Due Day of the Month"
          hint="Whole number between 1 and 28"
          required
          value={rentDueDay}
          onChange={(e) => setRentDueDay(e.target.value)}
          disabled={updateMutation.isPending}
        />

        <Textarea
          label="Agreement Notes & Terms (Optional)"
          rows={3}
          maxLength={1000}
          placeholder="Special terms, maintenance notes, or guidelines..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={updateMutation.isPending}
        />
      </form>
    </Modal>
  )
}

/**
 * UpdateTenancyTermsModal
 * Allows an owner to modify the proposed tenancy agreement terms.
 * Modifying terms automatically resets tenancy status to `pending`,
 * requiring the tenant to review and approve the updated terms.
 */
export const UpdateTenancyTermsModal: React.FC<UpdateTenancyTermsModalProps> = (props) => {
  if (!props.open || !props.tenancy) return null

  return (
    <UpdateTenancyTermsModalForm
      key={`${props.tenancy.id}-${props.tenancy.updated_at || 'initial'}`}
      {...props}
      tenancy={props.tenancy}
    />
  )
}

export default UpdateTenancyTermsModal
