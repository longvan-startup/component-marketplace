/**
 * Shared integration-test helpers for auth flows (issue #92 slices 1+2).
 *
 * `requireEmailVerification: true` (slice 2) means sign-up no longer
 * returns a usable session — every existing integration suite that used to
 * sign up and immediately get a cookie (`catalog/integration.test.ts`,
 * `auth/password-reset.test.ts`) now needs to verify the email first.
 * Centralized here instead of duplicated per file.
 *
 * Not itself a `*.test.ts` file (it's imported BY test files), so it stays
 * outside `tsconfig.json`'s test exclusion and gets typechecked as regular
 * source — meaning it can't import `bun:test` (no ambient types there).
 * `captureConsoleLogs` below does a plain manual console.log swap instead
 * of `bun:test`'s `spyOn` for that reason.
 */

export type AuthUserPayload = {
  id: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  role: 'user' | 'seller' | 'admin'
  [key: string]: unknown
}

/**
 * Spies on `console.log` for the duration of `action`, returning every
 * logged line. The dev-only `sendResetPassword`/`sendVerificationEmail`
 * transports in `auth/config.ts` log the real link there instead of
 * sending an email — this is how tests recover it without a mail server.
 */
export async function captureConsoleLogs(action: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  const original = console.log
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  }
  try {
    await action()
  } finally {
    console.log = original
  }
  return lines
}

/** Pulls the first `http(s)://...` URL out of a dev-transport log line. */
export function extractUrl(lines: string[], marker: string): string {
  const line = lines.find((l) => l.includes(marker))
  if (!line) throw new Error(`No log line containing "${marker}" (got: ${JSON.stringify(lines)})`)
  const match = line.match(/https?:\/\/\S+/)
  if (!match) throw new Error(`No URL found in log line: ${line}`)
  return match[0]
}

/** Signs up a new user, captures + follows the verification link from the
 * dev-transport log, then signs in — returning a real session cookie. */
export async function registerVerifiedUser(baseUrl: string, emailLog: string[]) {
  const email = `auth-${crypto.randomUUID()}@test.local`
  const password = 'correct-horse-auth-test'
  emailLog.push(email)

  const logs = await captureConsoleLogs(async () => {
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Auth Integration User', email, password }),
    })
    if (!response.ok) throw new Error(`Sign-up failed (${response.status})`)
    const payload = (await response.json()) as { token: string | null }
    if (payload.token !== null) {
      throw new Error('Expected sign-up to skip auto-sign-in while unverified')
    }
  })

  const verifyUrl = extractUrl(logs, `verification link for ${email}`)
  const token = new URL(verifyUrl).searchParams.get('token')
  if (!token) throw new Error(`No token in verification URL: ${verifyUrl}`)

  const verifyResponse = await fetch(
    `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
  )
  if (!verifyResponse.ok) throw new Error(`Verify failed (${verifyResponse.status})`)

  const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = (await signInResponse.json()) as { token: string | null; user: AuthUserPayload }
  const cookie = signInResponse.headers.get('set-cookie')?.split(';', 1)[0]
  if (!signInResponse.ok || !cookie) {
    throw new Error(`Sign-in after verification failed (${signInResponse.status})`)
  }
  return { email, password, response: signInResponse, payload, cookie }
}
