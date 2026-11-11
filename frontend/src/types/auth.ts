/**
 * Authentication and User Types
 * Strictly aligned with Django backend authentication and accounts schemas.
 */

/**
 * Core User entity as returned by backend authentication endpoints.
 */
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  is_tenant: boolean
  is_owner: boolean
  is_platform_admin: boolean
}

/**
 * User Profile entity returned by GET /api/v1/auth/profile/.
 */
export interface UserProfile extends User {
  phone_number: string | null
  bio: string | null
  profile_image: string | null
  email_verified_at: string | null
  has_usable_password: boolean
  auth_providers: string[]
}

/**
 * Type guard to check whether a user object has loaded the complete profile properties.
 */
export function isUserProfile(user: User | null): user is UserProfile {
  return user !== null && 'bio' in user
}

/**
 * Writable user profile fields for PATCH /api/v1/auth/profile/.
 * Strictly matches backend ProfileSerializer validated fields.
 */
export interface UpdateProfileRequest {
  first_name?: string
  last_name?: string
  phone_number?: string | null
  bio?: string | null
  profile_image?: string | null
}

/**
 * JWT token pair returned by login and token refresh endpoints.
 */
export interface AuthTokens {
  access: string
  refresh: string
}

/**
 * Request payload for POST /api/v1/auth/login/.
 */
export interface LoginRequest {
  email: string
  password: string
}

/**
 * Request payload for POST /api/v1/auth/google/.
 */
export interface GoogleAuthRequest {
  credential: string
}

/**
 * Data payload returned on successful login (POST /api/v1/auth/login/).
 */
export interface LoginResponseData {
  access: string
  refresh: string
  user: User
}

/**
 * Request payload for POST /api/v1/auth/register/.
 * Note: password confirmation field name is `password_confirm`.
 */
export interface RegisterRequest {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirm: string
}

/**
 * Data payload returned on successful registration (POST /api/v1/auth/register/).
 */
export interface RegisterResponseData {
  id: string
  email: string
}

/**
 * Request payload for POST /api/v1/auth/verify-email/.
 */
export interface VerifyEmailRequest {
  user_id: string
  token: string
}

/**
 * Data payload returned on successful email verification (POST /api/v1/auth/verify-email/).
 */
export interface VerifyEmailResponseData {
  id: string
  email: string
  is_active: boolean
}

/**
 * Request payload for POST /api/v1/auth/resend-email-verification/.
 */
export interface ResendEmailVerificationRequest {
  email: string
}

/**
 * Request payload for POST /api/v1/auth/token/refresh/.
 */
export interface RefreshTokenRequest {
  refresh: string
}

/**
 * Data payload returned on successful token refresh (POST /api/v1/auth/token/refresh/).
 */
export interface RefreshTokenResponseData {
  access: string
  refresh: string
}

/**
 * Request payload for POST /api/v1/auth/logout/.
 */
export interface LogoutRequest {
  refresh: string
}

/**
 * Request payload for POST /api/v1/auth/password-reset/request/.
 */
export interface PasswordResetRequest {
  email: string
}

/**
 * Request payload for POST /api/v1/auth/password-reset/confirm/.
 * Note: password confirmation field name is `confirm_password`.
 */
export interface PasswordResetConfirmRequest {
  uid: string
  token: string
  new_password: string
  confirm_password: string
}

/**
 * Request payload for POST /api/v1/auth/change-password/.
 * Note: password confirmation field name is `confirm_password`.
 */
export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  confirm_password: string
}

