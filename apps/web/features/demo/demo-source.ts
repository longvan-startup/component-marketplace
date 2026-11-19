/** The demo data layer: the only place components read demo manifests from. */

import { MOCK_DEMOS } from '../../mocks/demos'
import type { DemoManifest } from './demo-manifest'

export function getDemoManifest(slug: string): DemoManifest | null {
  return MOCK_DEMOS.find((demo) => demo.slug === slug) ?? null
}
