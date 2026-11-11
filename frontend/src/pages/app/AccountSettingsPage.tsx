import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../hooks/useAuth'
import authService from '../../services/auth.service'
import { Alert, Badge, Button, Input, Skeleton } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { getMediaUrl } from '../../utils/imageUrl'
import { formatDate } from '../../utils/application'
import type {
  ChangePasswordRequest,
  UpdateProfileRequest,
  UserProfile,
} from '../../types/auth'
import type { ApiErrorResponse } from '../../types/api'

type SettingsSection = 'personal' | 'security' | 'notifications' | 'preferences'

interface ProfileFormState {
  firstName: string
  lastName: string
  phoneNumber: string
  bio: string
}

interface ProfileFormErrors {
  firstName?: string
  lastName?: string
  phoneNumber?: string
  bio?: string
}

interface PasswordFormState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface PasswordFormErrors {
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

const SECTION_ITEMS: Array<{
  id: SettingsSection
  label: string
  icon: React.ReactNode
}> = [
  {
    id: 'personal',
    label: 'Personal Information',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    ),
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.9">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

function toFormState(data: UserProfile | null, fallbackFirstName = '', fallbackLastName = ''): ProfileFormState {
  return {
    firstName: data?.first_name ?? fallbackFirstName,
    lastName: data?.last_name ?? fallbackLastName,
    phoneNumber: data?.phone_number ?? '',
    bio: data?.bio ?? '',
  }
}

/**
 * AccountSettingsPage
 * Single shared account-level Settings experience rendered identically inside
 * both OwnerWorkspaceLayout (/app/owner/settings) and TenantWorkspaceLayout
 * (/app/tenant/settings). Uses live accounts APIs with no workspace duplication.
 */
export const AccountSettingsPage: React.FC = () => {
  const { user: authUser, refreshProfile } = useAuth()
  const { addToast } = useToast()

  const [activeSection, setActiveSection] = useState<SettingsSection>('personal')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Personal Information state
  const [form, setForm] = useState<ProfileFormState>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    bio: '',
  })
  const [fieldErrors, setFieldErrors] = useState<ProfileFormErrors>({})
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false)

  // Security (Change Password) state
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordErrors, setPasswordErrors] = useState<PasswordFormErrors>({})
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false)

  const fetchAccountProfile = async () => {
    setLoadError(null)
    setIsLoading(true)
    try {
      const response = await authService.getProfile()
      if (response.data) {
        setProfile(response.data)
        setForm(toFormState(response.data))
      }
    } catch (err: unknown) {
      if (authUser) {
        setForm(toFormState(null, authUser.first_name || '', authUser.last_name || ''))
      }
      if (axios.isAxiosError(err)) {
        const apiError = err.response?.data as ApiErrorResponse | undefined
        setLoadError(apiError?.message || 'Failed to load account settings.')
      } else {
        setLoadError('Failed to load account settings.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const response = await authService.getProfile()
        if (isMounted && response.data) {
          setProfile(response.data)
          setForm(toFormState(response.data))
        }
      } catch (err: unknown) {
        if (!isMounted) return
        if (authUser) {
          setForm(toFormState(null, authUser.first_name || '', authUser.last_name || ''))
        }
        if (axios.isAxiosError(err)) {
          const apiError = err.response?.data as ApiErrorResponse | undefined
          setLoadError(apiError?.message || 'Failed to load account settings.')
        } else {
          setLoadError('Failed to load account settings.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void init()

    return () => {
      isMounted = false
    }
    // Load full profile once on mount; authUser changes from refreshProfile synchronize via setProfile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isProfileDirty = useMemo(() => {
    const saved = toFormState(
      profile,
      authUser?.first_name || '',
      authUser?.last_name || ''
    )
    return (
      form.firstName !== saved.firstName ||
      form.lastName !== saved.lastName ||
      form.phoneNumber !== saved.phoneNumber ||
      form.bio !== saved.bio
    )
  }, [form, profile, authUser])

  const validateProfileForm = (): boolean => {
    const errors: ProfileFormErrors = {}

    if (form.firstName.trim().length > 150) {
      errors.firstName = 'First name cannot exceed 150 characters.'
    }
    if (form.lastName.trim().length > 150) {
      errors.lastName = 'Last name cannot exceed 150 characters.'
    }
    if (form.phoneNumber.trim().length > 20) {
      errors.phoneNumber = 'Phone number cannot exceed 20 characters.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleProfileCancel = () => {
    setForm(
      toFormState(profile, authUser?.first_name || '', authUser?.last_name || '')
    )
    setFieldErrors({})
    setProfileError(null)
    setProfileSuccess(null)
  }

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSavingProfile) return

    setProfileError(null)
    setProfileSuccess(null)

    if (!validateProfileForm()) return

    setIsSavingProfile(true)

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
        setForm(toFormState(response.data))
      }

      await refreshProfile()

      setProfileSuccess('Your personal information has been updated.')
      addToast({
        title: 'Settings Saved',
        description: 'Your personal information has been updated across all workspaces.',
        variant: 'success',
      })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as ApiErrorResponse | undefined

        if (errorData?.errors && typeof errorData.errors === 'object') {
          const errorsMap: ProfileFormErrors = {}
          const errors = errorData.errors as Record<string, string[]>

          if (errors.first_name?.[0]) errorsMap.firstName = errors.first_name[0]
          if (errors.last_name?.[0]) errorsMap.lastName = errors.last_name[0]
          if (errors.phone_number?.[0]) errorsMap.phoneNumber = errors.phone_number[0]
          if (errors.bio?.[0]) errorsMap.bio = errors.bio[0]

          setFieldErrors(errorsMap)
        }

        setProfileError(
          errorData?.message || 'Failed to update profile. Please verify your inputs.'
        )
      } else {
        setProfileError('A network error occurred while saving your changes.')
      }
    } finally {
      setIsSavingProfile(false)
    }
  }

  const validatePasswordForm = (): boolean => {
    const errors: PasswordFormErrors = {}

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Enter your current password.'
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'Enter a new password.'
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters long.'
    }
    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Confirm your new password.'
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isChangingPassword) return

    setSecurityError(null)
    setSecuritySuccess(null)

    if (!validatePasswordForm()) return

    setIsChangingPassword(true)

    const payload: ChangePasswordRequest = {
      current_password: passwordForm.currentPassword,
      new_password: passwordForm.newPassword,
      confirm_password: passwordForm.confirmPassword,
    }

    try {
      await authService.changePassword(payload)
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setPasswordErrors({})
      setSecuritySuccess(
        'Your password has been updated. All previous sessions have been revoked.'
      )
      addToast({
        title: 'Password Updated',
        description: 'Your account password was changed successfully.',
        variant: 'success',
      })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data as ApiErrorResponse | undefined

        if (errorData?.errors && typeof errorData.errors === 'object') {
          const errorsMap: PasswordFormErrors = {}
          const errors = errorData.errors as Record<string, string[]>

          if (errors.current_password?.[0]) {
            errorsMap.currentPassword = errors.current_password[0]
          }
          if (errors.new_password?.[0]) {
            errorsMap.newPassword = errors.new_password[0]
          }
          if (errors.confirm_password?.[0]) {
            errorsMap.confirmPassword = errors.confirm_password[0]
          }

          setPasswordErrors(errorsMap)
        }

        setSecurityError(
          errorData?.message || 'Unable to change password. Please verify your details.'
        )
      } else {
        setSecurityError('A network error occurred while updating your password.')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Account-level identity fields derived strictly from backend user/profile state
  const userEmail = profile?.email || authUser?.email || ''
  const isVerified = Boolean(profile?.email_verified_at)
  const verifiedDateText = profile?.email_verified_at
    ? formatDate(profile.email_verified_at)
    : null
  const isTenant = profile?.is_tenant ?? authUser?.is_tenant ?? false
  const isOwner = profile?.is_owner ?? authUser?.is_owner ?? false
  const isPlatformAdmin = profile?.is_platform_admin ?? authUser?.is_platform_admin ?? false
  const hasUsablePassword = profile?.has_usable_password ?? null
  const authProviders = profile?.auth_providers ?? []
  const usesGoogleAuth = authProviders.includes('google')
  const profileImageUrl = profile?.profile_image
    ? getMediaUrl(profile.profile_image)
    : null

  const displayName =
    `${form.firstName} ${form.lastName}`.trim() ||
    `${profile?.first_name || authUser?.first_name || ''} ${
      profile?.last_name || authUser?.last_name || ''
    }`.trim() ||
    userEmail ||
    'Account User'

  const avatarInitials = (() => {
    const first = (form.firstName || profile?.first_name || authUser?.first_name || '').trim()
    const last = (form.lastName || profile?.last_name || authUser?.last_name || '').trim()
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
    if (first) return first.slice(0, 2).toUpperCase()
    if (userEmail) return userEmail[0].toUpperCase()
    return 'U'
  })()

  return (
    <div className="space-y-4 pb-8">
      {/* A. Page Heading */}
      <div className="border-b border-[#E5E7EB] pb-3.5">
        <h1 className="text-xl font-medium tracking-tight text-[#111827] mb-0">
          Settings
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-normal text-[#6B7280]">
          Manage your shared personal information, security, and account preferences across all workspaces.
        </p>
      </div>

      {/* Fetch Error Banner */}
      {loadError && (
        <Alert variant="error" title="Unable to load complete account details">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <span>{loadError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchAccountProfile()}
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Skeleton className="lg:col-span-3 h-48 rounded-2xl" />
            <Skeleton className="lg:col-span-9 h-80 rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* B. Account Profile Summary Card */}
          <section
            aria-label="Account Summary"
            className="rounded-2xl border border-[#E5E7EB] bg-white p-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Avatar / Initials */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#ECF5F2] text-[#408A71] border border-[#DCE8E2] font-medium text-lg overflow-hidden">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{avatarInitials}</span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-medium text-[#111827] truncate mb-0">
                    {displayName}
                  </h2>
                  {isVerified ? (
                    <Badge variant="success" size="sm">
                      Email Verified
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Verification Pending
                    </Badge>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-[#6B7280] truncate">{userEmail}</p>

                {/* Account Roles (explicitly distinct from active workspace) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs font-normal text-[#6B7280] mr-1">
                    Account Roles:
                  </span>
                  {isTenant && (
                    <Badge variant="neutral" size="sm">
                      Tenant
                    </Badge>
                  )}
                  {isOwner && (
                    <Badge variant="info" size="sm">
                      Property Owner
                    </Badge>
                  )}
                  {isPlatformAdmin && (
                    <Badge variant="neutral" size="sm">
                      Platform Admin
                    </Badge>
                  )}
                  {!isTenant && !isOwner && !isPlatformAdmin && (
                    <span className="text-xs text-[#6B7280]">Standard Account</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* C & D. Two-Column Desktop Settings Navigation + Active Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Settings Section Navigation */}
            <aside
              aria-label="Settings Sections"
              className="lg:col-span-3 rounded-2xl border border-[#E5E7EB] bg-white p-2"
            >
              <nav className="flex lg:flex-col gap-1 overflow-x-auto">
                {SECTION_ITEMS.map((section) => {
                  const isActive = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm whitespace-nowrap text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#ECF5F2] text-[#408A71] font-medium'
                          : 'text-[#4B5563] hover:bg-gray-50 hover:text-[#111827] font-normal'
                      }`}
                    >
                      <span className={isActive ? 'text-[#408A71]' : 'text-[#6B7280]'}>
                        {section.icon}
                      </span>
                      <span>{section.label}</span>
                    </button>
                  )
                })}
              </nav>
            </aside>

            {/* Settings Content Panel */}
            <div className="lg:col-span-9 min-w-0">
              {/* 1. Personal Information */}
              {activeSection === 'personal' && (
                <section
                  aria-label="Personal Information"
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-5"
                >
                  <div className="border-b border-[#F3F4F6] pb-3.5">
                    <h2 className="text-base font-medium text-[#111827] mb-0">
                      Personal Information
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm font-normal text-[#6B7280]">
                      Update your shared account name, phone number, and biography.
                    </p>
                  </div>

                  {profileError && (
                    <Alert
                      variant="error"
                      title="Could not save personal information"
                      onClose={() => setProfileError(null)}
                    >
                      {profileError}
                    </Alert>
                  )}

                  {profileSuccess && (
                    <Alert
                      variant="success"
                      title="Changes saved"
                      onClose={() => setProfileSuccess(null)}
                    >
                      {profileSuccess}
                    </Alert>
                  )}

                  <form onSubmit={handleProfileSubmit} noValidate className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        disabled={isSavingProfile}
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
                        disabled={isSavingProfile}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Permanent Email Address"
                        type="email"
                        value={userEmail}
                        disabled
                        hint="Account email addresses cannot be changed directly."
                      />

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
                        disabled={isSavingProfile}
                        hint="Used on rental inquiries and tenancy communications."
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label
                        htmlFor="account-bio"
                        className="block text-xs sm:text-sm font-medium text-[#111827]"
                      >
                        Biography
                      </label>
                      <textarea
                        id="account-bio"
                        rows={4}
                        placeholder="Share a brief introduction visible on your account profile..."
                        value={form.bio}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, bio: e.target.value }))
                          if (fieldErrors.bio) {
                            setFieldErrors((prev) => ({ ...prev, bio: undefined }))
                          }
                        }}
                        disabled={isSavingProfile}
                        className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm text-[#111827] outline-none transition-all placeholder:text-[#9CA3AF] hover:border-gray-400 focus:border-[#408A71] focus:ring-2 focus:ring-[#408A71]/20 disabled:bg-[#F9FAFB] disabled:cursor-not-allowed"
                      />
                      {fieldErrors.bio && (
                        <p className="text-xs text-[#DC2626] font-medium mt-1">
                          {fieldErrors.bio}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3F4F6]">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={handleProfileCancel}
                        disabled={isSavingProfile || !isProfileDirty}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        isLoading={isSavingProfile}
                        loadingText="Saving changes..."
                      >
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </section>
              )}

              {/* 2. Security (Authentication-aware: Google-only vs local password) */}
              {activeSection === 'security' && (
                <div className="space-y-4">
                  {/* Verification Status Card */}
                  <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm sm:text-base font-medium text-[#111827] mb-0">
                        Email Verification
                      </h2>
                      <p className="mt-1 text-xs text-[#6B7280]">
                        {isVerified
                          ? `Verified${verifiedDateText ? ` on ${verifiedDateText}` : ''} (${userEmail}).`
                          : `Verification pending for ${userEmail}.`}
                      </p>
                    </div>
                    {isVerified ? (
                      <Badge variant="success" size="sm" dot>
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm" dot>
                        Pending
                      </Badge>
                    )}
                  </section>

                  {/* Sign-In & Password Section */}
                  {hasUsablePassword === null ? (
                    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
                      <Alert
                        variant="warning"
                        title="Security details unavailable"
                      >
                        Could not determine your account authentication method because your profile details failed to load. Retry loading your account above.
                      </Alert>
                    </section>
                  ) : hasUsablePassword ? (
                    <section
                      aria-label="Change Password"
                      className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-5"
                    >
                      <div className="border-b border-[#F3F4F6] pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base font-medium text-[#111827] mb-0">
                            Change Password
                          </h2>
                          <p className="mt-1 text-xs sm:text-sm font-normal text-[#6B7280]">
                            Update your account password. Changing your password revokes existing refresh sessions on other devices.
                          </p>
                        </div>
                        {usesGoogleAuth && (
                          <Badge variant="neutral" size="sm" className="shrink-0">
                            Password + Google Linked
                          </Badge>
                        )}
                      </div>

                      {securityError && (
                        <Alert
                          variant="error"
                          title="Password update failed"
                          onClose={() => setSecurityError(null)}
                        >
                          {securityError}
                        </Alert>
                      )}

                      {securitySuccess && (
                        <Alert
                          variant="success"
                          title="Password updated"
                          onClose={() => setSecuritySuccess(null)}
                        >
                          {securitySuccess}
                        </Alert>
                      )}

                      <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
                        <Input
                          label="Current Password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Enter your current password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => {
                            setPasswordForm((prev) => ({
                              ...prev,
                              currentPassword: e.target.value,
                            }))
                            if (passwordErrors.currentPassword) {
                              setPasswordErrors((prev) => ({
                                ...prev,
                                currentPassword: undefined,
                              }))
                            }
                          }}
                          error={passwordErrors.currentPassword}
                          disabled={isChangingPassword}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="New Password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Minimum 8 characters"
                            value={passwordForm.newPassword}
                            onChange={(e) => {
                              setPasswordForm((prev) => ({
                                ...prev,
                                newPassword: e.target.value,
                              }))
                              if (passwordErrors.newPassword) {
                                setPasswordErrors((prev) => ({
                                  ...prev,
                                  newPassword: undefined,
                                }))
                              }
                            }}
                            error={passwordErrors.newPassword}
                            disabled={isChangingPassword}
                            hint="Use at least 8 characters and avoid common passwords."
                          />

                          <Input
                            label="Confirm New Password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Re-enter new password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => {
                              setPasswordForm((prev) => ({
                                ...prev,
                                confirmPassword: e.target.value,
                              }))
                              if (passwordErrors.confirmPassword) {
                                setPasswordErrors((prev) => ({
                                  ...prev,
                                  confirmPassword: undefined,
                                }))
                              }
                            }}
                            error={passwordErrors.confirmPassword}
                            disabled={isChangingPassword}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3F4F6]">
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            onClick={() => {
                              setPasswordForm({
                                currentPassword: '',
                                newPassword: '',
                                confirmPassword: '',
                              })
                              setPasswordErrors({})
                              setSecurityError(null)
                            }}
                            disabled={isChangingPassword}
                          >
                            Clear
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            isLoading={isChangingPassword}
                            loadingText="Updating password..."
                          >
                            Update Password
                          </Button>
                        </div>
                      </form>
                    </section>
                  ) : (
                    <section
                      aria-label="Sign-In Method"
                      className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4"
                    >
                      <div className="border-b border-[#F3F4F6] pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base font-medium text-[#111827] mb-0">
                            Sign-In Method
                          </h2>
                          <p className="mt-1 text-xs sm:text-sm font-normal text-[#6B7280]">
                            Authentication and password management for your account.
                          </p>
                        </div>
                        <Badge variant="info" size="sm" className="shrink-0">
                          {usesGoogleAuth ? 'Google Sign-In' : 'External Sign-In'}
                        </Badge>
                      </div>

                      <Alert
                        variant="info"
                        title={
                          usesGoogleAuth
                            ? 'Signed in with Google'
                            : 'No local password configured'
                        }
                      >
                        {usesGoogleAuth
                          ? 'Your account uses Google sign-in. Password management is handled by Google.'
                          : 'Your account does not have a local password configured. Manage your credentials through your sign-in provider.'}
                      </Alert>
                    </section>
                  )}
                </div>
              )}

              {/* 3. Notifications (Backend preferences API not yet available) */}
              {activeSection === 'notifications' && (
                <section
                  aria-label="Notification Settings"
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4"
                >
                  <div className="border-b border-[#F3F4F6] pb-3.5">
                    <h2 className="text-base font-medium text-[#111827] mb-0">
                      Notifications
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm font-normal text-[#6B7280]">
                      Account notification delivery configuration.
                    </p>
                  </div>

                  <Alert
                    variant="info"
                    title="Notification preferences unavailable"
                  >
                    Per-channel notification preference controls (such as email or push toggles) are not yet supported by the backend API. In-app alerts for applications, tenancies, and documents remain active automatically.
                  </Alert>

                  {isTenant && (
                    <div className="pt-1">
                      <Link
                        to="/app/tenant/notifications"
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#408A71] hover:text-[#34745C] transition-colors"
                      >
                        <span>View Notifications Centre</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  )}
                </section>
              )}

              {/* 4. Preferences (Backend preferences API not yet available) */}
              {activeSection === 'preferences' && (
                <section
                  aria-label="Account Preferences"
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4"
                >
                  <div className="border-b border-[#F3F4F6] pb-3.5">
                    <h2 className="text-base font-medium text-[#111827] mb-0">
                      Preferences
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm font-normal text-[#6B7280]">
                      Account-wide regional and display settings.
                    </p>
                  </div>

                  <Alert
                    variant="info"
                    title="Account preferences unavailable"
                  >
                    Saved display and regional preference settings are not yet supported by the backend API. Your active workspace selection can be changed anytime using the workspace switcher in the sidebar or header.
                  </Alert>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AccountSettingsPage

