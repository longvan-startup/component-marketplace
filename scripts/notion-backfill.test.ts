/**
 * Tests for scripts/notion-backfill.mjs. Neither the GitHub API nor the
 * Notion API is ever called — `fetchImpl` is a fake that routes by host and
 * records every call.
 */
import { describe, expect, test } from 'bun:test'
import {
  backfillConfiguration,
  run,
  toIssueRecord,
  toPullRequestRecord,
} from './notion-backfill.mjs'

const REPO = 'longvan-startup/component-marketplace'

const baseEnv = {
  NOTION_API_TOKEN: 'secret',
  NOTION_DATABASE_ID: 'db-1',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_REPOSITORY: REPO,
}

describe('backfillConfiguration', () => {
  test('configured=false when any of the 4 required values is missing', () => {
    expect(backfillConfiguration({}).configured).toBe(false)
    expect(
      backfillConfiguration({ NOTION_API_TOKEN: 'x', NOTION_DATABASE_ID: 'x' }).configured,
    ).toBe(false)
    expect(backfillConfiguration({ ...baseEnv, GITHUB_TOKEN: undefined }).configured).toBe(false)
  })

  test('configured=true when all 4 values are present', () => {
    expect(backfillConfiguration(baseEnv).configured).toBe(true)
  })
})

describe('toIssueRecord / toPullRequestRecord', () => {
  test('maps a GitHub issue list item to the shared record shape', () => {
    const record = toIssueRecord(REPO, {
      number: 68,
      title: 'review: Duyệt RFC',
      html_url: `https://github.com/${REPO}/issues/68`,
      state: 'open',
      labels: [{ name: 'decision' }],
      user: { login: 'DaoDungVan' },
      updated_at: '2026-11-08T00:00:00Z',
    })
    expect(record).toEqual({
      kind: 'issue',
      number: 68,
      title: 'review: Duyệt RFC',
      url: `https://github.com/${REPO}/issues/68`,
      repo: REPO,
      state: 'open',
      labels: ['decision'],
      author: 'DaoDungVan',
      updatedAt: '2026-11-08T00:00:00Z',
    })
  })

  test('accepts plain-string labels as well as label objects', () => {
    const record = toIssueRecord(REPO, { number: 1, labels: ['bug', { name: 'p1' }] })
    expect(record.labels).toEqual(['bug', 'p1'])
  })

  test('a merged PR (merged_at set) maps to state="merged" regardless of draft/state', () => {
    const record = toPullRequestRecord(REPO, {
      number: 117,
      state: 'closed',
      draft: false,
      merged_at: '2026-11-09T03:32:18Z',
      html_url: `https://github.com/${REPO}/pull/117`,
      user: { login: 'DaoDungVan' },
      updated_at: '2026-11-09T03:32:18Z',
      labels: [],
    })
    expect(record.state).toBe('merged')
  })

  test('an open draft PR maps to state="draft"', () => {
    const record = toPullRequestRecord(REPO, {
      number: 2,
      state: 'open',
      draft: true,
      merged_at: null,
      html_url: `https://github.com/${REPO}/pull/2`,
      labels: [],
    })
    expect(record.state).toBe('draft')
  })

  test('a closed, unmerged PR keeps the GitHub state ("closed")', () => {
    const record = toPullRequestRecord(REPO, {
      number: 3,
      state: 'closed',
      draft: false,
      merged_at: null,
      html_url: `https://github.com/${REPO}/pull/3`,
      labels: [],
    })
    expect(record.state).toBe('closed')
  })
})

/** Routes GitHub REST calls and Notion API calls through one fake; records
 * every call made. */
function fakeFetch({ issuesPages = [[]], pullsPages = [[]] } = {}) {
  const calls: { method: string; url: string }[] = []
  const impl = async (url: string, init: { method?: string; body?: string } = {}) => {
    const method = init.method ?? 'GET'
    calls.push({ method, url })

    if (url.includes('api.github.com')) {
      const pageMatch = url.match(/[?&]page=(\d+)/)
      const page = pageMatch ? Number(pageMatch[1]) : 1
      if (url.includes('/issues?')) {
        return new Response(JSON.stringify(issuesPages[page - 1] ?? []), { status: 200 })
      }
      if (url.includes('/pulls?')) {
        return new Response(JSON.stringify(pullsPages[page - 1] ?? []), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    }

    // Notion API: query always "finds nothing" so every record is a create.
    if (url.includes('/databases/') && url.endsWith('/query')) {
      return new Response(JSON.stringify({ results: [] }), { status: 200 })
    }
    if (method === 'POST' && url.endsWith('/pages')) {
      return new Response(JSON.stringify({ id: 'page-new' }), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  }
  return { impl, calls }
}

describe('run', () => {
  test('skips without hitting the network when not configured', async () => {
    const { impl, calls } = fakeFetch()
    const result = await run({}, impl)
    expect(result).toEqual({ skipped: true, reason: 'not_configured' })
    expect(calls.length).toBe(0)
  })

  test('fetches issues and PRs (filtering PR items out of the issues list) and upserts each into Notion', async () => {
    const { impl, calls } = fakeFetch({
      issuesPages: [
        [
          {
            number: 68,
            title: 'review: Duyệt RFC',
            html_url: `https://github.com/${REPO}/issues/68`,
            state: 'open',
            labels: [],
            user: { login: 'DaoDungVan' },
            updated_at: '2026-11-08T00:00:00Z',
          },
          // Issues list endpoint also returns PRs — must be filtered out.
          {
            number: 117,
            pull_request: { url: 'x' },
            title: 'PR shows up here too',
          },
        ],
      ],
      pullsPages: [
        [
          {
            number: 117,
            title: 'feat(api): admin catalog CRUD',
            html_url: `https://github.com/${REPO}/pull/117`,
            state: 'closed',
            draft: false,
            merged_at: '2026-11-09T03:32:18Z',
            labels: [],
            user: { login: 'DaoDungVan' },
            updated_at: '2026-11-09T03:32:18Z',
          },
        ],
      ],
    })

    const result = await run(baseEnv, impl)
    expect(result).toEqual({ skipped: false, synced: 2 })

    const notionPageCreates = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/pages'))
    expect(notionPageCreates.length).toBe(2)
  })

  test('paginates GitHub results until a short page is returned', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      title: `issue ${i + 1}`,
      html_url: `https://github.com/${REPO}/issues/${i + 1}`,
      state: 'open',
      labels: [],
      user: { login: 'DaoDungVan' },
      updated_at: '2026-11-08T00:00:00Z',
    }))
    const { impl, calls } = fakeFetch({ issuesPages: [fullPage, []], pullsPages: [[]] })

    const result = await run(baseEnv, impl)
    expect(result).toEqual({ skipped: false, synced: 100 })

    const issuesCalls = calls.filter((c) => c.url.includes('/issues?'))
    expect(issuesCalls.length).toBe(2)
  })
})
