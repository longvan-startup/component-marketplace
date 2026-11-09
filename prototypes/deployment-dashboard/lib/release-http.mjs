import { randomBytes, timingSafeEqual } from 'node:crypto'
import { authSettings, hasAccess } from './auth.mjs'
import { getReleaseSnapshot, startRelease } from './release.mjs'

const CSRF_COOKIE = 'control-room-release-csrf'

function respond(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
  res.end(JSON.stringify(body))
}

function cookiesFromHeader(value) {
  const result = new Map()
  for (const part of String(value || '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 1) continue
    result.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim())
  }
  return result
}

function csrfCookie(value, secure) {
  return `${CSRF_COOKIE}=${value}; Path=/api/release; SameSite=Strict; Max-Age=600${secure ? '; Secure' : ''}`
}

function validCsrf(req) {
  const supplied = req.headers['x-csrf-token']
  const cookie = cookiesFromHeader(req.headers.cookie).get(CSRF_COOKIE)
  if (
    typeof supplied !== 'string' ||
    typeof cookie !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(supplied) ||
    !/^[A-Za-z0-9_-]{43}$/.test(cookie)
  )
    return false
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(cookie))
}

async function readJson(req) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.byteLength > 4096) throw new Error('REQUEST_TOO_LARGE')
    return JSON.parse(req.body.toString('utf8'))
  }
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > 4096) throw new Error('REQUEST_TOO_LARGE')
    return JSON.parse(req.body)
  }
  if (req.body && typeof req.body === 'object') {
    const value = JSON.stringify(req.body)
    if (Buffer.byteLength(value) > 4096) throw new Error('REQUEST_TOO_LARGE')
    return JSON.parse(value)
  }
  let value = ''
  for await (const chunk of req) {
    value += chunk.toString()
    if (Buffer.byteLength(value) > 4096) throw new Error('REQUEST_TOO_LARGE')
  }
  return JSON.parse(value)
}

let dispatchInFlight = false

export async function handleRelease(req, res, dependencies = {}) {
  const getSnapshot = dependencies.getReleaseSnapshot || getReleaseSnapshot
  const start = dependencies.startRelease || startRelease
  const settings = authSettings()
  const path = new URL(req.url, 'http://local.invalid').pathname
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (!settings) return respond(res, 503, { error: 'AUTH_NOT_CONFIGURED' })

  try {
    if (!(await hasAccess(req, settings))) return respond(res, 401, { error: 'UNAUTHORIZED' })
  } catch {
    return respond(res, 401, { error: 'UNAUTHORIZED' })
  }

  if (path === '/api/release' && req.method === 'GET') {
    try {
      return respond(res, 200, await getSnapshot())
    } catch {
      return respond(res, 502, { error: 'RELEASE_STATUS_UNAVAILABLE' })
    }
  }

  if (path === '/api/release/csrf' && req.method === 'GET') {
    const token = randomBytes(32).toString('base64url')
    return respond(
      res,
      200,
      { csrfToken: token },
      { 'Set-Cookie': csrfCookie(token, settings.origin.startsWith('https:')) },
    )
  }

  if (path !== '/api/release' || req.method !== 'POST')
    return respond(res, 405, { error: 'METHOD_NOT_ALLOWED' })

  if (req.headers.origin !== settings.origin) return respond(res, 403, { error: 'ORIGIN_REJECTED' })
  if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')
    return respond(res, 403, { error: 'ORIGIN_REJECTED' })
  if (
    !String(req.headers['content-type'] || '')
      .toLowerCase()
      .startsWith('application/json')
  )
    return respond(res, 415, { error: 'CONTENT_TYPE_REQUIRED' })
  if (!validCsrf(req)) return respond(res, 403, { error: 'CSRF_REJECTED' })

  let body
  try {
    body = await readJson(req)
  } catch (error) {
    return respond(res, error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, {
      error: error.message === 'REQUEST_TOO_LARGE' ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON',
    })
  }
  if (body?.confirmed !== true) return respond(res, 400, { error: 'CONFIRMATION_REQUIRED' })
  if (
    !/^[a-f0-9]{40}$/i.test(body.expectedSha || '') ||
    !/^dpl_[\w-]+$/.test(body.expectedDeploymentId || '') ||
    (body.expectedReleaseRunId != null && !/^\d{1,20}$/.test(String(body.expectedReleaseRunId)))
  )
    return respond(res, 400, { error: 'INVALID_RELEASE_CONFIRMATION' })
  if (dispatchInFlight) return respond(res, 409, { error: 'RELEASE_ALREADY_REQUESTED' })

  dispatchInFlight = true
  try {
    const result = await start({
      expectedSha: body.expectedSha,
      expectedDeploymentId: body.expectedDeploymentId,
      expectedReleaseRunId: body.expectedReleaseRunId ?? null,
    })
    if (!result.started) {
      const error =
        result.reason === 'CANDIDATE_CHANGED' ? 'RELEASE_CANDIDATE_CHANGED' : 'RELEASE_NOT_READY'
      return respond(res, 409, { error })
    }
    return respond(res, 202, { release: result.release })
  } catch {
    return respond(res, 502, { error: 'RELEASE_REQUEST_FAILED' })
  } finally {
    dispatchInFlight = false
  }
}
