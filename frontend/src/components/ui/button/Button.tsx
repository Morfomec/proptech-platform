import React, { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  loadingText?: string
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-white hover:bg-brand-hover hover:text-white active:bg-brand-deep active:text-white border border-transparent shadow-xs focus-visible:outline-brand-primary',
  secondary:
    'bg-white text-[#111827] hover:bg-[#F9FAFB] hover:text-[#111827] active:bg-[#F3F4F6] border border-[#E5E7EB] shadow-xs focus-visible:outline-brand-primary',
  outline:
    'bg-white border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white active:bg-brand-hover active:text-white focus-visible:outline-brand-primary',
  ghost:
    'bg-transparent text-[#111827] hover:bg-gray-100 hover:text-[#111827] active:bg-gray-200 border border-transparent focus-visible:outline-brand-primary',
  danger:
    'bg-[#DC2626] text-white hover:bg-red-700 hover:text-white active:bg-red-800 active:text-white border border-transparent shadow-xs focus-visible:outline-red-600',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-2 h-8 min-h-[32px]',
  md: 'px-4 py-2 text-sm rounded-xl gap-2 h-10 min-h-[40px]',
  lg: 'px-6 py-2.5 text-base rounded-xl gap-2.5 h-12 min-h-[48px]',
}

const LoadingSpinner: React.FC<{ size?: ButtonSize }> = ({ size = 'md' }) => {
  const dimension = size === 'sm' ? 14 : size === 'lg' ? 20 : 16
  return (
    <svg
      className="animate-spin shrink-0"
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      fullWidth = false,
      leftIcon,
      rightIcon,
      type = 'button',
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        className={`inline-flex items-center justify-center font-medium text-center transition-all duration-150 select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${
          isDisabled
            ? 'bg-[#F3F4F6] text-[#9CA3AF] border border-[#E5E7EB] cursor-not-allowed pointer-events-none shadow-none opacity-100'
            : 'cursor-pointer'
        } ${className}`}
        {...props}
      >
        {isLoading && <LoadingSpinner size={size} />}
        {!isLoading && leftIcon && (
          <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className="inline-flex items-center justify-center text-center whitespace-nowrap">
          {isLoading && loadingText ? loadingText : children}
        </span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
