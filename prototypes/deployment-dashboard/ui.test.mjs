import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName
    this.dataset = {}
    this.textContent = ''
    this.value = ''
    this.children = []
    this.attributes = {}
    this.listeners = {}
    this.open = false
    this.className = ''
    this.href = ''
    this.target = ''
    this.rel = ''
    this.disabled = false
    const classes = new Set()
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
    }
  }
  setAttribute(name, value) {
    this.attributes[name] = value
  }
  removeAttribute(name) {
    delete this.attributes[name]
  }
  addEventListener(name, callback) {
    this.listeners[name] = callback
  }
  append(...items) {
    this.children.push(...items)
  }
  replaceChildren(...items) {
    this.children = items
  }
  showModal() {
    this.open = true
  }
  close() {
    this.open = false
  }
  focus() {}
}

const readySnapshot = {
  mode: 'live',
  configuration: {
    productionEnabled: true,
    productionUrls: { web: 'https://marketplace.example', api: 'https://marketplace.example/api' },
  },
  ci: {
    latestVerified: {
      sha: 'a'.repeat(40),
      url: 'https://github.com/longvan-startup/component-marketplace/actions/runs/1',
    },
  },
  pullRequests: [],
  pullRequestsAvailable: true,
  workflowUrl:
    'https://github.com/longvan-startup/component-marketplace/actions/workflows/release.yml',
  stagedDeployment: { id: 'dpl_stage_1', status: 'READY', commitSha: 'a'.repeat(40) },
  productionDeployment: null,
  releaseRun: null,
  alreadyReleased: false,
  readyToRelease: true,
  vercelError: null,
}

async function mount(fetchHandler, stored = {}) {
  const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const nodes = new Map()
  const ids = [
    'login-panel',
    'login-error',
    'connection-status',
    'logout',
    'load-error',
    'release-section',
    'activity-panel',
    'history',
    'empty-history',
    'services',
    'recent-pull-requests',
    'pull-request-error',
    'verified-sha',
    'readiness-status',
    'ci-link',
    'release-workflow-link',
    'release-help',
    'release-error',
    'deploy-production',
    'refresh-release',
    'confirm-dialog',
    'confirm-sha',
    'confirm-deployment-id',
    'confirm-failed-run-id',
    'confirm-error',
    'confirm-release',
    'cancel-release',
    'breadcrumb',
    'page-title',
    'page-intro',
  ]
  for (const id of ids) nodes.set(id, new Element())
  for (const id of [
    'logout',
    'load-error',
    'activity-panel',
    'release-section',
    'release-error',
    'pull-request-error',
    'ci-link',
    'release-workflow-link',
    'confirm-error',
  ])
    nodes.get(id).classList.add('hidden')
  const nav = ['overview', 'activity'].map((view) => {
    const item = new Element('button')
    item.dataset.view = view
    return item
  })
  const local = new Map(Object.entries(stored))
  const localStorage = {
    getItem(key) {
      return local.get(key) ?? null
    },
    setItem(key, value) {
      local.set(key, value)
    },
  }
  const opened = []
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, new Element())
      return nodes.get(id)
    },
    querySelectorAll(selector) {
      return selector === '[data-view]' ? nav : []
    },
    createElement(tagName) {
      return new Element(tagName)
    },
    createTextNode(text) {
      return { textContent: text }
    },
  }
  vm.runInNewContext(script, {
    document,
    fetch: fetchHandler,
    localStorage,
    URL,
    Date,
    Math,
    window: {
      open: (...args) => opened.push(args),
      setTimeout: () => 1,
      clearTimeout: () => {},
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 25))
  return { nodes, nav, local, opened }
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

test('guest remains on sign-in and does not request release data', async () => {
  const paths = []
  const { nodes } = await mount(async (path) => {
    paths.push(path)
    return response({ user: null })
  })
  assert.deepEqual(paths, ['/api/auth/session'])
  assert.equal(nodes.get('login-panel').classList.contains('hidden'), false)
  assert.equal(nodes.get('release-section').classList.contains('hidden'), true)
})

test('recent PRs show their GitHub state and activity separately from CI and production', async () => {
  const snapshot = {
    ...structuredClone(readySnapshot),
    pullRequests: [
      {
        number: 130,
        title: 'Open <script> title',
        state: 'OPEN',
        mergedAt: null,
        updatedAt: '2026-11-09T08:00:00.000Z',
        url: 'https://github.com/longvan-startup/component-marketplace/pull/130',
      },
      {
        number: 125,
        title: 'A recent merged change',
        state: 'MERGED',
        mergedAt: '2026-11-09T07:22:10.000Z',
        updatedAt: '2026-11-09T07:22:10.000Z',
        url: 'https://github.com/longvan-startup/component-marketplace/pull/125',
      },
      {
        number: 131,
        title: 'Untrusted URL stays unlinked',
        state: 'CLOSED',
        mergedAt: '2026-11-09T07:00:00.000Z',
        updatedAt: '2026-11-09T07:00:00.000Z',
        url: 'https://attacker.example/longvan-startup/component-marketplace/pull/131',
      },
    ],
    productionState: { status: 'ERROR' },
    productionDeployment: { commitSha: 'f'.repeat(40), createdAt: '2026-11-08T10:00:00Z' },
  }
  const { nodes } = await mount(async (path) => {
    if (path === '/api/auth/session') return response({ user: { name: 'User' } })
    if (path === '/api/release') return response(snapshot)
    throw new Error(`Unexpected request: ${path}`)
  })

  const rows = nodes.get('recent-pull-requests').children
  assert.equal(rows.length, 3)
  assert.equal(rows[0].children[0].children[0].tagName, 'a')
  assert.equal(rows[0].children[0].children[0].href, snapshot.pullRequests[0].url)
  assert.equal(rows[0].children[0].children[0].textContent, 'Open <script> title')
  assert.equal(rows[0].children[1].textContent, 'Đang mở')
  assert.match(rows[1].children[0].children[1].textContent, /#125 · Cập nhật/)
  assert.equal(rows[1].children[1].textContent, 'Đã merge')
  assert.equal(rows[2].children[0].children[0].tagName, 'span')
  assert.match(
    nodes.get('services').children[0].children[2].children[1].textContent,
    /commit f{12}/i,
  )
  assert.equal(nodes.get('readiness-status').textContent, 'Sẵn sàng release')
})

test('Open Local uses loopback URL, Admin remains planned, and deploy confirmation sends only a protected request', async () => {
  const paths = []
  let snapshot = structuredClone(readySnapshot)
  const { nodes, opened, local } = await mount(async (path, options = {}) => {
    paths.push([path, options])
    if (path === '/api/auth/session') return response({ user: { name: 'User' } })
    if (path === '/api/release/csrf') return response({ csrfToken: 'csrf-test-token' })
    if (path === '/api/release' && options.method === 'POST') {
      snapshot = {
        ...snapshot,
        readyToRelease: false,
        releaseRun: {
          id: 42,
          status: 'QUEUED',
          url: 'https://github.com/actions/runs/42',
          sha: 'a'.repeat(40),
          deploymentId: 'dpl_stage_1',
          title: `Production release - vercel-services - ${'a'.repeat(40)}`,
          requestedAt: new Date().toISOString(),
        },
      }
      return response(
        {
          release: {
            id: 42,
            status: 'QUEUED',
            url: 'https://github.com/actions/runs/42',
            sha: 'a'.repeat(40),
            deploymentId: 'dpl_stage_1',
            title: `Production release - vercel-services - ${'a'.repeat(40)}`,
            requestedAt: new Date().toISOString(),
          },
        },
        202,
      )
    }
    if (path === '/api/release') return response(snapshot)
    throw new Error(`Unexpected request: ${path}`)
  })

  const webCard = nodes.get('services').children[0]
  assert.match(webCard.children[1].children[1].textContent, /Ready/)
  assert.equal(webCard.children[3].children[0].children[1].textContent, 'http://localhost:3000/')
  assert.equal(
    webCard.children[3].children[1].children[1].textContent,
    'https://marketplace.example/',
  )
  const cardActions = webCard.children[4]
  await cardActions.children[0].listeners.click()
  assert.deepEqual(opened[0], ['http://localhost:3000/', '_blank', 'noopener,noreferrer'])
  assert.equal(
    paths.some(([path]) => path.startsWith('http://localhost')),
    false,
  )

  const adminCard = nodes.get('services').children[2]
  assert.match(adminCard.children[1].textContent, /Planned · Not configured/)
  assert.equal(adminCard.children.length, 2)

  cardActions.children[2].listeners.click()
  assert.equal(nodes.get('confirm-dialog').open, true)
  assert.equal(nodes.get('confirm-sha').textContent, 'a'.repeat(40))
  assert.equal(nodes.get('confirm-deployment-id').textContent, 'dpl_stage_1')
  assert.equal(nodes.get('confirm-failed-run-id').textContent, 'Không có')
  await nodes.get('confirm-release').listeners.click()
  assert.equal(nodes.get('confirm-dialog').open, false)
  const post = paths.find(
    ([path, options]) => path === '/api/release' && options.method === 'POST',
  )?.[1]
  assert.equal(post.headers['x-csrf-token'], 'csrf-test-token')
  assert.deepEqual(JSON.parse(post.body), {
    confirmed: true,
    expectedSha: 'a'.repeat(40),
    expectedDeploymentId: 'dpl_stage_1',
    expectedReleaseRunId: null,
  })
  assert.equal(
    nodes.get('services').children[0].children[1].children[1].textContent,
    'Queued · Production',
  )
  assert.equal(local.has('component-marketplace-control-room:local-urls:v1'), false)
})

test('release confirmation keeps the SHA and staged deployment shown when opened', async () => {
  let releaseReads = 0
  let requestBody
  const changedSnapshot = {
    ...readySnapshot,
    ci: { latestVerified: { sha: 'b'.repeat(40) } },
    stagedDeployment: { id: 'dpl_stage_2', status: 'READY', commitSha: 'b'.repeat(40) },
  }
  const { nodes } = await mount(async (path, options = {}) => {
    if (path === '/api/auth/session') return response({ user: { name: 'User' } })
    if (path === '/api/release/csrf') return response({ csrfToken: 'csrf-test-token' })
    if (path === '/api/release' && options.method === 'POST') {
      requestBody = JSON.parse(options.body)
      return response({ error: 'RELEASE_CANDIDATE_CHANGED' }, 409)
    }
    if (path === '/api/release') {
      releaseReads++
      return response(releaseReads === 1 ? readySnapshot : changedSnapshot)
    }
    throw new Error(`Unexpected request: ${path}`)
  })

  nodes.get('deploy-production').listeners.click()
  assert.equal(nodes.get('confirm-sha').textContent, 'a'.repeat(40))
  assert.equal(nodes.get('confirm-deployment-id').textContent, 'dpl_stage_1')

  await nodes.get('refresh-release').listeners.click()
  await nodes.get('confirm-release').listeners.click()

  assert.deepEqual(requestBody, {
    confirmed: true,
    expectedSha: 'a'.repeat(40),
    expectedDeploymentId: 'dpl_stage_1',
    expectedReleaseRunId: null,
  })
  assert.equal(nodes.get('confirm-dialog').open, true)
  assert.match(nodes.get('confirm-error').textContent, /đã thay đổi/)
})

test('a failed older run with the same title does not clear the pending run id', async () => {
  let releaseReads = 0
  const title = `Production release - vercel-services - ${'a'.repeat(40)}`
  const { nodes } = await mount(async (path, options = {}) => {
    if (path === '/api/auth/session') return response({ user: { name: 'User' } })
    if (path === '/api/release/csrf') return response({ csrfToken: 'csrf-test-token' })
    if (path === '/api/release' && options.method === 'POST')
      return response(
        {
          release: {
            id: 42,
            status: 'QUEUED',
            title,
            sha: 'a'.repeat(40),
            deploymentId: 'dpl_stage_1',
            requestedAt: new Date().toISOString(),
            url: 'https://github.com/actions/runs/42',
          },
        },
        202,
      )
    if (path === '/api/release') {
      releaseReads++
      if (releaseReads === 1) return response(readySnapshot)
      return response({
        ...readySnapshot,
        releaseRun: {
          id: 22,
          status: 'FAILED',
          title,
          sha: 'a'.repeat(40),
          url: 'https://github.com/actions/runs/22',
          createdAt: '2026-11-01T10:00:00.000Z',
        },
      })
    }
    throw new Error(`Unexpected request: ${path}`)
  })

  nodes.get('services').children[0].children[4].children[2].listeners.click()
  await nodes.get('confirm-release').listeners.click()

  assert.equal(nodes.get('readiness-status').textContent, 'Đang chờ release')
  assert.equal(
    nodes.get('services').children[0].children[1].children[1].textContent,
    'Queued · Production',
  )
  assert.equal(nodes.get('deploy-production').disabled, true)
})

test('retry confirmation is bound to the currently failed workflow run id', async () => {
  const failedSnapshot = {
    ...readySnapshot,
    releaseRun: {
      id: 22,
      status: 'FAILED',
      title: `Production release - vercel-services - ${'a'.repeat(40)}`,
      sha: 'a'.repeat(40),
      createdAt: '2026-11-08T10:00:00.000Z',
    },
  }
  let requestBody
  const { nodes } = await mount(async (path, options = {}) => {
    if (path === '/api/auth/session') return response({ user: { name: 'User' } })
    if (path === '/api/release/csrf') return response({ csrfToken: 'csrf-test-token' })
    if (path === '/api/release' && options.method === 'POST') {
      requestBody = JSON.parse(options.body)
      return response(
        { release: { id: 23, status: 'QUEUED', title: failedSnapshot.releaseRun.title } },
        202,
      )
    }
    if (path === '/api/release') return response(failedSnapshot)
    throw new Error(`Unexpected request: ${path}`)
  })

  nodes.get('services').children[0].children[4].children[2].listeners.click()
  assert.equal(nodes.get('confirm-failed-run-id').textContent, '22')
  await nodes.get('confirm-release').listeners.click()

  assert.equal(requestBody.expectedReleaseRunId, 22)
})

test('local URL editor stores only valid loopback URLs in this browser', async () => {
  const { nodes, local } = await mount(async (path) => {
    if (path === '/api/auth/session') return response({ user: { name: 'User' } })
    if (path === '/api/release') return response({ ...readySnapshot, readyToRelease: false })
    throw new Error(`Unexpected request: ${path}`)
  })
  const webConfig = nodes.get('services').children[0].children[5]
  const input = webConfig.children[1].children[0]
  const save = webConfig.children[1].children[1]
  input.value = 'https://example.com/not-local'
  save.listeners.click()
  assert.match(webConfig.children[3].textContent, /localhost hoặc IP loopback/)
  assert.equal(local.has('component-marketplace-control-room:local-urls:v1'), false)

  input.value = 'http://127.0.0.1:3010'
  save.listeners.click()
  const saved = JSON.parse(local.get('component-marketplace-control-room:local-urls:v1'))
  assert.equal(saved.web, 'http://127.0.0.1:3010/')
})

test('legacy local history is displayed as user-entered data, not CI or deployment state', async () => {
  const oldHistory = JSON.stringify([
    {
      id: '1',
      serviceId: 'web',
      createdAt: '2026-01-01T00:00:00.000Z',
      testResult: 'pass',
      commit: 'oldsha',
      note: 'old local entry',
    },
  ])
  const released = {
    ...readySnapshot,
    releaseRun: {
      status: 'SUCCESS',
      sha: 'b'.repeat(40),
      url: 'https://github.com/actions/runs/43',
    },
    alreadyReleased: true,
    readyToRelease: false,
  }
  const { nodes, nav } = await mount(
    async (path) => {
      if (path === '/api/auth/session') return response({ user: { name: 'User' } })
      if (path === '/api/release') return response(released)
      throw new Error(`Unexpected request: ${path}`)
    },
    { 'component-marketplace-control-room:deployment-history:v1': oldHistory },
  )
  assert.equal(nodes.get('readiness-status').textContent, 'Đã release')
  assert.equal(nodes.get('deploy-production').disabled, true)
  nav[1].listeners.click()
  assert.match(nodes.get('history').children[0].children[0].children[0].textContent, /Bản ghi cũ/)
  assert.match(
    nodes.get('history').children[0].children[1].children[0].textContent,
    /Kết quả nhập tay: PASS/,
  )
})
