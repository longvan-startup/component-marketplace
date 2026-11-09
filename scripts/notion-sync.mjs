/**
 * notion-sync.mjs — mirror GitHub issues/PRs into a Notion database and ping
 * the relevant teammate with an @mention comment (Notion's own notification
 * mechanism) on review-request / assign / merge.
 *
 * No native Notion↔GitHub feature covers both halves of this for free: the
 * official "Database sync" integration (Business plan only) is read-only and
 * sends no notification at all — see docs/NOTION_SYNC.md for why this exists
 * instead of that.
 *
 * Run: bun scripts/notion-sync.mjs   (invoked by .github/workflows/notion-sync.yml
 * on `issues`/`pull_request` events; GITHUB_EVENT_NAME + GITHUB_EVENT_PATH are
 * set by Actions automatically).
 *
 * Missing NOTION_API_TOKEN/NOTION_DATABASE_ID ⇒ skip with a notice, same
 * fail-safe-off pattern as prototypes/deployment-dashboard — never guess or
 * fall back to a demo mode.
 *
 * A closed or merged issue/PR is archived (Notion's trash) right after
 * syncing, not just marked State=closed — the database should only ever
 * show what's still open. Reopening later creates a fresh row rather than
 * restoring the archived one (Notion's query API doesn't return archived
 * pages), which is fine: an archived page is meant to stay gone.
 */

import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const NOTION_VERSION = '2022-06-28'
/** Notion title property max length. */
const MAX_TITLE_LENGTH = 2000

/** Reads config from env; never logs the token/user-map values. */
export function syncConfiguration(env = process.env) {
  const userMap = parseUserMap(env.NOTION_GITHUB_USER_MAP)
  const configured = Boolean(env.NOTION_API_TOKEN && env.NOTION_DATABASE_ID)
  return {
    configured,
    token: env.NOTION_API_TOKEN ?? null,
    databaseId: env.NOTION_DATABASE_ID ?? null,
    userMap,
  }
}

function parseUserMap(raw) {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Normalizes a GitHub Actions `issues`/`pull_request` event payload into the
 * shape the rest of this module works with. Returns null for any event/action
 * this sync doesn't handle — the workflow still only triggers on the actions
 * listed in its `on:` block, this is a second guard for safety.
 */
export function parseGithubEvent(eventName, payload) {
  const repo = payload?.repository?.full_name
  if (!repo || typeof payload?.action !== 'string') return null

  if (eventName === 'issues' && payload.issue) {
    const issue = payload.issue
    return {
      kind: 'issue',
      number: issue.number,
      title: issue.title ?? '',
      url: issue.html_url,
      repo,
      state: issue.state,
      labels: (issue.labels ?? []).map((label) => label.name).filter(Boolean),
      author: issue.user?.login ?? null,
      updatedAt: issue.updated_at ?? null,
      notify: issueNotify(payload),
    }
  }

  if (eventName === 'pull_request' && payload.pull_request) {
    const pr = payload.pull_request
    const state = pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state
    return {
      kind: 'pull_request',
      number: pr.number,
      title: pr.title ?? '',
      url: pr.html_url,
      repo,
      state,
      labels: (pr.labels ?? []).map((label) => label.name).filter(Boolean),
      author: pr.user?.login ?? null,
      updatedAt: pr.updated_at ?? null,
      notify: pullRequestNotify(payload, pr),
    }
  }

  return null
}

/** Only `assigned` pings — every other issue action still syncs, just quietly. */
function issueNotify(payload) {
  if (payload.action === 'assigned' && payload.assignee?.login) {
    return {
      githubLogin: payload.assignee.login,
      message: `Issue #${payload.issue.number} assigned to you`,
    }
  }
  return null
}

/** Review requests and merges ping; every other PR action still syncs quietly. */
function pullRequestNotify(payload, pr) {
  if (payload.action === 'review_requested' && payload.requested_reviewer?.login) {
    return {
      githubLogin: payload.requested_reviewer.login,
      message: `Review requested on PR #${pr.number}`,
    }
  }
  if (payload.action === 'closed' && pr.merged && pr.user?.login) {
    return { githubLogin: pr.user.login, message: `PR #${pr.number} merged` }
  }
  return null
}

export function buildNotionProperties(record) {
  const kindLabel = record.kind === 'pull_request' ? 'PR' : 'Issue'
  const title = `${kindLabel} #${record.number}: ${record.title}`.slice(0, MAX_TITLE_LENGTH)
  return stripUndefined({
    Name: { title: [{ text: { content: title } }] },
    Type: { select: { name: record.kind === 'pull_request' ? 'Pull Request' : 'Issue' } },
    Repo: { rich_text: [{ text: { content: record.repo } }] },
    Number: { number: record.number },
    State: { select: { name: record.state } },
    URL: { url: record.url },
    Labels: { multi_select: record.labels.map((name) => ({ name })) },
    Author: { rich_text: [{ text: { content: record.author ?? 'unknown' } }] },
    'Updated At': record.updatedAt ? { date: { start: record.updatedAt } } : undefined,
  })
}

export function buildQueryFilter(record) {
  return {
    and: [
      { property: 'Repo', rich_text: { equals: record.repo } },
      { property: 'Number', number: { equals: record.number } },
      {
        property: 'Type',
        select: { equals: record.kind === 'pull_request' ? 'Pull Request' : 'Issue' },
      },
    ],
  }
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

async function notionRequest(token, fetchImpl, method, path, body) {
  const res = await fetchImpl(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'content-type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion API ${method} ${path} failed: ${res.status} ${text.slice(0, 500)}`)
  }
  return res.json()
}

async function findExistingPageId(token, databaseId, fetchImpl, record) {
  const result = await notionRequest(token, fetchImpl, 'POST', `/databases/${databaseId}/query`, {
    filter: buildQueryFilter(record),
    page_size: 1,
  })
  return result.results?.[0]?.id ?? null
}

/** Create-or-update by (Repo, Number, Type) — never creates a duplicate row. */
export async function upsertPage(token, databaseId, fetchImpl, record) {
  const properties = buildNotionProperties(record)
  const existingId = await findExistingPageId(token, databaseId, fetchImpl, record)
  if (existingId) {
    await notionRequest(token, fetchImpl, 'PATCH', `/pages/${existingId}`, { properties })
    return existingId
  }
  const created = await notionRequest(token, fetchImpl, 'POST', '/pages', {
    parent: { database_id: databaseId },
    properties,
  })
  return created.id
}

/** Closed/merged items are removed from the active view — "archived" is
 * Notion's trash, same as deleting a row from the database UI by hand. */
export async function archivePage(token, fetchImpl, pageId) {
  await notionRequest(token, fetchImpl, 'PATCH', `/pages/${pageId}`, { archived: true })
}

/** @mention IS the notification — Notion pushes it to that workspace member. */
export async function postNotifyComment(token, fetchImpl, pageId, notionUserId, message) {
  await notionRequest(token, fetchImpl, 'POST', '/comments', {
    parent: { page_id: pageId },
    rich_text: [
      { type: 'mention', mention: { type: 'user', user: { id: notionUserId } } },
      { type: 'text', text: { content: ` — ${message}` } },
    ],
  })
}

async function defaultLoadEventPayload(env) {
  if (!env.GITHUB_EVENT_PATH) return null
  const raw = await readFile(env.GITHUB_EVENT_PATH, 'utf8')
  return JSON.parse(raw)
}

export async function run(
  env = process.env,
  fetchImpl = fetch,
  loadEventPayload = defaultLoadEventPayload,
) {
  const config = syncConfiguration(env)
  if (!config.configured) {
    console.log('::notice::NOTION_API_TOKEN/NOTION_DATABASE_ID not set — skipping Notion sync.')
    return { skipped: true, reason: 'not_configured' }
  }

  const eventName = env.GITHUB_EVENT_NAME
  const payload = await loadEventPayload(env)
  if (!eventName || !payload) {
    console.log('::notice::No GitHub event payload available — skipping Notion sync.')
    return { skipped: true, reason: 'no_event' }
  }

  const record = parseGithubEvent(eventName, payload)
  if (!record) {
    console.log(
      `::notice::Unsupported event/action (${eventName}/${payload.action}) — skipping Notion sync.`,
    )
    return { skipped: true, reason: 'unsupported_event' }
  }

  const pageId = await upsertPage(config.token, config.databaseId, fetchImpl, record)
  console.log(`Synced ${record.kind} #${record.number} (${record.repo}) → Notion page ${pageId}`)

  if (record.notify) {
    const notionUserId = config.userMap[record.notify.githubLogin]
    if (notionUserId) {
      await postNotifyComment(config.token, fetchImpl, pageId, notionUserId, record.notify.message)
      console.log(`Notified Notion user mapped to GitHub @${record.notify.githubLogin}`)
    } else {
      console.log(
        `::notice::No Notion user mapped for GitHub login "${record.notify.githubLogin}" (NOTION_GITHUB_USER_MAP) — skipping mention comment.`,
      )
    }
  }

  const archived = record.state === 'closed' || record.state === 'merged'
  if (archived) {
    await archivePage(config.token, fetchImpl, pageId)
    console.log(`Archived ${record.kind} #${record.number} (state=${record.state})`)
  }

  return { skipped: false, pageId, archived }
}

// Run the CLI only when executed directly (bun scripts/notion-sync.mjs); do
// not self-run when imported for tests — same guard as check-boundaries.mjs.
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
