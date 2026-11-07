import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

class Element {
  constructor() {
    this.dataset = {}
    this.textContent = ''
    this.value = ''
    this.children = []
    this.attributes = {}
    this.listeners = {}
    this.open = false
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
  reset() {}
}

async function mount(fetchHandler, storedValue = null) {
  const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const nodes = new Map()
  for (const id of [
    'login-panel',
    'record-dialog',
    'record-form',
    'record-commit',
    'test-result',
    'record-note',
    'empty-history',
  ]) {
    nodes.set(id, new Element())
  }
  for (const id of ['logout', 'service-section', 'activity-panel', 'load-error', 'storage-error']) {
    const node = new Element()
    node.classList.add('hidden')
    nodes.set(id, node)
  }
  const nav = ['overview', 'activity'].map((view) => {
    const item = new Element()
    item.dataset.view = view
    return item
  })
  const local = new Map()
  if (storedValue !== null)
    local.set('component-marketplace-control-room:deployment-history:v1', storedValue)
  const localStorage = {
    getItem(key) {
      return local.get(key) ?? null
    },
    setItem(key, value) {
      local.set(key, value)
    },
  }
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, new Element())
      return nodes.get(id)
    },
    querySelectorAll(selector) {
      return selector === '[data-view]' ? nav : []
    },
    createElement() {
      return new Element()
    },
    createTextNode(text) {
      return { textContent: text }
    },
  }
  vm.runInNewContext(script, {
    document,
    fetch: fetchHandler,
    localStorage,
    encodeURIComponent,
    Date,
    Math,
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  return { nodes, nav, local }
}

test('guest remains on sign-in and does not request deployment services', async () => {
  const paths = []
  const { nodes } = await mount(async (path) => {
    paths.push(path)
    return { ok: true, json: async () => null }
  })
  assert.deepEqual(paths, ['/api/auth/session'])
  assert.equal(nodes.get('login-panel').classList.contains('hidden'), false)
  assert.equal(nodes.get('service-section').classList.contains('hidden'), true)
})

test('authorized user can record a deployment and test result without calling a deploy service', async () => {
  const paths = []
  const { nodes, nav, local } = await mount(async (path) => {
    paths.push(path)
    return { ok: true, json: async () => ({ user: { name: 'User' } }) }
  })
  assert.deepEqual(paths, ['/api/auth/session'])
  assert.equal(nodes.get('connection-status').textContent, 'Đã đăng nhập')
  assert.equal(nodes.get('services').children.length, 3)

  nodes.get('services').children[0].children[3].listeners.click()
  assert.equal(nodes.get('record-dialog').open, true)
  nodes.get('test-result').value = 'pass'
  nodes.get('record-commit').value = 'a1b2c3d'
  nodes.get('record-note').value = 'Focused checks passed'
  nodes.get('record-form').listeners.submit({ preventDefault() {} })

  const records = JSON.parse(local.get('component-marketplace-control-room:deployment-history:v1'))
  assert.equal(records.length, 1)
  assert.equal(records[0].serviceId, 'web')
  assert.equal(records[0].testResult, 'pass')
  assert.equal(records[0].commit, 'a1b2c3d')
  assert.equal(nodes.get('record-dialog').open, false)
  assert.equal(nodes.get('history').children.length, 1)
  assert.deepEqual(paths, ['/api/auth/session'])

  nav[1].listeners.click()
  assert.equal(nodes.get('activity-panel').classList.contains('hidden'), false)
  assert.equal(nodes.get('service-section').classList.contains('hidden'), true)
})

test('unreadable local history is reported without blocking sign-in', async () => {
  const { nodes } = await mount(
    async () => ({ ok: true, json: async () => ({ user: { name: 'User' } }) }),
    '{not-json',
  )
  assert.equal(nodes.get('login-panel').classList.contains('hidden'), true)
  assert.equal(nodes.get('load-error').classList.contains('hidden'), false)
  assert.match(nodes.get('load-error').textContent, /Không đọc được lịch sử/)
  assert.equal(nodes.get('services').children.length, 3)
})
