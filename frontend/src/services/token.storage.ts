/**
 * Centralized Token Storage Service
 *
 * Responsibilities:
 * - Persist and retrieve the rotated refresh token in browser localStorage.
 * - Safely handle environments where localStorage is unavailable (SSR, private browsing, quota exceeded).
 * - Strictly DO NOT store access tokens, passwords, or sensitive credentials.
 */

const REFRESH_TOKEN_KEY = 'proptech_refresh_token'

/**
 * Retrieves the stored refresh token from localStorage.
 * Returns null if not found, empty, or if localStorage is inaccessible.
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const token = window.localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!token || typeof token !== 'string') {
      return null
    }
    const trimmed = token.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

/**
 * Persists the rotated refresh token in localStorage.
 *
 * @param token The raw refresh token string
 * @returns true if successfully persisted, false if storage is unavailable or write failed
 */
export function setRefreshToken(token: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  if (typeof token !== 'string' || token.trim().length === 0) {
    return false
  }

  try {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token.trim())
    return true
  } catch {
    return false
  }
}

/**
 * Removes the stored refresh token from localStorage.
 *
 * @returns true if removed, false if storage was inaccessible
 */
export function removeRefreshToken(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  try {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY)
    return true
  } catch {
    return false
  }
}

