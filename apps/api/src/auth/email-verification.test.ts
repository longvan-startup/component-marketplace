/**
 * Integration tests cho mandatory email verification (#92 slice 2) —
 * Postgres THẬT. Pattern tái dùng y hệt `password-reset.test.ts`.
 *
 * Verification tokens are self-contained signed JWTs (not a `verifications`
 * DB row like password-reset), so tests recover them from the dev-only
 * `console.log` transport via `captureConsoleLogs`/`extractUrl`
 * (`./test-helpers.ts`), the same way production would read them from a
 * real email.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbHandle, type DatabaseHandle, schema } from '@marketplace/db'
import { inArray } from 'drizzle-orm'
import { createServer, shutdown } from '../index'
import { captureConsoleLogs, extractUrl, registerVerifiedUser } from './test-helpers'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip

const AUTH_TEST_SECRET = 'auth-integration-test-secret-long-enough-32'
const AUTH_TEST_EMAILS: string[] = []
const CALLBACK_URL = 'http://127.0.0.1:4000/verify-email?verified=1'

describeIntegration(
  'mandatory email verification (integration, requires TEST_DATABASE_URL)',
  () => {
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
      await dbHandle.db.delete(schema.users).where(inArray(schema.users.email, AUTH_TEST_EMAILS))
      await closeServer()
    })

    /** Signs up WITHOUT verifying — returns the raw signup response plus the
     * verification URL captured from the dev console transport. */
    const signUpUnverified = async () => {
      const email = `auth-verify-${crypto.randomUUID()}@test.local`
      const password = 'correct-horse-auth-test'
      AUTH_TEST_EMAILS.push(email)

      let signUpStatus = 0
      let signUpBody: { token: string | null; user: { emailVerified: boolean } } | undefined
      const logs = await captureConsoleLogs(async () => {
        const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Verify Flow User', email, password }),
        })
        signUpStatus = response.status
        signUpBody = await response.json()
      })
      const verifyUrl = extractUrl(logs, `verification link for ${email}`)
      return { email, password, signUpStatus, signUpBody, verifyUrl }
    }

    test('sign-up sends a verification link, returns no session, and leaves emailVerified:false', async () => {
      const { signUpStatus, signUpBody, verifyUrl } = await signUpUnverified()
      expect(signUpStatus).toBe(200)
      expect(signUpBody?.token).toBeNull()
      expect(signUpBody?.user.emailVerified).toBe(false)
      expect(verifyUrl).toContain('/verify-email?token=')
    })

    test('sign-in is blocked with 403 EMAIL_NOT_VERIFIED until the link is used', async () => {
      const { email, password } = await signUpUnverified()
      const blocked = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      expect(blocked.status).toBe(403)
      const body = await blocked.json()
      expect(JSON.stringify(body)).toContain('EMAIL_NOT_VERIFIED')
    })

    test('GET /verify-email with no callbackURL: verifies, sets a session cookie (autoSignInAfterVerification), returns JSON', async () => {
      const { email, verifyUrl } = await signUpUnverified()
      const token = new URL(verifyUrl).searchParams.get('token')
      if (!token) throw new Error('No token in verification URL')

      const verifyResponse = await fetch(
        `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      )
      expect(verifyResponse.status).toBe(200)
      expect(await verifyResponse.json()).toEqual({ status: true, user: null })
      const cookie = verifyResponse.headers.get('set-cookie')?.split(';', 1)[0]
      expect(cookie).toBeTruthy()

      // autoSignInAfterVerification really logged us in — the cookie works.
      const sessionResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
        headers: { cookie: cookie ?? '' },
      })
      const sessionPayload = (await sessionResponse.json()) as { user: { email: string } }
      expect(sessionPayload.user.email).toBe(email)

      // Sign-in with a password now works too — no longer blocked.
      const signIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'correct-horse-auth-test' }),
      })
      expect(signIn.status).toBe(200)
    })

    test('GET /verify-email with callbackURL: redirects with the marker intact, no error, on success', async () => {
      const { verifyUrl } = await signUpUnverified()
      const token = new URL(verifyUrl).searchParams.get('token')
      if (!token) throw new Error('No token in verification URL')

      const response = await fetch(
        `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(CALLBACK_URL)}`,
        { redirect: 'manual' },
      )
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(CALLBACK_URL) // no ?error= appended
    })

    test('GET /verify-email with an invalid token: redirects with ?error=INVALID_TOKEN appended to the marker', async () => {
      const response = await fetch(
        `${baseUrl}/api/auth/verify-email?token=not-a-real-token&callbackURL=${encodeURIComponent(CALLBACK_URL)}`,
        { redirect: 'manual' },
      )
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe(`${CALLBACK_URL}&error=INVALID_TOKEN`)
    })

    test('POST /send-verification-email: always {status:true} for unknown, already-verified, and genuinely-unverified emails (no leak)', async () => {
      const resend = (email: string) =>
        fetch(`${baseUrl}/api/auth/send-verification-email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, callbackURL: CALLBACK_URL }),
        })

      const unknown = await resend(`nobody-${crypto.randomUUID()}@test.local`)
      expect(unknown.status).toBe(200)
      expect(await unknown.json()).toEqual({ status: true })

      const { email: unverifiedEmail } = await signUpUnverified()
      const unverifiedLogs = await captureConsoleLogs(async () => {
        const result = await resend(unverifiedEmail)
        expect(result.status).toBe(200)
        expect(await result.json()).toEqual({ status: true })
      })
      expect(
        unverifiedLogs.some((l) => l.includes(`verification link for ${unverifiedEmail}`)),
      ).toBe(true)

      const verified = await registerVerifiedUser(baseUrl, AUTH_TEST_EMAILS)
      const alreadyVerified = await resend(verified.email)
      expect(alreadyVerified.status).toBe(200)
      expect(await alreadyVerified.json()).toEqual({ status: true })
    })

    test('a failed sign-in on an unverified account resends a fresh verification link (sendOnSignIn)', async () => {
      const { email, password } = await signUpUnverified()
      const logs = await captureConsoleLogs(async () => {
        const blocked = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        expect(blocked.status).toBe(403)
      })
      expect(logs.some((l) => l.includes(`verification link for ${email}`))).toBe(true)
    })
  },
)
