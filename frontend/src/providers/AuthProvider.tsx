import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { configureAuthBridge, isAuthenticationFailure } from '../api/client'
import { AuthContext, type AuthContextValue } from '../contexts/AuthContext'
import { authService } from '../services/auth.service'
import {
  getRefreshToken,
  removeRefreshToken,
  setRefreshToken,
} from '../services/token.storage'
import type { ApiResponse } from '../types/api'
import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponseData,
  User,
  UserProfile,
} from '../types/auth'

export interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * Singleton in-flight initialization promise to prevent race conditions or
 * double-rotation token blacklisting during React StrictMode mount/remount.
 */
let sessionInitPromise: Promise<{
  access: string
  profile: UserProfile | null
} | null> | null = null

/**
 * Central Authentication Provider
 * Manages in-memory access tokens, authenticated user state, and session lifecycle.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | UserProfile | null>(null)
  const [isInitializing, setIsInitializing] = useState<boolean>(true)

  // In-memory access token reference accessible to synchronous bridge callbacks
  const accessTokenRef = useRef<string | null>(null)

  // Monotonically increasing logout sequence counter to prevent late async responses from resurrecting auth
  const logoutVersionRef = useRef<number>(0)

  // Configure the HTTP client auth bridge without stale closures
  useEffect(() => {
    configureAuthBridge({
      getAccessToken: () => accessTokenRef.current,
      setAccessToken: (token: string | null) => {
        accessTokenRef.current = token
      },
      onSessionExpired: () => {
        accessTokenRef.current = null
        setUser(null)
      },
    })

    return () => {
      configureAuthBridge({
        getAccessToken: () => null,
        setAccessToken: () => {},
        onSessionExpired: () => {},
      })
    }
  }, [])

  // Session Rehydration on Application Startup
  useEffect(() => {
    let isMounted = true

    const initializeSession = async () => {
      const currentLogoutVersion = logoutVersionRef.current
      const storedRefresh = getRefreshToken()

      if (!storedRefresh) {
        if (isMounted) {
          setIsInitializing(false)
        }
        return
      }

      try {
        if (!sessionInitPromise) {
          sessionInitPromise = (async () => {
            // 1. Exchange refresh token for fresh access token and rotated refresh token
            const refreshResponse = await authService.refreshToken({
              refresh: storedRefresh,
            })
            const refreshData = refreshResponse.data
            if (!refreshData?.access || !refreshData?.refresh) {
              throw new Error('Malformed token refresh response: missing tokens.')
            }

            // 2. Persist the rotated refresh token; abort if storage rejects write
            const persisted = setRefreshToken(refreshData.refresh)
            if (!persisted) {
              throw new Error(
                'Failed to persist rotated refresh token in browser storage.'
              )
            }

            // 3. Update in-memory access token before fetching profile
            accessTokenRef.current = refreshData.access

            // 4. Fetch authenticated user profile
            try {
              const profileResponse = await authService.getProfile()
              const profile = profileResponse.data ?? null
              return { access: refreshData.access, profile }
            } catch {
              // Profile fetch failed (e.g. temporary network error or 5xx).
              // CRITICAL: Do NOT clear the valid rotated refresh token.
              // Clear the temporary access token so we do not report a broken partial session.
              accessTokenRef.current = null
              return null
            }
          })()
            .catch((initError) => {
              // Only clear stored refresh token if the failure is an authentic authentication failure
              // (such as an invalid/expired/blacklisted token) or a storage persistence failure.
              // Never purge valid tokens due to temporary network drops or 5xx server errors.
              if (isAuthenticationFailure(initError)) {
                removeRefreshToken()
                accessTokenRef.current = null
              }
              throw initError
            })
            .finally(() => {
              sessionInitPromise = null
            })
        }

        const result = await sessionInitPromise

        // Validate that component is mounted, no logout occurred in the interim, and refresh token is still present
        if (
          isMounted &&
          logoutVersionRef.current === currentLogoutVersion &&
          getRefreshToken()
        ) {
          if (result && result.profile) {
            accessTokenRef.current = result.access
            setUser(result.profile)
          } else {
            // Profile could not be hydrated; keep user as null without wiping valid refresh token
            setUser(null)
          }
        }
      } catch {
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false)
        }
      }
    }

    initializeSession()

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (credentials: LoginRequest): Promise<void> => {
    const currentLogoutVersion = logoutVersionRef.current
    const response = await authService.login(credentials)
    const loginData = response.data

    if (!loginData?.access || !loginData?.refresh || !loginData?.user) {
      throw new Error('Invalid login response payload.')
    }

    const persisted = setRefreshToken(loginData.refresh)
    if (!persisted) {
      throw new Error('Failed to persist refresh token in browser storage.')
    }

    if (logoutVersionRef.current !== currentLogoutVersion) {
      // User logged out while login request was in flight; discard credentials
      removeRefreshToken()
      return
    }

    accessTokenRef.current = loginData.access

    // Set genuine User object from login response (accurately typed without unsafe casting)
    setUser(loginData.user)

    // Attempt to enrich with full profile; if it fails temporarily, user remains authentic User
    try {
      const profileResponse = await authService.getProfile()
      if (
        profileResponse.data &&
        logoutVersionRef.current === currentLogoutVersion
      ) {
        setUser(profileResponse.data)
      }
    } catch {
      // Profile fetch failed temporarily; keep user as authenticated User
    }
  }, [])

  const register = useCallback(
    async (
      payload: RegisterRequest
    ): Promise<ApiResponse<RegisterResponseData>> => {
      return await authService.register(payload)
    },
    []
  )

  const logout = useCallback(async (): Promise<void> => {
    // Increment logout version to invalidate any pending asynchronous operations
    logoutVersionRef.current += 1
    const storedRefresh = getRefreshToken()
    const currentToken = accessTokenRef.current

    // Synchronously destroy local session immediately so the UI responds instantaneously
    removeRefreshToken()
    accessTokenRef.current = null
    setUser(null)

    try {
      if (storedRefresh && currentToken) {
        await authService.logout({ refresh: storedRefresh })
      }
    } catch {
      // Backend logout errors should not affect local session destruction
    }
  }, [])

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const currentLogoutVersion = logoutVersionRef.current
    if (!accessTokenRef.current) {
      return null
    }

    try {
      const response = await authService.getProfile()
      const updated = response.data ?? null
      if (updated && logoutVersionRef.current === currentLogoutVersion) {
        setUser(updated)
      }
      return updated
    } catch {
      return null
    }
  }, [])

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, isInitializing, login, register, logout, refreshProfile]
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
