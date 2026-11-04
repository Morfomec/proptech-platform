import React, { useState } from 'react'

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  name?: string
  fallback?: React.ReactNode
  size?: AvatarSize
  status?: AvatarStatus
  className?: string
}

const sizeStyles: Record<
  AvatarSize,
  {
    container: string
    text: string
    statusDot: string
    statusOffset: string
  }
> = {
  sm: {
    container: 'w-8 h-8',
    text: 'text-xs',
    statusDot: 'w-2 h-2',
    statusOffset: 'bottom-0 right-0',
  },
  md: {
    container: 'w-10 h-10',
    text: 'text-sm font-semibold',
    statusDot: 'w-2.5 h-2.5',
    statusOffset: 'bottom-0 right-0',
  },
  lg: {
    container: 'w-12 h-12',
    text: 'text-base font-semibold',
    statusDot: 'w-3 h-3',
    statusOffset: 'bottom-0.5 right-0.5',
  },
  xl: {
    container: 'w-16 h-16',
    text: 'text-xl font-bold',
    statusDot: 'w-3.5 h-3.5',
    statusOffset: 'bottom-1 right-1',
  },
}

const statusColors: Record<AvatarStatus, { bg: string; label: string }> = {
  online: { bg: 'bg-[#15803D]', label: 'Online' },
  busy: { bg: 'bg-[#DC2626]', label: 'Busy' },
  away: { bg: 'bg-[#D97706]', label: 'Away' },
  offline: { bg: 'bg-[#9CA3AF]', label: 'Offline' },
}

const getInitials = (name?: string): string => {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  name,
  fallback,
  size = 'md',
  status,
  className = '',
  ...props
}) => {
  const [imageError, setImageError] = useState(false)
  const currentSize = sizeStyles[size]

  const showImage = Boolean(src && !imageError)
  const initials = fallback || getInitials(name) || '?'

  return (
    <div
      className={`relative inline-flex shrink-0 select-none ${className}`}
      {...props}
    >
      <div
        className={`relative flex items-center justify-center rounded-full overflow-hidden bg-brand-soft text-brand-deep border border-brand-primary/20 shadow-xs ${currentSize.container} ${currentSize.text}`}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span aria-label={name || alt}>{initials}</span>
        )}
      </div>

      {status && (
        <span
          title={statusColors[status].label}
          aria-label={statusColors[status].label}
          className={`absolute rounded-full ring-2 ring-white ${statusColors[status].bg} ${currentSize.statusDot} ${currentSize.statusOffset}`}
        />
      )}
    </div>
  )
}

Avatar.displayName = 'Avatar'

export default Avatar
