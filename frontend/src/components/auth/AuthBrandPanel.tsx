import React from 'react'
import { Link } from 'react-router-dom'

/**
 * AuthBrandPanel
 * Left-side visual branding panel for split-screen authentication layouts.
 * Features bright luxury property photography, fresh brand overlay,
 * top-left logo, and "Manage your properties with ease." headline.
 */
export const AuthBrandPanel: React.FC = () => {
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[#1B3E32] p-8 sm:p-12 xl:p-16 text-white">
      {/* Background Photography with Luxury Modern Living Room */}
      <img
        src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=80"
        alt="Modern luxury penthouse living room"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Fresh, Light Atmospheric Green Overlay (Bright & Airy) */}
      <div className="absolute inset-0 bg-[#1A4436]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0E2C22]/65 via-[#1A4436]/25 to-[#1A4436]/35" />

      {/* Top Brand Logo */}
      <div className="relative z-10 flex items-center gap-2.5">
        <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#408A71] text-white shadow-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
          <span className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
            PropTech
          </span>
        </Link>
      </div>

      {/* Center Headline Only */}
      <div className="relative z-10 my-auto py-8">
        <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-white leading-[1.15] drop-shadow-md">
          Manage your<br />
          properties <span className="text-[#A5E0CB]">with<br />ease.</span>
        </h1>
      </div>

      {/* Empty bottom anchor to maintain layout balance */}
      <div className="relative z-10 h-6" aria-hidden="true" />
    </div>
  )
}

export default AuthBrandPanel
