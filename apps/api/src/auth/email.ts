import type { ApiEnv } from '../env'

type AuthEmailKind = 'verification' | 'password-reset'
type AuthEmailUser = { email: string; name?: string | null }

type AuthEmailInput = {
  kind: AuthEmailKind
  user: AuthEmailUser
  url: string
}

type ResendEmail = {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
}

type EmailEnvironment = Pick<ApiEnv, 'NODE_ENV' | 'RESEND_API_KEY' | 'AUTH_EMAIL_FROM'>

const RESEND_REQUEST_TIMEOUT_MS = 10_000
const SAFE_NETWORK_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EPIPE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
])

function safeNetworkErrorName(error: unknown): string {
  if (error instanceof TypeError) return 'TypeError'
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
    return error.name
  }
  return error instanceof Error ? 'Error' : 'unknown'
}

function safeNetworkErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || typeof error.cause !== 'object' || error.cause === null) {
    return undefined
  }

  const code = 'code' in error.cause ? error.cause.code : undefined
  return typeof code === 'string' && SAFE_NETWORK_ERROR_CODES.has(code) ? code : undefined
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function emailContent({ kind, user, url }: AuthEmailInput) {
  const recipientName = user.name?.trim() || 'there'
  const safeName = escapeHtml(recipientName)
  const safeUrl = escapeHtml(url)
  const verification = kind === 'verification'
  const action = verification ? 'Verify your email address' : 'Reset your password'
  const subject = verification
    ? 'Verify your Component Marketplace email'
    : 'Reset your Component Marketplace password'

  return {
    subject,
    text: `Hi ${recipientName},\n\n${action}: ${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${safeName},</p><p><a href="${safeUrl}">${action}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  }
}

/** Creates the mail callback used by Better Auth for verification and reset links.
 * @param env Runtime mode and optional Resend credentials.
 * @param fetchImpl HTTP transport, injectable for tests.
 * @returns An async sender that logs links outside production and uses Resend in production.
 */
export function createAuthEmailSender(
  env: EmailEnvironment,
  fetchImpl: typeof fetch = fetch,
): (input: AuthEmailInput) => Promise<void> {
  return async ({ kind, user, url }) => {
    if (env.NODE_ENV !== 'production') {
      const label = kind === 'verification' ? 'verification' : 'password reset'
      console.log(`[dev] ${label} link for ${user.email}: ${url}`)
      return
    }

    const apiKey = env.RESEND_API_KEY
    const fromAddress = env.AUTH_EMAIL_FROM
    if (!apiKey || !fromAddress) {
      throw new Error('Email delivery is not configured')
    }

    const content = emailContent({ kind, user, url })
    const payload: ResendEmail = {
      from: `Marketplace <${fromAddress}>`,
      to: [user.email],
      ...content,
    }

    let response: Response
    try {
      response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(RESEND_REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      const errorName = safeNetworkErrorName(error)
      const errorCode = safeNetworkErrorCode(error)
      console.error('[auth-email] Resend request failed', {
        kind,
        errorName,
        ...(errorCode ? { errorCode } : {}),
      })
      // Keep provider response text, credentials, and tokenized links out of
      // Better Auth's error logs and the HTTP response.
      throw new Error('Email delivery failed')
    }

    if (!response.ok) {
      console.error('[auth-email] Resend rejected email', { kind, status: response.status })
      // Keep provider response text, credentials, and tokenized links out of
      // Better Auth's error logs and the HTTP response.
      throw new Error('Email delivery failed')
    }
  }
}
