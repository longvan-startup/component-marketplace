/**
 * apps/api/src/catalog/queries.ts — truy vấn đọc catalog (issue #31).
 *
 * Danh sách lựa chọn scope nhỏ-nhất-có-dùng (ghi rõ để review):
 *   - `q`      : ILIKE trên name / slug / description (substring).
 *   - category : exact match trên enum hợp đồng (`animation`,
 *                `react-component`, `tool`).
 *   - tag      : exact match một tag trong mảng tags.
 *   - sort     : 'newest' (mặc định, createdAt DESC) / 'name' (ASC).
 *   - Pagination SQL thật (LIMIT/OFFSET) + đếm tổng riêng — không load all.
 *
 * Mọi query CHỈ list hàng `isPublished = true` (catalog công khai; unpublished
 * 404 ở detail và không bao giờ xuất hiện trong list). Đây là hàm monomorphic
 * trên `Database` của `@marketplace/db` — tests truyền handle thật (xem
 * `integration.test.ts`) hoặc mock khi chỉ cần logic.
 *
 * `getComponentAnyStatus` (#111) là ngoại lệ DUY NHẤT không filter theo
 * `isPublished` — chỉ dùng bởi admin-queries.ts (route đã qua `requireRole
 * ('admin')`), không bao giờ expose qua route public.
 */

import { type DatabaseHandle, schema } from '@marketplace/db'
import type { CatalogListQuery } from '@marketplace/shared'
import { and, arrayContains, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'

import type { CatalogRow } from './mapper'

const { components, users } = schema

/**
 * SELECT shape dùng chung cho list + detail: đủ trường public + authorName.
 * Không select createdAt/updatedAt/authorId — không thể rò dù lơ là.
 */
export const rowShape = {
  id: components.id,
  slug: components.slug,
  name: components.name,
  description: components.description,
  category: components.category,
  tags: components.tags,
  latestVersion: components.latestVersion,
  isPublished: components.isPublished,
  priceAmountMinor: components.priceAmountMinor,
  priceCurrency: components.priceCurrency,
  requiresPaymentForUpdate: components.requiresPaymentForUpdate,
  accessTier: components.accessTier,
  authorName: users.name,
}

function publishedFilters(request?: CatalogListQuery): SQL[] {
  const filters: SQL[] = [eq(components.isPublished, true)]
  if (request) {
    if (request.q !== undefined) {
      const like = `%${request.q}%`
      const qMatch = or(
        ilike(components.name, like),
        ilike(components.slug, like),
        ilike(components.description, like),
      )
      if (qMatch) filters.push(qMatch)
    }
    if (request.category !== undefined) {
      filters.push(eq(components.category, request.category))
    }
    if (request.tag !== undefined) {
      filters.push(arrayContains(components.tags, [request.tag]))
    }
  }
  return filters
}

/** List public components theo request — trả rows + total để routes đóng gói. */
export async function listComponents(
  db: DatabaseHandle,
  request: CatalogListQuery,
): Promise<{ rows: CatalogRow[]; total: number }> {
  const where = and(...publishedFilters(request))
  const order =
    request.sort === 'name'
      ? asc(components.name)
      : // 'newest' — tie-break bằng name ASC cho ổn định trang khi nhiều row
        // cùng mốc createdAt (defaultNow trong 1 transaction).
        desc(components.createdAt)

  const rows = (await db.db
    .select(rowShape)
    .from(components)
    .leftJoin(users, eq(components.authorId, users.id))
    .where(where)
    .orderBy(order, asc(components.name))
    .limit(request.pageSize)
    .offset((request.page - 1) * request.pageSize)) as unknown as CatalogRow[]

  const countRows = await db.db.select({ value: count() }).from(components).where(where)
  const total = countRows[0]?.value ?? 0

  return { rows, total: Number(total) }
}

/** Lấy 1 component PUBLISHED theo slug — null ⇒ routes trả 404. */
export async function getComponentBySlug(
  db: DatabaseHandle,
  slug: string,
): Promise<CatalogRow | null> {
  const rows = (await db.db
    .select(rowShape)
    .from(components)
    .leftJoin(users, eq(components.authorId, users.id))
    .where(and(eq(components.slug, slug), eq(components.isPublished, true)))
    .limit(1)) as unknown as CatalogRow[]
  return rows[0] ?? null
}

/** Lấy 1 component THEO SLUG bất kể trạng thái publish — chỉ dùng cho admin. */
export async function getComponentAnyStatus(
  db: DatabaseHandle,
  slug: string,
): Promise<CatalogRow | null> {
  const rows = (await db.db
    .select(rowShape)
    .from(components)
    .leftJoin(users, eq(components.authorId, users.id))
    .where(eq(components.slug, slug))
    .limit(1)) as unknown as CatalogRow[]
  return rows[0] ?? null
}
