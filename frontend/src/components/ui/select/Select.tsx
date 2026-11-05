import React, { forwardRef, useId } from 'react'

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  placeholder?: string
  options?: SelectOption[]
  hint?: string
  error?: string
  fullWidth?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      placeholder,
      options,
      hint,
      error,
      fullWidth = true,
      id: customId,
      required,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const selectId = customId || `select-${generatedId}`
    const hintId = `${selectId}-hint`
    const errorId = `${selectId}-error`

    const hasError = Boolean(error)
    const ariaDescribedBy = [
      hasError ? errorId : null,
      hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={`${fullWidth ? 'w-full' : 'inline-block'} text-left`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[#111827] mb-1.5"
          >
            {label}
            {required && <span className="text-[#DC2626] ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            required={required}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={ariaDescribedBy || undefined}
            className={`w-full bg-white text-[#111827] text-sm rounded-xl border pl-3.5 pr-10 h-10 py-2 appearance-none transition-all duration-150 outline-none cursor-pointer ${
              hasError
                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20'
                : 'border-[#E5E7EB] hover:border-gray-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20'
            } ${
              disabled
                ? 'bg-[#F9FAFB] text-[#9CA3AF] border-[#E5E7EB] cursor-not-allowed opacity-100'
                : ''
            } ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden={required} className="text-[#6B7280] bg-white">
                {placeholder}
              </option>
            )}

            {options
              ? options.map((opt) => (
                  <option
                    key={String(opt.value)}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="text-[#111827] bg-white"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Custom Chevron Indicator */}
          <div
            className="absolute right-3.5 pointer-events-none text-[#6B7280] flex items-center"
            aria-hidden="true"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {hasError && (
          <p id={errorId} className="text-xs text-[#DC2626] font-medium mt-1.5 flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </p>
        )}

        {!hasError && hint && (
          <p id={hintId} className="text-xs text-[#6B7280] mt-1.5">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
