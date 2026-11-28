import type { RegistryResponse } from '@marketplace/shared'
import { registryResponseSchema } from '@marketplace/shared'
import { apiFetchJson } from '../../lib/api-client'
import type { CatalogItem } from './catalog-source'
import { resolveApiMode } from './catalog-source'

/** Loads a published Free source release that matches catalog metadata. */
export async function getCatalogRegistryRelease(
  item: CatalogItem,
): Promise<RegistryResponse['item'] | null> {
  if (resolveApiMode() !== 'live' || item.accessTier !== 'free') return null
  try {
    const payload = await apiFetchJson<unknown>(`/registry/${encodeURIComponent(item.slug)}`, {
      revalidate: 60,
    })
    const release = registryResponseSchema.parse(payload).item
    if (release.slug !== item.slug || release.version !== item.latestVersion) return null
    return release
  } catch {
    return null
  }
}
