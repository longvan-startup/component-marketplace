/**
 * Integration tests cho forgot/reset password (#92 slice 1) — Postgres THẬT.
 * Pattern tái dùng y hệt `catalog/integration.test.ts`: migration thật +
 * HTTP thật qua `app.listen(0)`, `describe.skip` khi không có
 * `TEST_DATABASE_URL`.
 *
 * Không mock `sendResetPassword` — nó chỉ `console.log` ra dev transport
 * (xem `auth/config.ts`), nên test đọc token trực tiếp từ bảng
 * `verifications` (identifier `reset-password:<token>`) thay vì bắt log.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbHandle, type DatabaseHandle, schema } from '@marketplace/db'
import { apiErrorSchema } from '@marketplace/shared'
import { eq, inArray, like } from 'drizzle-orm'
import { createServer, shutdown } from '../index'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip

const AUTH_TEST_SECRET = 'auth-integration-test-secret-long-enough-32'
const AUTH_TEST_EMAILS: string[] = []
// Fixed to match BETTER_AUTH_URL below (trustedOrigins), not the ephemeral
// test port — the callback is never actually fetched, only redirected to.
const CALLBACK_URL = 'http://127.0.0.1:4000/reset-password'

describeIntegration('forgot/reset password (integration, requires TEST_DATABASE_URL)', () => {
  if (!TEST_DB_URL) return // safety for non-bun runners

  let dbHandle: DatabaseHandle
  let baseUrl: string
  let closeServer: () => Promise<void> = async () => {}

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
  })

  afterAll(async () => {
    if (!TEST_DB_URL) return
    // Belt-and-suspenders: a test that fails before consuming its token
    // would otherwise leave a stray verification row behind.
    await dbHandle.db
      .delete(schema.verifications)
      .where(like(schema.verifications.identifier, 'reset-password:%'))
    await dbHandle.db.delete(schema.users).where(inArray(schema.users.email, AUTH_TEST_EMAILS))
    await closeServer()
  })

  const register = async () => {
    const email = `auth-reset-${crypto.randomUUID()}@test.local`
    const password = 'correct-horse-auth-test'
    AUTH_TEST_EMAILS.push(email)
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Reset Flow User', email, password }),
    })
    const payload = (await response.json()) as { user: { id: string } }
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
    if (!response.ok || !cookie) throw new Error(`Auth signup failed (${response.status})`)
    return { email, password, userId: payload.user.id, cookie }
  }

  const signIn = async (email: string, password: string) => {
    const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
    if (!response.ok || !cookie) throw new Error(`Sign-in failed (${response.status})`)
    return cookie
  }

  const requestReset = (email: string) =>
    fetch(`${baseUrl}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, redirectTo: CALLBACK_URL }),
    })

  /** Dev transport never sends real email — read the token straight from
   * the `verifications` table the way `sendResetPassword`'s `url` arg would
   * have carried it. */
  const findResetToken = async (userId: string): Promise<string> => {
    const rows = await dbHandle.db.query.verifications.findMany({
      where: eq(schema.verifications.value, userId),
    })
    const row = rows.find((r) => r.identifier.startsWith('reset-password:'))
    if (!row) throw new Error('No reset-password verification row found')
    return row.identifier.replace('reset-password:', '')
  }

  test('request-password-reset: always {status:true}, even for an unknown email (no leak)', async () => {
    const known = await register()
    const knownRes = await requestReset(known.email)
    expect(knownRes.status).toBe(200)
    const knownBody = (await knownRes.json()) as { status: boolean }
    expect(knownBody.status).toBe(true)

    const unknownRes = await requestReset(`nobody-${crypto.randomUUID()}@test.local`)
    expect(unknownRes.status).toBe(200)
    const unknownBody = (await unknownRes.json()) as { status: boolean }
    expect(unknownBody).toEqual(knownBody) // identical shape for both cases
  })

  test('reset-password/:token GET callback redirects with ?token= on valid token, ?error=INVALID_TOKEN otherwise', async () => {
    const user = await register()
    await requestReset(user.email)
    const token = await findResetToken(user.userId)

    const valid = await fetch(
      `${baseUrl}/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(CALLBACK_URL)}`,
      { redirect: 'manual' },
    )
    expect(valid.status).toBe(302)
    expect(valid.headers.get('location')).toContain(`${CALLBACK_URL}?token=`)

    const invalid = await fetch(
      `${baseUrl}/api/auth/reset-password/bogus-token?callbackURL=${encodeURIComponent(CALLBACK_URL)}`,
      { redirect: 'manual' },
    )
    expect(invalid.status).toBe(302)
    expect(invalid.headers.get('location')).toBe(`${CALLBACK_URL}?error=INVALID_TOKEN`)
  })

  test('reset-password POST: sets new password, revokes every other session, old password stops working', async () => {
    const user = await register()
    const secondSessionCookie = await signIn(user.email, user.password)

    await requestReset(user.email)
    const token = await findResetToken(user.userId)

    const newPassword = 'a-brand-new-correct-horse'
    const reset = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    })
    expect(reset.status).toBe(200)
    expect(await reset.json()).toEqual({ status: true })

    // Both the signup session AND the second sign-in session are revoked.
    for (const cookie of [user.cookie, secondSessionCookie]) {
      const session = await fetch(`${baseUrl}/api/auth/get-session`, { headers: { cookie } })
      expect(await session.json()).toBeNull()
    }

    const oldPasswordSignIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: user.password }),
    })
    expect(oldPasswordSignIn.status).toBe(401)

    const newPasswordSignIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: newPassword }),
    })
    expect(newPasswordSignIn.status).toBe(200)
  })

  test('reset-password POST: reusing a consumed token FAILS', async () => {
    const user = await register()
    await requestReset(user.email)
    const token = await findResetToken(user.userId)

    const first = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'first-new-password-123' }),
    })
    expect(first.status).toBe(200)

    const second = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'second-new-password-456' }),
    })
    expect(second.status).toBe(400)
    const body = await second.json()
    expect(apiErrorSchema.safeParse(body).success).toBe(false) // Better Auth's own shape, unwrapped
  })

  test('reset-password POST: password shorter than 8 chars FAILS (Better Auth minPasswordLength)', async () => {
    const user = await register()
    await requestReset(user.email)
    const token = await findResetToken(user.userId)

    const tooShort = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'short' }),
    })
    expect(tooShort.status).toBe(400)
  })

  test('reset-password POST: unknown token FAILS without touching any user', async () => {
    const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'never-issued-token', newPassword: 'longenoughpassword' }),
    })
    expect(response.status).toBe(400)
  })
})
