import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'
import { envConfig } from '../config/env'
import {
  getRefreshToken,
  removeRefreshToken,
  setRefreshToken,
} from '../services/token.storage'
import type { ApiResponse } from '../types/api'
import type { RefreshTokenResponseData } from '../types/auth'

/**
 * Determines whether an error is a terminal authentication failure
 * (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden, or missing/unwritable token)
 * as opposed to a transient network drop or 5xx server error.
 */
export function isAuthenticationFailure(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status
      return status === 400 || status === 401 || status === 403
    }
    // Network errors (offline, connection refused, DNS failure) are not terminal auth failures
    return false
  }
  // Internal errors like missing tokens or storage write failures are terminal session errors
  return true
}

/**
 * Access token and session callback signatures for AuthProvider bridge.
 */
export type AccessTokenGetter = () => string | null
export type AccessTokenSetter = (token: string | null) => void
export type SessionExpiredHandler = () => void

let getAccessToken: AccessTokenGetter = () => null
let setAccessToken: AccessTokenSetter = () => {}
let onSessionExpired: SessionExpiredHandler = () => {}

/**
 * Configures the auth bridge callbacks used by the Axios client.
 * Allows AuthProvider to inject in-memory state handlers without circular dependencies.
 */
export function configureAuthBridge(handlers: {
  getAccessToken?: AccessTokenGetter
  setAccessToken?: AccessTokenSetter
  onSessionExpired?: SessionExpiredHandler
}): void {
  if (handlers.getAccessToken) {
    getAccessToken = handlers.getAccessToken
  }
  if (handlers.setAccessToken) {
    setAccessToken = handlers.setAccessToken
  }
  if (handlers.onSessionExpired) {
    onSessionExpired = handlers.onSessionExpired
  }
}

/**
 * Central Axios instance configured with backend API base URL and JSON headers.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: envConfig.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

/**
 * Internal request config extension tracking retry status.
 */
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

/**
 * Request Interceptor: Attaches current in-memory Bearer access token if present.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) {
      if (config.headers && typeof config.headers.set === 'function') {
        if (!config.headers.has('Authorization')) {
          config.headers.set('Authorization', `Bearer ${token}`)
        }
      } else if (config.headers) {
        if (!config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    }
    return config
  },
  (error: unknown) => Promise.reject(error)
)

/**
 * Checks whether the requested URL belongs to authentication endpoints
 * that must never trigger an automatic token refresh loop.
 */
function isAuthBypassUrl(url: string | undefined): boolean {
  if (!url) {
    return false
  }

  // Normalize by stripping query strings and boundary slashes for robust matching
  const cleanUrl = url.split('?')[0].replace(/^\/+|\/+$/g, '')

  const bypassEndpoints = [
    'auth/login',
    'auth/register',
    'auth/token/refresh',
    'auth/verify-email',
    'auth/resend-email-verification',
    'auth/password-reset/request',
    'auth/password-reset/confirm',
  ]

  return bypassEndpoints.some(
    (endpoint) => cleanUrl.endsWith(endpoint) || cleanUrl.includes(endpoint)
  )
}

/**
 * Shared in-flight refresh promise to guarantee that only one refresh request
 * executes at any given time, preventing token rotation race conditions and blacklisting conflicts.
 */
let refreshPromise: Promise<string> | null = null

/**
 * Response Interceptor: Handles 401 Unauthorized errors by refreshing the access token
 * with the rotated refresh token, updating storage, and retrying the original request.
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    // Pass through if there is no request config or if the response status is not 401
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    // Exclude authentication bypass URLs to prevent infinite loops
    if (isAuthBypassUrl(originalRequest.url)) {
      return Promise.reject(error)
    }

    // Prevent retry loops: if already retried once, reject immediately
    if (originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    // If a refresh is not already running, initiate one
    if (!refreshPromise) {
      refreshPromise = (async (): Promise<string> => {
        const storedRefreshToken = getRefreshToken()
        if (!storedRefreshToken) {
          throw new Error('No refresh token available')
        }

        // Direct isolated Axios call to avoid invoking apiClient interceptors recursively
        const refreshResponse = await axios.post<ApiResponse<RefreshTokenResponseData>>(
          `${envConfig.apiBaseUrl}/auth/token/refresh/`,
          { refresh: storedRefreshToken },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          }
        )

        const refreshData = refreshResponse.data.data
        if (!refreshData?.access || !refreshData?.refresh) {
          throw new Error('Malformed token refresh response: missing tokens.')
        }

        const { access, refresh: rotatedRefreshToken } = refreshData

        // Update local storage with newly rotated refresh token; fail if storage rejected write
        const persisted = setRefreshToken(rotatedRefreshToken)
        if (!persisted) {
          throw new Error('Failed to persist rotated refresh token in browser storage.')
        }

        // Update in-memory access token via bridge
        setAccessToken(access)

        return access
      })()
        .catch((refreshError: unknown) => {
          // Only clear credentials and notify session expiration if this is an authentic auth failure
          // or storage persistence failure; do NOT clear refresh tokens on temporary network/server drop.
          if (isAuthenticationFailure(refreshError)) {
            removeRefreshToken()
            setAccessToken(null)

            try {
              onSessionExpired()
            } catch {
              // Prevent unhandled errors inside user callback
            }
          }

          throw refreshError
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    try {
      const newAccessToken = await refreshPromise

      // Attach new access token to original request headers
      if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
        originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`)
      } else if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      }

      // Replay original request
      return apiClient(originalRequest)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  }
)

export default apiClient

