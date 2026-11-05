/**
 * Centralised Brand Configuration
 * Single source of truth for product identity.
 */

export interface BrandLogoConfig {
  alt: string
  symbol: string
  ariaLabel: string
}

export interface BrandConfig {
  readonly name: string
  readonly tagline: string
  readonly description: string
  readonly websiteUrl: string
  readonly logo: BrandLogoConfig
}

export const brandConfig: BrandConfig = {
  name: 'PropTech',
  tagline: 'Find. Manage. Grow.',
  description: 'A smarter way to discover and manage properties.',
  websiteUrl: (import.meta.env.VITE_APP_URL as string | undefined) || 'https://proptech.example.com',
  logo: {
    alt: 'PropTech Logo',
    symbol: 'PT',
    ariaLabel: 'PropTech Home',
  },
} as const

export default brandConfig
