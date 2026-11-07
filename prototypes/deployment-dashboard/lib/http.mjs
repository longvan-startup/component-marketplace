import { authSettings, hasAccess } from './auth.mjs'
import { listDeployments, listServices, ProviderError } from './provider.mjs'

function respond(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(body))
}

export async function handleApi(req, res, action) {
  if (req.method !== 'GET') return respond(res, 405, { error: 'METHOD_NOT_ALLOWED' })
  const settings = authSettings()
  if (!settings) return respond(res, 503, { error: 'AUTH_NOT_CONFIGURED' })
  try {
    if (!(await hasAccess(req, settings))) return respond(res, 401, { error: 'UNAUTHORIZED' })
    const url = new URL(req.url, 'http://local.invalid')
    const result =
      action === 'services'
        ? await listServices()
        : await listDeployments(url.searchParams.get('id'))
    return respond(res, 200, result)
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : 'UPSTREAM_UNAVAILABLE'
    const status = code === 'INVALID_ID' ? 400 : code === 'NOT_CONFIGURED' ? 503 : 502
    return respond(res, status, { error: code })
  }
}
