import React, { useState } from 'react'
import { Input } from '../../ui/input'
import { Button } from '../../ui/button'

export interface Step2FormData {
  address_line_1: string
  address_line_2: string
  landmark: string
  locality: string
  city: string
  district: string
  state: string
  pin_code: string
  country_code: string
  latitude: string
  longitude: string
}

export interface Step2Props {
  formData: Step2FormData
  errors: Record<string, string>
  onChange: (field: keyof Step2FormData, value: string) => void
}

export const Step2Location: React.FC<Step2Props> = ({ formData, errors, onChange }) => {
  const [geoLocating, setGeoLocating] = useState(false)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)

  const handleFetchCurrentPosition = () => {
    if (!navigator.geolocation) {
      setGeoMsg('Geolocation is not supported by your browser.')
      return
    }

    setGeoLocating(true)
    setGeoMsg(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange('latitude', pos.coords.latitude.toFixed(6))
        onChange('longitude', pos.coords.longitude.toFixed(6))
        setGeoLocating(false)
        setGeoMsg('Coordinates populated successfully.')
      },
      (err) => {
        setGeoLocating(false)
        setGeoMsg(`Could not fetch location: ${err.message}`)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Location Details</h2>
        <p className="text-xs text-[#6B7280] mt-0.5">
          Enter the full physical address and geographical coordinates for the property.
        </p>
      </div>

      {/* Street Address */}
      <div className="space-y-4">
        <Input
          label="Address Line 1"
          placeholder="Building name, door/flat number, street name"
          value={formData.address_line_1}
          onChange={(e) => onChange('address_line_1', e.target.value)}
          error={errors.address_line_1}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Address Line 2"
            placeholder="Floor, wing, tower, or suite (optional)"
            value={formData.address_line_2}
            onChange={(e) => onChange('address_line_2', e.target.value)}
            error={errors.address_line_2}
          />

          <Input
            label="Landmark"
            placeholder="Nearby landmark, park, or metro station"
            value={formData.landmark}
            onChange={(e) => onChange('landmark', e.target.value)}
            error={errors.landmark}
          />
        </div>
      </div>

      {/* Area & City Specifics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Locality / Neighborhood"
          placeholder="e.g. Koramangala 4th Block"
          value={formData.locality}
          onChange={(e) => onChange('locality', e.target.value)}
          error={errors.locality}
          required
        />

        <Input
          label="City"
          placeholder="e.g. Bengaluru"
          value={formData.city}
          onChange={(e) => onChange('city', e.target.value)}
          error={errors.city}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="District"
          placeholder="e.g. Bengaluru Urban"
          value={formData.district}
          onChange={(e) => onChange('district', e.target.value)}
          error={errors.district}
          required
        />

        <Input
          label="State"
          placeholder="e.g. Karnataka"
          value={formData.state}
          onChange={(e) => onChange('state', e.target.value)}
          error={errors.state}
          required
        />

        <Input
          label="PIN Code"
          placeholder="6-digit PIN code"
          maxLength={6}
          value={formData.pin_code}
          onChange={(e) => onChange('pin_code', e.target.value.replace(/\D/g, ''))}
          error={errors.pin_code}
          hint="6 digits for Indian postal codes."
          required
        />
      </div>

      {/* Geographic Coordinates */}
      <div className="rounded-xl border border-[#E5E7EB] bg-gray-50/70 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
              Geographic Coordinates (GPS)
            </h3>
            <p className="text-[11px] text-[#6B7280]">
              Optional for draft status. Required before public listing activation.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleFetchCurrentPosition}
            isLoading={geoLocating}
            leftIcon={
              <svg
                className="w-3.5 h-3.5 text-[#408A71]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          >
            Detect My Location
          </Button>
        </div>

        {geoMsg && (
          <div className="text-[11px] text-[#408A71] font-medium bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200/50">
            {geoMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Latitude"
            placeholder="e.g. 12.9352"
            value={formData.latitude}
            onChange={(e) => onChange('latitude', e.target.value)}
            error={errors.latitude}
            hint="Valid range: -90.00 to 90.00 degrees."
          />

          <Input
            label="Longitude"
            placeholder="e.g. 77.6245"
            value={formData.longitude}
            onChange={(e) => onChange('longitude', e.target.value)}
            error={errors.longitude}
            hint="Valid range: -180.00 to 180.00 degrees."
          />
        </div>
      </div>
    </div>
  )
}

export default Step2Location

