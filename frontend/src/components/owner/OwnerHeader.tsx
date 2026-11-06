import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export interface OwnerHeaderProps {
  onOpenSidebar: () => void
}

export const OwnerHeader: React.FC<OwnerHeaderProps> = ({ onOpenSidebar }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const userFullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'Property Owner'

  const userInitials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : (userFullName.slice(0, 2) || 'PO').toUpperCase()

  const handleLogout = async () => {
    setIsDropdownOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/app/owner/properties?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 sm:px-6 lg:px-8">
      {/* Mobile Hamburger & Logo */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex p-2 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Open navigation sidebar"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link to="/app/owner/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#408A71] text-white shadow-2xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-[#111827]">
            prop<span className="text-[#408A71]">tech</span>
          </span>
        </Link>
      </div>

      {/* Desktop Search Bar (Center/Left matching mockup) */}
      <div className="hidden lg:flex items-center flex-1 max-w-md">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
            <svg
              className="w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search properties, locations..."
            className="w-full pl-9 pr-4 py-2 bg-[#F3F4F6] hover:bg-[#EFF1F4] focus:bg-white text-xs text-[#111827] placeholder-[#9CA3AF] rounded-lg border border-transparent focus:border-[#408A71] focus:outline-hidden focus:ring-2 focus:ring-[#408A71]/20 transition-all"
          />
        </form>
      </div>

      {/* Right Action Icons & User Dropdown */}
      <div className="flex items-center gap-3 sm:gap-4 ml-auto">
        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          title="Notifications"
          aria-label="Notifications"
        >
          <svg
            className="w-5 h-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#408A71] ring-2 ring-white" />
        </button>

        {/* Vertical Divider */}
        <div className="h-6 w-px bg-[#E5E7EB]" />

        {/* User Profile Pill & Pull-Down Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group focus:outline-hidden"
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#408A71]/15 text-[#408A71] font-bold text-xs flex items-center justify-center ring-2 ring-[#408A71]/20 group-hover:ring-[#408A71]/40 transition-all shrink-0">
              {userInitials}
            </div>

            {/* User Name & Role (desktop) */}
            <div className="hidden sm:flex flex-col text-left leading-tight">
              <span className="text-xs font-bold text-[#111827] group-hover:text-[#408A71] transition-colors truncate max-w-[140px]">
                {userFullName}
              </span>
              <span className="text-[10px] font-medium text-[#6B7280]">
                Property Owner
              </span>
            </div>

            {/* Chevron icon */}
            <svg
              className={`w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#4B5563] transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180 text-[#408A71]' : ''
              }`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Pull-Down Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-[#E5E7EB] py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User Summary Header */}
              <div className="px-4 py-3 border-b border-[#F3F4F6]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#408A71]/15 text-[#408A71] font-bold text-xs flex items-center justify-center ring-1 ring-[#408A71]/30 shrink-0">
                    {userInitials}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#111827] truncate">
                      {userFullName}
                    </span>
                    <span className="text-[11px] text-[#6B7280] truncate">
                      {user?.email}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#408A71]/10 text-[#408A71]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#408A71]" />
                    Verified Owner
                  </span>
                </div>
              </div>

              {/* Navigation Options */}
              <div className="py-1">
                <Link
                  to="/app/profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#374151] hover:bg-gray-50 hover:text-[#111827] transition-colors"
                >
                  <svg
                    className="w-4 h-4 text-[#6B7280]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span>My Profile &amp; Settings</span>
                </Link>
              </div>

              {/* Divider */}
              <div className="border-t border-[#F3F4F6] my-1" />

              {/* Log Out Option */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer text-left"
              >
                <svg
                  className="w-4 h-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default OwnerHeader
