/**
 * Mock fixture for the catalog — mirrors the contract PROPOSED for
 * `packages/shared` (see the `shared: catalog contract proposal` issue for
 * Long's review). While that contract is pending this stays the default data
 * source; swap is a one-env-var change (API_MODE=live), no UI rewrite.
 */

import type { CatalogItem } from '../features/catalog/catalog-source'

export const MOCK_COMPONENTS: CatalogItem[] = [
  {
    id: '0d8f55a7-0c1f-4c2f-98a2-0fbb5f0f5ad1',
    slug: 'spring-card-stack',
    name: 'Spring Card Stack',
    summary: 'Stacked cards with spring stagger on hover and focus.',
    description:
      'A small stack of cards that spreads with a spring easing using CSS transforms only. Keyboard focus triggers the same spread. Reduced motion falls back to a static stack.',
    category: 'animation',
    tags: ['motion', 'hover', 'spring', 'accessible'],
    latestVersion: '1.2.0',
    author: 'van',
    isPublished: true,
  },
  {
    id: '5bfbe3a3-c6df-47bb-8eb5-31d0884b9ec9',
    slug: 'shimmer-skeleton-block',
    name: 'Shimmer Skeleton Block',
    summary: 'Content placeholder shimmer that respects reduced motion.',
    description:
      'One rectangular placeholder with a shimmer sweep. Respects prefers-reduced-motion by swapping to a soft pulse.',
    category: 'animation',
    tags: ['skeleton', 'loading', 'accessible'],
    latestVersion: '0.9.3',
    author: 'van',
    isPublished: true,
  },
  {
    id: '88b3a2f1-2a77-4d28-a4b0-24b5f6a7ba44',
    slug: 'badge-row',
    name: 'Badge Row',
    summary: 'Wrapping row of status badges with neutral / brand / success variants.',
    description:
      'Flex row that wraps gracefully on narrow screens; relies on the ui/badge primitive so variants stay consistent site-wide.',
    category: 'react-component',
    tags: ['badge', 'layout'],
    latestVersion: '0.4.1',
    author: 'long',
    isPublished: false,
  },
  {
    id: 'd8fdb50e-3871-4e02-a61a-18b6ec42ab9a',
    slug: 'fade-list-group',
    name: 'Fade List Group',
    summary: 'List whose items fade up on first paint, index-staggered.',
    description:
      'Applies a short fade/translate to list items on mount. Configurable stagger; disabled entirely under prefers-reduced-motion.',
    category: 'animation',
    tags: ['motion', 'list', 'stagger'],
    latestVersion: '1.0.0',
    author: 'van',
    isPublished: true,
  },
  {
    id: 'c58516cb-06b7-4797-9b85-36d9adf9d64c',
    slug: 'copyable-slug-field',
    name: 'Copyable Slug Field',
    summary: 'Readonly slug text with a copy-to-clipboard action and live feedback.',
    description:
      'Small utility field for marketplace detail pages. Uses the Web Clipboard API with a visible state transition and falls back to a selected text range when clipboard access is denied.',
    category: 'tool',
    tags: ['clipboard', 'interaction'],
    latestVersion: '0.2.0',
    author: 'long',
    isPublished: true,
  },
  {
    id: '2a9c0b1d-ee33-45c8-87b2-9d1a1b0a72f0',
    slug: 'version-diff-previewer',
    name: 'Version Diff Previewer',
    summary: 'Compact component props diff between two published versions.',
    description:
      'Renders a two-column diff of prop tables between versions, highlighting additions and removals. Read-only; intended for detail pages.',
    category: 'tool',
    tags: ['diff', 'versions'],
    latestVersion: '0.1.0',
    author: 'van',
    isPublished: false,
  },
]
