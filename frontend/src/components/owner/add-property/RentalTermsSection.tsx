import React from 'react'
import { FormSection } from './FormSection'
import { FormField } from './FormField'

export interface RentalTermsSectionProps {
  monthlyRent: string
  onMonthlyRentChange: (val: string) => void
  securityDeposit: string
  onSecurityDepositChange: (val: string) => void
  onSetDepositMultiplier: (multiplier: number) => void
  availableFrom: string
  onAvailableFromChange: (val: string) => void
  formattedRentPreview: string | null
  fieldErrors: Record<string, string>
}

export const RentalTermsSection: React.FC<RentalTermsSectionProps> = ({
  monthlyRent,
  onMonthlyRentChange,
  securityDeposit,
  onSecurityDepositChange,
  onSetDepositMultiplier,
  availableFrom,
  onAvailableFromChange,
  formattedRentPreview,
  fieldErrors,
}) => {
  return (
    <FormSection
      title="Pricing & Rental Terms"
      icon={
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      action={
        formattedRentPreview ? (
          <span className="text-xs font-medium text-[#111827] bg-gray-100 px-2.5 py-1 rounded-md border border-[#E5E7EB] tabular-nums">
            {formattedRentPreview}/mo
          </span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {/* Monthly Rent */}
        <FormField label="Monthly Rent (₹)" required error={fieldErrors.monthly_rent}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
              ₹
            </span>
            <input
              type="number"
              step="any"
              min="0"
              value={monthlyRent}
              onChange={(e) => onMonthlyRentChange(e.target.value)}
              placeholder="e.g. 35000"
              className={`h-[42px] w-full pl-8 pr-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                fieldErrors.monthly_rent
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
              }`}
            />
          </div>
        </FormField>

        {/* Security Deposit */}
        <FormField
          label="Security Deposit (₹)"
          error={fieldErrors.security_deposit}
          action={
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((mul) => (
                <button
                  key={mul}
                  type="button"
                  onClick={() => onSetDepositMultiplier(mul)}
                  className="h-5 px-1.5 inline-flex items-center justify-center text-[10px] font-semibold leading-none rounded bg-gray-100 hover:bg-[#ECF5F2] hover:text-[#408A71] text-gray-600 transition-colors cursor-pointer"
                  title={`Set to ${mul}x month rent`}
                >
                  {mul}x
                </button>
              ))}
            </div>
          }
        >
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
              ₹
            </span>
            <input
              type="number"
              step="any"
              min="0"
              value={securityDeposit}
              onChange={(e) => onSecurityDepositChange(e.target.value)}
              placeholder="e.g. 70000"
              className={`h-[42px] w-full pl-8 pr-3.5 py-2 bg-white border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-all ${
                fieldErrors.security_deposit
                  ? 'border-red-400 focus:ring-red-200'
                  : 'border-gray-300 focus:border-[#408A71] focus:ring-[#408A71]'
              }`}
            />
          </div>
        </FormField>

        {/* Available From Date */}
        <FormField label="Available From">
          <input
            type="date"
            value={availableFrom}
            onChange={(e) => onAvailableFromChange(e.target.value)}
            className="h-[42px] w-full px-3.5 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-hidden focus:border-[#408A71] focus:ring-1 focus:ring-[#408A71] transition-all cursor-pointer leading-normal"
          />
        </FormField>
      </div>
    </FormSection>
  )
}

export default RentalTermsSection
