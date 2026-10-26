/**
 * Smoke test thật (bun:test): boot server trên port ephemeral,
 * gọi GET /health và GET /, assert đúng contract đã cam kết.
 *
 * Là "contract" mà Docker healthcheck (compose) và CI runtime kiểm tra.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { parseApiEnv } from './env'
import { createServer, resolveMountPaths } from './index'

// Env cố định (không phụ thuộc .env thật/process env của CI):	tests contract
// phải tự vạch — DATABASE_URL luôn vắng để /health/db khẳng định 503 unconfig.
const fixedEnv = parseApiEnv({})

const { app } = createServer({ env: fixedEnv })

const server = app.listen(0)
const port = (server.address() as { port: number }).port

afterAll(() => {
  server.close()
})

describe('API smoke', () => {
  test('GET /health trả 200 đúng contract', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      status: string
      service: string
      app: string
      version: string
    }
    expect(body.status).toBe('ok')
    expect(body.service).toBe('api')
    expect(body.app).toBe('component-marketplace')
    expect(body.version).toBe('0.1.0')
  })

  test('GET /health/db: 503 khi chưa cấu hình DATABASE_URL (không lộ chi tiết lỗi)', async () => {
    // Backup/restore env — handler đọc DATABASE_URL lúc request, nên xoá env tạm là đủ
    const original = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health/db`)

      expect(res.status).toBe(503)
      const body = (await res.json()) as { status: string; database: string; error?: string }
      expect(body.status).toBe('degraded')
      expect(body.database).toBe('unconfigured')
      // Không được trả chi tiết lỗi database về client
      expect(body.error).toBeUndefined()
    } finally {
      if (original !== undefined) process.env.DATABASE_URL = original
    }
  })

  test('GET / trả 200 — API đã boot', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`)

    expect(res.status).toBe(200)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain('skeleton OK')
  })
})

describe('Vercel Services mounts (env VERCEL)', () => {
  test('mặc định (Docker/host): chỉ mount `/`', () => {
    expect(resolveMountPaths(undefined)).toEqual(['/'])
  })

  test('VERCEL set: mount song song `/api` + `/` — public ingress dùng prefix, binding calls không', async () => {
    process.env.VERCEL = '1'
    try {
      const { app: vercelApp } = createServer({ env: fixedEnv })
      const s = vercelApp.listen(0)
      const p = (s.address() as { port: number }).port
      try {
        // Public surface qua rewrite: same path prefix /api (docs/services/routing)
        const viaPrefix = await fetch(`http://127.0.0.1:${p}/api/health`)
        expect(viaPrefix.status).toBe(200)

        // Internal binding call không đi qua rewrite: path gốc vẫn hoạt động
        const viaBinding = await fetch(`http://127.0.0.1:${p}/health`)
        expect(viaBinding.status).toBe(200)
      } finally {
        s.close()
      }
    } finally {
      delete process.env.VERCEL
    }
  })
})
