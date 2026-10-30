/**
 * API entrypoint — HTTP móng thẳng thắn (issue #29), giữ nguyên hợp đồng cũ.
 *
 * Thứ tự middleware (đọc từ trên xuống trong createServer):
 *   1. CORS allowlist       → match từ CORS_ORIGINS; OPTIONS preflight
 *   2. request log          → 1 dòng JSON, KHÔNG body/cookie/auth;
 *                             bỏ qua /health* (smoke spam)
 *   3. Better Auth          → raw body + response contract nguyên bản
 *   4. json body parse      → express.json() cho các API còn lại
 *   5. apiRoutes            → mount theo resolveMountPaths()
 *   6. 404 + error envelope → các lỗi không thuộc `/api/auth/*`
 *
 * Hai môi trường chạy cùng code (giữ từ #46, KHÔNG đổi):
 * - Docker/host (mặc định): router mount ở `/` — healthcheck & smoke probes
 *   gọi `/health`, `/health/db` như compose đã ghi.
 * - Vercel Services: public rewrite `/{api_path}` route tới service — service
 *   NHẬN path gốc (không strip), nên khi VERCEL set, router mount thêm ở
 *   `/api` song song (internal binding calls (SSR → api) không qua public
 *   rewrite, vẫn dùng path gốc).
 *
 * Không đăng ký signal handlers ở module-được-import: chỉ block
 * `import.meta.main` ký handler, tránh double-register trong bun tests
 * (issue #29 §D).
 */

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDbHandle, type DatabaseHandle } from '@marketplace/db'
import { getAppInfo } from '@marketplace/shared'
import { toNodeHandler } from 'better-auth/node'
import { sql } from 'drizzle-orm'
import express from 'express'
import { createAuth } from './auth/config'
import { toCatalogComponent } from './catalog/mapper'
import { getComponentBySlug, listComponents } from './catalog/queries'
import { parseListRequest, parseSlugParam } from './catalog/requests'
import { type ApiEnv, applyDotEnvFile, parseApiEnv, resolveRootDotEnvPath } from './env'
import { ApiHttpError, errorHandler, notFoundHandler, sendError } from './errors'

/** Mount paths computed per call so tests can vary the VERCEL env. */
export function resolveMountPaths(env = process.env.VERCEL): string[] {
  // `/api`: public rewrite ingress (docs/services/routing — the service sees
  // the original path, prefix NOT stripped). `/`: internal calls (service
  // binding / docker healthcheck) keep plain root paths. Outside Vercel
  // (Docker) chỉ `/` — compose healthchecks gọi `/health`, unchanged.
  return env ? ['/api', '/'] : ['/']
}

export interface ServerOptions {
  /** Inject env đã-parse (tests) — mặc định parse từ process.env. */
  env?: ApiEnv
  /**
   * Inject db handle (tests). Có key `db` trong options ⇒ dùng đúng giá trị đó
   * (kể cả undefined = ép "không có DB" ⇒ /health/db 503). Không có key ⇒
   * sinh từ DATABASE_URL trong env (nếu có).
   */
  db?: DatabaseHandle | undefined
}

export function createServer(options: ServerOptions = {}) {
  const env = options.env ?? parseApiEnv()

  // postgres.js lazy-connect: tạo handle KHÔNG mở socket — socket mở ở truy
  // vấn đầu tiên (/health/db, endpoint #31...).
  const dbHandle =
    'db' in options ? options.db : env.DATABASE_URL ? createDbHandle(env.DATABASE_URL) : undefined
  const auth =
    dbHandle && env.BETTER_AUTH_SECRET && env.BETTER_AUTH_URL
      ? createAuth(dbHandle.db, env)
      : undefined

  const app = express()

  // Giảm bề mặt: không quảng cáo stack (x-powered-by).
  app.disable('x-powered-by')

  /* --- CORS: allowlist exact-match; preflight; prod không bao giờ `*` --- */
  const allowedOrigins = env.CORS_ORIGINS ?? []
  app.use((req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
    const allowed = origin !== '' && allowedOrigins.includes(origin)

    // Vary: Origin luôn set — middleware cache biết mỗi response có ACAO tùy
    // origin (tránh cache nhầm ACAO của origin khác).
    res.setHeader('Vary', 'Origin')

    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }

    if (req.method === 'OPTIONS') {
      if (!allowed) {
        // Origin lạ: không mở `*` — chặn bằng envelope chuẩn.
        sendError(res, {
          code: 'CORS_ORIGIN_NOT_ALLOWED',
          message: 'Origin not allowed',
          status: 403,
        })
        return
      }
      res.status(204)
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.setHeader('Access-Control-Max-Age', '600')
      res.end()
      return
    }

    next()
  })

  /* --- Request log: 1 dòng JSON; KHÔNG body/cookie/authorization --- */
  app.use((req, res, next) => {
    const pathname = req.path
    if (!pathname.startsWith('/health')) {
      const started = performance.now()
      res.on('finish', () => {
        console.log(
          `[api] ${req.method} ${pathname} ${res.statusCode} ${Math.round(performance.now() - started)}ms`,
        )
      })
    }
    next()
  })

  /* --- Better Auth owns its route contract and must receive the raw body --- */
  const unavailableAuthHandler: express.RequestHandler = (_req, res) => {
    sendError(res, {
      code: 'AUTH_UNAVAILABLE',
      message: 'Authentication is not configured',
      status: 503,
    })
  }
  const authHandler = auth ? toNodeHandler(auth) : unavailableAuthHandler
  app.all('/api/auth', authHandler)
  app.all('/api/auth/*splat', authHandler)

  // Better Auth consumes its own request stream, so the API JSON parser follows
  // the catch-all auth handler (Express 5 ordering requirement).
  app.use(express.json())

  /* --- Routes --- */
  const apiRouter = express.Router()

  // Health — dùng bởi Docker healthcheck & CI smoke test.
  // ADDITIVE so với contract cũ: thêm `db` boolean (orchestrator biết DB đã
  // cấu hình chưa) — các field cũ giữ nguyên loại/giá trị.
  apiRouter.get('/health', (_req, res) => {
    const info = getAppInfo()
    res.status(200).json({
      status: 'ok',
      service: 'api',
      app: info.name,
      version: info.version,
      db: dbHandle !== undefined,
      uptime: process.uptime(),
    })
  })

  // Health DB — ping PostgreSQL qua Drizzle. Chi tiết lỗi (host, credentials)
  // chỉ in VÀO LOG CHUNG 1 câu, không trả về client.
  apiRouter.get('/health/db', async (_req, res) => {
    if (!dbHandle) {
      res.status(503).json({ status: 'degraded', database: 'unconfigured' })
      return
    }
    try {
      await dbHandle.db.execute(sql`select 1`)
      res.status(200).json({ status: 'ok', database: 'connected' })
    } catch {
      console.error('[api] /health/db ping failed (details suppressed)')
      res.status(503).json({ status: 'degraded', database: 'unreachable' })
    }
  })

  // Root — xác nhận skeleton đã boot (giữ nguyên contract cũ, trả message cũ).
  apiRouter.get('/', (_req, res) => {
    res.status(200).json({ message: 'Component Marketplace API — skeleton OK' })
  })

  /* --- Catalog read endpoints (issue #31) ------------------------------- */
  // Guard: dataset nằm trong Postgres — khi chưa cấu hình DATABASE_URL trả
  // 503 DATABASE_UNCONFIGURED (tính "degraded" của #29, bao giờ /health/db).
  const requireDb = () => {
    if (!dbHandle) {
      throw new ApiHttpError(503, 'DATABASE_UNCONFIGURED', 'Database is not configured')
    }
    return dbHandle
  }

  // GET /components — list công khai; query: q, category, sort, page, pageSize
  // (định dạng + biên nằm trong `listRequestSchema` của shared, sai = 422).
  apiRouter.get('/components', async (req, res) => {
    const request = parseListRequest(req.query as unknown as Record<string, unknown>)
    const { rows, total } = await listComponents(requireDb(), request)
    res.status(200).json({
      items: rows.map(toCatalogComponent),
      page: request.page,
      pageSize: request.pageSize,
      total,
    })
  })

  // GET /components/:slug — chi tiết 1 component PUBLISHED; sai slug / không
  // tìm thấy / chưa publish đều 404 NOT_FOUND (không phân biệt để lộ state).
  apiRouter.get('/components/:slug', async (req, res) => {
    const slug = parseSlugParam(req.params.slug)
    const row = await getComponentBySlug(requireDb(), slug)
    if (!row) {
      throw new ApiHttpError(404, 'NOT_FOUND', 'Component not found')
    }
    res.status(200).json({ item: toCatalogComponent(row) })
  })

  for (const mountPath of resolveMountPaths()) {
    app.use(mountPath, apiRouter)
  }

  /* --- 404 + error envelope: mọi path chưa match kết thúc tại hai hàm này --- */
  app.use(notFoundHandler)
  app.use(errorHandler)

  return {
    app,
    /** Dùng bởi import.meta.main + tests; trả http.Server để shutdown(). */
    listen: () => app.listen(env.PORT),
    dbHandle,
    auth,
    env,
  }
}

/**
 * Graceful shutdown (issue #29 §D): server.close() = ngừng nhận request mới +
 * drain request đang chạy; SAU ĐÓ mới `pool.end()` — không rớt connection khi
 * request chưa hoàn tất. Tests gọi trực tiếp; entrypoint nối vào signal.
 */
export async function shutdown(options: {
  server: { close: (callback?: () => void) => void }
  db?: DatabaseHandle | undefined
}): Promise<void> {
  await new Promise<void>((resolve) => {
    options.server.close(() => resolve())
  })
  if (options.db) {
    await options.db.close()
  }
}

/* ------------------------------------------------------------------ */
/* Entrypoint thực thi thật (bun run src/index.ts, container CMD)        */
/* ------------------------------------------------------------------ */

/**
 * Dev-only fill từ repo root `.env` (issue #70): bun chỉ auto-load `.env`
 * theo cwd — `bun run --cwd apps/api` không bao giờ thấy root `.env` nên
 * dev ngoài Docker bị 503 DATABASE_UNCONFIGURED dù DB đang chạy.
 * Fill-ONLY + skip khi production (compose/Vercel inject env thật) và khi
 * test (bun test không đổi hành vi); file thiếu = im lặng.
 */
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  const apiDir = dirname(fileURLToPath(import.meta.url)) // src (dev) | dist (start)
  const filled = applyDotEnvFile(resolveRootDotEnvPath(apiDir))
  if (filled > 0) {
    console.log(`[api] dev env: filled ${filled} variable(s) from repo root .env (fill-only)`)
  }
}

const { app, listen, dbHandle, env } = createServer()

/** Vercel Express runtime entry — chỉ cung cấp app, không listen. */
export default app

if (import.meta.main) {
  let shuttingDown = false
  // Listen ĐÚNG MỘT lần ở đây — server dùng cho shutdown phải là server thật.
  const server = listen()
  console.log(`[api] listening on http://0.0.0.0:${env.PORT}`)

  const handleSignal = (signal: string) => {
    // Tín hiệu lần 2 trong lúc drain ⇒ thoát luôn (tránh chờ quá thời hạn
    // kill timeout của infra). SIGTERM/SIGINT chỉ ký MỘT handler, tại đây.
    if (shuttingDown) {
      process.exit(1)
    }
    shuttingDown = true
    console.log(`[api] ${signal} received — draining connections`)
    void shutdown({ server, db: dbHandle }).then(() => {
      console.log('[api] shutdown complete (http + db pool closed)')
      process.exit(0)
    })
  }

  // Handlers chỉ đăng ký ĐÚNG 1 lần, chỉ khi file được thực thi trực tiếp —
  // tests import module không chạm vào process handlers (#29 §D).
  process.on('SIGTERM', () => handleSignal('SIGTERM'))
  process.on('SIGINT', () => handleSignal('SIGINT'))
}
