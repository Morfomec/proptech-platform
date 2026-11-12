import React, { useState } from 'react'
import { Alert, Button, ConfirmationDialog, Modal, Textarea, useToast } from '../ui'
import { useReviewApplication } from '../../hooks/useOwnerApplications'
import { extractApiErrorMessage } from '../../utils/application'
import type {
  ApplicationListItem,
  OwnerReviewApplicationStatus,
} from '../../types/leasing'

export interface ApplicationReviewModalProps {
  open: boolean
  application: ApplicationListItem | null
  targetStatus: OwnerReviewApplicationStatus | null
  onClose: () => void
  onSuccess?: () => void
}

const ACTION_CONFIG: Record<
  OwnerReviewApplicationStatus,
  {
    title: string
    confirmLabel: string
    loadingText: string
    buttonVariant: 'primary' | 'danger' | 'outline'
    description: string
    warningNote?: string
    toastTitle: string
  }
> = {
  under_review: {
    title: 'Move Application Under Review',
    confirmLabel: 'Mark Under Review',
    loadingText: 'Updating...',
    buttonVariant: 'primary',
    description:
      'Let the applicant know you are reviewing their rental application.',
    toastTitle: 'Application Marked Under Review',
  },
  approved: {
    title: 'Approve Rental Application',
    confirmLabel: 'Confirm Approval',
    loadingText: 'Approving...',
    buttonVariant: 'primary',
    description:
      'Approve this applicant for your property listing. This action records your final decision and notifies the tenant.',
    warningNote:
      'Once approved, this application cannot be reviewed again. Tenancy creation remains a separate step.',
    toastTitle: 'Application Approved',
  },
  rejected: {
    title: 'Reject Rental Application',
    confirmLabel: 'Confirm Rejection',
    loadingText: 'Rejecting...',
    buttonVariant: 'danger',
    description:
      'Decline this rental application. The applicant will be notified of your decision.',
    warningNote:
      'Once rejected, this application cannot be reopened or reviewed again.',
    toastTitle: 'Application Rejected',
  },
}

/**
 * ApplicationReviewModal
 * Shared confirmation dialog for owner application review transitions
 * (`under_review`, `approved`, `rejected`) backed by `POST /api/v1/applications/{id}/review/`.
 */
export const ApplicationReviewModal: React.FC<ApplicationReviewModalProps> = ({
  open,
  application,
  targetStatus,
  onClose,
  onSuccess,
}) => {
  const { addToast } = useToast()
  const reviewMutation = useReviewApplication()

  const [reason, setReason] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSecondConfirmOpen, setIsSecondConfirmOpen] = useState(false)

  if (!application || !targetStatus) return null

  const config = ACTION_CONFIG[targetStatus]
  const requiresSecondConfirm = targetStatus === 'approved' || targetStatus === 'rejected'
  const propertyTitle =
    application.property_title || application.listing_title || 'this listing'
  const applicantDisplay = application.applicant_name || 'Applicant'

  const handleClose = () => {
    if (reviewMutation.isPending) return
    setReason('')
    setErrorMsg(null)
    setIsSecondConfirmOpen(false)
    onClose()
  }

  const executeReview = async () => {
    if (reviewMutation.isPending) return
    setErrorMsg(null)

    try {
      const trimmedReason = reason.trim()
      await reviewMutation.mutateAsync({
        applicationId: application.id,
        payload: {
          status: targetStatus,
          ...(trimmedReason ? { change_reason: trimmedReason } : {}),
        },
      })

      addToast({
        title: config.toastTitle,
        description: `${applicantDisplay} — ${propertyTitle}`,
        variant: 'success',
      })
      setReason('')
      setIsSecondConfirmOpen(false)
      onClose()
      onSuccess?.()
    } catch (err: unknown) {
      setIsSecondConfirmOpen(false)
      setErrorMsg(
        extractApiErrorMessage(err, 'Unable to update application status. Please retry.')
      )
    }
  }

  const handleConfirm = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (reviewMutation.isPending) return
    if (requiresSecondConfirm) {
      setIsSecondConfirmOpen(true)
      return
    }
    await executeReview()
  }

  return (
    <>
    <Modal
      open={open}
      onClose={handleClose}
      closeOnBackdropClick={!reviewMutation.isPending}
      closeOnEscape={!reviewMutation.isPending}
      title={config.title}
      description={config.description}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={reviewMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            size="sm"
            isLoading={reviewMutation.isPending}
            loadingText={config.loadingText}
            onClick={() => void handleConfirm()}
          >
            {config.confirmLabel}
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => void handleConfirm(e)} className="space-y-3">
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#6B7280]">Applicant</span>
            <span className="font-medium text-[#111827]">{applicantDisplay}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#6B7280]">Property</span>
            <span className="font-medium text-[#111827] truncate max-w-[220px]">
              {propertyTitle}
            </span>
          </div>
        </div>

        {config.warningNote && (
          <Alert variant={targetStatus === 'rejected' ? 'warning' : 'info'}>
            {config.warningNote}
          </Alert>
        )}

        <div>
          <Textarea
            id="owner-review-reason"
            label="Review Note (Optional)"
            hint="Recorded in the application status history."
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Add an optional note..."
            disabled={reviewMutation.isPending}
          />
        </div>
      </form>
    </Modal>

    <ConfirmationDialog
      open={isSecondConfirmOpen}
      onClose={() => {
        if (!reviewMutation.isPending) setIsSecondConfirmOpen(false)
      }}
      onConfirm={executeReview}
      title={
        targetStatus === 'approved'
          ? 'Final Confirmation: Approve Application?'
          : 'Final Confirmation: Reject Application?'
      }
      description={
        targetStatus === 'approved'
          ? `Are you sure you want to approve ${applicantDisplay}'s application for ${propertyTitle}? This decision is final and notifies the tenant immediately.`
          : `Are you sure you want to reject ${applicantDisplay}'s application for ${propertyTitle}? Once rejected, it cannot be reopened and the tenant will be notified immediately.`
      }
      confirmText={
        reviewMutation.isPending
          ? config.loadingText
          : targetStatus === 'approved'
            ? 'Yes, Approve Application'
            : 'Yes, Reject Application'
      }
      cancelText="Go Back"
      variant={targetStatus === 'rejected' ? 'danger' : 'default'}
      loading={reviewMutation.isPending}
    />
    </>
  )
}

export default ApplicationReviewModal

