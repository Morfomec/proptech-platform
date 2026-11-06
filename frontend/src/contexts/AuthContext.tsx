import { createContext, useContext } from 'react'
import type { ApiResponse } from '../types/api'
import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponseData,
  User,
  UserProfile,
} from '../types/auth'

/**
 * Public Authentication Context Value Contract
 */
export interface AuthContextValue {
  /**
   * The currently authenticated user, or null if unauthenticated.
   * Can be the core User from login or the enriched UserProfile once loaded.
   */
  user: User | UserProfile | null

  /**
   * Boolean flag indicating whether a verified active user session exists.
   */
  isAuthenticated: boolean

  /**
   * True while the initial session rehydration and token validation is in progress.
   */
  isInitializing: boolean

  /**
   * Authenticate with email and password credentials.
   */
  login: (credentials: LoginRequest) => Promise<void>

  /**
   * Register a new user account and dispatch activation email.
   */
  register: (payload: RegisterRequest) => Promise<ApiResponse<RegisterResponseData>>

  /**
   * Invalidate the current session both on the backend and locally.
   */
  logout: () => Promise<void>

  /**
   * Re-fetch the current user's profile and update the in-memory state.
   */
  refreshProfile: () => Promise<UserProfile | null>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Hook to consume the Authentication Context.
 * Throws an actionable error if called outside of an AuthProvider hierarchy.
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
