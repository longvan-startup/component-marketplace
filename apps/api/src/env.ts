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

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { z } from 'zod'

export const nodeEnvSchema = z.enum(['development', 'test', 'production'])

const envConfigSchema = z
  .object({
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
    BETTER_AUTH_SECRET: z
      .string()
      .optional()
      .transform((raw) => (raw && raw.trim() !== '' ? raw.trim() : undefined))
      .refine((secret) => secret === undefined || secret.length >= 32, {
        message: 'BETTER_AUTH_SECRET must be at least 32 characters',
      }),
    BETTER_AUTH_URL: z
      .string()
      .optional()
      .transform((raw) => (raw && raw.trim() !== '' ? raw.trim() : undefined))
      .refine(
        (url) => {
          if (url === undefined) return true
          try {
            const parsed = new URL(url)
            return (
              (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
              !parsed.username &&
              !parsed.password
            )
          } catch {
            return false
          }
        },
        { message: 'BETTER_AUTH_URL must be an http(s) URL without credentials' },
      ),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.DATABASE_URL) {
      if (!env.BETTER_AUTH_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['BETTER_AUTH_SECRET'],
          message: 'BETTER_AUTH_SECRET is required when DATABASE_URL is configured in production',
        })
      }
      if (!env.BETTER_AUTH_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['BETTER_AUTH_URL'],
          message: 'BETTER_AUTH_URL is required when DATABASE_URL is configured in production',
        })
      }
    }
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

/* ------------------------------------------------------------------ */
/* Root .env fill (issue #70) — dev convenience                        */
/* ------------------------------------------------------------------ */

/**
 * Chỉ resolve `.env` ở repo root từ thư mục runtime của API — bền vững cho
 * CẢ `./src` (bun dev) lẫn `./dist` (bun start compiled). Không dò `.env`
 * gần hơn trong `apps/api` hoặc ở thư mục cha bên ngoài repo.
 *
 * Ví dụ: '/repo/apps/api/src' (và '/repo/apps/api/dist') → '/repo/.env'
 * @param apiRuntimeDir Thư mục chạy API (`src` khi dev hoặc `dist` sau build).
 * @returns Đường dẫn `.env` ở repo root, hoặc chuỗi rỗng nếu file vắng.
 */
export function resolveRootDotEnvPath(apiRuntimeDir: string): string {
  const candidate = resolve(apiRuntimeDir, '../../../.env')
  return existsSync(candidate) ? candidate : ''
}

/**
 * Đọc một file dotenv và FILL-ONLY vào `target` (mặc định `process.env`):
 *   - key CHƯA tồn tại (kể cả rỗng) mới được gán — env thật luôn thắng.
 *   - bỏ qua dòng trống / comment `#` / dòng không đúng `KEY=VALUE` /
 *     key sai định dạng identifier.
 *   - strip cặp quote ('"…"' / "'…'") bọc đầu–cuối nếu có.
 *   - KHÔNG trả về/log giá trị — chỉ số key đã fill.
 *
 * File không tồn tại ⇒ KHÔNG throw (nhẹ nhàng: CI/tests/Docker/prod không
 * có root .env) — trả 0. File hỏng vì lý do khác (permission…) vẫn throw
 * fail-loud.
 *
 * Motivation (#70): bun chỉ auto-load `.env` theo cwd; `bun run --cwd
 * apps/api` làm root `.env` không bao giờ được nạp khi dev ngoài Docker
 * → guards `requireDb()` trả 503 DATABASE_UNCONFIGURED dù DB đang chạy.
 */
export function applyDotEnvFile(
  filePath: string,
  target: Record<string, string | undefined> = process.env,
): number {
  if (filePath === '') return 0
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw error
  }

  let filled = 0
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    // Fill-ONLY: key nào target đã có (kể cả rỗng) thì giữ nguyên.
    if (key in target) continue
    let value = line.slice(eq + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    target[key] = value
    filled += 1
  }
  return filled
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
