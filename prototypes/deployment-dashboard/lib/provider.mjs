export class ProviderError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function configuration() {
  const key = process.env.VERCEL_API_TOKEN
  const team = process.env.VERCEL_TEAM_ID
  const ids = (process.env.VERCEL_PROJECT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (
    !key ||
    !/^team_[\w-]+$/.test(team || '') ||
    ids.length === 0 ||
    ids.length > 20 ||
    ids.some((id) => !/^prj_[\w-]+$/.test(id))
  ) {
    throw new ProviderError('NOT_CONFIGURED')
  }
  return { key, team, ids: [...new Set(ids)], origin: 'https://api.vercel.com' }
}

async function getUpstream(config, path, params = {}) {
  const url = new URL(path, config.origin)
  url.searchParams.set('teamId', config.team)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  let response
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${config.key}`, accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(7000),
      cache: 'no-store',
    })
  } catch {
    throw new ProviderError('UPSTREAM_UNAVAILABLE')
  }
  if (!response.ok) throw new ProviderError('UPSTREAM_UNAVAILABLE')
  const declaredLength = Number(response.headers.get('content-length') || '0')
  if (declaredLength > 1_000_000) throw new ProviderError('UPSTREAM_RESPONSE')
  try {
    if (!response.body) throw new Error('missing response body')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let size = 0
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1_000_000) {
        await reader.cancel()
        throw new Error('response too large')
      }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  } catch {
    throw new ProviderError('UPSTREAM_RESPONSE')
  }
}

export async function listServices() {
  const config = configuration()
  const items = await Promise.all(
    config.ids.map(async (id) => {
      const item = await getUpstream(config, `/v9/projects/${id}`)
      if (!item || item.id !== id || typeof item.name !== 'string')
        throw new ProviderError('UPSTREAM_RESPONSE')
      return {
        id,
        name: item.name.slice(0, 160),
        description: 'Vercel project',
        status:
          typeof item.targets?.production?.readyState === 'string'
            ? item.targets.production.readyState.slice(0, 40)
            : 'unknown',
      }
    }),
  )
  return { mode: 'vercel', items, total: items.length }
}

export async function listDeployments(id) {
  if (typeof id !== 'string' || !/^prj_[\w-]+$/.test(id)) throw new ProviderError('INVALID_ID')
  const config = configuration()
  if (!config.ids.includes(id)) throw new ProviderError('INVALID_ID')
  const data = await getUpstream(config, '/v6/deployments', { projectId: id, limit: '50' })
  if (!data || !Array.isArray(data.deployments)) throw new ProviderError('UPSTREAM_RESPONSE')
  return {
    mode: 'vercel',
    items: data.deployments.slice(0, 50).map((item) => {
      if (!item || typeof item.uid !== 'string' || typeof item.state !== 'string')
        throw new ProviderError('UPSTREAM_RESPONSE')
      const created = Number(item.created)
      return {
        id: item.uid.slice(0, 128),
        status: item.state.slice(0, 40),
        createdAt: Number.isFinite(created) && created > 0 ? new Date(created).toISOString() : null,
      }
    }),
  }
}
