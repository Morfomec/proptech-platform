import React, { forwardRef, useId } from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftElement?: React.ReactNode
  rightElement?: React.ReactNode
  fullWidth?: boolean
  inputSize?: 'md' | 'lg'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      leftElement,
      rightElement,
      fullWidth = true,
      inputSize = 'md',
      id: customId,
      required,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = customId || `input-${generatedId}`
    const hintId = `${inputId}-hint`
    const errorId = `${inputId}-error`

    const hasError = Boolean(error)
    const ariaDescribedBy = [
      hasError ? errorId : null,
      hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(' ')

    const heightClass =
      inputSize === 'lg'
        ? 'h-11 sm:h-12 text-sm sm:text-base'
        : 'h-10.5 text-sm'

    return (
      <div className={`${fullWidth ? 'w-full' : 'inline-block'} text-left`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs sm:text-sm font-medium text-[#111827] mb-1.5"
          >
            {label}
            {required && <span className="text-[#DC2626] ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftElement && (
            <div
              className="absolute left-3.5 flex items-center pointer-events-none text-[#6B7280]"
              aria-hidden="true"
            >
              {leftElement}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={ariaDescribedBy || undefined}
            className={`w-full bg-white text-[#111827] rounded-xl border transition-all duration-150 outline-none ${heightClass} ${
              leftElement ? 'pl-11' : 'pl-4'
            } ${rightElement ? 'pr-11' : 'pr-4'} py-2.5 placeholder:text-[#9CA3AF] ${
              hasError
                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20'
                : 'border-[#E5E7EB] hover:border-gray-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20'
            } ${
              disabled
                ? 'bg-[#F9FAFB] text-[#9CA3AF] border-[#E5E7EB] cursor-not-allowed opacity-100'
                : ''
            } ${className}`}
            {...props}
          />

          {rightElement && (
            <div
              className="absolute right-3.5 flex items-center text-[#6B7280]"
              aria-hidden="true"
            >
              {rightElement}
            </div>
          )}
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

Input.displayName = 'Input'

export default Input
