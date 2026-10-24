/**
 * contracts/common.ts — cross-domain contract primitives.
 *
 * Framework-free by design: no Express, React, Next.js or Drizzle imports
 * (enforced by `bun run boundary` + review). Everything here is pure Zod.
 *
 * DTO vs DB row rule: schemas in `contracts/` describe PUBLIC API payloads
 * only. Internal fields (timestamps, author IDs, emails, tokens) must never
 * appear here; Zod object parsing strips unknown keys, so even a careless
 * `res.json(rowToDict(dbRow))` cannot leak them past this contract — but the
 * api side still maps rows deliberately (see `catalog.ts` header).
 */

import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* Pagination — shared limits so both apps cannot drift apart.         */
/* ------------------------------------------------------------------ */

/** Pagination bounds + defaults, agreed in issue #30. */
export const PAGINATION_LIMITS = {
  defaultPage: 1,
  defaultPageSize: 12,
  maxPage: 10_000,
  maxPageSize: 48,
} as const

export const pageNumberSchema = z.coerce
  .number()
  .int()
  .min(1, 'page must be >= 1')
  .max(PAGINATION_LIMITS.maxPage, `page must be <= ${PAGINATION_LIMITS.maxPage}`)

export const pageSizeNumberSchema = z.coerce
  .number()
  .int()
  .min(1, 'pageSize must be >= 1')
  .max(PAGINATION_LIMITS.maxPageSize, `pageSize must be <= ${PAGINATION_LIMITS.maxPageSize}`)

/* ------------------------------------------------------------------ */
/* Error envelope — the ONE failure shape for every 4xx/5xx (#29).     */
/* ------------------------------------------------------------------ */

/**
 * Flat error envelope. `details` carries machine-readable per-field
 * validation messages (e.g. Zod issue summaries) when they exist.
 */
export const apiErrorSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[A-Z0-9_]+$/, 'code must be UPPER_SNAKE (e.g. VALIDATION_ERROR, NOT_FOUND)'),
  message: z.string().min(1),
  status: z
    .number()
    .int()
    .min(400, 'error status must be >= 400')
    .max(599, 'error status must be <= 599'),
  details: z.array(z.string().min(1)).max(20).optional(),
})

export type ApiError = z.infer<typeof apiErrorSchema>
