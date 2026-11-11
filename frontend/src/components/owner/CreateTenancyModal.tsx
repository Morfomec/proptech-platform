import React, { useState } from 'react'
import { Alert, Button, Input, Modal, Textarea, useToast } from '../ui'
import { useCreateTenancy } from '../../hooks/useOwnerTenancies'
import { extractApiErrorMessage } from '../../utils/application'
import type { ApplicationListItem } from '../../types/leasing'
import type { PublicListingItem } from '../../types/listing'

export interface CreateTenancyModalProps {
  open: boolean
  application: ApplicationListItem | null
  listing?: PublicListingItem | null
  onClose: () => void
  onCreated?: (tenancyId: string) => void
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * CreateTenancyModal
 * Allows an owner to create a pending tenancy from an approved rental application
 * backed by `POST /api/v1/tenancies/`.
 */
export const CreateTenancyModal: React.FC<CreateTenancyModalProps> = ({
  open,
  application,
  listing,
  onClose,
  onCreated,
}) => {
  const { addToast } = useToast()
  const createMutation = useCreateTenancy()

  const initialStartDate = listing?.available_from || getTodayIsoDate()
  const initialMonthlyRent = listing?.monthly_rent ? String(listing.monthly_rent) : ''
  const initialDeposit = listing?.security_deposit ? String(listing.security_deposit) : '0.00'

  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState('')
  const [monthlyRent, setMonthlyRent] = useState(initialMonthlyRent)
  const [securityDeposit, setSecurityDeposit] = useState(initialDeposit)
  const [rentDueDay, setRentDueDay] = useState('1')
  const [notes, setNotes] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!application) return null

  const propertyId = application.property_id || listing?.property_id || listing?.property?.id
  const propertyTitle = application.property_title || application.listing_title || 'Property'
  const tenantDisplay = application.applicant_name || 'Applicant'

  const handleClose = () => {
    if (createMutation.isPending) return
    setErrorMsg(null)
    onClose()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErrorMsg(null)

    if (!propertyId) {
      setErrorMsg('Property identifier could not be resolved for this application.')
      return
    }
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
    if (
      !Number.isInteger(parsedDueDay) ||
      parsedDueDay < 1 ||
      parsedDueDay > 28
    ) {
      setErrorMsg('Rent due day must be a whole number between 1 and 28.')
      return
    }

    try {
      const response = await createMutation.mutateAsync({
        property_id: propertyId,
        tenant_id: application.applicant,
        application_id: application.id,
        start_date: startDate,
        end_date: endDate.trim() ? endDate.trim() : null,
        monthly_rent: monthlyRent.trim(),
        security_deposit: securityDeposit.trim() || '0.00',
        rent_due_day: parsedDueDay,
        notes: notes.trim() ? notes.trim() : null,
      })

      addToast({
        title: 'Tenancy Created',
        description: `Pending tenancy created for ${tenantDisplay}. Confirm it when ready to reserve the property.`,
        variant: 'success',
      })

      const createdId = response.data?.id
      onClose()
      if (createdId && onCreated) {
        onCreated(createdId)
      }
    } catch (err: unknown) {
      setErrorMsg(
        extractApiErrorMessage(
          err,
          'Could not create tenancy. Please check the dates and terms and try again.'
        )
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeOnBackdropClick={!createMutation.isPending}
      closeOnEscape={!createMutation.isPending}
      title="Create Tenancy"
      description="Create a pending tenancy agreement from this approved application."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={createMutation.isPending}
            loadingText="Creating..."
            onClick={() => void handleSubmit()}
          >
            Create Tenancy
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-normal text-[#6B7280]">Property</span>
            <span className="font-medium text-[#111827] truncate max-w-[260px]">
              {propertyTitle}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-normal text-[#6B7280]">Tenant</span>
            <span className="font-medium text-[#111827]">{tenantDisplay}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-normal text-[#6B7280]">Source Application</span>
            <span className="font-mono text-[11px] text-[#374151]">
              {application.id.slice(0, 8)}...
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="create-tenancy-start-date"
            type="date"
            label="Start Date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={createMutation.isPending}
          />
          <Input
            id="create-tenancy-end-date"
            type="date"
            label="End Date (Optional)"
            hint="Leave blank for open-ended."
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={createMutation.isPending}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="create-tenancy-rent"
            type="number"
            min="0"
            step="0.01"
            label="Monthly Rent (₹)"
            required
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            disabled={createMutation.isPending}
          />
          <Input
            id="create-tenancy-deposit"
            type="number"
            min="0"
            step="0.01"
            label="Security Deposit (₹)"
            value={securityDeposit}
            onChange={(e) => setSecurityDeposit(e.target.value)}
            disabled={createMutation.isPending}
          />
          <Input
            id="create-tenancy-due-day"
            type="number"
            min={1}
            max={28}
            step={1}
            label="Rent Due Day"
            hint="Day 1–28"
            required
            value={rentDueDay}
            onChange={(e) => setRentDueDay(e.target.value)}
            disabled={createMutation.isPending}
          />
        </div>

        <Textarea
          id="create-tenancy-notes"
          label="Agreement Notes (Optional)"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional rental terms or move-in instructions..."
          disabled={createMutation.isPending}
        />

        <Alert variant="info">
          Tenancies start in Pending Confirmation status. You can confirm, activate on move-in, or cancel from the Tenancy Details page.
        </Alert>
      </form>
    </Modal>
  )
}

export default CreateTenancyModal

