import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/toast'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
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

interface FormFields {
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirm: string
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  passwordConfirm?: string
}

export const RegisterPage: React.FC = () => {
  const { register, loginWithGoogle } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState<FormFields>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    passwordConfirm: '',
  })

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  const validateForm = (): boolean => {
    const errors: FormErrors = {}
    const trimmedEmail = form.email.trim()
    const trimmedFirstName = form.firstName.trim()
    const trimmedLastName = form.lastName.trim()

    if (!trimmedFirstName) {
      errors.firstName = 'First name is required.'
    }

    if (!trimmedLastName) {
      errors.lastName = 'Last name is required.'
    }

    if (!trimmedEmail) {
      errors.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.'
    }

    if (!form.password) {
      errors.password = 'Password is required.'
    } else if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.'
    }

    if (!form.passwordConfirm) {
      errors.passwordConfirm = 'Please confirm your password.'
    } else if (form.password !== form.passwordConfirm) {
      errors.passwordConfirm = 'Passwords do not match.'
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
      // Strictly mirror backend RegistrationSerializer payload key: `password_confirm`
      await register({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        password_confirm: form.passwordConfirm,
      })

      setRegisteredEmail(form.email.trim().toLowerCase())
      setIsSuccess(true)

      addToast({
        title: 'Account created!',
        description: 'Please check your email to activate your account.',
        variant: 'success',
      })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as ApiErrorResponse | undefined

        if (errorData?.errors && typeof errorData.errors === 'object') {
          const errorsMap: FormErrors = {}
          const errors = errorData.errors as Record<string, string[]>

          if (errors.first_name && errors.first_name[0]) {
            errorsMap.firstName = errors.first_name[0]
          }
          if (errors.last_name && errors.last_name[0]) {
            errorsMap.lastName = errors.last_name[0]
          }
          if (errors.email && errors.email[0]) {
            errorsMap.email = errors.email[0]
          }
          if (errors.password && errors.password[0]) {
            errorsMap.password = errors.password[0]
          }
          if (errors.password_confirm && errors.password_confirm[0]) {
            errorsMap.passwordConfirm = errors.password_confirm[0]
          }
          if (errors.non_field_errors && errors.non_field_errors[0]) {
            setGeneralError(errors.non_field_errors[0])
          }
          setFieldErrors(errorsMap)
        }

        setGeneralError(
          errorData?.message || 'Registration could not be completed. Please verify your details.'
        )
      } else if (err instanceof Error) {
        setGeneralError(err.message)
      } else {
        setGeneralError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSuccess = async (credential: string) => {
    if (isSubmitting || isGoogleSubmitting) return

    setGeneralError(null)
    setIsGoogleSubmitting(true)

    try {
      await loginWithGoogle(credential)

      addToast({
        title: 'Welcome to PropTech!',
        description: 'You have signed in with Google successfully.',
        variant: 'success',
      })

      const state = location.state as LocationState | undefined
      const destination = resolveDestination(state?.from)
      navigate(destination, { replace: true })
    } catch (err: unknown) {
      let errMsg = 'Google registration failed. Please try again.'
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data as ApiErrorResponse
        errMsg = data.message || errMsg
      } else if (err instanceof Error) {
        errMsg = err.message
      }
      setGeneralError(errMsg)
    } finally {
      setIsGoogleSubmitting(false)
    }
  }

  const userIcon = (
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )

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

  // Success Confirmation State: prompt to verify email
  if (isSuccess) {
    return (
      <AuthCard
        title="Check your inbox"
      >
        <div className="py-2 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#408A71] border border-emerald-200">
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
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#111827]">
              Verify your email address
            </h3>
            <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              We&apos;ve sent a verification email to{' '}
              <strong className="text-[#111827]">{registeredEmail}</strong>.
              Click the link in the email to activate your account.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/login"
              state={location.state}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#408A71] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#34745C]"
            >
              Proceed to Sign In
            </Link>
          </div>

          <p className="text-xs text-[#6B7280] pt-2">
            Didn&apos;t receive the email?{' '}
            <Link
              to="/resend-verification"
              className="font-semibold text-[#408A71] hover:underline"
            >
              Resend verification email
            </Link>
          </p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Create Account"
    >
      {/* General Error Banner */}
      {generalError && (
        <Alert
          variant="error"
          title="Registration failed"
          className="mb-5 text-left"
          onClose={() => setGeneralError(null)}
        >
          {generalError}
        </Alert>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3 sm:space-y-3.5 text-left">
        {/* Name fields row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
          <Input
            label="First Name"
            type="text"
            autoComplete="given-name"
            placeholder="John"
            value={form.firstName}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, firstName: e.target.value }))
              if (fieldErrors.firstName) {
                setFieldErrors((prev) => ({ ...prev, firstName: undefined }))
              }
            }}
            error={fieldErrors.firstName}
            leftElement={userIcon}
            disabled={isSubmitting}
            required
          />

          <Input
            label="Last Name"
            type="text"
            autoComplete="family-name"
            placeholder="Doe"
            value={form.lastName}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, lastName: e.target.value }))
              if (fieldErrors.lastName) {
                setFieldErrors((prev) => ({ ...prev, lastName: undefined }))
              }
            }}
            error={fieldErrors.lastName}
            leftElement={userIcon}
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Email Address */}
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={form.email}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, email: e.target.value }))
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
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, password: e.target.value }))
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }))
              }
            }}
            error={fieldErrors.password}
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Confirm Password */}
        <div>
          <PasswordInput
            label="Confirm Password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.passwordConfirm}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, passwordConfirm: e.target.value }))
              if (fieldErrors.passwordConfirm) {
                setFieldErrors((prev) => ({ ...prev, passwordConfirm: undefined }))
              }
            }}
            error={fieldErrors.passwordConfirm}
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Submit Button */}
        <div className="pt-1.5">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            loadingText="Creating account..."
          >
            Create Account
          </Button>
        </div>
      </form>

      {/* Social Divider & Google Button */}
      <AuthSocialDivider
        onGoogleSuccess={handleGoogleSuccess}
        isLoading={isGoogleSubmitting}
        disabled={isSubmitting}
        buttonText="signup_with"
      />

      {/* Switch to Login */}
      <div className="mt-4 text-center text-xs sm:text-sm text-[#6B7280]">
        Already have an account?{' '}
        <Link
          to="/login"
          state={location.state}
          className="font-semibold text-[#408A71] hover:text-[#34745C] hover:underline transition-colors"
        >
          Sign in
        </Link>
      </div>
    </AuthCard>
  )
}

export default RegisterPage
