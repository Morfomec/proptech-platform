import React from 'react'
import { Link } from 'react-router-dom'

export interface LandingFooterProps {
  isAuthenticated: boolean
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ isAuthenticated }) => {
  return (
    <footer className="bg-[#F9FAFB] border-t border-gray-200 text-[#6B7280]">
      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12 mb-12">
          {/* Column 1: Brand (spans 2 columns on large screens) */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
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
                  className="lucide lucide-building-2"
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
            <p className="text-sm text-[#6B7280] leading-relaxed max-w-sm mb-6">
              Modern property management and residential rental discovery throughout India. Designed
              for tenants and property owners alike.
            </p>
          </div>

          {/* Column 2: Marketplace */}
          <div>
            <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-4">
              Marketplace
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  to="/properties"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Browse Rentals
                </Link>
              </li>
              <li>
                <Link
                  to="/properties"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Featured Listings
                </Link>
              </li>
              <li>
                <Link
                  to="/properties"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Search by City
                </Link>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Rental Guide
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Owners */}
          <div>
            <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-4">
              Owners
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  to={isAuthenticated ? '/app/owner/properties/new' : '/register'}
                  className="hover:text-[#408A71] transition-colors"
                >
                  List Your Property
                </Link>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Property Management
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Pricing Plans
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Owner Support
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Support */}
          <div>
            <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-4">
              Support
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="#about"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Help Center
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  className="hover:text-[#408A71] transition-colors"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Socials */}
        <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-[#6B7280]">
            &copy; 2026 PropTech Solutions Inc. All rights reserved.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-4 text-[#9CA3AF]">
            {/* Twitter / X */}
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Twitter"
              className="hover:text-[#408A71] transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="LinkedIn"
              className="hover:text-[#408A71] transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram"
              className="hover:text-[#408A71] transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default LandingFooter

