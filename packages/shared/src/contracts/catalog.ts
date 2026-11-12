/**
 * contracts/catalog.ts — public API contract for the component catalog.
 *
 * Source of truth for BOTH sides (Long ↔ Văn) as agreed in issue #30 (+ the
 * concrete field proposal reviewed in issue #37). Apps consume schemas via
 * `z.infer` types; they never redeclare payload shapes locally.
 *
 * Deliberately left OUT of the public DTO (db-only / internal):
 *   createdAt, updatedAt, authorId, email — an api row mapper keeps those
 *   internal; parsing drops unknown keys, tests assert the strip behavior.
 *
 * Update pricing fields follow the product decision in issue #18 / PR #88.
 * Payment processing, purchase records, entitlements, and license selection
 * remain outside this Catalog response. Additive changes only — see
 * packages/shared/AGENTS.md ("Exports are public API").
 */

import { z } from 'zod'
import { pageNumberSchema, pageSizeNumberSchema } from './common'

/* ------------------------------------------------------------------ */
/* Identifiers & enums                                                 */
/* ------------------------------------------------------------------ */

/** URL-facing, stable public identifier. The detail endpoint is keyed by
 * SLUG, not id (unified across #31 api + #32 web; id stays internal). */
export const catalogSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case')

export const catalogCategorySchema = z.enum(['animation', 'react-component', 'tool'])
export const catalogSortSchema = z.enum(['newest', 'name'])

/** Public display name from the author's profile. */
const authorDisplayNameSchema = z.string().min(1).max(100)

const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semantic (x.y.z)')

export const componentAccessTierSchema = z.enum(['free', 'pro'])

/** Monetary values use the currency's minor unit and an uppercase 3-letter code. */
export const catalogPriceSchema = z.object({
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'currency must be an uppercase 3-letter code'),
})

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

export const componentSchema = z
  .object({
    id: z.uuid(),
    slug: catalogSlugSchema,
    name: z.string().min(1).max(120),
    summary: z.string().min(1).max(300),
    description: z.string().min(1).max(5000),
    category: catalogCategorySchema,
    tags: z.array(z.string().min(1).max(40)).max(12).default([]),
    latestVersion: semverSchema,
    author: authorDisplayNameSchema,
    isPublished: z.boolean(),
    /** Optional during the additive rollout; the API emits both fields. */
    price: catalogPriceSchema.nullable().optional(),
    requiresPaymentForUpdate: z.boolean().optional(),
    /** Optional during the additive rollout; the API always emits it. */
    accessTier: componentAccessTierSchema.optional(),
  })
  .superRefine((component, context) => {
    if (component.requiresPaymentForUpdate === true && component.price == null) {
      context.addIssue({
        code: 'custom',
        path: ['price'],
        message: 'A paid-update component must define a price',
      })
    }
  })

export type CatalogComponent = z.infer<typeof componentSchema>
export type CatalogCategory = z.infer<typeof catalogCategorySchema>
export type CatalogSort = z.infer<typeof catalogSortSchema>

/* ------------------------------------------------------------------ */
/* Requests & responses                                                */
/* ------------------------------------------------------------------ */

export const listRequestSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.optional(catalogCategorySchema),
  tag: z.string().trim().min(1).max(40).optional(),
  sort: z.optional(catalogSortSchema).default('newest'),
  page: pageNumberSchema.default(1),
  pageSize: pageSizeNumberSchema.default(12),
})

export const listResponseSchema = z.object({
  items: z.array(componentSchema),
  page: pageNumberSchema,
  pageSize: pageSizeNumberSchema,
  total: z.number().int().min(0),
})

/** Detail responses are wrapped (`{ item }`) so new sibling fields (e.g.
 * next/prev slug) can ship without breaking the envelope later. */
export const detailResponseSchema = z.object({
  item: componentSchema,
})

export type CatalogListRequest = z.input<typeof listRequestSchema>
export type CatalogListQuery = z.output<typeof listRequestSchema>
export type CatalogListResponse = z.infer<typeof listResponseSchema>
export type CatalogDetailResponse = z.infer<typeof detailResponseSchema>

/* ------------------------------------------------------------------ */
/* Admin write requests (issue #111)                                   */
/* ------------------------------------------------------------------ */

/** Tags are normalized at the write boundary: trim, lowercase, dedupe after
 * normalization. The 12-item / 40-char limits mirror the DB check constraints
 * in `packages/db/src/schema.ts` (`components_tags_count_check`).
 *
 * The `.default([])` lives ONLY on `adminTagsSchema` (create). The update
 * schema below uses `adminTagsInputSchema` directly (no default): in Zod 4 a
 * default inside a property still applies even when that property is wrapped
 * in `.optional()`, so a PATCH body omitting `tags` would otherwise parse to
 * `tags: []` and wipe the component's existing tags.
 */
const adminTagsInputSchema = z.array(z.string().trim().min(1).max(40)).max(12)
const normalizeTags = (tags: string[]) => Array.from(new Set(tags.map((tag) => tag.toLowerCase())))

export const adminTagsSchema = adminTagsInputSchema.default([]).transform(normalizeTags)

/**
 * Exactly two valid states going forward (issue #111 decision):
 *   free = price null AND requiresPaymentForUpdate false
 *   paid = price set  AND requiresPaymentForUpdate true
 * Any other combination is rejected at the write boundary. This is stricter
 * than `componentSchema`'s own refine, which only guards legacy/already-
 * written rows (flag true requires a price; it does not forbid a price on a
 * free row), so it stays separate rather than replacing that one.
 */
export function isValidPriceFlagCombo(
  price: { amountMinor: number; currency: string } | null,
  requiresPaymentForUpdate: boolean,
): boolean {
  if (price === null) return requiresPaymentForUpdate === false
  return requiresPaymentForUpdate === true
}

/** Admin create — the server derives `slug` from `name`; the client never
 * supplies it. New components are always drafts (`isPublished` is not a
 * client-settable field here); publish/unpublish are separate actions. */
export const createComponentRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(5000),
    category: catalogCategorySchema,
    tags: adminTagsSchema,
    latestVersion: semverSchema.default('0.0.0'),
    price: catalogPriceSchema.nullable().default(null),
    requiresPaymentForUpdate: z.boolean().default(false),
    /** Omitted creates stay `free`. Not tied to the price pair. */
    accessTier: componentAccessTierSchema.default('free'),
  })
  .superRefine((input, context) => {
    if (!isValidPriceFlagCombo(input.price, input.requiresPaymentForUpdate)) {
      context.addIssue({
        code: 'custom',
        path: ['requiresPaymentForUpdate'],
        message:
          'A free component needs price=null and requiresPaymentForUpdate=false; a paid component needs both set',
      })
    }
  })

/**
 * Admin update — every field optional (PATCH semantics). The price/flag combo
 * is NOT re-validated here: the route merges this patch onto the current row
 * first (so a client may update just one of the pair) and re-checks the
 * merged result with `isValidPriceFlagCombo` before writing.
 */
export const updateComponentRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  category: z.optional(catalogCategorySchema),
  tags: adminTagsInputSchema.transform(normalizeTags).optional(),
  latestVersion: z.optional(semverSchema),
  price: catalogPriceSchema.nullable().optional(),
  requiresPaymentForUpdate: z.boolean().optional(),
  // No `.default()` — same Zod 4 optional-default trap as `tags` above.
  accessTier: componentAccessTierSchema.optional(),
})

export type CreateComponentRequest = z.infer<typeof createComponentRequestSchema>
export type UpdateComponentRequest = z.infer<typeof updateComponentRequestSchema>
