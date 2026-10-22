/**
 * API entrypoint — skeleton tối thiểu để boot.
 * KHÔNG chứa business logic (auth, payment, marketplace... tích hợp sau).
 *
 * Export `createServer()` để smoke test (bun test) dùng được;
 * chỉ listen khi chạy trực tiếp (bun run / container CMD).
 */

import { createDb, type Database } from '@marketplace/db'
import { getAppInfo } from '@marketplace/shared'
import { sql } from 'drizzle-orm'
import express from 'express'

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

  // Health check — dùng bởi Docker healthcheck & CI smoke test
  app.get('/health', (_req, res) => {
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
  app.get('/health/db', async (_req, res) => {
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
  app.get('/', (_req, res) => {
    res.status(200).json({ message: 'Component Marketplace API — skeleton OK' })
  })

  return { app, listen: () => app.listen(Number(process.env.PORT ?? 4000)) }
}

if (import.meta.main) {
  const { listen } = createServer()
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
