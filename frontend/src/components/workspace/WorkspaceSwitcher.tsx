import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getAccessibleWorkspaces,
  getWorkspaceDashboardRoute,
  setStoredWorkspace,
  type WorkspaceType,
} from '../../utils/workspace'

export interface WorkspaceSwitcherProps {
  currentWorkspace: WorkspaceType
  variant?: 'header' | 'sidebar'
  onSwitch?: () => void
}

interface WorkspaceOption {
  id: WorkspaceType
  label: string
  shortLabel: string
  subtitle: string
}

const WORKSPACE_OPTIONS: WorkspaceOption[] = [
  {
    id: 'tenant',
    label: 'Tenant Workspace',
    shortLabel: 'Tenant',
    subtitle: 'Rentals, applications & documents',
  },
  {
    id: 'owner',
    label: 'Owner Workspace',
    shortLabel: 'Owner',
    subtitle: 'Properties, listings & portfolio',
  },
]

/**
 * WorkspaceSwitcher
 * Renders a "Switch Workspace" pill dropdown in the header or a compact
 * segmented toggle in the sidebar when the signed-in user holds access
 * to more than one authorized workspace (e.g., Tenant + Owner).
 * Hidden automatically when only one workspace is available.
 */
export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  currentWorkspace,
  variant = 'header',
  onSwitch,
}) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const accessibleWorkspaces = getAccessibleWorkspaces(user)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Only show switcher if user has access to multiple workspaces
  if (accessibleWorkspaces.length <= 1) {
    return null
  }

  const availableOptions = WORKSPACE_OPTIONS.filter((opt) =>
    accessibleWorkspaces.includes(opt.id)
  )

  const handleSelectWorkspace = (workspace: WorkspaceType) => {
    setIsOpen(false)
    setStoredWorkspace(workspace)
    onSwitch?.()
    if (workspace !== currentWorkspace) {
      navigate(getWorkspaceDashboardRoute(workspace))
    }
  }

  if (variant === 'sidebar') {
    return (
      <div className="px-3 pt-3">
        <div
          role="group"
          aria-label="Switch workspace"
          className="grid grid-cols-2 gap-1 rounded-lg bg-[#F3F4F6] p-1 border border-[#E5E7EB]"
        >
          {availableOptions.map((option) => {
            const isSelected = option.id === currentWorkspace
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelectWorkspace(option.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs transition-all cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#408A71]/30 ${
                  isSelected
                    ? 'bg-white text-[#408A71] font-medium shadow-2xs'
                    : 'text-[#6B7280] hover:text-[#111827] font-normal'
                }`}
              >
                {option.shortLabel}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-[#408A71]/35 bg-[#ECF5F2] hover:bg-[#DCECE6] text-xs sm:text-sm font-medium text-[#1A382A] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/25"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Switch Workspace"
      >
        <svg
          className="w-4 h-4 text-[#408A71] shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2.1"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 16l-4-4m0 0l4-4m-4 4h14m-4-8l4 4m0 0l-4 4m4-4H7"
          />
        </svg>
        <span className="hidden sm:inline">Switch Workspace</span>
        <svg
          className={`w-4 h-4 text-[#408A71] transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2.3"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-xl bg-white shadow-xl border border-[#E5E7EB] py-1.5 z-50"
        >
          <div className="px-3.5 py-2 border-b border-[#F3F4F6]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Workspaces
            </p>
          </div>
          <div className="py-1">
            {availableOptions.map((option) => {
              const isSelected = option.id === currentWorkspace
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectWorkspace(option.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#ECF5F2]/70 text-[#111827]'
                      : 'hover:bg-gray-50 text-[#374151]'
                  }`}
                >
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold ${
                        isSelected ? 'text-[#408A71]' : 'text-[#111827]'
                      }`}
                    >
                      {option.label}
                    </p>
                    <p className="text-[11px] text-[#6B7280] truncate">{option.subtitle}</p>
                  </div>
                  {isSelected && (
                    <svg
                      className="w-4 h-4 text-[#408A71] shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkspaceSwitcher
