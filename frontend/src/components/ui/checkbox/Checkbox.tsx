import React, { forwardRef, useEffect, useId, useRef } from 'react'

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  description?: React.ReactNode
  indeterminate?: boolean
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      indeterminate = false,
      error,
      checked,
      defaultChecked,
      disabled = false,
      id: customId,
      className = '',
      onChange,
      ...props
    },
    forwardedRef
  ) => {
    const generatedId = useId()
    const checkboxId = customId || `checkbox-${generatedId}`
    const descriptionId = `${checkboxId}-description`
    const errorId = `${checkboxId}-error`

    const internalRef = useRef<HTMLInputElement>(null)

    const isControlled = checked !== undefined
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(Boolean(defaultChecked))
    const isChecked = isControlled ? Boolean(checked) : uncontrolledChecked

    // Handle forwarded ref while also maintaining internal ref for indeterminate DOM property
    const setRefs = (node: HTMLInputElement | null) => {
      internalRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    useEffect(() => {
      if (internalRef.current) {
        internalRef.current.indeterminate = indeterminate
      }
    }, [indeterminate])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setUncontrolledChecked(e.target.checked)
      }
      onChange?.(e)
    }

    const hasError = Boolean(error)
    const ariaDescribedBy = [
      hasError ? errorId : null,
      description ? descriptionId : null,
    ]
      .filter(Boolean)
      .join(' ')

    // Indicator background & border styles
    let indicatorStyle = 'bg-white border-[#E5E7EB] hover:border-brand-primary'
    if (disabled) {
      if (indeterminate || isChecked) {
        indicatorStyle = 'bg-brand-primary/50 border-brand-primary/50 text-white cursor-not-allowed'
      } else {
        indicatorStyle = 'bg-[#F9FAFB] border-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
      }
    } else if (hasError) {
      indicatorStyle = 'border-[#DC2626] bg-white'
    } else if (indeterminate || isChecked) {
      indicatorStyle = 'bg-brand-primary border-brand-primary text-white'
    }

    return (
      <div className={`text-left ${className}`}>
        <div className="flex items-start gap-3">
          <div className="relative flex items-center pt-0.5">
            <input
              ref={setRefs}
              id={checkboxId}
              type="checkbox"
              checked={checked}
              defaultChecked={defaultChecked}
              disabled={disabled}
              aria-invalid={hasError ? 'true' : undefined}
              aria-describedby={ariaDescribedBy || undefined}
              onChange={handleChange}
              className="peer sr-only"
              {...props}
            />

            {/* Custom styled checkbox indicator */}
            <label
              htmlFor={checkboxId}
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-150 select-none ${
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              } ${indicatorStyle} peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/20 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-primary peer-focus-visible:outline-offset-2`}
              aria-hidden="true"
            >
              {indeterminate ? (
                /* Horizontal minus icon for indeterminate */
                <svg
                  className="w-3.5 h-3.5 fill-none stroke-white stroke-2"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8h9" />
                </svg>
              ) : isChecked ? (
                /* Clean white checkmark for checked */
                <svg
                  className="w-3.5 h-3.5 fill-none stroke-white stroke-2"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8.5l3 3 6-6" />
                </svg>
              ) : null}
            </label>
          </div>

          {(label || description) && (
            <div className="text-sm">
              {label && (
                <label
                  htmlFor={checkboxId}
                  className={`font-medium block leading-snug select-none ${
                    disabled
                      ? 'text-[#9CA3AF] cursor-not-allowed'
                      : 'text-[#111827] cursor-pointer'
                  }`}
                >
                  {label}
                </label>
              )}
              {description && (
                <p
                  id={descriptionId}
                  className={`text-xs mt-0.5 leading-relaxed ${
                    disabled ? 'text-[#9CA3AF]' : 'text-[#6B7280]'
                  }`}
                >
                  {description}
                </p>
              )}
            </div>
          )}
        </div>

        {hasError && (
          <p id={errorId} className="text-xs text-[#DC2626] font-medium mt-1.5 flex items-center gap-1 ml-8">
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
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox
