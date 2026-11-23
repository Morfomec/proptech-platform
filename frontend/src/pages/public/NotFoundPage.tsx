import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'

/**
 * NotFoundPage
 * Simple, elegant 404 error page matching PropTech branding and design standards.
 */
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F9FAFB] text-[#111827]">
      {/* Top Header with Brand */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="bg-[#408A71] text-white p-2 rounded-xl group-hover:bg-[#34745C] transition-colors shadow-2xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 12h4" />
              <path d="M10 8h4" />
              <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
              <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
              <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#111827]">
            prop<span className="text-[#408A71]">tech</span>
          </span>
        </Link>

        <Link
          to="/properties"
          className="text-xs font-medium text-[#408A71] hover:text-[#34745C] transition-colors inline-flex items-center gap-1"
        >
          <span>Browse Properties</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </header>

      {/* Main 404 Card */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full bg-white border border-[#E5E7EB] rounded-2xl p-8 sm:p-10 shadow-xs text-center flex flex-col items-center">
          {/* Visual 404 Accent Badge */}
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#ECF5F2] text-[#408A71] mb-5 shadow-2xs">
            <span className="text-xl font-bold tracking-tight">404</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-medium text-[#111827] tracking-tight">
            Page not found
          </h1>

          <p className="mt-2 text-sm font-normal text-[#6B7280] leading-relaxed">
            Sorry, we couldn’t find the page you’re looking for. It may have been moved, deleted, or the URL might be incorrect.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto"
            >
              Go Back
            </Button>
            <Link to="/" className="w-full sm:w-auto">
              <Button variant="primary" size="md" className="w-full">
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-[#9CA3AF]">
        &copy; {new Date().getFullYear()} proptech. All rights reserved.
      </footer>
    </div>
  )
}

export default NotFoundPage
