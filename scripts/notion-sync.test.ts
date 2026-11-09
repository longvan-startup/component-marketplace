/**
 * Tests for scripts/notion-sync.mjs. The Notion API itself is never called —
 * `fetchImpl` is always a fake that records calls and returns canned JSON.
 */
import { describe, expect, test } from 'bun:test'
import {
  buildNotionProperties,
  buildQueryFilter,
  parseGithubEvent,
  postNotifyComment,
  run,
  syncConfiguration,
  upsertPage,
} from './notion-sync.mjs'

const REPO = 'longvan-startup/component-marketplace'

function issuesPayload(action, overrides = {}) {
  return {
    action,
    repository: { full_name: REPO },
    issue: {
      number: 68,
      title: 'review: Duyệt RFC',
      html_url: `https://github.com/${REPO}/issues/68`,
      state: 'open',
      labels: [{ name: 'decision' }],
      user: { login: 'DaoDungVan' },
      updated_at: '2026-11-08T00:00:00Z',
      ...overrides.issue,
    },
    ...(overrides.assignee ? { assignee: overrides.assignee } : {}),
  }
}

function pullRequestPayload(action, overrides = {}) {
  return {
    action,
    repository: { full_name: REPO },
    pull_request: {
      number: 117,
      title: 'feat(api): admin catalog CRUD',
      html_url: `https://github.com/${REPO}/pull/117`,
      state: 'open',
      merged: false,
      draft: false,
      labels: [],
      user: { login: 'DaoDungVan' },
      updated_at: '2026-11-08T16:53:00Z',
      ...overrides.pull_request,
    },
    ...(overrides.requested_reviewer ? { requested_reviewer: overrides.requested_reviewer } : {}),
  }
}

describe('syncConfiguration', () => {
  test('configured=false when token or database id is missing', () => {
    expect(syncConfiguration({}).configured).toBe(false)
    expect(syncConfiguration({ NOTION_API_TOKEN: 'x' }).configured).toBe(false)
    expect(syncConfiguration({ NOTION_DATABASE_ID: 'x' }).configured).toBe(false)
  })

  test('configured=true and parses a valid NOTION_GITHUB_USER_MAP', () => {
    const config = syncConfiguration({
      NOTION_API_TOKEN: 'secret_x',
      NOTION_DATABASE_ID: 'db_x',
      NOTION_GITHUB_USER_MAP: '{"DaoDungVan":"notion-user-1"}',
    })
    expect(config.configured).toBe(true)
    expect(config.userMap).toEqual({ DaoDungVan: 'notion-user-1' })
  })

  test('malformed NOTION_GITHUB_USER_MAP degrades to an empty map, not a crash', () => {
    const config = syncConfiguration({
      NOTION_API_TOKEN: 'x',
      NOTION_DATABASE_ID: 'x',
      NOTION_GITHUB_USER_MAP: 'not json',
    })
    expect(config.userMap).toEqual({})
  })
})

describe('parseGithubEvent', () => {
  test('returns null for an event this sync does not handle', () => {
    expect(parseGithubEvent('push', { repository: { full_name: REPO } })).toBeNull()
  })

  test('returns null when repository.full_name is missing', () => {
    expect(parseGithubEvent('issues', { action: 'opened', issue: {} })).toBeNull()
  })

  test('issues/opened syncs with notify=null', () => {
    const record = parseGithubEvent('issues', issuesPayload('opened'))
    expect(record?.kind).toBe('issue')
    expect(record?.number).toBe(68)
    expect(record?.notify).toBeNull()
  })

  test('issues/assigned sets notify to the new assignee', () => {
    const record = parseGithubEvent(
      'issues',
      issuesPayload('assigned', { assignee: { login: 'NguyenTuMinhLong' } }),
    )
    expect(record?.notify).toEqual({
      githubLogin: 'NguyenTuMinhLong',
      message: 'Issue #68 assigned to you',
    })
  })

  test('pull_request/review_requested sets notify to the requested reviewer', () => {
    const record = parseGithubEvent(
      'pull_request',
      pullRequestPayload('review_requested', { requested_reviewer: { login: 'NguyenTuMinhLong' } }),
    )
    expect(record?.notify).toEqual({
      githubLogin: 'NguyenTuMinhLong',
      message: 'Review requested on PR #117',
    })
  })

  test('pull_request/closed with merged=true sets notify to the PR author and state="merged"', () => {
    const record = parseGithubEvent(
      'pull_request',
      pullRequestPayload('closed', { pull_request: { merged: true, state: 'closed' } }),
    )
    expect(record?.state).toBe('merged')
    expect(record?.notify).toEqual({ githubLogin: 'DaoDungVan', message: 'PR #117 merged' })
  })

  test('pull_request/closed without merge has no notify and state="closed"', () => {
    const record = parseGithubEvent(
      'pull_request',
      pullRequestPayload('closed', { pull_request: { state: 'closed' } }),
    )
    expect(record?.state).toBe('closed')
    expect(record?.notify).toBeNull()
  })

  test('draft pull_request reports state="draft"', () => {
    const record = parseGithubEvent(
      'pull_request',
      pullRequestPayload('opened', { pull_request: { draft: true } }),
    )
    expect(record?.state).toBe('draft')
  })
})

describe('buildNotionProperties / buildQueryFilter', () => {
  const record = parseGithubEvent('pull_request', pullRequestPayload('opened'))

  test('properties carry the expected Notion shapes', () => {
    const properties = buildNotionProperties(record)
    expect(properties.Name.title[0].text.content).toBe('PR #117: feat(api): admin catalog CRUD')
    expect(properties.Type).toEqual({ select: { name: 'Pull Request' } })
    expect(properties.Repo).toEqual({ rich_text: [{ text: { content: REPO } }] })
    expect(properties.Number).toEqual({ number: 117 })
    expect(properties.State).toEqual({ select: { name: 'open' } })
  })

  test('a missing updatedAt omits the "Updated At" property instead of sending null', () => {
    const properties = buildNotionProperties({ ...record, updatedAt: null })
    expect(properties['Updated At']).toBeUndefined()
  })

  test('query filter matches on Repo + Number + Type', () => {
    expect(buildQueryFilter(record)).toEqual({
      and: [
        { property: 'Repo', rich_text: { equals: REPO } },
        { property: 'Number', number: { equals: 117 } },
        { property: 'Type', select: { equals: 'Pull Request' } },
      ],
    })
  })
})

/** Records every call; `queryResult` controls whether upsert creates or updates. */
function fakeFetch(queryResult = { results: [] }) {
  const calls: { method: string; url: string; body: unknown }[] = []
  const impl = async (url: string, init: { method: string; body?: string }) => {
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method: init.method, url, body })
    if (url.includes('/databases/') && url.endsWith('/query')) {
      return new Response(JSON.stringify(queryResult), { status: 200 })
    }
    if (init.method === 'POST' && url.endsWith('/pages')) {
      return new Response(JSON.stringify({ id: 'page-new' }), { status: 200 })
    }
    if (init.method === 'PATCH' && url.includes('/pages/')) {
      return new Response(JSON.stringify({ id: 'page-existing' }), { status: 200 })
    }
    if (init.method === 'POST' && url.endsWith('/comments')) {
      return new Response(JSON.stringify({ id: 'comment-1' }), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  }
  return { impl, calls }
}

describe('upsertPage', () => {
  test('creates a page when the query finds nothing', async () => {
    const record = parseGithubEvent('pull_request', pullRequestPayload('opened'))
    const { impl, calls } = fakeFetch({ results: [] })
    const pageId = await upsertPage('token', 'db-1', impl, record)
    expect(pageId).toBe('page-new')
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/pages'))).toBe(true)
  })

  test('updates the existing page instead of creating a duplicate', async () => {
    const record = parseGithubEvent('pull_request', pullRequestPayload('opened'))
    const { impl, calls } = fakeFetch({ results: [{ id: 'page-existing' }] })
    const pageId = await upsertPage('token', 'db-1', impl, record)
    expect(pageId).toBe('page-existing')
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/pages'))).toBe(false)
    expect(calls.some((c) => c.method === 'PATCH' && c.url.includes('page-existing'))).toBe(true)
  })

  test('throws with the status + body on a non-OK Notion response', async () => {
    const record = parseGithubEvent('pull_request', pullRequestPayload('opened'))
    const impl = async () => new Response('bad token', { status: 401 })
    await expect(upsertPage('token', 'db-1', impl, record)).rejects.toThrow(/401/)
  })
})

describe('postNotifyComment', () => {
  test('sends a mention block followed by the message text', async () => {
    const { impl, calls } = fakeFetch()
    await postNotifyComment('token', impl, 'page-1', 'notion-user-1', 'PR #117 merged')
    const call = calls.find((c) => c.url.endsWith('/comments'))
    expect(call?.body).toEqual({
      parent: { page_id: 'page-1' },
      rich_text: [
        { type: 'mention', mention: { type: 'user', user: { id: 'notion-user-1' } } },
        { type: 'text', text: { content: ' — PR #117 merged' } },
      ],
    })
  })
})

describe('run', () => {
  const baseEnv = {
    NOTION_API_TOKEN: 'secret',
    NOTION_DATABASE_ID: 'db-1',
    GITHUB_EVENT_NAME: 'pull_request',
  }

  test('skips without hitting the network when not configured', async () => {
    const { impl, calls } = fakeFetch()
    const result = await run({}, impl, async () => pullRequestPayload('opened'))
    expect(result).toEqual({ skipped: true, reason: 'not_configured' })
    expect(calls.length).toBe(0)
  })

  test('skips when the event payload is missing', async () => {
    const { impl } = fakeFetch()
    const result = await run(baseEnv, impl, async () => null)
    expect(result).toEqual({ skipped: true, reason: 'no_event' })
  })

  test('skips unsupported actions (e.g. "synchronize") without erroring', async () => {
    const { impl } = fakeFetch()
    const result = await run(baseEnv, impl, async () => ({
      action: 'synchronize',
      repository: { full_name: REPO },
    }))
    expect(result).toEqual({ skipped: true, reason: 'unsupported_event' })
  })

  test('syncs and posts a mention comment when the GitHub login is mapped', async () => {
    const { impl, calls } = fakeFetch({ results: [] })
    const env = { ...baseEnv, NOTION_GITHUB_USER_MAP: '{"NguyenTuMinhLong":"notion-user-2"}' }
    const payload = pullRequestPayload('review_requested', {
      requested_reviewer: { login: 'NguyenTuMinhLong' },
    })
    const result = await run(env, impl, async () => payload)
    expect(result).toEqual({ skipped: false, pageId: 'page-new' })
    expect(calls.some((c) => c.url.endsWith('/comments'))).toBe(true)
  })

  test('syncs but skips the comment when the GitHub login has no mapped Notion user', async () => {
    const { impl, calls } = fakeFetch({ results: [] })
    const payload = pullRequestPayload('review_requested', {
      requested_reviewer: { login: 'SomeoneUnmapped' },
    })
    const result = await run(baseEnv, impl, async () => payload)
    expect(result.skipped).toBe(false)
    expect(calls.some((c) => c.url.endsWith('/comments'))).toBe(false)
  })
})
