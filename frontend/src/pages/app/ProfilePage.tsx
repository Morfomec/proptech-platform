import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import authService from '../../services/auth.service'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Spinner } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import type { UpdateProfileRequest, UserProfile } from '../../types/auth'
import type { ApiErrorResponse } from '../../types/api'

interface FormState {
  firstName: string
  lastName: string
  phoneNumber: string
  bio: string
}

interface FormErrors {
  firstName?: string
  lastName?: string
  phoneNumber?: string
  bio?: string
}

/**
 * ProfilePage
 * Authenticated user profile view and edit screen.
 * Route: /app/profile (Protected)
 */
export const ProfilePage: React.FC = () => {
  const { user: authUser, logout, refreshProfile } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    bio: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch full profile on mount
  useEffect(() => {
    let isMounted = true

    const fetchProfile = async () => {
      try {
        const response = await authService.getProfile()
        if (isMounted && response.data) {
          const data = response.data
          setProfile(data)
          setForm({
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            phoneNumber: data.phone_number || '',
            bio: data.bio || '',
          })
        }
      } catch (err: unknown) {
        if (isMounted) {
          // If profile fetch fails, fallback to in-memory user data from auth context
          if (authUser) {
            setForm({
              firstName: authUser.first_name || '',
              lastName: authUser.last_name || '',
              phoneNumber: '',
              bio: '',
            })
          }
          if (axios.isAxiosError(err)) {
            const apiError = err.response?.data as ApiErrorResponse | undefined
            setGeneralError(apiError?.message || 'Failed to load profile details.')
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void fetchProfile()

    return () => {
      isMounted = false
    }
  }, [authUser])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const validateForm = (): boolean => {
    const errors: FormErrors = {}

    if (form.firstName.length > 150) {
      errors.firstName = 'First name cannot exceed 150 characters.'
    }
    if (form.lastName.length > 150) {
      errors.lastName = 'Last name cannot exceed 150 characters.'
    }
    if (form.phoneNumber.length > 20) {
      errors.phoneNumber = 'Phone number cannot exceed 20 characters.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSaving) return

    setGeneralError(null)
    setSuccessMessage(null)

    if (!validateForm()) return

    setIsSaving(true)

    // Strictly send only backend-supported editable fields to satisfy serializer validation
    const payload: UpdateProfileRequest = {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      phone_number: form.phoneNumber.trim() || null,
      bio: form.bio.trim() || null,
    }

    try {
      const response = await authService.updateProfile(payload)
      if (response.data) {
        setProfile(response.data)
      }

      // Synchronize in-memory auth provider state
      await refreshProfile()

      setSuccessMessage('Profile updated successfully.')
      addToast({
        title: 'Profile Updated',
        description: 'Your profile changes have been saved.',
        variant: 'success',
      })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as ApiErrorResponse | undefined

        if (errorData?.errors && typeof errorData.errors === 'object') {
          const errorsMap: FormErrors = {}
          const errors = errorData.errors as Record<string, string[]>

          if (errors.first_name?.[0]) errorsMap.firstName = errors.first_name[0]
          if (errors.last_name?.[0]) errorsMap.lastName = errors.last_name[0]
          if (errors.phone_number?.[0]) errorsMap.phoneNumber = errors.phone_number[0]
          if (errors.bio?.[0]) errorsMap.bio = errors.bio[0]

          setFieldErrors(errorsMap)
        }

        setGeneralError(
          errorData?.message || 'Failed to update profile. Please verify your inputs.'
        )
      } else {
        setGeneralError('A network error occurred while updating your profile.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Display values
  const userEmail = profile?.email || authUser?.email || ''
  const isVerified = Boolean(profile?.email_verified_at)
  const isTenant = profile?.is_tenant ?? authUser?.is_tenant ?? false
  const isOwner = profile?.is_owner ?? authUser?.is_owner ?? false
  const isPlatformAdmin = profile?.is_platform_admin ?? authUser?.is_platform_admin ?? false
  const profileImage = profile?.profile_image

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] antialiased">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#408A71] text-white shadow-xs group-hover:bg-[#34745C] transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
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
            <span className="text-xl font-bold tracking-tight text-[#111827]">
              prop<span className="text-[#408A71]">tech</span>
            </span>
          </Link>

          {/* Navigation & Logout */}
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              to="/app/owner/dashboard"
              className="text-xs sm:text-sm font-medium text-gray-600 hover:text-[#111827] transition-colors"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-red-600 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-3xl py-8 px-4 sm:px-6 space-y-6">
        {/* Header Breadcrumb & Title */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#6B7280] mb-1">
              <Link to="/app/owner/dashboard" className="hover:text-[#408A71] transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-[#111827]">Profile</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827]">
              Account Profile
            </h1>
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white p-12 shadow-xs">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" variant="brand" />
              <p className="text-sm text-[#6B7280]">Loading profile details...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Feedback Alerts */}
            {generalError && (
              <Alert
                variant="error"
                title="Update failed"
                className="text-left"
                onClose={() => setGeneralError(null)}
              >
                {generalError}
              </Alert>
            )}

            {successMessage && (
              <Alert
                variant="success"
                title="Changes saved"
                className="text-left"
                onClose={() => setSuccessMessage(null)}
              >
                {successMessage}
              </Alert>
            )}

            {/* Profile Overview Card (Read-Only Identity) */}
            <section className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                {/* Avatar Display */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#408A71] border border-emerald-100 font-bold text-xl">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile avatar"
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span>
                      {(form.firstName[0] || userEmail[0] || 'U').toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#111827]">
                    {form.firstName || form.lastName
                      ? `${form.firstName} ${form.lastName}`.trim()
                      : 'PropTech User'}
                  </h2>
                  <p className="text-sm text-[#6B7280]">{userEmail}</p>

                  {/* Verification & Roles Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* Verification Status */}
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#15803D] border border-emerald-200">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Email Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                        Verification Pending
                      </span>
                    )}

                    {/* Roles */}
                    {isTenant && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#15803D] border border-emerald-200">
                        Tenant
                      </span>
                    )}
                    {isOwner && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                        Property Owner
                      </span>
                    )}
                    {isPlatformAdmin && (
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                        Platform Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Editable Profile Form Card */}
            <section className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs">
              <div className="mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-lg font-bold text-[#111827]">
                  Personal Information
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#6B7280]">
                  Update your display name, contact phone number, and brief biography.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                {/* Name Fields Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <Input
                    label="First Name"
                    type="text"
                    placeholder="Enter your first name"
                    value={form.firstName}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, firstName: e.target.value }))
                      if (fieldErrors.firstName) {
                        setFieldErrors((prev) => ({ ...prev, firstName: undefined }))
                      }
                    }}
                    error={fieldErrors.firstName}
                    disabled={isSaving}
                  />

                  <Input
                    label="Last Name"
                    type="text"
                    placeholder="Enter your last name"
                    value={form.lastName}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, lastName: e.target.value }))
                      if (fieldErrors.lastName) {
                        setFieldErrors((prev) => ({ ...prev, lastName: undefined }))
                      }
                    }}
                    error={fieldErrors.lastName}
                    disabled={isSaving}
                  />
                </div>

                {/* Email Address (Read-Only) */}
                <div>
                  <Input
                    label="Email Address (Permanent)"
                    type="email"
                    value={userEmail}
                    disabled
                    hint="Account email addresses cannot be altered directly."
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phoneNumber}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))
                      if (fieldErrors.phoneNumber) {
                        setFieldErrors((prev) => ({ ...prev, phoneNumber: undefined }))
                      }
                    }}
                    error={fieldErrors.phoneNumber}
                    disabled={isSaving}
                  />
                </div>

                {/* Biography */}
                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor="profile-bio"
                    className="block text-xs sm:text-sm font-medium text-[#111827]"
                  >
                    Biography
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={4}
                    placeholder="Tell other property managers and tenants a little about yourself..."
                    value={form.bio}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, bio: e.target.value }))
                      if (fieldErrors.bio) {
                        setFieldErrors((prev) => ({ ...prev, bio: undefined }))
                      }
                    }}
                    disabled={isSaving}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-sm text-[#111827] outline-none transition-all placeholder:text-[#9CA3AF] hover:border-gray-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:bg-[#F9FAFB] disabled:cursor-not-allowed"
                  />
                  {fieldErrors.bio && (
                    <p className="text-xs text-[#DC2626] font-medium mt-1">
                      {fieldErrors.bio}
                    </p>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <Link to="/app/owner/dashboard">
                    <Button type="button" variant="secondary" size="md">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSaving}
                    loadingText="Saving changes..."
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default ProfilePage

