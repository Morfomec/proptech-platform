import React from 'react'

export interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

/**
 * AuthCard
 * The central white card used on all authentication pages.
 * Displays header typography as its first element and wraps form content in a breathable container.
 */
export const AuthCard: React.FC<AuthCardProps> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <div className="w-full max-w-[480px] sm:max-w-[500px] rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-6 sm:p-7 lg:p-8 shadow-[0_12px_36px_-10px_rgba(0,0,0,0.07)] transition-all">
      {/* Card Header (First Element) */}
      <div className="mb-5 sm:mb-6 text-center">
        <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[#111827]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs sm:text-sm text-[#6B7280]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Form and Content Body */}
      <div>{children}</div>
    </div>
  )
}

export default AuthCard

