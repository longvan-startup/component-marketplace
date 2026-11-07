/**
 * Integration tests cho admin catalog CRUD (#111) — Postgres THẬT.
 * Pattern tái dùng y hệt `catalog/integration.test.ts` / `auth/password-
 * reset.test.ts`: migration thật + HTTP thật qua `app.listen(0)`,
 * `describe.skip` khi không có `TEST_DATABASE_URL`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbHandle, type DatabaseHandle, schema } from '@marketplace/db'
import { apiErrorSchema, componentSchema, detailResponseSchema } from '@marketplace/shared'
import { eq, inArray } from 'drizzle-orm'
import { registerVerifiedUser } from '../auth/test-helpers'
import { createServer, shutdown } from '../index'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip

const AUTH_TEST_SECRET = 'auth-integration-test-secret-long-enough-32'
const AUTH_TEST_EMAILS: string[] = []
const CREATED_SLUGS: string[] = []

type ItemEnvelope = { item: Record<string, unknown> }

describeIntegration('admin catalog CRUD (integration, requires TEST_DATABASE_URL)', () => {
  if (!TEST_DB_URL) return // safety for non-bun runners

  let dbHandle: DatabaseHandle
  let baseUrl: string
  let closeServer: () => Promise<void> = async () => {}
  let adminCookie: string
  let userCookie: string

  beforeAll(async () => {
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

    const { app } = createServer({
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
    const server = app.listen(0)
    const port = (server.address() as { port: number }).port
    baseUrl = `http://127.0.0.1:${port}`
    closeServer = () => shutdown({ server, db: dbHandle })

    const admin = await registerVerifiedUser(baseUrl, AUTH_TEST_EMAILS)
    await dbHandle.db
      .update(schema.users)
      .set({ role: 'admin' })
      .where(eq(schema.users.email, admin.email))
    adminCookie = admin.cookie

    const user = await registerVerifiedUser(baseUrl, AUTH_TEST_EMAILS)
    userCookie = user.cookie
  })

  afterAll(async () => {
    if (!TEST_DB_URL) return
    await dbHandle.db
      .delete(schema.components)
      .where(inArray(schema.components.slug, CREATED_SLUGS))
    await dbHandle.db.delete(schema.users).where(inArray(schema.users.email, AUTH_TEST_EMAILS))
    await closeServer()
  })

  /** Helpers: fetch + envelope parse + slug cleanup tracking. */
  const post = async (path: string, cookie: string | undefined, body?: unknown) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, body: await res.json() }
  }

  const patch = async (path: string, cookie: string | undefined, body: unknown) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    })
    return { status: res.status, body: await res.json() }
  }

  const get = async (path: string) => {
    const res = await fetch(`${baseUrl}${path}`)
    return { status: res.status, body: await res.json() }
  }

  const createDraft = async (overrides: Record<string, unknown> = {}) => {
    const { status, body } = await post('/admin/components', adminCookie, {
      name: `Admin Test ${crypto.randomUUID()}`,
      description: 'A component created by an admin integration test.',
      category: 'tool',
      tags: [],
      ...overrides,
    })
    expect(status).toBe(201)
    const parsed = (body as ItemEnvelope).item
    CREATED_SLUGS.push(parsed.slug as string)
    return parsed
  }

  test('POST /admin/components — role matrix (guest 401, user 403, admin 201)', async () => {
    const guest = await post('/admin/components', undefined, {
      name: 'x',
      description: 'x',
      category: 'tool',
    })
    expect(guest.status).toBe(401)
    expect(apiErrorSchema.parse(guest.body).code).toBe('UNAUTHENTICATED')

    const asUser = await post('/admin/components', userCookie, {
      name: 'x',
      description: 'x',
      category: 'tool',
    })
    expect(asUser.status).toBe(403)
    expect(apiErrorSchema.parse(asUser.body).code).toBe('FORBIDDEN')

    const draft = await createDraft({ name: 'Role Matrix Component' })
    expect(componentSchema.parse(draft).isPublished).toBe(false)
  })

  test('Create ignores client-sent isPublished/role — always a draft', async () => {
    const draft = await createDraft({ name: 'Sneaky Draft', isPublished: true, role: 'admin' })
    expect(draft.isPublished).toBe(false)

    const publicList = await get('/components')
    expect(
      (publicList.body as { items: { slug: string }[] }).items.some((i) => i.slug === draft.slug),
    ).toBe(false)
    const publicDetail = await get(`/components/${draft.slug}`)
    expect(publicDetail.status).toBe(404)
  })

  test('Publish/unpublish toggles public visibility and is idempotent', async () => {
    const draft = await createDraft({ name: 'Publish Toggle Component' })
    const slug = draft.slug as string

    const published = await post(`/admin/components/${slug}/publish`, adminCookie)
    expect(published.status).toBe(200)
    expect(componentSchema.parse((published.body as ItemEnvelope).item).isPublished).toBe(true)

    const publishedAgain = await post(`/admin/components/${slug}/publish`, adminCookie)
    expect(publishedAgain.status).toBe(200) // repeat publish = no-op, not an error

    const visible = await get(`/components/${slug}`)
    expect(visible.status).toBe(200)
    expect(detailResponseSchema.parse(visible.body).item.slug).toBe(slug)

    const unpublished = await post(`/admin/components/${slug}/unpublish`, adminCookie)
    expect(unpublished.status).toBe(200)
    expect(componentSchema.parse((unpublished.body as ItemEnvelope).item).isPublished).toBe(false)

    const hidden = await get(`/components/${slug}`)
    expect(hidden.status).toBe(404)
  })

  test('Publish/update/unpublish on an unknown slug — 404 NOT_FOUND', async () => {
    for (const { method, path } of [
      { method: 'POST', path: '/admin/components/does-not-exist/publish' },
      { method: 'POST', path: '/admin/components/does-not-exist/unpublish' },
      { method: 'PATCH', path: '/admin/components/does-not-exist' },
    ]) {
      const result =
        method === 'PATCH'
          ? await patch(path, adminCookie, { name: 'x' })
          : await post(path, adminCookie)
      expect(result.status).toBe(404)
      expect(apiErrorSchema.parse(result.body).code).toBe('NOT_FOUND')
    }
  })

  test('PATCH updates metadata and leaves isPublished untouched', async () => {
    const draft = await createDraft({ name: 'Metadata Before' })
    const slug = draft.slug as string
    await post(`/admin/components/${slug}/publish`, adminCookie)

    const updated = await patch(`/admin/components/${slug}`, adminCookie, {
      name: 'Metadata After',
      description: 'Updated description.',
    })
    expect(updated.status).toBe(200)
    const item = componentSchema.parse((updated.body as ItemEnvelope).item)
    expect(item.name).toBe('Metadata After')
    expect(item.description).toBe('Updated description.')
    expect(item.isPublished).toBe(true) // PATCH never touches publish state
  })

  test('Tags are normalized (trim, lowercase, dedupe) and bounded', async () => {
    const draft = await createDraft({
      name: 'Tag Normalization Component',
      tags: [' UI ', 'ui', 'Hero'],
    })
    expect(draft.tags).toEqual(['ui', 'hero'])

    const emptyTag = await post('/admin/components', adminCookie, {
      name: 'Empty Tag Component',
      description: 'x',
      category: 'tool',
      tags: [''],
    })
    expect(emptyTag.status).toBe(422)

    const tooManyTags = await post('/admin/components', adminCookie, {
      name: 'Too Many Tags Component',
      description: 'x',
      category: 'tool',
      tags: Array.from({ length: 13 }, (_, i) => `tag-${i}`),
    })
    expect(tooManyTags.status).toBe(422)
  })

  test('Price/requiresPaymentForUpdate combo — only free or paid is valid', async () => {
    const paid = await createDraft({
      name: 'Paid Component',
      price: { amountMinor: 1000, currency: 'USD' },
      requiresPaymentForUpdate: true,
    })
    expect(paid.price).toEqual({ amountMinor: 1000, currency: 'USD' })

    const priceWithoutFlag = await post('/admin/components', adminCookie, {
      name: 'Bad Combo A',
      description: 'x',
      category: 'tool',
      price: { amountMinor: 1000, currency: 'USD' },
      requiresPaymentForUpdate: false,
    })
    expect(priceWithoutFlag.status).toBe(422)

    const flagWithoutPrice = await post('/admin/components', adminCookie, {
      name: 'Bad Combo B',
      description: 'x',
      category: 'tool',
      requiresPaymentForUpdate: true,
    })
    expect(flagWithoutPrice.status).toBe(422)

    // PATCH: updating just the flag against an existing free draft must fail
    // the merged-combo check (price stays null, flag would become true).
    const free = await createDraft({ name: 'Free Component For Patch' })
    const badPatch = await patch(`/admin/components/${free.slug}`, adminCookie, {
      requiresPaymentForUpdate: true,
    })
    expect(badPatch.status).toBe(422)

    // Updating only the price on that same free draft, together with the
    // flag, flips it to paid correctly.
    const goodPatch = await patch(`/admin/components/${free.slug}`, adminCookie, {
      price: { amountMinor: 500, currency: 'EUR' },
      requiresPaymentForUpdate: true,
    })
    expect(goodPatch.status).toBe(200)
  })

  test('Duplicate component name — slug gets a numeric suffix', async () => {
    const first = await createDraft({ name: 'Duplicate Name Component' })
    const second = await createDraft({ name: 'Duplicate Name Component' })
    expect(first.slug).not.toBe(second.slug)
    expect(second.slug).toBe(`${first.slug}-2`)
  })
})
