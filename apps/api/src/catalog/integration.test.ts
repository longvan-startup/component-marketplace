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

import { createServer, shutdown } from '../index'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip

const SEED_SLUGS = ['hero-section', 'giant-tooltip', 'hidden-draft', 'anonymous-row']

describeIntegration('catalog endpoints (integration, requires TEST_DATABASE_URL)', () => {
  if (!TEST_DB_URL) return // safety for non-bun runners

  let dbHandle: DatabaseHandle
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
    const { app } = createServer({
      env: { PORT: 0, NODE_ENV: 'test', DATABASE_URL: TEST_DB_URL, CORS_ORIGINS: undefined },
      db: dbHandle,
    })
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port
    baseUrl = `http://127.0.0.1:${port}`
    closeServer = () => shutdown({ server, db: dbHandle })
  })

  afterAll(async () => {
    if (!TEST_DB_URL) return
    await dbHandle.db.delete(schema.components)
    await dbHandle.db.delete(schema.users)
    await closeServer()
  })

  /** Helpers: fetch + envelope parse. */
  const get = async (path: string): Promise<{ status: number; body: unknown }> => {
    const res = await fetch(`${baseUrl}${path}`)
    return { status: res.status, body: await res.json() }
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
})
