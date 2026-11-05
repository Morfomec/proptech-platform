import React from 'react'

export interface BreadcrumbItem {
  label: React.ReactNode
  href?: string
  icon?: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void
  isCurrent?: boolean
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  maxItemWidth?: string | number
  className?: string
}

const DefaultSeparator: React.FC = () => (
  <svg
    className="w-4 h-4 text-[#9CA3AF] shrink-0"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
      clipRule="evenodd"
    />
  </svg>
)

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  separator = <DefaultSeparator />,
  maxItemWidth = '240px',
  className = '',
  ...props
}) => {
  if (!items || items.length === 0) return null

  const maxWidthStyle = typeof maxItemWidth === 'number' ? `${maxItemWidth}px` : maxItemWidth

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-sm font-medium ${className}`}
      {...props}
    >
      <ol className="flex items-center flex-wrap gap-1.5 sm:gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const isCurrent = item.isCurrent ?? isLast

          return (
            <li key={`breadcrumb-item-${index}`} className="inline-flex items-center gap-1.5 sm:gap-2">
              {/* Separator before item (for all except first) */}
              {index > 0 && (
                <span className="inline-flex items-center select-none" aria-hidden="true">
                  {separator}
                </span>
              )}

              {/* Breadcrumb Content */}
              {isCurrent ? (
                <span
                  aria-current="page"
                  style={{ maxWidth: maxWidthStyle }}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#111827] truncate select-none"
                  title={typeof item.label === 'string' ? item.label : undefined}
                >
                  {item.icon && (
                    <span className="shrink-0 text-[#111827]" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  onClick={item.onClick}
                  style={{ maxWidth: maxWidthStyle }}
                  className="inline-flex items-center gap-1.5 text-[#6C7182] hover:text-[#408A71] transition-colors duration-150 truncate focus-visible:outline-brand-primary rounded"
                  title={typeof item.label === 'string' ? item.label : undefined}
                >
                  {item.icon && (
                    <span className="shrink-0 text-[#6C7182]" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </a>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  style={{ maxWidth: maxWidthStyle }}
                  className="inline-flex items-center gap-1.5 text-[#6C7182] hover:text-[#408A71] transition-colors duration-150 truncate cursor-pointer bg-transparent border-0 p-0 text-left focus-visible:outline-brand-primary rounded"
                  title={typeof item.label === 'string' ? item.label : undefined}
                >
                  {item.icon && (
                    <span className="shrink-0 text-[#6C7182]" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              ) : (
                <span
                  style={{ maxWidth: maxWidthStyle }}
                  className="inline-flex items-center gap-1.5 text-[#6C7182] truncate"
                  title={typeof item.label === 'string' ? item.label : undefined}
                >
                  {item.icon && (
                    <span className="shrink-0 text-[#6C7182]" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
