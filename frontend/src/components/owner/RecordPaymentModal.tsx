import React, { useState, useMemo } from 'react'
import { Alert, Button, Input, Modal, Select, Textarea, useToast } from '../ui'
import { useOwnerRentSummary, useRecordPayment } from '../../hooks/useOwnerRent'
import { useManagedTenancies } from '../../hooks/useOwnerTenancies'
import { extractApiErrorMessage, formatINR } from '../../utils/application'
import type { PaymentMethod } from '../../types/rent'

export interface RecordPaymentModalProps {
  open: boolean
  onClose: () => void
  initialTenancyId?: string
  initialAmount?: string
  initialChargeType?: 'rent' | 'security_deposit'
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Credit / Debit Card' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

const getTodayDateString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const RecordPaymentModalForm: React.FC<RecordPaymentModalProps> = ({
  open,
  onClose,
  initialTenancyId,
  initialAmount,
  initialChargeType = 'rent',
}) => {
  const { addToast } = useToast()
  const recordMutation = useRecordPayment()

  // Fetch active managed tenancies to populate the payment selection dropdown
  const { data: tenanciesData, isLoading: isLoadingTenancies } = useManagedTenancies({
    page: 1,
    page_size: 100,
    status: 'active',
  })

  const tenancies = useMemo(() => tenanciesData?.results ?? [], [tenanciesData?.results])

  const [selectedTenancyId, setSelectedTenancyId] = useState(initialTenancyId || '')
  const [paymentType, setPaymentType] = useState<'rent' | 'security_deposit'>(initialChargeType)
  const [amount, setAmount] = useState(initialAmount || '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi')
  const [transactionReference, setTransactionReference] = useState('')
  const [paidAt, setPaidAt] = useState(getTodayDateString())
  const [notes, setNotes] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const effectiveTenancyId =
    selectedTenancyId || initialTenancyId || (tenancies.length > 0 ? tenancies[0].id : '')

  // Fetch financial summary specifically for the selected tenancy
  const { data: tenancySummary, isLoading: isLoadingSummary } = useOwnerRentSummary(
    effectiveTenancyId ? { tenancy_id: effectiveTenancyId } : undefined
  )

  const handleClose = () => {
    if (recordMutation.isPending) return
    setErrorMsg(null)
    onClose()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErrorMsg(null)

    if (!effectiveTenancyId) {
      setErrorMsg('Please select a tenancy.')
      return
    }

    const numAmount = parseFloat(amount)
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than zero.')
      return
    }

    try {
      await recordMutation.mutateAsync({
        tenancy_id: effectiveTenancyId,
        amount: numAmount.toFixed(2),
        payment_method: paymentMethod,
        target_charge_type: paymentType,
        transaction_reference: transactionReference.trim() || undefined,
        paid_at: paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : undefined,
        notes: notes.trim() || undefined,
        status: 'completed',
      })

      addToast({
        title: 'Payment Recorded',
        description: `Payment for ${paymentType === 'security_deposit' ? 'security deposit' : 'rent'} logged successfully.`,
        variant: 'success',
      })

      // Reset form
      setAmount('')
      setTransactionReference('')
      setPaidAt(getTodayDateString())
      setNotes('')
      onClose()
    } catch (err: unknown) {
      setErrorMsg(extractApiErrorMessage(err, 'Failed to record payment.'))
    }
  }

  const tenancyOptions = tenancies.map((t) => ({
    value: t.id,
    label: `${t.property_title} — ${t.tenant_name}`,
  }))

  const pendingAmount =
    paymentType === 'security_deposit'
      ? tenancySummary?.total_deposits_outstanding || '0.00'
      : tenancySummary?.outstanding_rent || '0.00'
  const hasPending = parseFloat(pendingAmount) > 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Record Payment"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={recordMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={recordMutation.isPending}
            disabled={recordMutation.isPending || isLoadingTenancies || tenancies.length === 0}
          >
            Record Payment
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <Alert variant="error" title="Submission Error">
            {errorMsg}
          </Alert>
        )}

        {/* Payment Classification: Rent vs Security Deposit */}
        <div>
          <label className="block text-xs font-medium text-[#111827] mb-1.5">
            Payment Category <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPaymentType('rent')
                if (tenancySummary) {
                  setAmount(parseFloat(tenancySummary.outstanding_rent || '0') > 0 ? tenancySummary.outstanding_rent : '')
                }
              }}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                paymentType === 'rent'
                  ? 'border-[#408A71] bg-[#ECF5F2] text-[#34745C]'
                  : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-gray-50'
              }`}
            >
              Rent Payment
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentType('security_deposit')
                if (tenancySummary) {
                  setAmount(parseFloat(tenancySummary.total_deposits_outstanding || '0') > 0 ? tenancySummary.total_deposits_outstanding! : '')
                }
              }}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors cursor-pointer ${
                paymentType === 'security_deposit'
                  ? 'border-[#408A71] bg-[#ECF5F2] text-[#34745C]'
                  : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-gray-50'
              }`}
            >
              Security Deposit
            </button>
          </div>
        </div>

        {/* Tenancy Selection */}
        <div>
          <label className="block text-xs font-medium text-[#111827] mb-1.5">
            Tenancy <span className="text-red-500">*</span>
          </label>
          {isLoadingTenancies ? (
            <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
          ) : tenancies.length === 0 ? (
            <p className="text-xs text-[#6B7280]">
              No active or confirmed tenancies found in your portfolio.
            </p>
          ) : (
            <Select
              options={tenancyOptions}
              value={effectiveTenancyId}
              onChange={(e) => setSelectedTenancyId(e.target.value)}
              placeholder="Select tenancy..."
            />
          )}

          {/* Tenancy Pending Balance Overview Banner */}
          {effectiveTenancyId && (
            <div className="mt-2">
              {isLoadingSummary ? (
                <div className="h-9 w-full animate-pulse rounded-lg bg-gray-100" />
              ) : hasPending ? (
                <div className="flex items-center justify-between rounded-lg bg-amber-50/70 border border-amber-200/60 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 min-w-0">
                    <svg
                      className="w-4 h-4 shrink-0 text-amber-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="truncate">
                      Pending {paymentType === 'security_deposit' ? 'Deposit' : 'Rent'}:{' '}
                      <strong className="font-semibold text-amber-900">
                        {formatINR(pendingAmount)}
                      </strong>
                      {paymentType === 'rent' && parseFloat(tenancySummary?.overdue_rent || '0') > 0 && (
                        <span className="text-rose-600 font-medium ml-1.5">
                          ({formatINR(tenancySummary?.overdue_rent)} overdue)
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAmount(pendingAmount)}
                    className="text-[11px] font-medium text-[#408A71] hover:text-[#34745C] hover:underline cursor-pointer ml-2 shrink-0"
                  >
                    Pay Full
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50/70 border border-emerald-200/60 px-3 py-2 text-xs text-emerald-800">
                  <svg
                    className="w-4 h-4 shrink-0 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    No pending {paymentType === 'security_deposit' ? 'deposit' : 'rent'} balance.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount & Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-[#111827] mb-1.5">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 15000.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#111827] mb-1.5">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <Select
              options={PAYMENT_METHODS}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            />
          </div>
        </div>

        {/* Transaction Reference & Paid Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-[#111827] mb-1.5">
              Transaction Reference <span className="text-[#6B7280]">(Optional)</span>
            </label>
            <Input
              type="text"
              placeholder="UPI/NEFT/Cheque reference"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#111827] mb-1.5">
              Payment Date <span className="text-[#6B7280]">(Default: Today)</span>
            </label>
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-[#111827] mb-1.5">
            Notes <span className="text-[#6B7280]">(Optional)</span>
          </label>
          <Textarea
            rows={2}
            placeholder="Add any verification or receipt notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  )
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  open,
  onClose,
  initialTenancyId,
  initialAmount,
  initialChargeType = 'rent',
}) => {
  if (!open) return null

  return (
    <RecordPaymentModalForm
      key={`${initialTenancyId ?? 'none'}-${initialAmount ?? 'none'}-${initialChargeType}`}
      open={open}
      onClose={onClose}
      initialTenancyId={initialTenancyId}
      initialAmount={initialAmount}
      initialChargeType={initialChargeType}
    />
  )
}

export default RecordPaymentModal
