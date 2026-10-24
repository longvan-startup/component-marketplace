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
 * Payments/pricing/licensing/AI fields intentionally absent until the
 * product requirements land (issue #18). Additive changes only — see
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

/** Public author handle (@username). Real identity lives behind auth (#17). */
const authorHandleSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/, 'invalid author handle')

const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semantic (x.y.z)')

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

export const componentSchema = z.object({
  id: z.uuid(),
  slug: catalogSlugSchema,
  name: z.string().min(1).max(120),
  summary: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  category: catalogCategorySchema,
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  latestVersion: semverSchema,
  author: authorHandleSchema,
  isPublished: z.boolean(),
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
