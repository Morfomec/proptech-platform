import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import authService from '../../services/auth.service'
import AuthCard from '../../components/auth/AuthCard'
import PasswordInput from '../../components/auth/PasswordInput'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import type { ApiErrorResponse } from '../../types/api'

interface PasswordErrors {
  newPassword?: string
  confirmPassword?: string
}

/**
 * ResetPasswordPage
 * Allows users to set a new password via password recovery token.
 * Link structure: /reset-password?uid={uid}&token={token}
 * Dispatches: POST /api/v1/auth/password-reset/confirm/ with { uid, token, new_password, confirm_password }
 */
export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid')
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<PasswordErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // 1. Missing query parameters guard
  if (!uid || !token) {
    return (
      <AuthCard
        title="Invalid Reset Link"
      >
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
              This password reset link is invalid, incomplete, or has expired. Please request a new recovery link.
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Link to="/forgot-password" className="block w-full">
              <Button variant="primary" size="lg" fullWidth>
                Request New Reset Link
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
      </AuthCard>
    )
  }

  // 2. Success state
  if (isSuccess) {
    return (
      <AuthCard
        title="Password Reset Complete"
      >
        <div className="flex flex-col items-center text-center space-y-5 py-2">
          {/* Success Checkmark Badge */}
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
              Your password has been reset successfully. You can now sign in to your PropTech account with your new credentials.
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
      </AuthCard>
    )
  }

  const validateForm = (): boolean => {
    const errors: PasswordErrors = {}

    if (!newPassword) {
      errors.newPassword = 'New password is required.'
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long.'
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.'
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setGeneralError(null)
    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      await authService.confirmPasswordReset({
        uid: uid.trim(),
        token: token.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setIsSuccess(true)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as ApiErrorResponse | undefined

        if (errorData?.errors && typeof errorData.errors === 'object') {
          const errorsMap: PasswordErrors = {}
          const errors = errorData.errors as Record<string, string[]>

          if (errors.new_password && errors.new_password[0]) {
            errorsMap.newPassword = errors.new_password[0]
          }
          if (errors.confirm_password && errors.confirm_password[0]) {
            errorsMap.confirmPassword = errors.confirm_password[0]
          }
          if (errors.non_field_errors && errors.non_field_errors[0]) {
            setGeneralError(errors.non_field_errors[0])
          }

          setFieldErrors(errorsMap)
        }

        setGeneralError(
          (prev) =>
            prev ||
            errorData?.message ||
            'Failed to reset password. The link may have expired or is invalid.'
        )
      } else {
        setGeneralError('A network error occurred. Please check your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Set New Password"
    >
      {/* General Error Banner */}
      {generalError && (
        <Alert
          variant="error"
          title="Reset failed"
          className="mb-5 text-left"
          onClose={() => setGeneralError(null)}
        >
          {generalError}
        </Alert>
      )}

      {/* Reset Password Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-4.5 text-left">
        {/* New Password */}
        <div>
          <PasswordInput
            label="New Password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              if (fieldErrors.newPassword) {
                setFieldErrors((prev) => ({ ...prev, newPassword: undefined }))
              }
            }}
            error={fieldErrors.newPassword}
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Confirm Password */}
        <div>
          <PasswordInput
            label="Confirm New Password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (fieldErrors.confirmPassword) {
                setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
              }
            }}
            error={fieldErrors.confirmPassword}
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Updating password..."
          >
            Reset Password
          </Button>
        </div>
      </form>

      {/* Return to sign in link */}
      <div className="mt-5 text-center text-xs sm:text-sm text-[#6B7280]">
        Remember your password?{' '}
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

export default ResetPasswordPage
