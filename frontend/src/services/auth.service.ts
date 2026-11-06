import apiClient from '../api/client'
import type { ApiResponse } from '../types/api'
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponseData,
  LogoutRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  RefreshTokenRequest,
  RefreshTokenResponseData,
  RegisterRequest,
  RegisterResponseData,
  ResendEmailVerificationRequest,
  UpdateProfileRequest,
  UserProfile,
  VerifyEmailRequest,
  VerifyEmailResponseData,
} from '../types/auth'

/**
 * Authentication and User Profile API Service
 * Encapsulates all authentication network operations using the centralized Axios client.
 */
export const authService = {
  /**
   * Authenticate user with email and password credentials.
   * Dispatches POST /api/v1/auth/login/.
   */
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponseData>> {
    const response = await apiClient.post<ApiResponse<LoginResponseData>>(
      '/auth/login/',
      credentials
    )
    return response.data
  },

  /**
   * Register a new user account and trigger a verification email.
   * Dispatches POST /api/v1/auth/register/.
   */
  async register(payload: RegisterRequest): Promise<ApiResponse<RegisterResponseData>> {
    const response = await apiClient.post<ApiResponse<RegisterResponseData>>(
      '/auth/register/',
      payload
    )
    return response.data
  },

  /**
   * Verify an account using user ID and raw verification token.
   * Dispatches POST /api/v1/auth/verify-email/.
   */
  async verifyEmail(
    payload: VerifyEmailRequest
  ): Promise<ApiResponse<VerifyEmailResponseData>> {
    const response = await apiClient.post<ApiResponse<VerifyEmailResponseData>>(
      '/auth/verify-email/',
      payload
    )
    return response.data
  },

  /**
   * Resend an activation email to an unverified user.
   * Dispatches POST /api/v1/auth/resend-email-verification/.
   */
  async resendVerificationEmail(
    payload: ResendEmailVerificationRequest
  ): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/resend-email-verification/',
      payload
    )
    return response.data
  },

  /**
   * Refresh JWT access and refresh token pair using an existing refresh token.
   * Dispatches POST /api/v1/auth/token/refresh/.
   */
  async refreshToken(
    payload: RefreshTokenRequest
  ): Promise<ApiResponse<RefreshTokenResponseData>> {
    const response = await apiClient.post<ApiResponse<RefreshTokenResponseData>>(
      '/auth/token/refresh/',
      payload
    )
    return response.data
  },

  /**
   * Invalidate the current session and blacklist the refresh token on the backend.
   * Dispatches POST /api/v1/auth/logout/.
   */
  async logout(payload: LogoutRequest): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/logout/',
      payload
    )
    return response.data
  },

  /**
   * Request a password reset link.
   * Dispatches POST /api/v1/auth/password-reset/request/.
   */
  async requestPasswordReset(
    payload: PasswordResetRequest
  ): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/password-reset/request/',
      payload
    )
    return response.data
  },

  /**
   * Confirm password reset with UID, reset token, and new password.
   * Dispatches POST /api/v1/auth/password-reset/confirm/.
   */
  async confirmPasswordReset(
    payload: PasswordResetConfirmRequest
  ): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/password-reset/confirm/',
      payload
    )
    return response.data
  },

  /**
   * Change password for the currently authenticated user.
   * Dispatches POST /api/v1/auth/change-password/.
   */
  async changePassword(
    payload: ChangePasswordRequest
  ): Promise<ApiResponse<null>> {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/change-password/',
      payload
    )
    return response.data
  },

  /**
   * Retrieve the current authenticated user's profile and roles.
   * Dispatches GET /api/v1/auth/profile/.
   */
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    const response = await apiClient.get<ApiResponse<UserProfile>>(
      '/auth/profile/'
    )
    return response.data
  },

  /**
   * Partially update the authenticated user's profile details.
   * Dispatches PATCH /api/v1/auth/profile/.
   */
  async updateProfile(
    payload: UpdateProfileRequest
  ): Promise<ApiResponse<UserProfile>> {
    const response = await apiClient.patch<ApiResponse<UserProfile>>(
      '/auth/profile/',
      payload
    )
    return response.data
  },
}

export default authService

