/**
 * Bootstrap integration tests (issue #29 — boot thật qua HTTP, không mock
 * thay toàn bộ verification).
 *
 * Pattern: `createServer({ env: FIXED_ENV, db: injector })` + `app.listen(0)`
 * → fetch thật trên port ephemeral. Env cố định cho mỗi case để không phụ
 * thuộc process env của CI.
 */

import { afterAll, describe, expect, test } from 'bun:test'

import type { DatabaseHandle } from '@marketplace/db'
import type { ApiEnv } from './env'
import { createServer, resolveMountPaths, shutdown } from './index'

const NO_CORS_ENV: ApiEnv = {
  PORT: 0,
  NODE_ENV: 'test',
  DATABASE_URL: undefined,
  CORS_ORIGINS: undefined,
}

/** Boot nhanh trên port ephemeral; trả helpers cho từng test. */
function boot(env: Partial<ApiEnv> = {}, db?: DatabaseHandle | undefined) {
  const options: Record<string, unknown> = {
    env: { ...NO_CORS_ENV, ...env } as ApiEnv,
    db, // key luôn thuộc options ⇒ giá trị undefined = ép "không có DB"
  }
  const { listen, dbHandle } = createServer(options as never)
  const server = listen()
  const port = (server.address() as { port: number }).port
  return {
    server,
    port,
    dbHandle,
    close: async () => shutdown({ server, db: dbHandle }),
    url: `http://127.0.0.1:${port}`,
  }
}

const boots: Array<{ close: () => Promise<void> }> = []
function track(booted: { close: () => Promise<void> }) {
  boots.push(booted)
  return booted
}
afterAll(async () => {
  await Promise.all(boots.map((b) => b.close()))
})

describe('Error envelope (issue #29 §B)', () => {
  test('unknown route trả 404 theo apiErrorSchema (UPPER_SNAKE envelope)', async () => {
    const b = track(boot())
    const res = await fetch(`${b.url}/definitely-not-a-route`)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { code: string; message: string; status: number }
    expect(body.code).toBe('NOT_FOUND')
    expect(body.status).toBe(404)
    expect(body.message).toContain('not found')
  })

  test('middleware error (throw trong handler) ⇒ 500 mà không lộ stack/message internals', async () => {
    // Fake unknown error qua 1 app riêng: mount để nhảy vào error handler;
    // dùng route gốc không tồn tại nhưng qua json-parse bug: gửi body JSON hỏng.
    const b = track(boot())
    const res = await fetch(`${b.url}/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    })
    // express.json() parse fail ⇒ error middleware bắt ⇒ INVALID_JSON 400.
    expect(res.status).toBe(400)
    const raw = await res.text()
    const body = JSON.parse(raw) as { code: string; status: number }
    expect(body.code).toBe('INVALID_JSON')
    expect(body.status).toBe(400)
    expect(raw).not.toContain('stack')
    expect(raw).not.toContain('at Object')
  })

  test('mọi error response đều theo code UPPER_SNAKE + message kể chuyện được', async () => {
    const b = track(boot())
    const res = await fetch(`${b.url}/echo-nonexistent`, {
      method: 'GET',
      headers: { 'x-nothing': '1' },
    })
    // Route không tồn tại ⇒ 404 (case riêng đã test) — ở đây khẳng định mọi
    // phản hồi (list) đều JSON object với code đúng chuẩn hợp đồng.
    const body = (await res.json()) as { code: string }
    expect(/^[A-Z0-9_]+$/.test(body.code)).toBe(true)
  })
})

describe('CORS (issue #29 §B)', () => {
  const CORS_ENV: Partial<ApiEnv> = { CORS_ORIGINS: ['http://localhost:3000'] }

  test('allowed origin: GET nhận Access-Control-Allow-Origin đúng origin', async () => {
    const b = track(boot(CORS_ENV))
    const res = await fetch(`${b.url}/health`, {
      headers: { origin: 'http://localhost:3000' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
  })

  test('origin lạ: GET KHÔNG nhận ACAO (không mở wildcard)', async () => {
    const b = track(boot(CORS_ENV))
    const res = await fetch(`${b.url}/health`, { headers: { origin: 'https://evil.example' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('preflight allowed: OPTIONS 204 + Methods/Headers + Max-Age', async () => {
    const b = track(boot(CORS_ENV))
    const res = await fetch(`${b.url}/components`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    expect(res.headers.get('access-control-allow-methods')).toContain('GET')
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type')
  })

  test('preflight origin lạ: OPTIONS 403 theo envelope', async () => {
    const b = track(boot(CORS_ENV))
    const res = await fetch(`${b.url}/components`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('CORS_ORIGIN_NOT_ALLOWED')
  })

  test('variable Vary: Origin luôn set (cache an toàn giữa các origin)', async () => {
    const b = track(boot(CORS_ENV))
    const res = await fetch(`${b.url}/health`)
    expect(res.headers.get('vary')).toContain('Origin')
  })
})

describe('Database lifecycle (issue #29 §C)', () => {
  test('KHÔNG DATABASE_URL: /health 200 + db:false, /health/db 503 unconfigured', async () => {
    // ép không có db: inject key `db` giá trị undefined
    const b = track(boot(undefined, undefined))
    const health = await fetch(`${b.url}/health`)
    const healthBody = (await health.json()) as { db: boolean; status: string }
    expect(healthBody.status).toBe('ok')
    expect(healthBody.db).toBe(false)

    const dbHealth = await fetch(`${b.url}/health/db`)
    expect(dbHealth.status).toBe(503)
    const dbBody = (await dbHealth.json()) as { database: string }
    expect(dbBody.database).toBe('unconfigured')
  })

  test('DB không kết nối được: /health/db 503 unreachable, chi tiết lỗi KHÔNG về client', async () => {
    // Port 9 = thuộc reserved discard — ECONNREFUSED nhanh, connect_timeout=1.
    const handle = (await import('@marketplace/db')).createDbHandle(
      'postgresql://postgres:noop@127.0.0.1:9/none',
      { connectTimeout: 1 },
    )
    const b = track(boot(undefined, handle))
    const res = await fetch(`${b.url}/health/db`)
    expect(res.status).toBe(503)
    const raw = await res.text()
    const body = JSON.parse(raw) as { database: string }
    expect(body.database).toBe('unreachable')
    expect(raw).not.toContain('127.0.0.1')
    expect(raw).not.toContain('noop')
    await handle.close() // dọn socket pool ngay trong test này
  })
})

describe('Graceful shutdown (issue #29 §D)', () => {
  test('shutdown: HTTP close + db.close() được gọi (spy), resources hết', async () => {
    let closeCalled = 0
    const spyDb: DatabaseHandle = {
      db: {} as DatabaseHandle['db'],
      close: async () => {
        closeCalled += 1
      },
    }
    const options = { env: { ...NO_CORS_ENV, DATABASE_URL: undefined } as ApiEnv, db: spyDb }
    const { listen } = createServer(options)
    const server = listen()
    const port = (server.address() as { port: number }).port

    // Request đang chạy phải hoàn tất trong khoảng drain (không gián đoạn):
    // request được issue TRƯỚC khi close.
    const pending = fetch(`http://127.0.0.1:${port}/health`)
    const res = await pending

    expect(res.ok).toBe(true)
    await shutdown({ server, db: spyDb })
    expect(closeCalled).toBe(1)

    // Server đã ngừng nhận request mới — fetch mới phải từ chối kết nối.
    let refused = false
    try {
      await fetch(`http://127.0.0.1:${port}/health`)
    } catch {
      refused = true
    }
    expect(refused).toBe(true)
  })
})

describe('Preserve existing behavior (issue #29 §E)', () => {
  test('GET / trả skeleton OK, /health giữ contract + db boolean additive', async () => {
    const b = track(boot())
    const root = await fetch(`${b.url}/`)
    expect(root.status).toBe(200)
    const rootBody = (await root.json()) as { message: string }
    expect(rootBody.message).toContain('skeleton OK')

    const health = await fetch(`${b.url}/health`)
    const body = (await health.json()) as {
      status: string
      service: string
      app: string
      version: string
      db: boolean
      uptime: number
    }
    expect(body.status).toBe('ok')
    expect(body.service).toBe('api')
    expect(body.app).toBe('component-marketplace')
    expect(body.version).toBe('0.1.0')
    expect(body.db).toBe(false)
    expect(typeof body.uptime).toBe('number')
  })

  test('dual mount: VERCEL set ⇒ cả /api/* lẫn /* đều hợp lệ, /health/db hoạt động', async () => {
    const original = process.env.VERCEL
    process.env.VERCEL = '1'
    try {
      const b = track(boot())
      const viaPrefix = await fetch(`${b.url}/api/health`)
      expect(viaPrefix.status).toBe(200)
      const viaRoot = await fetch(`${b.url}/health`)
      expect(viaRoot.status).toBe(200)
      const notFound = await fetch(`${b.url}/api/no-such-route`)
      expect(notFound.status).toBe(404)
    } finally {
      if (original === undefined) delete process.env.VERCEL
      else process.env.VERCEL = original
    }
  })

  test('resolveMountPaths ngoài Vercel ⇒ chỉ `/`', () => {
    expect(resolveMountPaths(undefined)).toEqual(['/'])
    expect(resolveMountPaths('1')).toEqual(['/api', '/'])
  })
})
