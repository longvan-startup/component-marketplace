/**
 * apps/api/src/catalog — DB row → public catalog DTO mapper.
 *
 * Quy tắc (docs/ENGINEERING.md): không bao giờ rò rỉ model DB ra public API.
 * Lớp này là điểm chuyển đổi DUY NHẤT giữa row Drizzle và `componentSchema`
 * của `@marketplace/shared`:
 *   - LUÔN đi qua `componentSchema.parse`: field lạ strip + violated shape →
 *     throw (fail loud, thành 500 INTERNAL_ERROR) — dữ liệu xấu không vào UI.
 *   - Field nội bộ (createdAt, updatedAt, authorId...) không nằm trong shape
 *     của parse ⇒ bị loại tự nhiên.
 *
 * `summary` (issue #41/#31): hợp đồng yêu cầu `summary` (1..300) nhưng bảng
 * `components` chưa có cột này. Owner đã chốt PHƯƠNG ÁN A ở #41: derive từ
 * `description` ở tầng mapper, không cần migration:
 *   - description != null → summary = 300 kí tự đầu của description.
 *   - description null    → dùng `name` cho cả `summary` lẫn `description`
 *     (đảm bảo min(1) của hợp đồng mà không chế dữ liệu).
 * Chỉ thêm cột riêng nếu sau này creator cần viết teaser khác description.
 *
 * `author` (D6/#41): join `users.name`; hàng không author hoặc name rỗng →
 * 'anonymous' (handle vẫn pass regex của hợp đồng).
 */

import { type CatalogComponent, componentSchema } from '@marketplace/shared'

/** Số kí tự tối đa của summary theo hợp đồng (catalog.ts: max(300)). */
export const SUMMARY_MAX_LENGTH = 300

/**
 * Array select shape dùng bởi queries.ts — ĐỦ field public + authorName của
 * join. Mục đích: row trả về không bao giờ được chứa timestamp/authorId ngay
 * từ tầng select (defense in depth với parser).
 */
export interface CatalogRow {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  tags: string[]
  latestVersion: string
  isPublished: boolean
  priceAmountMinor: number | null
  priceCurrency: string | null
  requiresPaymentForUpdate: boolean
  accessTier: 'free' | 'pro'
  /** Tên hiển thị từ LEFT JOIN users — null khi component không có author. */
  authorName: string | null
}

/** Row DB (đã join authorName) → DTO công khai đã validate theo contract. */
export function toCatalogComponent(row: CatalogRow): CatalogComponent {
  const descriptionText = row.description?.trim() ?? ''
  const description =
    descriptionText.length > 0
      ? descriptionText
      : // description null/rỗng — dùng name, vẫn thỏa min(1)..max(5000).
        row.name

  return componentSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: description.slice(0, SUMMARY_MAX_LENGTH),
    description,
    // Parse vẫn kiểm tra contract để dữ liệu legacy không hợp lệ fail loud.
    category: row.category,
    tags: row.tags,
    latestVersion: row.latestVersion,
    author: row.authorName && row.authorName.trim() !== '' ? row.authorName.trim() : 'anonymous',
    isPublished: row.isPublished,
    price:
      row.priceAmountMinor === null && row.priceCurrency === null
        ? null
        : { amountMinor: row.priceAmountMinor, currency: row.priceCurrency },
    requiresPaymentForUpdate: row.requiresPaymentForUpdate,
    accessTier: row.accessTier,
  })
}
