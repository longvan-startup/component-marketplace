/**
 * notion-backfill.mjs — one-time backfill of EXISTING GitHub issues/PRs into
 * the Notion database notion-sync.mjs keeps in sync going forward.
 *
 * notion-sync.mjs only reacts to new `issues`/`pull_request` webhook events,
 * so anything opened before that workflow existed never reaches Notion on
 * its own. This script walks the GitHub REST API once for currently-OPEN
 * issues/PRs only (closed/merged history is not backfilled — scoped down on
 * request, see docs/NOTION_SYNC.md) and upserts each through the same
 * Notion-writing code path
 * (buildNotionProperties / upsertPage, reused from notion-sync.mjs) — no
 * @mention comments, since pinging everyone for old activity would be noise,
 * not a notification.
 *
 * Run once, locally (not a GitHub Action — this is a manual one-off):
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo \
 *   NOTION_API_TOKEN=... NOTION_DATABASE_ID=... bun scripts/notion-backfill.mjs
 *
 * Missing any of the 4 required values ⇒ skip with a notice, same
 * fail-safe-off pattern as notion-sync.mjs: never guesses or runs partial.
 */

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { syncConfiguration, upsertPage } from './notion-sync.mjs'

const GITHUB_API = 'https://api.github.com'
const PER_PAGE = 100

export function backfillConfiguration(env = process.env) {
  const notion = syncConfiguration(env)
  return {
    ...notion,
    configured: notion.configured && Boolean(env.GITHUB_TOKEN && env.GITHUB_REPOSITORY),
    githubToken: env.GITHUB_TOKEN ?? null,
    repo: env.GITHUB_REPOSITORY ?? null,
  }
}

function labelNames(labels) {
  return (labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter(Boolean)
}

function loginNames(users) {
  return (users ?? []).map((user) => user?.login).filter(Boolean)
}

export function toIssueRecord(repo, issue) {
  return {
    kind: 'issue',
    number: issue.number,
    title: issue.title ?? '',
    url: issue.html_url,
    repo,
    state: issue.state,
    labels: labelNames(issue.labels),
    author: issue.user?.login ?? null,
    assignees: loginNames(issue.assignees),
    updatedAt: issue.updated_at ?? null,
  }
}

export function toPullRequestRecord(repo, pr) {
  const state = pr.merged_at ? 'merged' : pr.draft ? 'draft' : pr.state
  return {
    kind: 'pull_request',
    number: pr.number,
    title: pr.title ?? '',
    url: pr.html_url,
    repo,
    state,
    labels: labelNames(pr.labels),
    author: pr.user?.login ?? null,
    assignees: loginNames(pr.assignees),
    updatedAt: pr.updated_at ?? null,
  }
}

async function githubRequest(token, fetchImpl, path) {
  const res = await fetchImpl(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub API GET ${path} failed: ${res.status} ${text.slice(0, 500)}`)
  }
  return res.json()
}

async function paginate(token, fetchImpl, pathForPage) {
  const items = []
  for (let page = 1; ; page++) {
    const batch = await githubRequest(token, fetchImpl, pathForPage(page))
    items.push(...batch)
    if (batch.length < PER_PAGE) break
  }
  return items
}

/** Plain issues only — the `issues` list endpoint also returns PRs (flagged
 * by a `pull_request` key on each item); those are fetched separately via
 * `/pulls` below so PR state (`merged`) is accurate. */
async function fetchIssues(token, fetchImpl, repo) {
  const items = await paginate(
    token,
    fetchImpl,
    (page) => `/repos/${repo}/issues?state=open&per_page=${PER_PAGE}&page=${page}`,
  )
  return items.filter((item) => !item.pull_request)
}

function fetchPullRequests(token, fetchImpl, repo) {
  return paginate(
    token,
    fetchImpl,
    (page) => `/repos/${repo}/pulls?state=open&per_page=${PER_PAGE}&page=${page}`,
  )
}

export async function run(env = process.env, fetchImpl = fetch) {
  const config = backfillConfiguration(env)
  if (!config.configured) {
    console.log(
      '::notice::NOTION_API_TOKEN/NOTION_DATABASE_ID/GITHUB_TOKEN/GITHUB_REPOSITORY not set — skipping Notion backfill.',
    )
    return { skipped: true, reason: 'not_configured' }
  }

  const [issues, pullRequests] = await Promise.all([
    fetchIssues(config.githubToken, fetchImpl, config.repo),
    fetchPullRequests(config.githubToken, fetchImpl, config.repo),
  ])

  const records = [
    ...issues.map((issue) => toIssueRecord(config.repo, issue)),
    ...pullRequests.map((pr) => toPullRequestRecord(config.repo, pr)),
  ]

  let synced = 0
  for (const record of records) {
    await upsertPage(config.token, config.databaseId, fetchImpl, record)
    synced += 1
    console.log(`Synced ${record.kind} #${record.number} (${synced}/${records.length})`)
  }

  console.log(`Backfill done: ${synced} issue/PR synced into Notion.`)
  return { skipped: false, synced }
}

// Run the CLI only when executed directly (bun scripts/notion-backfill.mjs);
// do not self-run when imported for tests — same guard as check-boundaries.mjs.
function isDirectRun() {
  try {
    const self = realpathSync(fileURLToPath(import.meta.url))
    const entry = process.argv[1] ? realpathSync(process.argv[1]) : ''
    return self === entry
  } catch {
    return false
  }
}
if (isDirectRun()) {
  run().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
