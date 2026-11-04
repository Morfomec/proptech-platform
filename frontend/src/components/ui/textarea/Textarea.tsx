import React, { forwardRef, useId } from 'react'

export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  resize?: TextareaResize
  fullWidth?: boolean
}

const resizeStyles: Record<TextareaResize, string> = {
  none: 'resize-none',
  vertical: 'resize-y',
  horizontal: 'resize-x',
  both: 'resize',
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      hint,
      error,
      rows = 4,
      resize = 'vertical',
      fullWidth = true,
      id: customId,
      required,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const textareaId = customId || `textarea-${generatedId}`
    const hintId = `${textareaId}-hint`
    const errorId = `${textareaId}-error`

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
            htmlFor={textareaId}
            className="block text-sm font-medium text-[#111827] mb-1.5"
          >
            {label}
            {required && <span className="text-[#DC2626] ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          required={required}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={ariaDescribedBy || undefined}
          className={`w-full bg-white text-[#111827] text-sm rounded-xl border p-3.5 transition-all duration-150 outline-none placeholder:text-[#6B7280] ${
            resizeStyles[resize]
          } ${
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

Textarea.displayName = 'Textarea'

export default Textarea
