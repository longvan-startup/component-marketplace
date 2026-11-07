import { createPrivateKey, createSign } from 'node:crypto'

const API_ORIGIN = 'https://api.github.com'
const API_VERSION = '2026-03-10'
const DEFAULT_REPOSITORY = 'longvan-startup/component-marketplace'

export class GitHubReleaseError extends Error {
  constructor(code, status = 502) {
    super(code)
    this.code = code
    this.status = status
  }
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function repositoryName(env = process.env) {
  const value = env.RELEASE_GITHUB_REPOSITORY || DEFAULT_REPOSITORY
  if (!/^[\w.-]+\/[\w.-]+$/.test(value)) throw new GitHubReleaseError('CONFIG_NOT_VALID', 503)
  return value
}

export function appConfiguration(env = process.env) {
  const appId = env.GITHUB_APP_ID || ''
  const installationId = env.GITHUB_APP_INSTALLATION_ID || ''
  const privateKey = (env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!/^\d+$/.test(appId) || !/^\d+$/.test(installationId) || !privateKey.includes('PRIVATE KEY'))
    return null
  try {
    createPrivateKey(privateKey)
  } catch {
    return null
  }
  return { appId, installationId, privateKey }
}

function appJwt(config, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000) - 60
  const header = encode({ alg: 'RS256', typ: 'JWT' })
  const payload = encode({ iat: issuedAt, exp: issuedAt + 540, iss: config.appId })
  const unsigned = `${header}.${payload}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  return `${unsigned}.${signer.sign(config.privateKey, 'base64url')}`
}

async function responseJson(response) {
  const declaredLength = Number(response.headers.get('content-length') || '0')
  if (declaredLength > 1_000_000) throw new GitHubReleaseError('GITHUB_RESPONSE')
  try {
    if (!response.body) throw new Error('missing body')
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
    throw new GitHubReleaseError('GITHUB_RESPONSE')
  }
}

async function request(path, { method = 'GET', body, token, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(new URL(path, API_ORIGIN), {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': API_VERSION,
        'user-agent': 'component-marketplace-control-room',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    })
  } catch {
    throw new GitHubReleaseError('GITHUB_UNAVAILABLE')
  }
  if (!response.ok) {
    if (response.status === 404) throw new GitHubReleaseError('GITHUB_NOT_FOUND', 502)
    if (response.status === 401 || response.status === 403)
      throw new GitHubReleaseError('GITHUB_PERMISSION_DENIED', 503)
    throw new GitHubReleaseError('GITHUB_UNAVAILABLE')
  }
  if (response.status === 204) return null
  return responseJson(response)
}

export async function createInstallationToken(env = process.env, fetchImpl = fetch) {
  const config = appConfiguration(env)
  if (!config) throw new GitHubReleaseError('GITHUB_APP_NOT_CONFIGURED', 503)
  const jwt = appJwt(config)
  const repo = repositoryName(env)
  const result = await request(`/app/installations/${config.installationId}/access_tokens`, {
    method: 'POST',
    token: jwt,
    fetchImpl,
    body: {
      repositories: [repo.split('/')[1]],
      permissions: { actions: 'write', contents: 'read' },
    },
  })
  if (!result || typeof result.token !== 'string') throw new GitHubReleaseError('GITHUB_RESPONSE')
  return result.token
}

function workflowState(run) {
  if (['queued', 'requested', 'waiting', 'pending'].includes(run.status)) return 'QUEUED'
  if (run.status === 'in_progress') return 'RUNNING'
  if (run.status === 'completed' && run.conclusion === 'success') return 'SUCCESS'
  if (run.status === 'completed') return 'FAILED'
  return 'UNKNOWN'
}

function safeRun(run) {
  if (!run || !Number.isSafeInteger(run.id) || typeof run.status !== 'string')
    throw new GitHubReleaseError('GITHUB_RESPONSE')
  return {
    id: run.id,
    status: workflowState(run),
    conclusion: typeof run.conclusion === 'string' ? run.conclusion : null,
    url: typeof run.html_url === 'string' ? run.html_url : null,
    title: typeof run.display_title === 'string' ? run.display_title : '',
    createdAt: typeof run.created_at === 'string' ? run.created_at : null,
    updatedAt: typeof run.updated_at === 'string' ? run.updated_at : null,
  }
}

export async function getCiSnapshot(env = process.env, fetchImpl = fetch, token) {
  const repo = repositoryName(env)
  const result = await request(
    `/repos/${repo}/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=100`,
    { fetchImpl, token },
  )
  if (!result || !Array.isArray(result.workflow_runs))
    throw new GitHubReleaseError('GITHUB_RESPONSE')
  const runs = result.workflow_runs
    .filter((run) => run?.head_branch === 'main' && run?.event === 'push')
    .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))
  const latest = runs[0] || null
  const verified = runs.find(
    (run) =>
      run?.status === 'completed' &&
      run?.conclusion === 'success' &&
      /^[a-f0-9]{40}$/i.test(run.head_sha || ''),
  )
  return {
    latestMain: latest
      ? {
          status: workflowState(latest),
          conclusion: typeof latest.conclusion === 'string' ? latest.conclusion : null,
          sha: typeof latest.head_sha === 'string' ? latest.head_sha.toLowerCase() : null,
          url: typeof latest.html_url === 'string' ? latest.html_url : null,
          createdAt: typeof latest.created_at === 'string' ? latest.created_at : null,
        }
      : null,
    latestVerified: verified
      ? {
          status: 'SUCCESS',
          sha: verified.head_sha.toLowerCase(),
          url: typeof verified.html_url === 'string' ? verified.html_url : null,
          completedAt: typeof verified.updated_at === 'string' ? verified.updated_at : null,
        }
      : null,
  }
}

export async function getReleaseRun(
  env = process.env,
  sha,
  target = 'vercel-services',
  fetchImpl = fetch,
  token,
) {
  if (!/^[a-f0-9]{40}$/i.test(sha || '')) return null
  const repo = repositoryName(env)
  const result = await request(
    `/repos/${repo}/actions/workflows/release.yml/runs?branch=main&event=workflow_dispatch&per_page=100`,
    { fetchImpl, token },
  )
  if (!result || !Array.isArray(result.workflow_runs))
    throw new GitHubReleaseError('GITHUB_RESPONSE')
  const title = `Production release - ${target} - ${sha.toLowerCase()}`
  const found = result.workflow_runs
    .filter((run) => run?.display_title === title)
    .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))[0]
  return found ? safeRun(found) : null
}

export async function getRunById(env = process.env, runId, fetchImpl = fetch, token) {
  if (!/^\d{1,20}$/.test(String(runId || ''))) throw new GitHubReleaseError('INVALID_RUN_ID', 400)
  const data = await request(`/repos/${repositoryName(env)}/actions/runs/${runId}`, {
    fetchImpl,
    token,
  })
  const run = safeRun(data)
  if (!run.title.startsWith('Production release - '))
    throw new GitHubReleaseError('GITHUB_NOT_FOUND', 404)
  return run
}

export async function dispatchRelease(
  env = process.env,
  { target, sha, deploymentId },
  fetchImpl = fetch,
) {
  if (target !== 'vercel-services' || !/^[a-f0-9]{40}$/i.test(sha || ''))
    throw new GitHubReleaseError('INVALID_RELEASE_REQUEST', 400)
  if (!/^dpl_[\w-]+$/.test(deploymentId || ''))
    throw new GitHubReleaseError('INVALID_RELEASE_REQUEST', 400)
  const token = await createInstallationToken(env, fetchImpl)
  const repo = repositoryName(env)
  const result = await request(`/repos/${repo}/actions/workflows/release.yml/dispatches`, {
    method: 'POST',
    token,
    fetchImpl,
    body: {
      ref: 'main',
      inputs: {
        target,
        target_sha: sha.toLowerCase(),
        vercel_deployment_id: deploymentId,
      },
      return_run_details: true,
    },
  })
  if (result && Number.isSafeInteger(result.workflow_run_id)) {
    return {
      id: result.workflow_run_id,
      status: 'QUEUED',
      url: typeof result.html_url === 'string' ? result.html_url : null,
      sha: sha.toLowerCase(),
      title: `Production release - ${target} - ${sha.toLowerCase()}`,
    }
  }
  return {
    id: null,
    status: 'QUEUED',
    url: `https://github.com/${repo}/actions/workflows/release.yml`,
    sha: sha.toLowerCase(),
    title: `Production release - ${target} - ${sha.toLowerCase()}`,
  }
}

export { workflowState }
