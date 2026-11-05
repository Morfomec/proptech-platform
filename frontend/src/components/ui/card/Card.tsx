import React, { forwardRef } from 'react'

export type CardVariant = 'default' | 'outline' | 'flat' | 'elevated' | 'accent'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  interactive?: boolean
  children?: React.ReactNode
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface border border-border shadow-card',
  outline: 'bg-surface border border-border shadow-none',
  flat: 'bg-background border border-transparent shadow-none',
  elevated: 'bg-surface border border-border/80 shadow-lg',
  accent: 'bg-surface border border-border border-l-4 border-l-brand-primary shadow-card',
}

const paddingStyles: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      interactive = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`rounded-2xl transition-all duration-200 ${variantStyles[variant]} ${
          paddingStyles[padding]
        } ${
          interactive
            ? 'hover:shadow-card-hover hover:border-brand-primary/40 cursor-pointer'
            : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`flex flex-col space-y-1.5 pb-3 ${className}`} {...props}>
      {children}
    </div>
  )
)

CardHeader.displayName = 'CardHeader'

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = '', children, ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-lg font-bold text-heading leading-tight tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  )
)

CardTitle.displayName = 'CardTitle'

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = '', children, ...props }, ref) => (
    <p ref={ref} className={`text-xs md:text-sm text-muted leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  )
)

CardDescription.displayName = 'CardDescription'

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`flex-1 ${className}`} {...props}>
      {children}
    </div>
  )
)

CardContent.displayName = 'CardContent'

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`flex items-center pt-4 border-t border-border/80 gap-3 ${className}`} {...props}>
      {children}
    </div>
  )
)

CardFooter.displayName = 'CardFooter'

export default Card
