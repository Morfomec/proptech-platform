import React, { useRef, useState } from 'react'

export interface TabItem {
  id: string
  label: React.ReactNode
  content?: React.ReactNode
  disabled?: boolean
  icon?: React.ReactNode
  badge?: React.ReactNode
}

export type TabsVariant = 'underline' | 'pills'

export interface TabsProps {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  variant?: TabsVariant
  fullWidth?: boolean
  className?: string
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  value: controlledValue,
  defaultValue,
  onChange,
  variant = 'underline',
  fullWidth = false,
  className = '',
}) => {
  const [uncontrolledTab, setUncontrolledTab] = useState<string>(
    () => defaultValue ?? items.find((item) => !item.disabled)?.id ?? items[0]?.id ?? ''
  )
  const activeTab = controlledValue !== undefined ? controlledValue : uncontrolledTab
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const handleTabClick = (tabId: string) => {
    if (controlledValue === undefined) {
      setUncontrolledTab(tabId)
    }
    onChange?.(tabId)
  }

  const enabledTabs = items.filter((item) => !item.disabled)

  const handleKeyDown = (event: React.KeyboardEvent, currentId: string) => {
    const currentIndex = enabledTabs.findIndex((t) => t.id === currentId)
    if (currentIndex === -1) return

    let nextIndex: number

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % enabledTabs.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = enabledTabs.length - 1
    } else {
      return
    }

    event.preventDefault()
    const nextTab = enabledTabs[nextIndex]
    if (nextTab) {
      handleTabClick(nextTab.id)
      tabRefs.current.get(nextTab.id)?.focus()
    }
  }

  const activeItem = items.find((item) => item.id === activeTab)

  return (
    <div className={`w-full ${className}`}>
      {/* Tab List */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={`flex items-center gap-1 overflow-x-auto no-scrollbar ${
          variant === 'underline'
            ? 'border-b border-border'
            : 'p-1 bg-background rounded-xl border border-border'
        } ${fullWidth ? 'w-full' : ''}`}
      >
        {items.map((item) => {
          const isActive = item.id === activeTab
          const isDisabled = Boolean(item.disabled)

          let tabStyle: string
          if (variant === 'underline') {
            if (isActive) {
              tabStyle = 'text-brand-primary border-b-2 border-brand-primary font-semibold -mb-px'
            } else if (isDisabled) {
              tabStyle = 'text-[#9CA3AF] border-b-2 border-transparent font-medium cursor-not-allowed pointer-events-none'
            } else {
              tabStyle = 'text-[#111827] hover:text-brand-primary hover:border-b-2 hover:border-brand-primary/50 border-b-2 border-transparent font-medium'
            }
          } else {
            // pills
            if (isActive) {
              tabStyle = 'bg-white text-brand-primary font-semibold shadow-xs'
            } else if (isDisabled) {
              tabStyle = 'text-[#9CA3AF] font-medium cursor-not-allowed pointer-events-none'
            } else {
              tabStyle = 'text-[#111827] hover:text-brand-primary hover:bg-white/80 active:bg-white font-medium'
            }
          }

          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) tabRefs.current.set(item.id, el)
                else tabRefs.current.delete(item.id)
              }}
              id={`tab-${item.id}`}
              role="tab"
              type="button"
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.id}`}
              disabled={isDisabled}
              onClick={() => handleTabClick(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs md:text-sm transition-all duration-150 select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 ${
                fullWidth ? 'flex-1' : ''
              } ${
                variant === 'pills' ? 'rounded-lg' : ''
              } ${tabStyle} ${
                isDisabled ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'
              }`}
            >
              {item.icon && (
                <span className="shrink-0 flex items-center justify-center" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
              {item.badge && <span className="shrink-0 ml-0.5">{item.badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Tab Panel */}
      {activeItem?.content && (
        <div
          id={`tabpanel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeItem.id}`}
          tabIndex={0}
          className="pt-4 focus:outline-none"
        >
          {activeItem.content}
        </div>
      )}
    </div>
  )
}

Tabs.displayName = 'Tabs'

export default Tabs
