import React, { useState } from 'react'
import { Alert, Button, Modal, Textarea, useToast } from '../ui'
import { useWithdrawApplication } from '../../hooks/useTenantWorkspace'
import { extractApiErrorMessage } from '../../utils/application'

export interface ApplicationWithdrawModalProps {
  open: boolean
  applicationId: string | null
  propertyTitle?: string
  onClose: () => void
  onWithdrawn?: () => void
}

/**
 * Shared confirmation modal for withdrawing a pending (`submitted` / `under_review`)
 * rental application using `POST /api/v1/applications/{id}/withdraw/`.
 */
export const ApplicationWithdrawModal: React.FC<ApplicationWithdrawModalProps> = ({
  open,
  applicationId,
  propertyTitle,
  onClose,
  onWithdrawn,
}) => {
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { addToast } = useToast()
  const withdrawMutation = useWithdrawApplication()

  const handleClose = () => {
    if (withdrawMutation.isPending) return
    setReason('')
    setErrorMessage(null)
    onClose()
  }

  const handleConfirmWithdraw = async () => {
    if (!applicationId) return
    setErrorMessage(null)

    try {
      const trimmedReason = reason.trim()
      await withdrawMutation.mutateAsync({
        applicationId,
        payload: trimmedReason ? { change_reason: trimmedReason } : {},
      })

      addToast({
        title: 'Application Withdrawn',
        description: propertyTitle
          ? `Your application for ${propertyTitle} has been withdrawn.`
          : 'Your rental application has been withdrawn.',
        variant: 'success',
      })
      setReason('')
      onClose()
      onWithdrawn?.()
    } catch (err: unknown) {
      setErrorMessage(
        extractApiErrorMessage(err, 'Failed to withdraw application. Please try again.')
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Withdraw Application"
      description={
        propertyTitle
          ? `Confirm withdrawing your rental application for "${propertyTitle}".`
          : 'Confirm withdrawing this rental application.'
      }
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={withdrawMutation.isPending}
          >
            Keep Application
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            isLoading={withdrawMutation.isPending}
            loadingText="Withdrawing..."
            onClick={() => void handleConfirmWithdraw()}
          >
            Withdraw Application
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-[#4B5563]">
          Withdrawing closes this application and notifies the property owner. This action cannot be undone.
        </p>

        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        <div>
          <label
            htmlFor="withdraw-reason"
            className="block text-xs font-semibold text-[#374151] mb-1.5"
          >
            Reason for withdrawal (optional)
          </label>
          <Textarea
            id="withdraw-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Share a brief note if you'd like..."
            disabled={withdrawMutation.isPending}
          />
        </div>
      </div>
    </Modal>
  )
}

export default ApplicationWithdrawModal
