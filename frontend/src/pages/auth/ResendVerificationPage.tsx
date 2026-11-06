import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import authService from '../../services/auth.service'
import AuthCard from '../../components/auth/AuthCard'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import type { ApiErrorResponse } from '../../types/api'

/**
 * ResendVerificationPage
 * Allows users to request a new account activation email.
 * Dispatches: POST /api/v1/auth/resend-email-verification/ with { email }
 */
export const ResendVerificationPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const validateForm = (): boolean => {
    const trimmed = email.trim()
    if (!trimmed) {
      setEmailError('Email address is required.')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.')
      return false
    }
    setEmailError(undefined)
    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setGeneralError(null)
    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      await authService.resendVerificationEmail({
        email: email.trim().toLowerCase(),
      })
      setSubmittedEmail(email.trim().toLowerCase())
      setIsSuccess(true)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as ApiErrorResponse | undefined
        setGeneralError(
          errorData?.message ||
            'Unable to process your request at this time. Please try again later.'
        )
      } else {
        setGeneralError('A network error occurred. Please check your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const mailIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )

  // Success view (generic response preventing account enumeration)
  if (isSuccess) {
    return (
      <AuthCard
        title="Check Your Inbox"
        subtitle="Verification instructions dispatched."
      >
        <div className="flex flex-col items-center text-center space-y-5 py-2">
          {/* Sent Mail Icon Badge */}
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
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed">
              If an eligible account exists for{' '}
              <strong className="text-[#111827]">{submittedEmail}</strong>, a new verification link has been sent. Please check your inbox and spam folder.
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Link to="/login" className="block w-full">
              <Button variant="primary" size="lg" fullWidth>
                Return to Sign In
              </Button>
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsSuccess(false)
                setEmail('')
              }}
              className="text-xs sm:text-sm font-medium text-[#408A71] hover:text-[#34745C] hover:underline cursor-pointer transition-colors"
            >
              Need to use a different email?
            </button>
          </div>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Resend Verification"
      subtitle="Enter your email address to receive a new account activation link."
    >
      {/* General Error Banner */}
      {generalError && (
        <Alert
          variant="error"
          title="Request failed"
          className="mb-5 text-left"
          onClose={() => setGeneralError(null)}
        >
          {generalError}
        </Alert>
      )}

      {/* Resend Verification Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-4.5 text-left">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (emailError) setEmailError(undefined)
          }}
          error={emailError}
          leftElement={mailIcon}
          disabled={isSubmitting}
          required
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Sending link..."
          >
            Resend Verification Link
          </Button>
        </div>
      </form>

      {/* Return to login link */}
      <div className="mt-5 text-center text-xs sm:text-sm text-[#6B7280]">
        Remembered your credentials?{' '}
        <Link
          to="/login"
          className="font-semibold text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
        >
          Sign in
        </Link>
      </div>
    </AuthCard>
  )
}

export default ResendVerificationPage
