/**
 * API entrypoint — skeleton tối thiểu để boot.
 * KHÔNG chứa business logic (auth, payment, marketplace... tích hợp sau).
 */

import { createDb, type Database } from '@marketplace/db'
import { getAppInfo } from '@marketplace/shared'
import { sql } from 'drizzle-orm'
import express from 'express'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(express.json())

// Drizzle DB — tạo lazy một lần duy nhất khi có DATABASE_URL
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

// Health check DB — ping PostgreSQL qua Drizzle (503 nếu chưa cấu hình/không kết nối được)
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
    res.status(503).json({
      status: 'degraded',
      database: 'unreachable',
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// Root — xác nhận skeleton đã boot
app.get('/', (_req, res) => {
  res.status(200).json({ message: 'Component Marketplace API — skeleton OK' })
})

const server = app.listen(port, () => {
  console.log(`[api] listening on http://0.0.0.0:${port}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
