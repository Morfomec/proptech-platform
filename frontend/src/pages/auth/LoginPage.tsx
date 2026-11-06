import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/toast'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Alert } from '../../components/ui/alert'
import AuthCard from '../../components/auth/AuthCard'
import PasswordInput from '../../components/auth/PasswordInput'
import AuthSocialDivider from '../../components/auth/AuthSocialDivider'
import type { ApiErrorResponse } from '../../types/api'

interface LocationState {
  from?:
    | string
    | {
        pathname?: string
        search?: string
        hash?: string
      }
}

function resolveDestination(from: LocationState['from']): string {
  if (typeof from === 'string' && from.startsWith('/')) {
    return from
  }
  if (
    typeof from === 'object' &&
    from !== null &&
    typeof from.pathname === 'string' &&
    from.pathname.startsWith('/')
  ) {
    return `${from.pathname}${from.search || ''}${from.hash || ''}`
  }
  return '/'
}

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isUnverified, setIsUnverified] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {}
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      errors.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.'
    }

    if (!password) {
      errors.password = 'Password is required.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setGeneralError(null)
    setIsUnverified(false)

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
      })

      addToast({
        title: 'Welcome back!',
        description: 'You have signed in successfully.',
        variant: 'success',
      })

      // Safely resolve the intended destination (only local paths, preventing open redirects)
      const state = location.state as LocationState | undefined
      const destination = resolveDestination(state?.from)

      navigate(destination, { replace: true })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as ApiErrorResponse | undefined

        if (errorData?.errors && typeof errorData.errors === 'object') {
          const errorsMap: { email?: string; password?: string } = {}
          const errors = errorData.errors as Record<string, string[]>

          if (errors.email && errors.email[0]) {
            errorsMap.email = errors.email[0]
          }
          if (errors.password && errors.password[0]) {
            errorsMap.password = errors.password[0]
          }
          if (errors.non_field_errors && errors.non_field_errors[0]) {
            setGeneralError(errors.non_field_errors[0])
          }
          setFieldErrors(errorsMap)
        }

        const message = errorData?.message || 'Invalid email or password.'
        setGeneralError(message)

        if (message.toLowerCase().includes('verify your email')) {
          setIsUnverified(true)
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message)
      } else {
        setGeneralError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleClick = () => {
    addToast({
      title: 'Google Sign-In',
      description: 'Google authentication will be available in an upcoming update.',
      variant: 'info',
    })
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
      className="text-[#9CA3AF]"
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Please enter your details to sign in."
    >
      {/* General Error Banner */}
      {generalError && (
        <Alert
          variant="error"
          title="Sign in failed"
          className="mb-5 text-left"
          onClose={() => setGeneralError(null)}
        >
          <p>{generalError}</p>
          {isUnverified && (
            <div className="mt-2">
              <Link
                to="/resend-verification"
                className="font-semibold underline hover:text-red-900"
              >
                Resend verification email &rarr;
              </Link>
            </div>
          )}
        </Alert>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5 sm:space-y-4 text-left">
        {/* Email Address */}
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (fieldErrors.email) {
              setFieldErrors((prev) => ({ ...prev, email: undefined }))
            }
          }}
          error={fieldErrors.email}
          leftElement={mailIcon}
          disabled={isSubmitting}
          required
        />

        {/* Password */}
        <div>
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }))
              }
            }}
            error={fieldErrors.password}
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Remember me & Forgot password row */}
        <div className="flex items-center justify-between pt-0.5">
          <Checkbox
            label={<span className="text-xs sm:text-sm text-[#4B5563]">Remember me</span>}
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isSubmitting}
          />

          <Link
            to="/forgot-password"
            className="text-xs sm:text-sm font-medium text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <div className="pt-1.5">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Signing in..."
          >
            Sign in
          </Button>
        </div>
      </form>

      {/* Social Divider & Google Button */}
      <AuthSocialDivider onGoogleClick={handleGoogleClick} />

      {/* Switch to Registration */}
      <div className="mt-4 text-center text-xs sm:text-sm text-[#6B7280]">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          state={location.state}
          className="font-semibold text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
        >
          Sign up
        </Link>
      </div>
    </AuthCard>
  )
}

export default LoginPage
