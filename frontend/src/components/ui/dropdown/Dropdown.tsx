import React, { useEffect, useRef, useState } from 'react'

export interface DropdownMenuItem {
  id?: string
  label?: React.ReactNode
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  separator?: boolean
  shortcut?: string
}

export type DropdownPlacement = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

export interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownMenuItem[]
  placement?: DropdownPlacement
  width?: string
  disabled?: boolean
  className?: string
}

const placementStyles: Record<DropdownPlacement, string> = {
  'bottom-left': 'top-full left-0 mt-1.5',
  'bottom-right': 'top-full right-0 mt-1.5',
  'top-left': 'bottom-full left-0 mb-1.5',
  'top-right': 'bottom-full right-0 mb-1.5',
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  placement = 'bottom-left',
  width = 'w-56',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Filter out pure separators to calculate selectable item indices for keyboard navigation
  const selectableItems = items.filter((item) => !item.separator && !item.disabled)

  const toggleDropdown = () => {
    if (disabled) return
    setIsOpen((prev) => !prev)
    setActiveIndex(-1)
  }

  const closeDropdown = () => {
    setIsOpen(false)
    setActiveIndex(-1)
  }

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Keyboard navigation & Escape key listener
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDropdown()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((prev) => (prev + 1) % selectableItems.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((prev) =>
          prev <= 0 ? selectableItems.length - 1 : prev - 1
        )
      } else if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault()
        const targetItem = selectableItems[activeIndex]
        if (targetItem && !targetItem.disabled && targetItem.onClick) {
          targetItem.onClick()
          closeDropdown()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, activeIndex, selectableItems])

  let selectableCounter = 0

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger */}
      <div
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleDropdown()
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        className={`inline-flex items-center cursor-pointer select-none ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {trigger}
      </div>

      {/* Menu Overlay */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          className={`absolute z-50 ${width} ${placementStyles[placement]} bg-surface rounded-xl border border-border shadow-lg p-1.5 focus:outline-none animate-in fade-in-0 zoom-in-95`}
        >
          {items.map((item, index) => {
            if (item.separator) {
              return (
                <div
                  key={`sep-${index}`}
                  role="separator"
                  className="my-1 border-t border-border"
                />
              )
            }

            const isSelectable = !item.disabled
            const currentIndex = isSelectable ? selectableCounter++ : -1
            const isHighlighted = currentIndex === activeIndex

            return (
              <button
                key={item.id || `item-${index}`}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return
                  if (item.onClick) item.onClick()
                  closeDropdown()
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs md:text-sm rounded-lg transition-colors cursor-pointer select-none text-left ${
                  item.disabled
                    ? 'text-muted/50 cursor-not-allowed opacity-60'
                    : item.danger
                    ? isHighlighted
                      ? 'bg-red-50 text-[#DC2626]'
                      : 'text-[#DC2626] hover:bg-red-50'
                    : isHighlighted
                    ? 'bg-brand-soft text-brand-deep'
                    : 'text-heading hover:bg-background hover:text-brand-primary'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {item.icon && (
                    <span className="shrink-0 flex items-center justify-center text-muted" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </div>

                {item.shortcut && (
                  <span className="text-[10px] font-mono text-muted/70 uppercase ml-2 tracking-wider">
                    {item.shortcut}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

Dropdown.displayName = 'Dropdown'

export default Dropdown
