/**
 * apps/api — env validation (issue #29 §A).
 *
 * Env là chuyện của từng app: schema NẰM TRONG `apps/api`, KHÔNG đưa lên
 * `packages/shared` (shared phải free framework/config per-app).
 *
 * Quy tắc an toàn:
 * - Message lỗi chỉ nêu TÊN biến + lý do sai — không bao giờ in giá trị
 *   (DATABASE_URL chứa credentials, CORS_ORIGINS/PORT thì đừng để lộ).
 * - `DATABASE_URL` TÙY CHỌN ở level parse: renderer giữ đúng hành vi hiện tại
 *   (thiếu ⇒ `/health` vẫn OK, `/health/db` 503 degraded — compose không chết,
 *   service Vercel cũng vậy). Validate giá trị sai định dạng ⇒ fail boot.
 * - Unknown variables: được bỏ qua (Vercel/compose inject thêm nhiều biến,
 *   schema config-only, không reject toàn env).
 */

import { z } from 'zod'

export const nodeEnvSchema = z.enum(['development', 'test', 'production'])

const envConfigSchema = z.object({
  PORT: z.coerce
    .number()
    .int()
    .min(1, 'PORT must be >= 1')
    .max(65535, 'PORT must be <= 65535')
    .default(4000),
  NODE_ENV: nodeEnvSchema.default('development'),
  DATABASE_URL: z
    .string()
    .optional()
    // Biến được set nhưng rỗng/trắng = "không cấu hình" — degraded như cũ.
    .transform((raw) => (raw && raw.trim() !== '' ? raw : undefined))
    // Chỉ kiểm định dạng cho URL THẬT (undefined = degraded hợp lệ).
    .refine(
      (url) => url === undefined || /^postgres(ql)?:\/\//.test(url),
      'DATABASE_URL must be a postgres:// URL',
    ),
  /** CSV list of exact-match origins, e.g. `CORS_ORIGINS=http://localhost:3000`. */
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((raw) => {
      if (raw === undefined) return undefined
      const origins = raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
      return origins.length > 0 ? origins : undefined
    }),
})

export type ApiEnv = z.infer<typeof envConfigSchema>

/** Message format an toàn (issue tên biến, không log giá trị). */
export class ApiConfigError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) {
    super(`Invalid API configuration (${issues.length} issue(s)): ${issues.join('; ')}`)
    this.name = 'ApiConfigError'
    this.issues = issues
  }
}

/** Chuyển zod issue sang chuỗi nêu TÊN biến — không bao giờ chứa giá trị. */
export function formatConfigIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `${field}: ${issue.message}`
  })
}

/**
 * Parse + validate env. Ném `ApiConfigError` khi sai — caller (entrypoint)
 * quyết fail-loudly (exit 1). Tests inject source riêng để không chạm
 * `process.env` thật.
 */
export function parseApiEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  const result = envConfigSchema.safeParse(source)
  if (!result.success) {
    throw new ApiConfigError(formatConfigIssues(result.error))
  }
  return result.data
}
