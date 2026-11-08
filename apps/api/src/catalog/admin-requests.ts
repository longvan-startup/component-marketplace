/**
 * apps/api/src/catalog/admin-requests.ts — parsing cho admin catalog CRUD (#111).
 *
 * Cùng pattern với requests.ts: input bẩn đi qua hợp đồng `@marketplace/shared`
 * TRƯỚC khi chạm DB; sai shape ⇒ ApiHttpError 422 (VALIDATION_BODY) với chi
 * tiết issue Zod (path + message only — không echo giá trị client gửi).
 */

import type { CreateComponentRequest, UpdateComponentRequest } from '@marketplace/shared'
import { createComponentRequestSchema, updateComponentRequestSchema } from '@marketplace/shared'

import { ApiHttpError } from '../errors'

function parseWithSchema<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: unknown } },
  body: unknown,
): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const issues = (parsed.error as { issues: { path: PropertyKey[]; message: string }[] }).issues
    const details = issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)'
      return `${path}: ${issue.message}`
    })
    throw new ApiHttpError(422, 'VALIDATION_BODY', 'Invalid request body', details.slice(0, 20))
  }
  return parsed.data as T
}

export function parseCreateComponentRequest(body: unknown): CreateComponentRequest {
  return parseWithSchema(createComponentRequestSchema, body)
}

export function parseUpdateComponentRequest(body: unknown): UpdateComponentRequest {
  return parseWithSchema(updateComponentRequestSchema, body)
}

/**
 * `name` → base slug: bỏ dấu tiếng Việt (kể cả đ/Đ, không tự decompose qua
 * NFD), thường hóa, thay ký tự khác [a-z0-9] bằng `-`, cắt về đúng giới hạn
 * của `catalogSlugSchema` (<=80, không `-` ở đầu/cuối). Rỗng sau khi lọc
 * (ví dụ tên chỉ toàn emoji) ⇒ fallback `'component'` — collision resolver ở
 * admin-queries.ts vẫn thêm suffix nếu trùng.
 */
export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const truncated = base.slice(0, 80).replace(/-+$/g, '')
  return truncated.length > 0 ? truncated : 'component'
}
