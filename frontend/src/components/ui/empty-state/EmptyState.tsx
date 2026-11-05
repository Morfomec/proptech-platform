import React from 'react'
import { Button, type ButtonVariant } from '../button'

export type EmptyStateContext = 'property' | 'search' | 'tenant' | 'record' | 'default'
export type EmptyStateSize = 'sm' | 'md' | 'lg'

export interface EmptyStateActionConfig {
  label: string
  onClick?: () => void
  variant?: ButtonVariant
  icon?: React.ReactNode
  disabled?: boolean
  loading?: boolean
}

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode

  context?: EmptyStateContext
  action?: React.ReactNode | EmptyStateActionConfig
  secondaryAction?: React.ReactNode | EmptyStateActionConfig
  size?: EmptyStateSize
  bordered?: boolean
  className?: string
}

const contextIcons: Record<EmptyStateContext, React.ReactNode> = {
  property: (
    <svg
      className="w-full h-full"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  search: (
    <svg
      className="w-full h-full"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  tenant: (
    <svg
      className="w-full h-full"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  record: (
    <svg
      className="w-full h-full"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  default: (
    <svg
      className="w-full h-full"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
}

const sizeConfig: Record<
  EmptyStateSize,
  {
    padding: string
    iconWrapper: string
    iconSize: string
    titleSize: string
    descSize: string
    buttonSize: 'sm' | 'md'
  }
> = {
  sm: {
    padding: 'py-6 px-4',
    iconWrapper: 'w-10 h-10 rounded-xl mb-3',
    iconSize: 'w-5 h-5',
    titleSize: 'text-sm font-semibold',
    descSize: 'text-xs',
    buttonSize: 'sm',
  },
  md: {
    padding: 'py-10 px-6',
    iconWrapper: 'w-14 h-14 rounded-2xl mb-4',
    iconSize: 'w-7 h-7',
    titleSize: 'text-base font-semibold',
    descSize: 'text-sm',
    buttonSize: 'md',
  },
  lg: {
    padding: 'py-16 px-8',
    iconWrapper: 'w-16 h-16 rounded-2xl mb-5',
    iconSize: 'w-8 h-8',
    titleSize: 'text-lg font-bold',
    descSize: 'text-sm',
    buttonSize: 'md',
  },
}

function isActionConfig(action: unknown): action is EmptyStateActionConfig {
  return typeof action === 'object' && action !== null && 'label' in action
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  context = 'default',
  action,
  secondaryAction,
  size = 'md',
  bordered = false,
  className = '',
  ...props
}) => {
  const currentSize = sizeConfig[size]
  const displayIcon = icon ?? contextIcons[context]

  const borderClass = bordered
    ? 'border border-dashed border-[#E5E7EB] rounded-2xl bg-white'
    : ''

  const renderActionNode = (
    act: React.ReactNode | EmptyStateActionConfig | undefined,
    defaultVariant: ButtonVariant
  ) => {
    if (!act) return null
    if (isActionConfig(act)) {
      return (
        <Button
          variant={act.variant || defaultVariant}
          size={currentSize.buttonSize}
          onClick={act.onClick}
          disabled={act.disabled}
          isLoading={act.loading}
          leftIcon={act.icon}
        >
          {act.label}
        </Button>
      )
    }
    return act
  }

  const hasActions = Boolean(action || secondaryAction)

  return (
    <div
      role="region"
      aria-label={typeof title === 'string' ? title : 'Empty state'}
      className={`flex flex-col items-center justify-center text-center ${currentSize.padding} ${borderClass} ${className}`}
      {...props}
    >
      {/* Icon Wrapper */}
      {displayIcon && (
        <div
          className={`flex items-center justify-center bg-[#A5E0CB]/20 text-[#408A71] shadow-xs ${currentSize.iconWrapper}`}
        >
          <div className={currentSize.iconSize}>{displayIcon}</div>
        </div>
      )}

      {/* Title */}
      <h3 className={`text-[#111827] ${currentSize.titleSize} tracking-tight`}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className={`mt-1.5 max-w-md text-[#6C7182] ${currentSize.descSize} leading-relaxed`}>
          {description}
        </p>
      )}

      {/* Actions */}
      {hasActions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {renderActionNode(action, 'primary')}
          {renderActionNode(secondaryAction, 'secondary')}
        </div>
      )}
    </div>
  )
}
