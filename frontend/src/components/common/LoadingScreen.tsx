import React from 'react'
import { Spinner } from '../ui/spinner'

export interface LoadingScreenProps {
  /**
   * Accessible message displayed alongside the spinner.
   */
  message?: string
}

/**
 * LoadingScreen
 * Full-page branded loading screen used during authentication session initialization.
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Verifying session...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen w-full flex-col items-center justify-center bg-[#F9FAFB] p-4 text-[#111827]"
    >
      <Spinner size="lg" variant="brand" label={message} />
      {message && (
        <p className="mt-4 text-sm font-medium text-[#4B5563]">
          {message}
        </p>
      )}
    </div>
  )
}

export default LoadingScreen

