/**
 * Utility to resolve media URLs to full accessible URLs.
 * Handles both absolute URLs (e.g. https://...) and relative backend paths (e.g. /media/...).
 */
export function getMediaUrl(url?: string | null): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }

  // Prepend backend origin if relative path
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
  try {
    const origin = new URL(apiBase).origin
    return `${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
  } catch {
    return trimmed
  }
}

