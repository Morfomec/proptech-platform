import React from 'react'
import { Breadcrumbs, type BreadcrumbItem } from '../breadcrumbs'

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[] | React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

function isBreadcrumbArray(breadcrumbs: unknown): breadcrumbs is BreadcrumbItem[] {
  return Array.isArray(breadcrumbs)
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumbs,
  icon,
  actions,
  subtitle,
  meta,
  children,
  className = '',
  ...props
}) => {
  const renderBreadcrumbs = () => {
    if (!breadcrumbs) return null

    if (isBreadcrumbArray(breadcrumbs)) {
      return <Breadcrumbs items={breadcrumbs} className="mb-3.5" />
    }

    return <div className="mb-3.5">{breadcrumbs}</div>
  }

  return (
    <header className={`w-full ${className}`} {...props}>
      {/* Optional Breadcrumb Navigation */}
      {renderBreadcrumbs()}

      {/* Main Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Title, Icon, Subtitle, Meta & Description Container */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-3 sm:gap-3.5">
            {icon && (
              <div
                className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#A5E0CB]/20 text-[#408A71] shrink-0 shadow-xs"
                aria-hidden="true"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6">{icon}</div>
              </div>
            )}
            <div className="min-w-0">
              {subtitle && (
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#408A71] mb-0.5">
                  {subtitle}
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] tracking-tight">
                {title}
              </h1>
            </div>
          </div>

          {/* Optional Meta Tags / Status Badges */}
          {meta && (
            <div className="flex items-center flex-wrap gap-2 pt-1">
              {meta}
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-sm sm:text-base text-[#6C7182] pt-0.5 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Optional Action Buttons Area */}
        {actions && (
          <div className="flex items-center flex-wrap gap-2.5 shrink-0 self-start sm:self-center">
            {actions}
          </div>
        )}
      </div>

      {/* Additional Child Layout (Tabs, Sub-filters, Summary stats) */}
      {children && (
        <div className="mt-5 pt-4 border-t border-[#E5E7EB]">
          {children}
        </div>
      )}
    </header>
  )
}
