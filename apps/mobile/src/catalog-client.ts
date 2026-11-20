import { type CatalogListResponse, listResponseSchema } from '@marketplace/shared'

export function parseCatalogList(payload: unknown): CatalogListResponse {
  return listResponseSchema.parse(payload)
}
