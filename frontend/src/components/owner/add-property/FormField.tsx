import React from 'react'

export interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  helpText?: string
  className?: string
  action?: React.ReactNode
  children: React.ReactNode
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  helpText,
  className = '',
  action,
  children,
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="h-6 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-gray-700 truncate">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {action && <div className="flex items-center shrink-0">{action}</div>}
      </div>

      <div>{children}</div>

      {helpText && !error && (
        <p className="text-[11px] text-gray-500 mt-1">{helpText}</p>
      )}

      {error && (
        <p className="text-xs text-red-500 font-medium mt-1">{error}</p>
      )}
    </div>
  )
}

export default FormField
