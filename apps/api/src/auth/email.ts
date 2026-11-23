import type { ApiEnv } from '../env'
import { EMAIL_LOGO_CID, EMAIL_LOGO_FILENAME, EMAIL_LOGO_PNG_BASE64 } from './email-logo'

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
  /* the logo, referenced from the HTML as cid:<content_id> */
  attachments: { filename: string; content: string; content_id: string }[]
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

/** How long a verification or reset link stays valid, in minutes. config.ts uses it
 * for the token lifetimes too, so the email never promises a different time. */
export const AUTH_LINK_TTL_MINUTES = 15

/* Email clients do not read CSS variables, so the brand colours are written as
   plain hex values here, copied from the web app's tokens (globals.css). */
const COLOR = {
  page: '#f4f4f5',
  card: '#ffffff',
  border: '#e4e4e7',
  text: '#18181b',
  muted: '#52525b',
  primary: '#7c3aed',
  onPrimary: '#ffffff',
  /* violet-50 and violet-200: the hero panel and its outline */
  tint: '#f5f3ff',
  tintBorder: '#ddd6fe',
} as const
const FONT = "Inter, 'Segoe UI', Roboto, Arial, sans-serif"
const BRAND_NAME = 'Luva UI'

const COPY: Record<
  AuthEmailKind,
  { subject: string; icon: string; heading: string; intro: string; button: string; ignore: string }
> = {
  verification: {
    subject: `Xác minh email tài khoản ${BRAND_NAME}`,
    icon: '✓',
    heading: 'Xác minh email của bạn',
    intro: `Cảm ơn bạn đã đăng ký ${BRAND_NAME}. Bấm nút bên dưới để xác minh email và bắt đầu dùng tài khoản.`,
    button: 'Xác minh email',
    ignore: 'Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.',
  },
  'password-reset': {
    subject: `Đặt lại mật khẩu ${BRAND_NAME}`,
    icon: '•••',
    heading: 'Đặt lại mật khẩu',
    intro:
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút bên dưới để chọn mật khẩu mới.',
    button: 'Đặt lại mật khẩu',
    ignore: 'Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.',
  },
}

function emailContent({ kind, user, url }: AuthEmailInput) {
  const copy = COPY[kind]
  const name = user.name?.trim()
  const greeting = name ? `Chào ${name},` : 'Chào bạn,'
  const validity = `${AUTH_LINK_TTL_MINUTES} phút`
  const safeUrl = escapeHtml(url)
  const font = `font-family:${FONT};`
  const small = `${font}color:${COLOR.muted};font-size:13px;line-height:20px;`
  const detail = (label: string, value: string) =>
    `<tr><td style="padding:10px 0;border-top:1px solid ${COLOR.border};${small}">${label}</td><td align="right" style="padding:10px 0;border-top:1px solid ${COLOR.border};${font}color:${COLOR.text};font-size:14px;line-height:20px;font-weight:600;">${value}</td></tr>`

  /* A table layout with inline styles, which is what Gmail and Outlook render.
     The raw link is not printed: the button and one text link carry it, and the
     plain-text version below has it in full. */
  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.page};">${copy.intro}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLOR.card};border:1px solid ${COLOR.border};border-radius:20px;">
<tr><td style="padding:28px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="40" valign="middle"><img src="cid:${EMAIL_LOGO_CID}" width="40" height="40" alt="" style="display:block;border:0;width:40px;height:40px;"></td>
<td valign="middle" style="padding-left:12px;${font}font-size:22px;line-height:28px;font-weight:700;color:${COLOR.text};">${BRAND_NAME}</td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 24px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.tint};border:1px solid ${COLOR.tintBorder};border-radius:16px;"><tr><td align="center" style="padding:32px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" width="64" height="64" style="width:64px;height:64px;border-radius:32px;background:${COLOR.card};border:1px solid ${COLOR.tintBorder};${font}font-size:26px;line-height:64px;font-weight:700;color:${COLOR.primary};">${copy.icon}</td></tr></table>
<div style="padding-top:20px;${font}font-size:26px;line-height:34px;font-weight:700;color:${COLOR.text};">${copy.heading}</div>
<div style="padding-top:12px;${font}font-size:15px;line-height:24px;color:${COLOR.muted};"><strong style="color:${COLOR.text};">${escapeHtml(greeting)}</strong><br>${copy.intro}</div>
<div style="padding-top:28px;"><a href="${safeUrl}" style="display:inline-block;padding:15px 40px;border-radius:999px;background:${COLOR.primary};color:${COLOR.onPrimary};${font}font-size:16px;line-height:24px;font-weight:600;text-decoration:none;">${copy.button}</a></div>
<div style="padding-top:20px;${small}">Nếu nút không bấm được, hãy bấm vào <a href="${safeUrl}" style="color:${COLOR.primary};font-weight:600;">liên kết này</a>.</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:24px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${detail('Tài khoản', escapeHtml(user.email))}
${detail('Link có hiệu lực trong', validity)}
</table>
</td></tr>
<tr><td style="padding:20px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="3" style="width:3px;background:${COLOR.primary};border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
<td style="padding-left:14px;${font}color:${COLOR.muted};font-size:14px;line-height:22px;">${copy.ignore}</td>
</tr></table>
</td></tr>
<tr><td style="padding:28px 32px 0;"><div style="height:1px;line-height:1px;font-size:0;background:${COLOR.border};">&nbsp;</div></td></tr>
<tr><td style="padding:16px 32px 28px;${small}">
<strong style="color:${COLOR.text};">${BRAND_NAME}</strong> — thư viện component UI sẵn dùng.<br>Email này được gửi tự động, bạn không cần trả lời.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    greeting,
    '',
    copy.intro,
    '',
    `${copy.button}: ${url}`,
    '',
    `Tài khoản: ${user.email}`,
    `Link có hiệu lực trong ${validity}.`,
    copy.ignore,
    '',
    `— ${BRAND_NAME}`,
  ].join('\n')

  return { subject: copy.subject, text, html }
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
      from: `${BRAND_NAME} <${fromAddress}>`,
      to: [user.email],
      ...content,
      attachments: [
        {
          filename: EMAIL_LOGO_FILENAME,
          content: EMAIL_LOGO_PNG_BASE64,
          content_id: EMAIL_LOGO_CID,
        },
      ],
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
