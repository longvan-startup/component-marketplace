/**
 * The one place for catalog labels and badge variants. Pages and cards read
 * from here, so the home page, the catalog and the detail page show the same
 * wording. Labels are English technical terms, with the first letter capitalised.
 */
import type { CatalogCategory } from '@marketplace/shared'

export const CATEGORY_LABEL: Record<CatalogCategory, string> = {
  animation: 'Animation',
  'react-component': 'React component',
  tool: 'Tool',
}

/** Category options in display order, for filters and category tiles. */
export const CATEGORY_OPTIONS: { value: CatalogCategory; label: string }[] = (
  Object.keys(CATEGORY_LABEL) as CatalogCategory[]
).map((value) => ({ value, label: CATEGORY_LABEL[value] }))

export const TIER_LABEL = { free: 'Free', pro: 'Pro' } as const

export const STATUS_LABEL = { published: 'Đã publish', draft: 'Bản nháp' } as const

/** Category is a classification, not a status, so every category badge is neutral. */
export const CATEGORY_VARIANT = 'neutral' as const

/** Pro is the premium tier and gets the accent tone; Free gets success. */
export function tierVariant(tier: 'free' | 'pro'): 'accent' | 'success' {
  return tier === 'pro' ? 'accent' : 'success'
}
