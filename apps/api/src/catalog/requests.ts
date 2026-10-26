/**
 * apps/api/src/catalog/requests.ts — parsing request cho catalog (#31).
 *
 * Tách khỏi routes để unit test được pure (không cần HTTP): mọi input bẩn
 * từ query/param đi SỚM qua hợp đồng `@marketplace/shared` — sai shape ⇒
 * ApiHttpError trước khi chạm DB.
 *
 * Error codes mới: `VALIDATION_QUERY` (422) — chi tiết issue Zod nằm
 * trong `details` (≤20 entry, CHỈ path + message, không bao giờ chứa giá trị
 * query của client — tránh echo junk/xss vào envelope).
 */

import type { CatalogListQuery } from '@marketplace/shared'
import { catalogSlugSchema, listRequestSchema } from '@marketplace/shared'

import { ApiHttpError } from '../errors'

/** `req.query` có kiểu ParsedQs — cast an toàn chỉ ở biên, parse ngay sau đó. */
export function parseListRequest(query: unknown): CatalogListQuery {
  const parsed = listRequestSchema.safeParse(query)
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)'
      return `${path}: ${issue.message}`
    })
    throw new ApiHttpError(
      422,
      'VALIDATION_QUERY',
      'Invalid query parameters',
      details.slice(0, 20),
    )
  }
  return parsed.data
}

/**
 * Detail endpoint key bằng SLUG (hợp đồng catalog.ts). Slug không hợp lệ
 * (kể cả UPPER_CASE) = không tồn tại ⇒ 404 chủ động — không bao giờ chuyển
 * chuỗi lạ xuống Drizzle.
 */
export function parseSlugParam(raw: unknown): string {
  const result = catalogSlugSchema.safeParse(raw)
  if (!result.success) {
    throw new ApiHttpError(404, 'NOT_FOUND', 'Component not found')
  }
  return result.data
}
