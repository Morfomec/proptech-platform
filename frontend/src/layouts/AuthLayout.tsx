import React from 'react'
import { Link, Outlet } from 'react-router-dom'
import AuthBrandPanel from '../components/auth/AuthBrandPanel'
import AuthFooter from '../components/auth/AuthFooter'

/**
 * AuthLayout
 * Master split-screen layout for authentication routes.
 *
 * Left: Photographic brand showcase with atmospheric green tint overlay and value proposition.
 * Right: Responsive container housing the authentication card and footer within viewport height.
 */
export const AuthLayout: React.FC = () => {
  return (
    <div className="flex min-h-[100dvh] lg:h-[100dvh] lg:max-h-[100dvh] w-full bg-[#F9FAFB] text-[#111827] antialiased overflow-x-hidden lg:overflow-hidden">
      {/* Left Photographic Branding Panel (Desktop Only) */}
      <section className="hidden lg:flex lg:w-1/2 relative lg:h-full lg:overflow-hidden">
        <AuthBrandPanel />
      </section>

      {/* Right Authentication Form Container */}
      <section className="flex flex-1 flex-col justify-between items-center p-4 sm:p-6 lg:px-8 lg:py-2.5 xl:px-12 xl:py-3.5 min-h-[100dvh] lg:h-full lg:overflow-y-auto">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="flex lg:hidden justify-center pt-1 pb-2 w-full">
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#408A71] text-white shadow-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                <path d="M10 6h4" />
                <path d="M10 10h4" />
                <path d="M10 14h4" />
                <path d="M10 18h4" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#111827]">
              prop<span className="text-[#408A71]">tech</span>
            </span>
          </Link>
        </div>

        {/* Center Card Container */}
        <div className="w-full flex items-center justify-center my-auto py-1">
          <Outlet />
        </div>

        {/* Standard Auth Footer */}
        <AuthFooter />
      </section>
    </div>
  )
}

export default AuthLayout
