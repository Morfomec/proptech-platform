import React, { useState } from 'react'

export interface PropertyMapPreviewProps {
  latitude?: string | null
  longitude?: string | null
  onCoordinateChange?: (lat: string, lng: string) => void
  addressSummary?: string
}

/**
 * PropertyMapPreview
 * Isolated vector map component with pin marker, zoom controls, and coordinate readout.
 * Fully self-contained without external API keys, tokens, or network tracking.
 */
export const PropertyMapPreview: React.FC<PropertyMapPreviewProps> = ({
  latitude,
  longitude,
  onCoordinateChange,
}) => {
  const [zoomLevel, setZoomLevel] = useState(14)
  const [pinOffset, setPinOffset] = useState({ x: 50, y: 50 })

  const hasCustomCoords = Boolean(latitude && longitude)
  const displayLat = latitude ? Math.abs(parseFloat(latitude)).toFixed(4) : '11.2588'
  const displayLng = longitude ? Math.abs(parseFloat(longitude)).toFixed(4) : '75.7804'
  const latDir = (latitude && parseFloat(latitude) < 0) ? 'S' : 'N'
  const lngDir = (longitude && parseFloat(longitude) < 0) ? 'W' : 'E'

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 1, 18))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 1, 10))

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = Math.max(10, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100))
    const yPct = Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100))
    setPinOffset({ x: xPct, y: yPct })

    if (onCoordinateChange) {
      // Reposition marker relative to Kozhikode, Kerala center
      const baseLat = latitude ? parseFloat(latitude) : 11.2588
      const baseLng = longitude ? parseFloat(longitude) : 75.7804
      const newLat = (baseLat + (50 - yPct) * 0.001).toFixed(6)
      const newLng = (baseLng + (xPct - 50) * 0.001).toFixed(6)
      onCoordinateChange(newLat, newLng)
    }
  }

  return (
    <div
      onClick={handleMapClick}
      className="relative w-full h-[340px] sm:h-[400px] bg-[#EBF0F3] rounded-xl overflow-hidden border border-[#E5E7EB] shadow-inner select-none cursor-crosshair group"
      title="Click anywhere to reposition marker"
    >
      {/* Vector Map Background Canvas (Styled SVG roads, blocks & rivers) */}
      <svg
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
        style={{ transform: `scale(${1 + (zoomLevel - 14) * 0.1})` }}
        viewBox="0 0 600 400"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="city-blocks" width="60" height="60" patternUnits="userSpaceOnUse">
            <rect width="52" height="52" rx="4" fill="#F4F6F8" />
            <rect x="6" y="6" width="18" height="18" rx="2" fill="#EAEFF2" />
            <rect x="28" y="6" width="18" height="18" rx="2" fill="#EAEFF2" />
            <rect x="6" y="28" width="18" height="18" rx="2" fill="#EAEFF2" />
            <rect x="28" y="28" width="18" height="18" rx="2" fill="#EAEFF2" />
          </pattern>
        </defs>

        {/* Base Land Fill */}
        <rect width="100%" height="100%" fill="#E9EEF2" />

        {/* Urban Blocks */}
        <rect width="100%" height="100%" fill="url(#city-blocks)" opacity="0.8" />

        {/* Park / Greenery Areas */}
        <path
          d="M 20 40 Q 90 20 140 70 T 180 160 Q 140 210 60 180 Z"
          fill="#D9EAD3"
          opacity="0.75"
        />
        <path
          d="M 440 220 Q 520 190 580 240 T 560 360 Q 480 380 430 310 Z"
          fill="#D9EAD3"
          opacity="0.65"
        />

        {/* Water Stream / Canal */}
        <path
          d="M 0 350 C 180 340, 240 260, 360 270 C 460 280, 520 220, 600 230 L 600 300 C 510 290, 450 350, 340 330 C 220 310, 160 390, 0 400 Z"
          fill="#CFE2FE"
          opacity="0.85"
        />

        {/* Secondary Roads */}
        <g stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="0" y1="90" x2="600" y2="90" />
          <line x1="0" y1="200" x2="600" y2="200" />
          <line x1="0" y1="310" x2="600" y2="310" />
          <line x1="120" y1="0" x2="120" y2="400" />
          <line x1="280" y1="0" x2="280" y2="400" />
          <line x1="460" y1="0" x2="460" y2="400" />
        </g>

        {/* Major Highways / Arterials */}
        <path
          d="M 0 140 Q 200 130 300 200 T 600 220"
          fill="none"
          stroke="#FFE899"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 0 140 Q 200 130 300 200 T 600 220"
          fill="none"
          stroke="#FCD34D"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <path
          d="M 220 0 Q 230 180 330 250 T 360 400"
          fill="none"
          stroke="#FFE899"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 220 0 Q 230 180 330 250 T 360 400"
          fill="none"
          stroke="#FCD34D"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      {/* Center Location Pin Marker (matching screenshot red marker) */}
      <div
        className="absolute -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-200"
        style={{ left: `${pinOffset.x}%`, top: `${pinOffset.y}%` }}
      >
        {/* Soft pulse ring */}
        <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-red-500/25 animate-ping pointer-events-none" />
        <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-600/30" />

        {/* Pin Icon */}
        <div className="relative flex flex-col items-center drop-shadow-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8 text-[#EF4444]"
          >
            <path
              fillRule="evenodd"
              d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Floating Zoom Controls (Top-Right) */}
      <div
        className="absolute top-3 right-3 flex flex-col bg-white rounded-lg shadow-md border border-[#E5E7EB] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors border-b border-[#E5E7EB] font-bold text-sm"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors font-bold text-sm"
          title="Zoom out"
          aria-label="Zoom out"
        >
          &minus;
        </button>
      </div>

      {/* Floating Coordinates Badge (Bottom-Left) */}
      <div
        className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-xs border border-[#E5E7EB] text-[11px] font-mono text-gray-700 pointer-events-none"
      >
        <span>
          {displayLat}&deg; {latDir}, {displayLng}&deg; {lngDir}
          {!hasCustomCoords && ' · Kozhikode, Kerala'}
        </span>
      </div>

      {/* Interactive Helper Hint */}
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none">
        Click anywhere to reposition marker
      </div>
    </div>
  )
}

