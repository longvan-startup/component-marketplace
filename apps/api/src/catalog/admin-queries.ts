/**
 * apps/api/src/catalog/admin-queries.ts — ghi dữ liệu catalog cho admin (#111).
 *
 * Tách khỏi queries.ts (chỉ đọc công khai): các hàm ở đây GHI DB và chỉ được
 * gọi sau `requireRole('admin')` ở route. Mọi hàm trả `CatalogRow` (shape an
 * toàn, không authorId/timestamps) qua `getComponentAnyStatus`, không bao giờ
 * trả thẳng kết quả `.returning()`/`.update()` của Drizzle.
 */

import { type DatabaseHandle, schema } from '@marketplace/db'
import type {
  CatalogCategory,
  CreateComponentRequest,
  UpdateComponentRequest,
} from '@marketplace/shared'
import { isValidPriceFlagCombo } from '@marketplace/shared'
import { eq } from 'drizzle-orm'

import { ApiHttpError } from '../errors'
import { slugify } from './admin-requests'
import type { CatalogRow } from './mapper'
import { getComponentAnyStatus } from './queries'

const { components } = schema

/** Postgres unique-violation error code (`unique_violation`). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  )
}

async function slugExists(db: DatabaseHandle, slug: string): Promise<boolean> {
  const rows = await db.db
    .select({ slug: components.slug })
    .from(components)
    .where(eq(components.slug, slug))
    .limit(1)
  return rows.length > 0
}

/**
 * Base slug từ `name`, thêm `-2`, `-3`... khi trùng. Giới hạn 1000 lần thử để
 * tránh loop vô hạn nếu dữ liệu bất thường — thực tế admin không tạo hàng
 * nghìn component cùng tên.
 */
async function findUniqueSlug(db: DatabaseHandle, name: string): Promise<string> {
  const base = slugify(name)
  let candidate = base
  for (let suffix = 2; suffix <= 1000; suffix++) {
    if (!(await slugExists(db, candidate))) return candidate
    candidate = `${base}-${suffix}`
  }
  throw new ApiHttpError(409, 'SLUG_GENERATION_FAILED', 'Could not generate a unique slug')
}

function reconstructPrice(row: CatalogRow): { amountMinor: number; currency: string } | null {
  return row.priceAmountMinor === null
    ? null
    : { amountMinor: row.priceAmountMinor, currency: row.priceCurrency as string }
}

/** Tạo draft mới — LUÔN `isPublished=false` bất kể client gửi gì (không có
 * field đó trong `createComponentRequestSchema`). Slug tự sinh, không nhận
 * từ client. Trùng slug giữa lúc check và insert (race hiếm) ⇒ 409. */
export async function insertComponent(
  db: DatabaseHandle,
  input: CreateComponentRequest,
  authorId: string,
): Promise<CatalogRow> {
  const slug = await findUniqueSlug(db, input.name)

  try {
    await db.db.insert(components).values({
      slug,
      name: input.name,
      description: input.description,
      category: input.category,
      tags: input.tags,
      latestVersion: input.latestVersion,
      isPublished: false,
      priceAmountMinor: input.price?.amountMinor ?? null,
      priceCurrency: input.price?.currency ?? null,
      requiresPaymentForUpdate: input.requiresPaymentForUpdate,
      authorId,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiHttpError(409, 'SLUG_CONFLICT', 'A component with this slug already exists')
    }
    throw error
  }

  const row = await getComponentAnyStatus(db, slug)
  if (!row) throw new Error('Component insert succeeded but could not be re-read')
  return row
}

/**
 * Sửa metadata — PATCH semantics. price/requiresPaymentForUpdate merge lên
 * giá trị hiện tại của row TRƯỚC khi check combo, nên client có thể gửi chỉ
 * 1 trong 2 field (ví dụ đổi giá của component đã paid) mà không phải lặp lại
 * field còn lại. Không đổi `isPublished` — đó là hành động riêng.
 */
export async function updateComponent(
  db: DatabaseHandle,
  slug: string,
  patch: UpdateComponentRequest,
): Promise<CatalogRow> {
  const row = await getComponentAnyStatus(db, slug)
  if (!row) throw new ApiHttpError(404, 'NOT_FOUND', 'Component not found')

  const mergedPrice = Object.hasOwn(patch, 'price') ? (patch.price ?? null) : reconstructPrice(row)
  const mergedFlag = patch.requiresPaymentForUpdate ?? row.requiresPaymentForUpdate

  if (!isValidPriceFlagCombo(mergedPrice, mergedFlag)) {
    throw new ApiHttpError(
      422,
      'VALIDATION_BODY',
      'A free component needs price=null and requiresPaymentForUpdate=false; a paid component needs both set',
    )
  }

  await db.db
    .update(components)
    .set({
      name: patch.name ?? row.name,
      description: Object.hasOwn(patch, 'description') ? patch.description : row.description,
      category: (patch.category ?? row.category) as CatalogCategory,
      tags: patch.tags ?? row.tags,
      latestVersion: patch.latestVersion ?? row.latestVersion,
      priceAmountMinor: mergedPrice?.amountMinor ?? null,
      priceCurrency: mergedPrice?.currency ?? null,
      requiresPaymentForUpdate: mergedFlag,
    })
    .where(eq(components.slug, slug))

  const updated = await getComponentAnyStatus(db, slug)
  if (!updated) throw new Error('Component update succeeded but could not be re-read')
  return updated
}

/** Publish/unpublish — idempotent: lặp lại hành động đã ở đúng trạng thái là
 * no-op (vẫn 200 với row hiện tại), không phải lỗi. Item không tồn tại ⇒ 404. */
export async function setPublished(
  db: DatabaseHandle,
  slug: string,
  isPublished: boolean,
): Promise<CatalogRow> {
  const row = await getComponentAnyStatus(db, slug)
  if (!row) throw new ApiHttpError(404, 'NOT_FOUND', 'Component not found')

  if (row.isPublished !== isPublished) {
    await db.db.update(components).set({ isPublished }).where(eq(components.slug, slug))
  }

  const updated = await getComponentAnyStatus(db, slug)
  if (!updated) throw new Error('Component publish-state update succeeded but could not be re-read')
  return updated
}
