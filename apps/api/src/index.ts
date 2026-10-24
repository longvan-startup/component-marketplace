/**
 * API entrypoint — skeleton tối thiểu để boot.
 * KHÔNG chứa business logic (auth, payment, marketplace... tích hợp sau).
 *
 * Hai môi trường chạy cùng một code:
 * - Docker/host (mặc định): routes mount ở `/` — healthcheck & smoke probes
 *   gọi `/health`, `/health/db` như compose đã ghi.
 * - Vercel Services: public rewrite `/{api_path}` route tới service (
 *   docs/services/routing — service NHẬN path gốc, không bị strip prefix),
 *   nên router phải mount thêm ở `/api` (env VERCEL, framework express).
 *   Internal service-binding calls (Next.js SSR → api) không đi qua public
 *   rewrite và vẫn dùng path gốc, nên cả hai mount song song khi VERCEL set.
 *
 * Export `createServer()` để smoke test (bun test) dùng được; framework
 * Express của Vercel dò file `src/index.ts` và cần **default export app**,
 * nên module này cũng export default `app` (chỉ listen khi chạy trực tiếp
 * qua `import.meta.main`).
 */

import { createDb, type Database } from '@marketplace/db'
import { getAppInfo } from '@marketplace/shared'
import { sql } from 'drizzle-orm'
import express from 'express'

/** Mount paths are decided at construction time so tests can vary the VERCEL env. */
export function resolveMountPaths(env = process.env.VERCEL): string[] {
  // `/api`: public rewrite ingress (docs/services/routing — the service sees the
  // original path, prefix NOT stripped). `/`: internal calls (service binding /
  // docker healthcheck) keep using plain root paths. Outside Vercel (Docker),
  // only `/` mounts — compose healthchecks call `/health`, unchanged.
  return env ? ['/api', '/'] : ['/']
}

export function createServer() {
  const app = express()

  app.use(express.json())

  // Drizzle DB — tạo lazy một lần duy nhất khi DATABASE_URL được cấu hình.
  // Không cấu hình = DB health trả 503 (degraded), không làm sập /health.
  let dbInstance: Database | undefined
  function getDb(): Database | undefined {
    const url = process.env.DATABASE_URL
    if (!url) return undefined
    dbInstance ??= createDb(url)
    return dbInstance
  }

  const apiRouter = express.Router()

  // Health check — dùng bởi Docker healthcheck & CI smoke test
  apiRouter.get('/health', (_req, res) => {
    const info = getAppInfo()
    res.status(200).json({
      status: 'ok',
      service: 'api',
      app: info.name,
      version: info.version,
      uptime: process.uptime(),
    })
  })

  // Health check DB — ping PostgreSQL qua Drizzle (503 nếu chưa cấu hình/không kết nối được).
  // Chi tiết lỗi DB chỉ in ra log server, KHÔNG trả về client (tránh lộ thông tin nhạy cảm).
  apiRouter.get('/health/db', async (_req, res) => {
    const db = getDb()
    if (!db) {
      res.status(503).json({ status: 'degraded', database: 'unconfigured' })
      return
    }
    try {
      await db.execute(sql`select 1`)
      res.status(200).json({ status: 'ok', database: 'connected' })
    } catch (error) {
      console.error('[api] /health/db ping failed:', error)
      res.status(503).json({ status: 'degraded', database: 'unreachable' })
    }
  })

  // Root — xác nhận skeleton đã boot
  apiRouter.get('/', (_req, res) => {
    res.status(200).json({ message: 'Component Marketplace API — skeleton OK' })
  })

  for (const mountPath of resolveMountPaths()) {
    app.use(mountPath, apiRouter)
  }

  return { app, listen: () => app.listen(Number(process.env.PORT ?? 4000)) }
}

// Cả Vercel (default export app) và bun run (import.meta.main listen) dùng
// chung một lần construct duy nhất.
const { app, listen } = createServer()

/** Vercel Express runtime entry — chỉ chạy app, không tự listen. */
export default app

if (import.meta.main) {
  const server = listen()
  console.log(`[api] listening on http://0.0.0.0:${process.env.PORT ?? 4000}`)

  // Graceful shutdown
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0))
  })
  process.on('SIGINT', () => {
    server.close(() => process.exit(0))
  })
}
