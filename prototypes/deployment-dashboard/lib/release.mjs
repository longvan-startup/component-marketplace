import {
  appConfiguration,
  createInstallationToken,
  dispatchRelease,
  getCiSnapshot,
  getRecentPullRequests,
  getReleaseRun,
} from './github-release.mjs'
import {
  getDeploymentDetails,
  getProjectProductionState,
  listDeployments,
  ProviderError,
} from './provider.mjs'

const DEFAULT_REPOSITORY = 'longvan-startup/component-marketplace'

function publicUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash ||
      isLoopbackOrPrivateHost(url.hostname)
    )
      return null
    return url.origin + url.pathname.replace(/\/$/, '') + url.search
  } catch {
    return null
  }
}

function isLoopbackOrPrivateHost(hostname) {
  const host = hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.startsWith('[')
  )
    return true
  const address = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!address) return false
  const [first, second] = address.slice(1).map(Number)
  if (address.slice(1).some((part) => Number(part) > 255)) return true
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function sortedNewest(items) {
  return [...items].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
}

function deploymentSummary(item) {
  if (!item) return null
  return {
    id: item.id,
    status: item.status,
    commitSha: item.commitSha,
    url: publicUrl(item.url),
    createdAt: item.createdAt,
  }
}

function releaseRunIsBusy(run) {
  return run?.status === 'QUEUED' || run?.status === 'RUNNING'
}

export function releaseConfiguration(env = process.env) {
  const projectId = env.RELEASE_VERCEL_PROJECT_ID || ''
  const teamId = env.VERCEL_TEAM_ID || ''
  const allowedProjectIds = (env.VERCEL_PROJECT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const repository = env.RELEASE_GITHUB_REPOSITORY || DEFAULT_REPOSITORY
  const webUrl = publicUrl(env.PRODUCTION_WEB_URL)
  const apiUrl = publicUrl(env.PRODUCTION_API_URL)
  const vercelReadConfigured = Boolean(
    env.VERCEL_API_TOKEN &&
      /^team_[\w-]+$/.test(teamId) &&
      /^prj_[\w-]+$/.test(projectId) &&
      allowedProjectIds.includes(projectId),
  )
  const githubAppConfigured = Boolean(appConfiguration(env))
  const repositoryValid = /^[\w.-]+\/[\w.-]+$/.test(repository)
  const productionEnabled = env.RELEASE_PRODUCTION_ENABLED === 'true'
  const missing = []
  if (!productionEnabled) missing.push('release_disabled')
  if (!githubAppConfigured) missing.push('github_app')
  if (!vercelReadConfigured) missing.push('vercel_project_or_read_access')
  if (!repositoryValid) missing.push('github_repository')
  if (!webUrl || !apiUrl) missing.push('production_urls')
  return {
    productionEnabled,
    projectId: /^prj_[\w-]+$/.test(projectId) ? projectId : null,
    repository: repositoryValid ? repository : null,
    webUrl,
    apiUrl,
    vercelReadConfigured,
    githubAppConfigured,
    missing,
  }
}

export async function getReleaseSnapshot(
  env = process.env,
  fetchImpl = fetch,
  { includePullRequests = true } = {},
) {
  const configuration = releaseConfiguration(env)
  let githubToken
  let pullRequestToken
  let githubAppReady = false
  if (configuration.githubAppConfigured) {
    try {
      githubToken = await createInstallationToken(env, fetchImpl, { includePullRequests })
      if (includePullRequests) pullRequestToken = githubToken
      githubAppReady = true
    } catch {
      if (includePullRequests) {
        try {
          githubToken = await createInstallationToken(env, fetchImpl)
          githubAppReady = true
        } catch {
          githubAppReady = false
        }
      } else {
        githubAppReady = false
      }
    }
  }

  const pullRequestResult = includePullRequests
    ? getRecentPullRequests(env, fetchImpl, pullRequestToken)
        .then((items) => ({ items, available: true }))
        .catch(() => ({ items: [], available: false }))
    : Promise.resolve({ items: [], available: true })
  const [ci, pullRequests] = await Promise.all([
    getCiSnapshot(env, fetchImpl, githubToken),
    pullRequestResult,
  ])
  let vercelDeployments = []
  let productionState = null
  let vercelError = null
  if (configuration.vercelReadConfigured) {
    try {
      const [result, state] = await Promise.all([
        listDeployments(configuration.projectId, env, fetchImpl),
        getProjectProductionState(configuration.projectId, env, fetchImpl),
      ])
      vercelDeployments = result.items
      productionState = state
    } catch (error) {
      vercelError = error instanceof ProviderError ? error.code : 'UPSTREAM_UNAVAILABLE'
    }
  } else {
    vercelError = 'NOT_CONFIGURED'
  }

  const latestVerifiedSha = ci.latestVerified?.sha || null
  let productionDeployment =
    vercelDeployments.find(
      (deployment) =>
        deployment.target === 'production' &&
        productionState?.deploymentId &&
        deployment.id === productionState.deploymentId,
    ) ||
    sortedNewest(
      vercelDeployments.filter(
        (deployment) => deployment.target === 'production' && deployment.aliasAssigned === true,
      ),
    )[0]
  if (
    productionState?.deploymentId &&
    (productionDeployment?.id !== productionState.deploymentId || !productionDeployment.commitSha)
  ) {
    try {
      const activeDeployment = await getDeploymentDetails(
        productionState.deploymentId,
        configuration.projectId,
        env,
        fetchImpl,
      )
      if (
        activeDeployment.id === productionState.deploymentId &&
        activeDeployment.target === 'production'
      )
        productionDeployment = activeDeployment
    } catch {
      // Keep the project target status when Vercel omits deployment metadata.
    }
  }
  let stagedDeployment = null
  if (latestVerifiedSha) {
    const stagedCandidate = sortedNewest(
      vercelDeployments.filter(
        (deployment) =>
          deployment.target === 'production' &&
          deployment.status === 'READY' &&
          deployment.commitSha === latestVerifiedSha &&
          deployment.aliasAssigned === false,
      ),
    )[0]
    if (stagedCandidate) {
      try {
        const detail = await getDeploymentDetails(
          stagedCandidate.id,
          configuration.projectId,
          env,
          fetchImpl,
        )
        if (
          detail.status === 'READY' &&
          detail.target === 'production' &&
          detail.commitSha === latestVerifiedSha &&
          detail.aliasAssigned === false
        ) {
          stagedDeployment = deploymentSummary(detail)
        }
      } catch {
        stagedDeployment = null
      }
    }
  }

  let releaseRun = null
  if (latestVerifiedSha) {
    try {
      releaseRun = await getReleaseRun(
        env,
        latestVerifiedSha,
        'vercel-services',
        fetchImpl,
        githubToken,
      )
    } catch {
      releaseRun = null
    }
  }

  const alreadyReleased = Boolean(
    latestVerifiedSha &&
      (releaseRun?.status === 'SUCCESS' || productionDeployment?.commitSha === latestVerifiedSha),
  )
  const readyToRelease = Boolean(
    configuration.productionEnabled &&
      configuration.githubAppConfigured &&
      githubAppReady &&
      configuration.vercelReadConfigured &&
      !vercelError &&
      configuration.repository &&
      configuration.webUrl &&
      configuration.apiUrl &&
      latestVerifiedSha &&
      stagedDeployment &&
      !releaseRunIsBusy(releaseRun) &&
      !alreadyReleased,
  )
  const workflowUrl = configuration.repository
    ? `https://github.com/${configuration.repository}/actions/workflows/release.yml`
    : null

  return {
    mode: 'live',
    configuration: {
      productionEnabled: configuration.productionEnabled,
      vercelProjectConfigured: configuration.vercelReadConfigured,
      githubAppConfigured: configuration.githubAppConfigured && githubAppReady,
      productionUrls: { web: configuration.webUrl, api: configuration.apiUrl },
      missing: configuration.missing,
    },
    ci,
    pullRequests: pullRequests.items,
    pullRequestsAvailable: pullRequests.available,
    workflowUrl,
    vercelError,
    stagedDeployment,
    productionState,
    productionDeployment: deploymentSummary(productionDeployment),
    releaseRun,
    alreadyReleased,
    readyToRelease,
  }
}

export async function startRelease(env = process.env, fetchImpl = fetch, expectedCandidate = {}) {
  const snapshot = await getReleaseSnapshot(env, fetchImpl, { includePullRequests: false })
  const deployment = snapshot.stagedDeployment
  const sha = snapshot.ci.latestVerified?.sha?.toLowerCase() || null
  const expectedSha =
    typeof expectedCandidate.expectedSha === 'string'
      ? expectedCandidate.expectedSha.toLowerCase()
      : null
  const currentFailedRunId =
    snapshot.releaseRun?.status === 'FAILED' ? String(snapshot.releaseRun.id) : null
  const expectedFailedRunId =
    expectedCandidate.expectedReleaseRunId == null
      ? null
      : String(expectedCandidate.expectedReleaseRunId)
  if (
    expectedSha !== sha ||
    expectedCandidate.expectedDeploymentId !== deployment?.id ||
    expectedFailedRunId !== currentFailedRunId
  ) {
    return { started: false, reason: 'CANDIDATE_CHANGED', snapshot }
  }
  if (!snapshot.readyToRelease || !deployment?.id || !sha) {
    return { started: false, reason: 'NOT_READY', snapshot }
  }
  const release = await dispatchRelease(
    env,
    {
      target: 'vercel-services',
      sha,
      deploymentId: deployment.id,
      retryFailedRunId: currentFailedRunId,
    },
    fetchImpl,
  )
  return {
    started: true,
    release: {
      ...release,
      sha,
      deploymentId: deployment.id,
      retryFailedRunId: currentFailedRunId,
    },
  }
}
