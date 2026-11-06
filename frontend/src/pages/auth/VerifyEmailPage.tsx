import React, { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import authService from '../../services/auth.service'
import AuthCard from '../../components/auth/AuthCard'
import { Button } from '../../components/ui/button'
import { Spinner } from '../../components/ui/spinner'
import type { ApiErrorResponse } from '../../types/api'

type VerificationStatus = 'loading' | 'success' | 'error' | 'missing_params'

/**
 * VerifyEmailPage
 * Handles automatic email address verification via activation token link.
 * Link structure: /verify-email?uid={uid}&token={token}
 * Dispatches: POST /api/v1/auth/verify-email/ with { user_id: uid, token }
 */
export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid')
  const token = searchParams.get('token')
  const isMissingParams = !uid || !token

  const [status, setStatus] = useState<VerificationStatus>(() =>
    isMissingParams ? 'missing_params' : 'loading'
  )
  const [errorMessage, setErrorMessage] = useState<string>('')
  const verificationAttempted = useRef<boolean>(false)

  useEffect(() => {
    // If required parameters are missing or verification has already run, do not execute
    if (isMissingParams || verificationAttempted.current) return

    verificationAttempted.current = true

    const executeVerification = async () => {
      try {
        await authService.verifyEmail({
          user_id: uid.trim(),
          token: token.trim(),
        })
        setStatus('success')
      } catch (err: unknown) {
        setStatus('error')
        if (axios.isAxiosError(err)) {
          const apiError = err.response?.data as ApiErrorResponse | undefined
          setErrorMessage(
            apiError?.message ||
              'The verification link is invalid, expired, or has already been used.'
          )
        } else {
          setErrorMessage('An unexpected error occurred while verifying your email.')
        }
      }
    }

    void executeVerification()
  }, [uid, token, isMissingParams])

  return (
    <AuthCard
      title={
        status === 'loading'
          ? 'Verifying Email'
          : status === 'success'
          ? 'Email Verified'
          : status === 'missing_params'
          ? 'Invalid Link'
          : 'Verification Failed'
      }
    >
      {/* 1. Loading State */}
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
          <Spinner size="lg" variant="brand" />
          <div>
            <h3 className="text-base font-semibold text-[#111827]">
              Validating your security token
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[#6B7280]">
              Please wait while we activate your account...
            </p>
          </div>
        </div>
      )}

      {/* 2. Success State */}
      {status === 'success' && (
        <div className="flex flex-col items-center text-center space-y-5 py-2">
          {/* Success Check Badge */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF5] text-[#15803D] ring-8 ring-[#ECFDF5]/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed">
              Your email address has been successfully verified. You can now access all features of the PropTech platform.
            </p>
          </div>

          <div className="w-full pt-2">
            <Link to="/login" className="block w-full">
              <Button variant="primary" size="lg" fullWidth>
                Proceed to Sign In
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 3. Missing Parameters State */}
      {status === 'missing_params' && (
        <div className="flex flex-col items-center text-center space-y-5 py-2">
          {/* Warning Badge */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFFBEB] text-[#D97706] ring-8 ring-[#FFFBEB]/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed">
              This verification link is incomplete or missing required security parameters. Please verify you opened the full link from your email.
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Link to="/resend-verification" className="block w-full">
              <Button variant="primary" size="lg" fullWidth>
                Resend Verification Email
              </Button>
            </Link>
            <div className="text-center">
              <Link
                to="/login"
                className="text-xs sm:text-sm font-medium text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4. Verification Failed / Expired State */}
      {status === 'error' && (
        <div className="flex flex-col items-center text-center space-y-5 py-2">
          {/* Error Badge */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626] ring-8 ring-[#FEF2F2]/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed">
              {errorMessage ||
                'The verification link is invalid, expired, or has already been used.'}
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Link to="/resend-verification" className="block w-full">
              <Button variant="primary" size="lg" fullWidth>
                Request New Verification Link
              </Button>
            </Link>
            <div className="text-center">
              <Link
                to="/login"
                className="text-xs sm:text-sm font-medium text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      )}
    </AuthCard>
  )
}

export default VerifyEmailPage
