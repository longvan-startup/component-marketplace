/**
 * The HTML and plain text of the auth emails. A table layout with inline styles,
 * which is what Gmail and Outlook render: a notice bar, the wordmark, a large
 * heading with the button, a hero picture, a two-column list, a thank-you block,
 * the grey footer with the faded brand name, and the design credit.
 */
import { AUTH_LINK_TTL_MINUTES, type AuthEmailKind, BRAND_NAME, COPY } from './email-copy'
import {
  FOOTER_BASE64,
  HERO_RESET_BASE64,
  HERO_VERIFY_BASE64,
  TEAM_BASE64,
  WORDMARK_BASE64,
} from './email-images'

/* Email clients do not read CSS variables, so colours are plain hex values. */
const INK = '#040b22'
const BODY = '#4a4f5f'
const PRIMARY = '#7c3aed'
const GREY = '#f5f5f7'
const FONT = 'font-family:Inter,Helvetica,Arial,sans-serif;'

type Input = { kind: AuthEmailKind; user: { email: string; name?: string | null }; url: string }

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)
}

function attachments(kind: AuthEmailKind) {
  const file = (content_id: string, filename: string, content: string) => ({
    content_id,
    filename,
    content,
  })
  return [
    file('luva-wordmark', 'luva-wordmark.png', WORDMARK_BASE64),
    file(
      'luva-hero',
      'luva-hero.jpg',
      kind === 'verification' ? HERO_VERIFY_BASE64 : HERO_RESET_BASE64,
    ),
    file('luva-team', 'luva-team.png', TEAM_BASE64),
    file('luva-footer', 'luva-footer.jpg', FOOTER_BASE64),
  ]
}

const image = (cid: string, width: number, alt: string, extra = '') =>
  `<img src="cid:${cid}" width="${width}" alt="${alt}" style="display:block;border:0;width:100%;max-width:${width}px;height:auto;margin:0 auto;${extra}">`

/** A centred column of the page, `width` px wide on large screens. */
const column = (width: number, inner: string, padding = '0 24px') =>
  `<tr><td align="center" style="padding:${padding};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width}px;">${inner}</table></td></tr>`

function perkRows(perks: { title: string; body: string }[]): string {
  const cell = (perk: { title: string; body: string }) =>
    `<td class="col" width="50%" valign="top" style="padding:10px 16px 24px 0;"><div style="border-top:1px solid ${BODY};padding-top:12px;${FONT}font-size:17px;line-height:20px;font-weight:600;color:${INK};">${perk.title}</div><div style="padding-top:4px;${FONT}font-size:16px;line-height:19px;font-weight:300;color:${BODY};">${perk.body}</div></td>`
  const rows: string[] = []
  for (let i = 0; i < perks.length; i += 2) {
    rows.push(
      `<tr>${perks
        .slice(i, i + 2)
        .map(cell)
        .join('')}</tr>`,
    )
  }
  return rows.join('')
}

export function renderAuthEmail({ kind, user, url }: Input) {
  const copy = COPY[kind]
  const name = user.name?.trim()
  const greeting = name ? `Chào ${name},` : 'Chào bạn,'
  const validity = `Link có hiệu lực trong ${AUTH_LINK_TTL_MINUTES} phút.`
  const reason = `Bạn nhận email này vì có tài khoản hoặc yêu cầu tại ${BRAND_NAME}. ${copy.note}`
  const safeUrl = escapeHtml(url)
  const small = `${FONT}font-size:14px;line-height:22px;color:${BODY};`

  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(copy.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>@media (max-width:720px){.col{display:block!important;width:100%!important}.h1{font-size:32px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff;">${copy.intro}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;">
<tr><td align="center" style="padding:24px 24px 8px;">${image('luva-wordmark', 120, BRAND_NAME)}</td></tr>
${column(
  466,
  `<tr><td align="center" style="padding-top:8px;"><h1 class="h1" style="margin:0;${FONT}font-size:44px;line-height:1.2;font-weight:600;letter-spacing:-1px;color:${INK};">${copy.heading[0]}<br>${copy.heading[1]}</h1></td></tr>
<tr><td align="center" style="padding:8px 0 16px;${FONT}font-size:16px;line-height:1.3;font-weight:300;color:${BODY};">${escapeHtml(greeting)} ${copy.intro}</td></tr>
<tr><td align="center"><a href="${safeUrl}" style="display:inline-block;padding:12px 28px;border-radius:32px;background:${PRIMARY};color:#ffffff;${FONT}font-size:16px;line-height:22px;text-decoration:none;">${copy.button}</a></td></tr>
<tr><td align="center" style="padding:10px 0 32px;${FONT}font-size:12px;color:${BODY};">${validity}</td></tr>
<tr><td><a href="${safeUrl}">${image('luva-hero', 466, copy.button, 'border-radius:18px;')}</a></td></tr>
<tr><td style="padding:48px 0 12px;${FONT}font-size:20px;line-height:24px;font-weight:600;color:${INK};">${copy.perksTitle}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${perkRows(copy.perks)}</table></td></tr>`,
)}
${column(
  503,
  `<tr><td align="center" style="background:${GREY};border-radius:24px;padding:32px 24px;">${image('luva-team', 110, 'Đội ngũ Luva UI')}<div style="padding:12px 0 8px;${FONT}font-size:20px;line-height:24px;font-weight:300;letter-spacing:-1px;color:${INK};">Cảm ơn từ đội ngũ @</div>${image('luva-wordmark', 108, BRAND_NAME)}</td></tr>`,
  '32px 24px',
)}
<tr><td style="padding-top:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GREY};border-radius:24px 24px 0 0;">
<tr><td align="center" style="padding:44px 16px;${small}">${reason}<br><br>${BRAND_NAME}<br>Thư viện component UI sẵn dùng<br><br>Đây là email tự động về tài khoản của bạn, vui lòng không trả lời.<br><strong>Bảo mật &#124; Điều khoản</strong><br>© ${new Date().getFullYear()} ${BRAND_NAME}. Bảo lưu mọi quyền.</td></tr>
<tr><td>${image('luva-footer', 700, BRAND_NAME)}</td></tr>
</table></td></tr>
</table>
</td></tr></table>
</body>
</html>`

  const text = [
    `${greeting} ${copy.intro}`,
    '',
    `${copy.button}: ${url}`,
    '',
    `Tài khoản: ${user.email}`,
    validity,
    copy.note,
    '',
    `— ${BRAND_NAME}`,
  ].join('\n')

  return { subject: copy.subject, text, html, attachments: attachments(kind) }
}
