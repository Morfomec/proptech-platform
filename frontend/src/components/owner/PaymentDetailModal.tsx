import React, { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  Skeleton,
  useToast,
  type BadgeVariant,
} from '../ui'
import {
  useCreateRefund,
  useOwnerPaymentDetail,
  useOwnerRefunds,
} from '../../hooks/useOwnerRent'
import {
  extractApiErrorMessage,
  formatDate,
  formatDateTime,
  formatINR,
} from '../../utils/application'
import type { PaymentStatus } from '../../types/rent'

export interface PaymentDetailModalProps {
  open: boolean
  paymentId: string | null
  onClose: () => void
}

const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  completed: { label: 'Completed', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  failed: { label: 'Failed', variant: 'danger' },
}

export const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({
  open,
  paymentId,
  onClose,
}) => {
  const { addToast } = useToast()
  const { data: payment, isLoading, isError, refetch } = useOwnerPaymentDetail(paymentId)
  const { data: refundsData } = useOwnerRefunds(
    paymentId ? { payment_id: paymentId } : undefined
  )
  const createRefundMutation = useCreateRefund()

  // State for Refund Form
  const [isRefunding, setIsRefunding] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundReference, setRefundReference] = useState('')
  const [refundError, setRefundError] = useState<string | null>(null)

  if (!open || !paymentId) return null

  const refunds = refundsData?.results ?? []

  // Calculate remaining refundable balance
  const completedRefundsTotal = refunds
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0)

  const paymentAmountNum = payment ? parseFloat(payment.amount || '0') : 0
  const maxRefundable = Math.max(0, paymentAmountNum - completedRefundsTotal)

  const handleStartRefund = () => {
    setIsRefunding(true)
    setRefundAmount(maxRefundable > 0 ? maxRefundable.toFixed(2) : '')
    setRefundReason('')
    setRefundReference('')
    setRefundError(null)
  }

  const handleCancelRefund = () => {
    setIsRefunding(false)
    setRefundError(null)
  }

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault()
    setRefundError(null)

    const numAmount = parseFloat(refundAmount)
    if (!refundAmount || Number.isNaN(numAmount) || numAmount <= 0) {
      setRefundError('Please enter a valid refund amount greater than zero.')
      return
    }

    if (numAmount > maxRefundable) {
      setRefundError(`Refund amount cannot exceed remaining refundable balance of ₹${maxRefundable.toFixed(2)}.`)
      return
    }

    if (!refundReason.trim()) {
      setRefundError('Please enter a reason for the refund.')
      return
    }

    try {
      await createRefundMutation.mutateAsync({
        payment_id: paymentId,
        amount: numAmount.toFixed(2),
        reason: refundReason.trim(),
        refund_reference: refundReference.trim() || undefined,
        status: 'completed',
      })

      addToast({
        title: 'Refund Processed',
        description: `Successfully processed refund of ₹${numAmount.toFixed(2)}.`,
        variant: 'success',
      })

      setIsRefunding(false)
    } catch (err: unknown) {
      setRefundError(extractApiErrorMessage(err, 'Failed to process refund.'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment Details"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {payment?.status === 'completed' && maxRefundable > 0 && !isRefunding && (
              <Button variant="outline" size="sm" onClick={handleStartRefund}>
                Issue Refund
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-4 py-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : isError || !payment ? (
        <Alert variant="error" title="Failed to load payment details">
          <div className="flex items-center justify-between gap-3 mt-1">
            <span>Unable to retrieve payment information.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : (
        <div className="space-y-5">
          {/* Top Payment Summary Box */}
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-medium text-[#111827] tabular-nums">
                  {formatINR(payment.amount)}
                </span>
                <Badge
                  variant={PAYMENT_STATUS_META[payment.status]?.variant || 'neutral'}
                  size="sm"
                >
                  {payment.payment_method_display || payment.payment_method.toUpperCase()}
                </Badge>
                <Badge
                  variant={PAYMENT_STATUS_META[payment.status]?.variant || 'neutral'}
                  size="sm"
                  dot
                >
                  {PAYMENT_STATUS_META[payment.status]?.label || payment.status}
                </Badge>
              </div>

              <p className="mt-1 text-xs text-[#6B7280]">
                {payment.property_title} · {payment.tenant_name}
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <p className="text-xs text-[#6B7280]">Date Received</p>
              <p className="text-xs font-medium text-[#111827]">
                {formatDateTime(payment.paid_at || payment.created_at)}
              </p>
              {payment.transaction_reference && (
                <p className="text-[11px] text-[#6B7280] mt-0.5 font-mono">
                  Ref: {payment.transaction_reference}
                </p>
              )}
            </div>
          </div>

          {payment.notes && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-[#4B5563]">
              <span className="font-medium text-[#111827]">Notes: </span>
              {payment.notes}
            </div>
          )}

          {/* Refund Form Drawer / Inline Panel */}
          {isRefunding && (
            <form
              onSubmit={handleSubmitRefund}
              className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-amber-900 uppercase tracking-wider">
                  Issue Refund
                </h4>
                <span className="text-xs text-amber-800">
                  Max refundable: <strong className="tabular-nums font-semibold">₹{maxRefundable.toFixed(2)}</strong>
                </span>
              </div>

              {refundError && (
                <Alert variant="error" title="Refund Error">
                  {refundError}
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1">
                    Refund Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={maxRefundable}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1">
                    Refund Reference <span className="text-[#6B7280]">(Optional)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="Bank reference number"
                    value={refundReference}
                    onChange={(e) => setRefundReference(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Reason for Refund <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Deposit return, overpayment adjustment"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelRefund}
                  disabled={createRefundMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  isLoading={createRefundMutation.isPending}
                >
                  Confirm Refund
                </Button>
              </div>
            </form>
          )}

          {/* Allocations Section */}
          <div>
            <h4 className="text-xs font-medium text-[#111827] uppercase tracking-wider mb-2.5">
              Settled Rent Charges (Allocations)
            </h4>

            {payment.allocations && payment.allocations.length > 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
                <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                  <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                    <tr>
                      <th className="py-2.5 px-3 font-normal">Charge Type</th>
                      <th className="py-2.5 px-3 font-normal">Billing Period</th>
                      <th className="py-2.5 px-3 font-normal text-right">Allocated Amount</th>
                      <th className="py-2.5 px-3 font-normal text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                    {payment.allocations.map((alloc) => (
                      <tr key={alloc.id} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                        <td className="py-2 px-3 font-medium capitalize">
                          {alloc.charge_type.replace('_', ' ')}
                        </td>
                        <td className="py-2 px-3 text-[#6B7280]">
                          {formatDate(alloc.billing_period_start)} – {formatDate(alloc.billing_period_end)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums text-emerald-700">
                          {formatINR(alloc.allocated_amount)}
                        </td>
                        <td className="py-2 px-3 text-right text-[#6B7280]">
                          {formatDate(alloc.allocated_at || alloc.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-4 text-center">
                <p className="text-xs text-[#6B7280]">
                  No specific rent charges were settled by this payment. It remains as an unallocated credit on this tenancy.
                </p>
              </div>
            )}
          </div>

          {/* Refund History Section (if any refunds exist) */}
          {refunds.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[#111827] uppercase tracking-wider mb-2.5">
                Refund History
              </h4>

              <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
                <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs table-admin">
                  <thead className="bg-white border-b border-[#E5E7EB] text-[#6B7280]">
                    <tr>
                      <th className="py-2.5 px-3 font-normal">Date</th>
                      <th className="py-2.5 px-3 font-normal">Reason</th>
                      <th className="py-2.5 px-3 font-normal">Status</th>
                      <th className="py-2.5 px-3 font-normal text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-[#111827]">
                    {refunds.map((ref) => (
                      <tr key={ref.id} className="even:bg-[#F8FAFC] odd:bg-white hover:bg-[#F1F5F9] transition-colors">
                        <td className="py-2 px-3 text-[#6B7280]">
                          {formatDate(ref.created_at)}
                        </td>
                        <td className="py-2 px-3 text-[#111827]">
                          {ref.reason}
                          {ref.refund_reference && (
                            <span className="block text-[11px] text-[#6B7280] font-mono">
                              Ref: {ref.refund_reference}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={ref.status === 'completed' ? 'success' : ref.status === 'pending' ? 'warning' : 'danger'}
                            size="sm"
                          >
                            {ref.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums text-red-600">
                          -{formatINR(ref.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default PaymentDetailModal
