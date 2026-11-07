export class ProviderError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function configuration(env = process.env) {
  const key = env.VERCEL_API_TOKEN
  const team = env.VERCEL_TEAM_ID
  const ids = (env.VERCEL_PROJECT_IDS || '')
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

async function getUpstream(config, path, params = {}, fetchImpl = fetch) {
  const url = new URL(path, config.origin)
  url.searchParams.set('teamId', config.team)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  let response
  try {
    response = await fetchImpl(url, {
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

export async function listServices(env = process.env, fetchImpl = fetch) {
  const config = configuration(env)
  const items = await Promise.all(
    config.ids.map(async (id) => {
      const item = await getUpstream(config, `/v9/projects/${id}`, {}, fetchImpl)
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
        productionUrl:
          typeof item.targets?.production?.url === 'string'
            ? `https://${item.targets.production.url}`
            : null,
      }
    }),
  )
  return { mode: 'vercel', items, total: items.length }
}

export async function getProjectProductionState(id, env = process.env, fetchImpl = fetch) {
  if (typeof id !== 'string' || !/^prj_[\w-]+$/.test(id)) throw new ProviderError('INVALID_ID')
  const config = configuration(env)
  if (!config.ids.includes(id)) throw new ProviderError('INVALID_ID')
  const item = await getUpstream(config, `/v9/projects/${id}`, {}, fetchImpl)
  if (!item || item.id !== id) throw new ProviderError('UPSTREAM_RESPONSE')
  const target = item.targets?.production
  const url = typeof target?.url === 'string' ? target.url : null
  const deploymentId =
    typeof target?.deploymentId === 'string' && /^dpl_[\w-]+$/.test(target.deploymentId)
      ? target.deploymentId
      : null
  return {
    status: typeof target?.readyState === 'string' ? target.readyState.slice(0, 40) : 'unknown',
    deploymentId,
    url: url ? `https://${url}` : null,
  }
}

export async function listDeployments(id, env = process.env, fetchImpl = fetch) {
  if (typeof id !== 'string' || !/^prj_[\w-]+$/.test(id)) throw new ProviderError('INVALID_ID')
  const config = configuration(env)
  if (!config.ids.includes(id)) throw new ProviderError('INVALID_ID')
  const data = await getUpstream(
    config,
    '/v6/deployments',
    { projectId: id, limit: '50' },
    fetchImpl,
  )
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
        target: item.target === 'production' ? 'production' : 'preview',
        commitSha:
          typeof item.meta?.githubCommitSha === 'string' &&
          /^[a-f0-9]{40}$/i.test(item.meta.githubCommitSha)
            ? item.meta.githubCommitSha.toLowerCase()
            : null,
        url: typeof item.url === 'string' ? `https://${item.url}` : null,
        aliasAssigned: typeof item.aliasAssigned === 'boolean' ? item.aliasAssigned : null,
        createdAt: Number.isFinite(created) && created > 0 ? new Date(created).toISOString() : null,
      }
    }),
  }
}

export async function getDeploymentDetails(id, projectId, env = process.env, fetchImpl = fetch) {
  if (!/^dpl_[\w-]+$/.test(id || '') || !/^prj_[\w-]+$/.test(projectId || ''))
    throw new ProviderError('INVALID_ID')
  const config = configuration(env)
  if (!config.ids.includes(projectId)) throw new ProviderError('INVALID_ID')
  const item = await getUpstream(
    config,
    `/v13/deployments/${encodeURIComponent(id)}`,
    {},
    fetchImpl,
  )
  if (!item || (item.id !== id && item.uid !== id) || item.projectId !== projectId)
    throw new ProviderError('UPSTREAM_RESPONSE')
  const rawUrl = typeof item.url === 'string' ? item.url : null
  return {
    id,
    projectId,
    status:
      typeof item.readyState === 'string'
        ? item.readyState.slice(0, 40)
        : typeof item.state === 'string'
          ? item.state.slice(0, 40)
          : 'unknown',
    target: item.target === 'production' ? 'production' : 'preview',
    commitSha:
      typeof item.meta?.githubCommitSha === 'string' &&
      /^[a-f0-9]{40}$/i.test(item.meta.githubCommitSha)
        ? item.meta.githubCommitSha.toLowerCase()
        : null,
    url: rawUrl ? `https://${rawUrl}` : null,
    aliasAssigned: typeof item.aliasAssigned === 'boolean' ? item.aliasAssigned : null,
    createdAt:
      Number.isFinite(Number(item.createdAt)) && Number(item.createdAt) > 0
        ? new Date(Number(item.createdAt)).toISOString()
        : null,
  }
}
