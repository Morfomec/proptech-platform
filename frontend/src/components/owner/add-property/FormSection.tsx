import React from 'react'

export interface FormSectionProps {
  id?: string
  icon?: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const FormSection: React.FC<FormSectionProps> = ({
  id,
  icon,
  title,
  subtitle,
  action,
  children,
  className = '',
}) => {
  return (
    <section
      id={id}
      className={`bg-white rounded-xl border border-gray-200 shadow-2xs p-5 sm:p-6 space-y-4 sm:space-y-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-[#ECF5F2] text-[#408A71] flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div>{children}</div>
    </section>
  )
}

export default FormSection

