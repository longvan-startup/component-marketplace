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

/** Shared semantic version syntax for catalog and registry contracts. */
export const catalogVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'version must be semantic (x.y.z)')
const semverSchema = catalogVersionSchema

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

/** Admin catalog rows expose publication state without returning author data. */
export const adminComponentListItemSchema = z.object({
  slug: catalogSlugSchema,
  name: z.string().min(1).max(120),
  category: catalogCategorySchema,
  accessTier: componentAccessTierSchema,
  isPublished: z.boolean(),
  latestVersion: semverSchema,
})

/** Admin list filter and pagination. `published` arrives as a query string. */
export const adminComponentsListRequestSchema = z.object({
  published: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: pageNumberSchema.default(1),
  pageSize: pageSizeNumberSchema.default(12),
})

export const adminComponentsListResponseSchema = z.object({
  items: z.array(adminComponentListItemSchema),
  page: pageNumberSchema,
  pageSize: pageSizeNumberSchema,
  total: z.number().int().min(0),
})

/** Detail responses are wrapped (`{ item }`) so new sibling fields (e.g.
 * next/prev slug) can ship without breaking the envelope later. */
export const detailResponseSchema = z.object({
  item: componentSchema,
})

function isSafeRegistryFilePath(path: string): boolean {
  if (path.startsWith('/') || path.includes('\\')) return false

  return path.split('/').every((segment) => {
    if (
      segment.length === 0 ||
      segment === '.' ||
      segment === '..' ||
      segment.startsWith('.') ||
      /[<>:"|?*]/u.test(segment)
    ) {
      return false
    }

    for (const character of segment) {
      const codePoint = character.codePointAt(0)
      if (codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f)) return false
    }

    return true
  })
}

const registryFilePathSchema = z
  .string()
  .min(1)
  .max(240)
  .refine(isSafeRegistryFilePath, 'path must be a safe relative file path')

/** One installable text file with a safe repository-relative path. */
export const registryFileSchema = z.object({
  path: registryFilePathSchema,
  content: z.string(),
})

/** Response for the source files of one published Free catalog item. */
export const registryResponseSchema = z.object({
  item: z.object({
    slug: catalogSlugSchema,
    version: semverSchema,
    files: z.array(registryFileSchema).min(1).max(100),
  }),
})

export type RegistryFile = z.infer<typeof registryFileSchema>
export type RegistryResponse = z.infer<typeof registryResponseSchema>

export type CatalogListRequest = z.input<typeof listRequestSchema>
export type CatalogListQuery = z.output<typeof listRequestSchema>
export type CatalogListResponse = z.infer<typeof listResponseSchema>
export type AdminComponentListItem = z.infer<typeof adminComponentListItemSchema>
export type AdminComponentsListRequest = z.input<typeof adminComponentsListRequestSchema>
export type AdminComponentsListQuery = z.output<typeof adminComponentsListRequestSchema>
export type AdminComponentsListResponse = z.infer<typeof adminComponentsListResponseSchema>
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
