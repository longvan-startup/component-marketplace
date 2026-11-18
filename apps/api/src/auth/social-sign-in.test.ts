/**
 * Google and GitHub sign-in starts an OAuth redirect. The authorize URL is
 * built by Better Auth and its state row needs Postgres, so this file follows
 * the other auth integration tests and skips without TEST_DATABASE_URL.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createDbHandle, type DatabaseHandle } from '@marketplace/db'
import { createServer, shutdown } from '../index'

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DB_URL ? describe : describe.skip

const AUTH_TEST_SECRET = 'auth-integration-test-secret-long-enough-32'
const GOOGLE_SECRET = 'test-google-client-secret'
const GITHUB_SECRET = 'test-github-client-secret'

describeIntegration('social sign-in (integration, requires TEST_DATABASE_URL)', () => {
  if (!TEST_DB_URL) return

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
        GOOGLE_CLIENT_ID: 'test-google-client',
        GOOGLE_CLIENT_SECRET: GOOGLE_SECRET,
        GITHUB_CLIENT_ID: 'test-github-client',
        GITHUB_CLIENT_SECRET: GITHUB_SECRET,
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
    await closeServer()
  })

  test('Google and GitHub return authorize URLs and an unknown provider is rejected', async () => {
    const start = (provider: string) =>
      fetch(`${baseUrl}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:4000' },
        body: JSON.stringify({
          provider,
          callbackURL: 'http://127.0.0.1:4000/',
          errorCallbackURL: 'http://127.0.0.1:4000/login',
          newUserCallbackURL: 'http://127.0.0.1:4000/',
          disableRedirect: true,
        }),
      })

    const google = await start('google')
    expect(google.status).toBe(200)
    const googleBody = (await google.json()) as { url: string }
    expect(new URL(googleBody.url).hostname).toBe('accounts.google.com')
    expect(googleBody.url).not.toContain(GOOGLE_SECRET)

    const github = await start('github')
    expect(github.status).toBe(200)
    const githubBody = (await github.json()) as { url: string }
    expect(new URL(githubBody.url).hostname).toBe('github.com')
    expect(githubBody.url).not.toContain(GITHUB_SECRET)

    const missing = await start('apple')
    expect(missing.status).toBeGreaterThanOrEqual(400)
    const missingBody = (await missing.json()) as { code?: string }
    expect(missingBody.code).not.toContain(GOOGLE_SECRET)
  })
})
