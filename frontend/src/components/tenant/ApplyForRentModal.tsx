import React, { useState } from 'react'
import { Alert, Button, Modal, Textarea, useToast } from '../ui'
import { useSubmitApplication } from '../../hooks/useTenantWorkspace'
import { extractApiErrorMessage, formatINR } from '../../utils/application'

export interface ApplyForRentModalProps {
  open: boolean
  listingId: string
  propertyTitle: string
  locationText?: string
  monthlyRent?: string | number | null
  securityDeposit?: string | number | null
  onClose: () => void
  onSuccess?: (applicationId: string) => void
}

/**
 * ApplyForRentModal
 * Rental application submission modal wired to `POST /api/v1/applications/`.
 */
export const ApplyForRentModal: React.FC<ApplyForRentModalProps> = ({
  open,
  listingId,
  propertyTitle,
  locationText,
  monthlyRent,
  securityDeposit,
  onClose,
  onSuccess,
}) => {
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { addToast } = useToast()
  const submitMutation = useSubmitApplication()

  const handleClose = () => {
    if (submitMutation.isPending) return
    setErrorMsg(null)
    onClose()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (submitMutation.isPending) return
    setErrorMsg(null)

    try {
      const trimmed = message.trim()
      const res = await submitMutation.mutateAsync({
        listing_id: listingId,
        message: trimmed || undefined,
      })

      addToast({
        title: 'Application Submitted',
        description: `Your rental application for ${propertyTitle} has been sent to the owner.`,
        variant: 'success',
      })
      setMessage('')
      onClose()
      if (res.data?.id) {
        onSuccess?.(res.data.id)
      }
    } catch (err: unknown) {
      setErrorMsg(
        extractApiErrorMessage(err, 'Failed to submit application. Please try again.')
      )
    }
  }

  const rentFormatted = formatINR(monthlyRent)
  const depositFormatted = formatINR(securityDeposit)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeOnBackdropClick={!submitMutation.isPending}
      closeOnEscape={!submitMutation.isPending}
      title="Apply for Rent"
      description="Submit a rental application directly to the property owner."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={submitMutation.isPending}
            loadingText="Submitting..."
            onClick={() => void handleSubmit()}
          >
            Submit Application
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        {/* Property Summary Snapshot */}
        <div className="rounded-xl border border-[#DCE8E2] bg-[#F4FAF7] p-4 space-y-2">
          <h4 className="text-sm font-bold text-[#111827]">{propertyTitle}</h4>
          {locationText && <p className="text-xs text-[#6B7280]">{locationText}</p>}
          {(rentFormatted || depositFormatted) && (
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              {rentFormatted && (
                <span>
                  <span className="text-[#6B7280]">Rent: </span>
                  <strong className="text-[#111827]">{rentFormatted}/mo</strong>
                </span>
              )}
              {depositFormatted && (
                <span>
                  <span className="text-[#6B7280]">Deposit: </span>
                  <strong className="text-[#111827]">{depositFormatted}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Optional Cover Message */}
        <div>
          <label
            htmlFor="apply-message"
            className="block text-xs font-semibold text-[#374151] mb-1.5"
          >
            Message to Owner (Optional)
          </label>
          <Textarea
            id="apply-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Introduce yourself, preferred move-in date, household or occupancy details..."
            disabled={submitMutation.isPending}
          />
          <p className="mt-1 text-[11px] text-[#6B7280]">
            You can track your application status and upload supporting documents in My Applications.
          </p>
        </div>
      </form>
    </Modal>
  )
}

export default ApplyForRentModal
