/**
 * Integration tests cho catalog read endpoints (#31) — Postgres THẬT.
 *
 * Cách chạy:
 *   - CI: service `postgres` của job quality inject `TEST_DATABASE_URL`
 *     (.github/workflows/ci.yml) — suite này chạy thật.
 *   - Local không có DB: `describe.skip` — `bun test` vẫn xanh (gates không
 *     phụ thuộc Docker).
 *
 * Pattern tái dùng migration thật của repo (`bun run db:migrate` =
 * drizzle-kit) trên DB sạch + seed nhỏ + HTTP thật qua `app.listen(0)` —
 * khớp pattern bootstrap.test.ts của #29.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbHandle, type DatabaseHandle, schema } from '@marketplace/db'
import {
  apiErrorSchema,
  componentSchema,
  detailResponseSchema,
  listResponseSchema,
} from '@marketplace/shared'
import { eq, inArray } from 'drizzle-orm'
import express from 'express'
import type { MarketplaceAuth } from '../auth/config'
import { requireAuth, requireRole } from '../auth/guards'
import { createServer, shutdown } from '../index'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip

const SEED_SLUGS = ['hero-section', 'giant-tooltip', 'hidden-draft', 'anonymous-row']
const AUTH_TEST_SECRET = 'auth-integration-test-secret-long-enough-32'
const AUTH_TEST_EMAILS: string[] = []

type AuthUserPayload = {
  id: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  role: 'user' | 'seller' | 'admin'
  [key: string]: unknown
}

type SignUpPayload = { token: string | null; user: AuthUserPayload }

describeIntegration('catalog endpoints (integration, requires TEST_DATABASE_URL)', () => {
  if (!TEST_DB_URL) return // safety for non-bun runners

  let dbHandle: DatabaseHandle
  let auth: MarketplaceAuth
  let baseUrl: string
  let closeServer: () => Promise<void> = async () => {}

  beforeAll(async () => {
    // 1. Migration thật của repo trên DB sạch (drizzle-kit đọc DATABASE_URL).
    const dbDir = new URL('../../../../packages/db', import.meta.url).pathname
    const migrate = Bun.spawnSync({
      cmd: ['bun', 'run', 'db:migrate'],
      cwd: dbDir,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdout: 'inherit',
      stderr: 'inherit',
    })
    if (migrate.exitCode !== 0) throw new Error(`db:migrate failed (exit ${migrate.exitCode})`)

    dbHandle = createDbHandle(TEST_DB_URL, { connectTimeout: 10 })

    // 2. Seed nhỏ: 1 author + 3 published + 1 draft (1 row description null).
    await dbHandle.db.delete(schema.components).where(inArray(schema.components.slug, SEED_SLUGS))
    await dbHandle.db
      .delete(schema.users)
      .where(eq(schema.users.email, 'catalog-author@test.local'))

    const [author] = await dbHandle.db
      .insert(schema.users)
      .values({ email: 'catalog-author@test.local', name: 'van-dev' })
      .returning()

    await dbHandle.db.insert(schema.components).values([
      {
        slug: 'hero-section',
        name: 'Hero Section',
        description: 'A responsive hero section with an overlay title.',
        category: 'react-component',
        tags: ['ui', 'hero'],
        latestVersion: '1.2.3',
        isPublished: true,
        authorId: author.id,
      },
      {
        slug: 'giant-tooltip',
        name: 'Giant Tooltip',
        description: 'x'.repeat(450),
        category: 'animation',
        tags: [],
        latestVersion: '0.3.1',
        isPublished: true,
        authorId: author.id,
      },
      {
        slug: 'anonymous-row',
        name: 'Anonymous Row',
        description: null,
        category: 'tool',
        tags: [],
        latestVersion: '1.0.0',
        isPublished: true,
        authorId: null,
      },
      {
        slug: 'hidden-draft',
        name: 'Hidden Draft',
        description: 'Not published yet.',
        category: 'tool',
        tags: [],
        latestVersion: '0.1.0',
        isPublished: false,
        authorId: author.id,
      },
    ])

    // 3. HTTP thật trên port ephemeral (pattern #29).
    const { app, auth: configuredAuth } = createServer({
      env: {
        PORT: 0,
        NODE_ENV: 'test',
        DATABASE_URL: TEST_DB_URL,
        CORS_ORIGINS: undefined,
        BETTER_AUTH_SECRET: AUTH_TEST_SECRET,
        BETTER_AUTH_URL: 'http://127.0.0.1:4000',
      },
      db: dbHandle,
    })
    if (!configuredAuth) throw new Error('Better Auth was not configured for integration tests')
    auth = configuredAuth
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port
    baseUrl = `http://127.0.0.1:${port}`
    closeServer = () => shutdown({ server, db: dbHandle })
  })

  afterAll(async () => {
    if (!TEST_DB_URL) return
    await dbHandle.db.delete(schema.components).where(inArray(schema.components.slug, SEED_SLUGS))
    await dbHandle.db
      .delete(schema.users)
      .where(inArray(schema.users.email, ['catalog-author@test.local', ...AUTH_TEST_EMAILS]))
    await closeServer()
  })

  /** Helpers: fetch + envelope parse. */
  const get = async (path: string): Promise<{ status: number; body: unknown }> => {
    const res = await fetch(`${baseUrl}${path}`)
    return { status: res.status, body: await res.json() }
  }

  const register = async (requestedRole?: string) => {
    const email = `auth-${crypto.randomUUID()}@test.local`
    const password = 'correct-horse-auth-test'
    AUTH_TEST_EMAILS.push(email)
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Auth Integration User',
        email,
        password,
        ...(requestedRole ? { role: requestedRole } : {}),
      }),
    })
    const payload = (await response.json()) as SignUpPayload
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
    if (!response.ok || !cookie) {
      throw new Error(`Auth signup failed (${response.status})`)
    }
    return { email, password, response, payload, cookie }
  }

  test('GET /components → 200 list envelope, published-only, contract-valid items', async () => {
    const { status, body } = await get('/components')
    expect(status).toBe(200)
    const parsed = listResponseSchema.parse(body)
    expect(parsed).toEqual({ items: parsed.items, page: 1, pageSize: 12, total: 3 })
    expect(parsed.items.map((item) => item.slug).sort()).toEqual([
      'anonymous-row',
      'giant-tooltip',
      'hero-section',
    ])
    // Hidden draft KHÔNG bao giờ lọt.
    expect(parsed.items.some((item) => item.slug === 'hidden-draft')).toBe(false)
    for (const item of parsed.items) {
      // Contrast: parse từ response THẬT (không phải fixture) — contract sống.
      void componentSchema.parse(item)
      expect(Object.keys(item as Record<string, unknown>).some((k) => k === 'createdAt')).toBe(
        false,
      )
      expect(Object.keys(item as Record<string, unknown>).some((k) => k === 'authorId')).toBe(false)
    }
  })

  test('Giant Tooltip giá trị nullable + stripe đúng (summary derive + anonymous)', async () => {
    const { body } = await get('/components/anonymous-row')
    const parsed = detailResponseSchema.parse(body)
    expect(parsed.item.author).toBe('anonymous') // authorId null (D6)
    // description null → fallback name cho cả summary + description (#41 A).
    expect(parsed.item.summary).toBe('Anonymous Row')
    expect(parsed.item.description).toBe('Anonymous Row')
    expect(parsed.item.category).toBe('tool')
  })

  test('GET /components?q=hero — q khớp name', async () => {
    const parsed = listResponseSchema.parse((await get('/components?q=hero')).body)
    expect(parsed.total).toBe(1)
    expect(parsed.items[0]?.slug).toBe('hero-section')
  })

  test('GET /components?q=overlay — q khớp description', async () => {
    const parsed = listResponseSchema.parse((await get('/components?q=overlay')).body)
    expect(parsed.total).toBe(1)
    expect(parsed.items[0]?.slug).toBe('hero-section')
  })

  test('GET /components?category=animation — exact enum filter', async () => {
    const parsed = listResponseSchema.parse((await get('/components?category=animation')).body)
    expect(parsed.total).toBe(1)
    expect(parsed.items[0]?.slug).toBe('giant-tooltip')
  })

  test('GET /components?sort=name — trang ASC theo name', async () => {
    const parsed = listResponseSchema.parse((await get('/components?sort=name')).body)
    const names = parsed.items.map((item) => item.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  test('GET /components?page=2&pageSize=2 — pagination SQL thật', async () => {
    const parsed = listResponseSchema.parse((await get('/components?page=2&pageSize=2')).body)
    expect(parsed.page).toBe(2)
    expect(parsed.pageSize).toBe(2)
    expect(parsed.total).toBe(3) // total là tổng, không phải page size
    expect(parsed.items).toHaveLength(1)
  })

  test('GET /components?category=general — 422 VALIDATION_QUERY envelope', async () => {
    const { status, body } = await get('/components?category=general')
    expect(status).toBe(422)
    const envelope = apiErrorSchema.parse(body)
    expect(envelope.code).toBe('VALIDATION_QUERY')
    expect(envelope.details?.length).toBeGreaterThan(0)
  })

  test('GET /components?page=0 — 422 (biên contract pagination)', async () => {
    const { status, body } = await get('/components?page=0')
    expect(status).toBe(422)
    expect(apiErrorSchema.parse(body).code).toBe('VALIDATION_QUERY')
  })

  test('GET /components/hero-section — 200 detail, contract live', async () => {
    const { status, body } = await get('/components/hero-section')
    expect(status).toBe(200)
    const parsed = detailResponseSchema.parse(body)
    expect(parsed.item.slug).toBe('hero-section')
    expect(parsed.item.author).toBe('van-dev')
    // Interim summary derive = prefix của description.
    expect(parsed.item.description.startsWith(parsed.item.summary)).toBe(true)
  })

  test('GET /components/hidden-draft — 404 (draft không lộ qua detail)', async () => {
    const { status, body } = await get('/components/hidden-draft')
    expect(status).toBe(404)
    const envelope = apiErrorSchema.parse(body)
    expect(envelope.code).toBe('NOT_FOUND')
  })

  test('GET /components/nope — 404 NOT_FOUND envelope', async () => {
    const { status, body } = await get('/components/nope')
    expect(status).toBe(404)
    expect(apiErrorSchema.parse(body).code).toBe('NOT_FOUND')
  })

  test('GET /components/HeroSection — slug không kebab-case → 404 (không chạm DB)', async () => {
    const { status, body } = await get('/components/HeroSection')
    expect(status).toBe(404)
    expect(apiErrorSchema.parse(body).code).toBe('NOT_FOUND')
  })

  test('signup auto-login trả user contract đủ field và bỏ role client gửi lên', async () => {
    const created = await register('admin')
    expect(created.response.status).toBe(200)
    expect(created.payload.user.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(created.payload.user.name).toBe('Auth Integration User')
    expect(created.payload.user.email).toBe(created.email)
    expect(Object.hasOwn(created.payload.user, 'image')).toBe(true)
    expect(
      created.payload.user.image === null || typeof created.payload.user.image === 'string',
    ).toBe(true)
    expect(created.payload.user.emailVerified).toBe(false)
    expect(created.payload.user.role).toBe('user')
    expect(typeof created.payload.token).toBe('string')

    const userKeys = Object.keys(created.payload.user)
    for (const sensitiveKey of [
      'password',
      'passwordHash',
      'password_hash',
      'sessionToken',
      'token',
    ]) {
      expect(userKeys).not.toContain(sensitiveKey)
    }
    expect(JSON.stringify(created.payload.user)).not.toContain(created.password)

    const sessionResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: { cookie: created.cookie },
    })
    expect(sessionResponse.status).toBe(200)
    const sessionPayload = (await sessionResponse.json()) as { user: AuthUserPayload }
    expect(sessionPayload.user).toMatchObject({
      id: created.payload.user.id,
      name: created.payload.user.name,
      email: created.email,
      emailVerified: false,
      role: 'user',
    })
  })

  test('get-session returns null for guest and invalid cookie', async () => {
    const guest = await fetch(`${baseUrl}/api/auth/get-session`)
    expect(guest.status).toBe(200)
    expect(await guest.json()).toBeNull()

    const created = await register()
    const cookieName = created.cookie.split('=', 1)[0]
    const invalid = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: { cookie: `${cookieName}=invalid` },
    })
    expect(invalid.status).toBe(200)
    expect(await invalid.json()).toBeNull()
  })

  test('signin accepts the right password and returns Better Auth error unchanged for a wrong one', async () => {
    const created = await register()
    const wrong = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: created.email, password: 'incorrect-password' }),
    })
    expect(wrong.status).toBe(401)
    const wrongBody = await wrong.json()
    expect(apiErrorSchema.safeParse(wrongBody).success).toBe(false)
    expect(JSON.stringify(wrongBody)).not.toContain('incorrect-password')
    expect(JSON.stringify(wrongBody)).not.toContain('stack')

    const correct = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: created.email, password: created.password }),
    })
    expect(correct.status).toBe(200)
    expect(correct.headers.get('set-cookie')).toContain('HttpOnly')
    const correctPayload = (await correct.json()) as SignUpPayload
    expect(correctPayload.user.email).toBe(created.email)
    expect(correctPayload.user.role).toBe('user')
  })

  test('duplicate signup preserves Better Auth error contract', async () => {
    const created = await register()
    const duplicate = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Auth Integration User',
        email: created.email,
        password: created.password,
      }),
    })
    expect(duplicate.status).toBe(422)
    const body = await duplicate.json()
    expect(apiErrorSchema.safeParse(body).success).toBe(false)
    expect(body).toHaveProperty('message')
  })

  test('signout invalidates the prior session; expired session becomes guest', async () => {
    const created = await register()
    const signedOut = await fetch(`${baseUrl}/api/auth/sign-out`, {
      method: 'POST',
      headers: { cookie: created.cookie },
    })
    expect(signedOut.status).toBe(200)
    expect(signedOut.headers.get('set-cookie')).toContain('Max-Age=0')

    const oldSession = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: { cookie: created.cookie },
    })
    expect(await oldSession.json()).toBeNull()

    const expiring = await register()
    const user = await dbHandle.db.query.users.findFirst({
      where: eq(schema.users.email, expiring.email),
    })
    expect(user).toBeDefined()
    if (!user) throw new Error('Auth test user was not persisted')
    await dbHandle.db
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.sessions.userId, user.id))

    const expired = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: { cookie: expiring.cookie },
    })
    expect(expired.status).toBe(200)
    expect(await expired.json()).toBeNull()
  })

  test('get-session returns each server role and guards use exact role matches', async () => {
    const roleCookies = new Map<'user' | 'seller' | 'admin', string>()
    for (const role of ['user', 'seller', 'admin'] as const) {
      const created = await register()
      const user = await dbHandle.db.query.users.findFirst({
        where: eq(schema.users.email, created.email),
      })
      if (!user) throw new Error('Auth test user was not persisted')
      await dbHandle.db.update(schema.users).set({ role }).where(eq(schema.users.id, user.id))

      const sessionResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
        headers: { cookie: created.cookie },
      })
      expect(sessionResponse.status).toBe(200)
      const payload = (await sessionResponse.json()) as { user: AuthUserPayload }
      expect(payload.user.role).toBe(role)
      roleCookies.set(role, created.cookie)
    }

    const guardApp = express()
    guardApp.get('/seller', requireAuth(auth), requireRole('seller'), (req, res) => {
      res.json({ role: req.authSession?.user.role })
    })
    guardApp.get('/admin', requireAuth(auth), requireRole('admin'), (req, res) => {
      res.json({ role: req.authSession?.user.role })
    })
    const guardServer = guardApp.listen(0)
    const guardPort = (guardServer.address() as { port: number }).port
    const guardUrl = `http://127.0.0.1:${guardPort}`

    try {
      const guest = await fetch(`${guardUrl}/seller`)
      expect(guest.status).toBe(401)
      expect(apiErrorSchema.parse(await guest.json()).code).toBe('UNAUTHENTICATED')

      for (const [role, expectedStatus] of [
        ['user', 403],
        ['seller', 200],
        ['admin', 403],
      ] as const) {
        const sellerResult = await fetch(`${guardUrl}/seller`, {
          headers: { cookie: roleCookies.get(role) ?? '' },
        })
        expect(sellerResult.status).toBe(expectedStatus)
      }

      for (const [role, expectedStatus] of [
        ['user', 403],
        ['seller', 403],
        ['admin', 200],
      ] as const) {
        const adminResult = await fetch(`${guardUrl}/admin`, {
          headers: { cookie: roleCookies.get(role) ?? '' },
        })
        expect(adminResult.status).toBe(expectedStatus)
      }
    } finally {
      await new Promise<void>((resolve) => guardServer.close(() => resolve()))
    }
  })
})
