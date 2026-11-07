import { Auth } from '@auth/core'
import { getToken } from '@auth/core/jwt'
import GitHub from '@auth/core/providers/github'

export function authSettings() {
  const {
    AUTH_SECRET,
    AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET,
    DASHBOARD_ORIGIN,
    DASHBOARD_GITHUB_IDS,
  } = process.env
  let origin
  try {
    const url = new URL(DASHBOARD_ORIGIN)
    const local =
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname) &&
      process.env.NODE_ENV !== 'production'
    if (
      (!local && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null
    origin = url.origin
  } catch {
    return null
  }
  const ids = (DASHBOARD_GITHUB_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (
    !AUTH_SECRET ||
    AUTH_SECRET.length < 32 ||
    !AUTH_GITHUB_ID ||
    !AUTH_GITHUB_SECRET ||
    !ids.length ||
    ids.some((id) => !/^\d+$/.test(id))
  )
    return null
  return {
    origin,
    secret: AUTH_SECRET,
    clientId: AUTH_GITHUB_ID,
    clientSecret: AUTH_GITHUB_SECRET,
    ids,
  }
}

export function authConfig(settings) {
  const allowed = (id) => typeof id === 'string' && settings.ids.includes(id)
  return {
    basePath: '/api/auth',
    trustHost: true,
    secret: settings.secret,
    useSecureCookies: settings.origin.startsWith('https:'),
    session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
    providers: [
      GitHub({
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        checks: ['pkce', 'state'],
        authorization: { params: { scope: 'read:user' } },
      }),
    ],
    callbacks: {
      signIn({ account, profile }) {
        return account?.provider === 'github' && allowed(String(profile?.id ?? ''))
      },
      jwt({ token, account, profile }) {
        if (account?.provider === 'github') token.githubId = String(profile?.id ?? '')
        return allowed(token.githubId) ? token : null
      },
    },
    logger: { error() {}, warn() {}, debug() {} },
  }
}

export async function hasAccess(req, settings) {
  if (!settings) return false
  const cookie = typeof req.headers.cookie === 'string' ? req.headers.cookie : ''
  const token = await getToken({
    req: new Request(settings.origin, { headers: { cookie } }),
    secret: settings.secret,
    secureCookie: settings.origin.startsWith('https:'),
  })
  return typeof token?.githubId === 'string' && settings.ids.includes(token.githubId)
}

async function requestBody(req) {
  if (req.method !== 'POST') return undefined
  if (typeof req.body === 'string') {
    if (req.body.length > 65536) throw new Error('Request too large')
    return req.body
  }
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    let text
    if (String(req.headers['content-type'] || '').includes('application/json'))
      text = JSON.stringify(req.body)
    else {
      const body = new URLSearchParams()
      for (const [key, value] of Object.entries(req.body))
        if (typeof value === 'string') body.set(key, value)
      text = body.toString()
    }
    if (text.length > 65536) throw new Error('Request too large')
    return text
  }
  let body = ''
  for await (const chunk of req) {
    body += chunk.toString()
    if (body.length > 65536) throw new Error('Request too large')
  }
  return body
}

export async function handleAuth(req, res) {
  const settings = authSettings()
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (!settings) {
    res.statusCode = 503
    return res.end('Dashboard authentication is not configured')
  }
  try {
    const path = new URL(req.url, 'http://internal.invalid')
    if (path.origin !== 'http://internal.invalid' || !path.pathname.startsWith('/api/auth/'))
      throw new Error('Invalid path')
    const headers = new Headers()
    if (req.headers.cookie) headers.set('cookie', req.headers.cookie)
    if (req.headers['content-type']) headers.set('content-type', req.headers['content-type'])
    const request = new Request(new URL(path.pathname + path.search, settings.origin), {
      method: req.method,
      headers,
      body: await requestBody(req),
    })
    const response = await Auth(request, authConfig(settings))
    res.statusCode = response.status
    for (const [name, value] of response.headers) {
      if (name.toLowerCase() !== 'set-cookie') res.setHeader(name, value)
    }
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('Set-Cookie', cookies)
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    return res.end(Buffer.from(await response.arrayBuffer()))
  } catch {
    res.statusCode = 400
    return res.end('Invalid authentication request')
  }
}
