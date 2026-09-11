/**
 * 面板 store 的行为测试：不碰 DOM、不碰 React，只喂假 fetch。
 *
 * 这一层是「自动建终端」这类语义的落点，也是最容易在重构里悄悄改坏的地方：
 *
 * - 面板打开（Ctrl+` 或按钮）时若一个终端都没有，必须先建一个，而不是按出一个空面板；
 * - 面板开着且确实有终端时，再按一下才是收起；
 * - 关掉最后一个终端时，如果自动建开着，立刻补一个（不能留一个空面板在屏幕上）；
 * - 把自动建关掉时，关掉最后一个就照 VSCode 的行为把面板一起收起。
 */

import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, test } from './harness.mjs'
import { tick } from './stubs.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** 载入测试专用产物。 */
async function loadSelftest() {
  return await import(pathToFileURL(join(root, 'lib/selftest.js')).href)
}

/**
 * 造一个假的宿主：POST 发号、DELETE 记账、GET 返回现存终端。
 *
 * @param {object} [overrides] 传给 store 的覆盖项（例如 `autoCreateTerminals: false`）。
 * @returns {Promise<{ store: object, calls: { method: string }[], live: () => number }>}
 */
async function makeStore(overrides = {}) {
  const { createTerminalPanelStore } = await loadSelftest()
  /** @type {string[]} */
  const alive = []
  /** @type {{ method: string }[]} */
  const calls = []
  let sequence = 0
  const meta = id => ({
    id,
    name: `终端 ${String(sequence)}`,
    pid: 100 + sequence,
    state: 'running',
    exitCode: null,
    cols: 80,
    rows: 24,
    createdAt: sequence,
  })
  const fetchImpl = async (input, init = {}) => {
    const url = String(input)
    const method = init.method ?? 'GET'
    calls.push({ method, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
    const json = body => ({
      ok: true,
      status: 200,
      async text() { return JSON.stringify(body) },
      async json() { return body },
    })
    if (method === 'POST') {
      sequence += 1
      alive.push(`t${String(sequence)}`)
      return json({ terminal: meta(`t${String(sequence)}`) })
    }
    if (method === 'DELETE') {
      const id = decodeURIComponent(url.split('/').pop() ?? '')
      const at = alive.indexOf(id)
      if (at >= 0) alive.splice(at, 1)
      return json({ closed: id })
    }
    return json({ terminals: alive.map(meta) })
  }
  const storage = new Map()
  const store = createTerminalPanelStore({
    viewportHeight: () => 900,
    storage: {
      /** @param {string} key 键。 */
      getItem: key => storage.get(key) ?? null,
      /** @param {string} key 键。 @param {string} value 值。 */
      setItem: (key, value) => { storage.set(key, value) },
    },
    fetchImpl,
    ...overrides,
  })
  return { store, calls, live: () => alive.length }
}

/** 等一次创建/删除请求落地（`readJson` 里还有一层 await）。 */
async function settle() {
  await tick()
  await tick()
}

describe('面板 store', () => {
  test('空面板按一下 Ctrl+`：先建一个终端再展开', async () => {
    const { store, calls, live } = await makeStore()
    assert.equal(store.getSnapshot().count, 0)
    assert.equal(store.getSnapshot().visible, false)

    store.toggle()
    // 立刻可见（占位标签已经在列表里），并且真的发了一次 POST。
    assert.equal(store.getSnapshot().visible, true)
    assert.equal(store.getSnapshot().count, 1)
    await settle()
    assert.equal(live(), 1)
    assert.deepEqual(calls.map(call => call.method), ['POST'])
  })

  test('有终端时按一下才是收起，不会再建终端', async () => {
    const { store, calls } = await makeStore()
    store.toggle()
    await settle()
    const created = calls.length
    assert.equal(store.getSnapshot().visible, true)

    store.toggle()
    assert.equal(store.getSnapshot().visible, false)
    assert.equal(store.getSnapshot().count, 1, '收起不该动终端')
    assert.equal(calls.length, created, '收起不该再发请求')
  })

  test('ensureTerminal 幂等：已经有终端时只是展开', async () => {
    const { store, calls } = await makeStore()
    await store.ensureTerminal()
    const after = calls.length
    await store.ensureTerminal()
    await store.ensureTerminal()
    assert.equal(calls.length, after, '已有终端时不该重复创建')
    assert.equal(store.getSnapshot().count, 1)
    assert.equal(store.getSnapshot().visible, true)
  })

  test('关掉最后一个终端：自动补一个，面板不空着', async () => {
    const { store, calls, live } = await makeStore()
    store.toggle()
    await settle()
    const first = store.getSnapshot().terminals[0].id
    assert.equal(live(), 1)
    assert.equal(first.startsWith('pending-'), false, '第一次创建应当已经落地')

    await store.closeTerminal(first)
    assert.equal(store.getSnapshot().visible, true, '自动建开着时面板不该收起')
    assert.equal(store.getSnapshot().count, 1, '应当已经补上了新终端')
    assert.notEqual(store.getSnapshot().terminals[0].id, first)
    await settle()
    assert.equal(live(), 1)
    assert.deepEqual(calls.map(call => call.method), ['POST', 'DELETE', 'POST'])
  })

  test('关掉多个中的一个：只删那一个，不补新的', async () => {
    const { store, calls } = await makeStore()
    store.toggle()
    await settle()
    await store.create()
    await settle()
    assert.equal(store.getSnapshot().count, 2)
    const before = calls.length

    const [first] = store.getSnapshot().terminals
    await store.closeTerminal(first.id)
    assert.equal(store.getSnapshot().count, 1)
    assert.equal(calls.length, before + 1, '只应当多一次 DELETE')
    assert.equal(calls[calls.length - 1].method, 'DELETE')
  })

  test('把自动建关掉：关掉最后一个就照 VSCode 的行为收起面板', async () => {
    const { store } = await makeStore({ autoCreateTerminals: false })
    store.toggle()
    await settle()
    const first = store.getSnapshot().terminals[0].id
    await store.closeTerminal(first)
    assert.equal(store.getSnapshot().count, 0)
    assert.equal(store.getSnapshot().visible, false, '没有自动建时应当一起收起')
  })

  test('refresh 与宿主对账：宿主里已有终端时不会重复创建', async () => {
    const { store, calls } = await makeStore()
    await store.create()
    await settle()
    assert.equal(store.getSnapshot().count, 1)
    const before = calls.length
    await store.refresh()
    assert.equal(store.getSnapshot().count, 1, '对账后仍是那一个')
    assert.equal(calls.length, before + 1, '对账只该多一次 GET')
    assert.equal(calls[calls.length - 1].method, 'GET')
  })

  test('create 会展开面板；setVisible(false) 只收起、不动终端', async () => {
    const { store } = await makeStore()
    await store.create()
    assert.equal(store.getSnapshot().visible, true)
    store.setVisible(false)
    assert.equal(store.getSnapshot().visible, false)
    assert.equal(store.getSnapshot().count, 1)
    store.setVisible(true)
    assert.equal(store.getSnapshot().visible, true)
  })

  test('新建终端会把「当前会话」报给宿主（新终端的 cwd 由此决定）', async () => {
    const { store, calls } = await makeStore()
    // 组件在会话出现时登记它。
    store.setActiveSession('session-dc-new-org')
    assert.equal(store.getSnapshot().activeSessionId, 'session-dc-new-org')

    await store.create()
    const post = calls.find(call => call.method === 'POST')
    assert.deepEqual(post.body, { cols: 80, rows: 24, sessionId: 'session-dc-new-org' })

    // 没有会话时就报不出 sessionId（宿主会退回进程工作目录）。
    store.setActiveSession(undefined)
    assert.equal(store.getSnapshot().activeSessionId, null)
    await store.create()
    const posts = calls.filter(call => call.method === 'POST')
    assert.deepEqual(posts[posts.length - 1].body, { cols: 80, rows: 24 })
  })
})
