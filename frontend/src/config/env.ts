/**
 * Frontend Environment Configuration
 * Centralized, typed, and validated environment configuration for the PropTech frontend.
 */

export interface EnvironmentConfig {
  /**
   * Central backend API base URL (e.g. "http://localhost:8000/api/v1").
   * Validated on access; throws an actionable error if missing or invalid.
   */
  readonly apiBaseUrl: string
  /**
   * Alias matching the environment variable name VITE_API_BASE_URL.
   */
  readonly VITE_API_BASE_URL: string
  /**
   * The raw API base URL from import.meta.env.VITE_API_BASE_URL without validation.
   * Can be undefined if no .env file is provided.
   */
  readonly rawApiBaseUrl: string | undefined
  /**
   * Public application URL (e.g. "http://localhost:5173").
   */
  readonly appUrl: string | undefined
  /**
   * Vite runtime mode (e.g., "development", "production", "test").
   */
  readonly mode: string
  /**
   * Boolean indicating whether running in development mode.
   */
  readonly isDev: boolean
  /**
   * Boolean indicating whether running in production mode.
   */
  readonly isProd: boolean
}

/**
 * Validates that an API base URL is a valid, well-formed HTTP/HTTPS URL.
 * Throws a clear, actionable error if missing or malformed.
 *
 * @param url The raw candidate URL string
 * @returns Cleaned URL without trailing slashes
 */
export function validateApiBaseUrl(url: unknown): string {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error(
      '[Environment Error] Missing required environment variable "VITE_API_BASE_URL".\n' +
      'Please create a local .env file in the "frontend" directory based on .env.example:\n' +
      '  VITE_API_BASE_URL=http://localhost:8000/api/v1\n' +
      'Make sure your Django backend API root is configured and accessible.'
    )
  }

  const trimmed = url.trim()

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid protocol "${parsed.protocol}". Expected "http:" or "https:".`)
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[Environment Error] Malformed "VITE_API_BASE_URL" ("${trimmed}"): ${reason}.\n` +
      'Ensure the URL includes protocol and host (e.g., http://localhost:8000/api/v1).',
      { cause: err }
    )
  }

  // Strip trailing slashes to ensure standard endpoint concatenation
  return trimmed.replace(/\/+$/, '')
}

/**
 * Retrieves the validated backend API base URL.
 * Evaluates import.meta.env.VITE_API_BASE_URL on demand so that the application
 * does not crash during initial static bootstrap or UI testing if .env is absent.
 */
export function getApiBaseUrl(): string {
  return validateApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
}

/**
 * Central typed environment configuration object.
 */
export const envConfig: EnvironmentConfig = {
  get apiBaseUrl(): string {
    return getApiBaseUrl()
  },
  get VITE_API_BASE_URL(): string {
    return getApiBaseUrl()
  },
  get rawApiBaseUrl(): string | undefined {
    const raw = import.meta.env.VITE_API_BASE_URL
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
  },
  get appUrl(): string | undefined {
    const raw = import.meta.env.VITE_APP_URL
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
  },
  mode: import.meta.env.MODE,
  isDev: Boolean(import.meta.env.DEV),
  isProd: Boolean(import.meta.env.PROD),
}

export default envConfig
