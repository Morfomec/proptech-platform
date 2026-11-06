import React from 'react'
import { Link } from 'react-router-dom'

/**
 * AuthFooter
 * Standard footer placed at the bottom of the authentication screens.
 * Contains copyright attribution and links to Privacy Policy and Terms of Service.
 */
export const AuthFooter: React.FC = () => {
  return (
    <footer className="w-full pt-3 pb-2 text-center text-xs text-[#9CA3AF] shrink-0">
      <p className="mb-1 font-normal">
        &copy; {new Date().getFullYear()} PropTech Solutions Inc. All rights reserved.
      </p>
      <div className="flex items-center justify-center gap-4 text-[#6B7280]">
        <Link
          to="#"
          onClick={(e) => e.preventDefault()}
          className="transition-colors hover:text-[#111827] hover:underline"
        >
          Privacy Policy
        </Link>
        <span aria-hidden="true">&bull;</span>
        <Link
          to="#"
          onClick={(e) => e.preventDefault()}
          className="transition-colors hover:text-[#111827] hover:underline"
        >
          Terms of Service
        </Link>
      </div>
    </footer>
  )
}

export default AuthFooter

