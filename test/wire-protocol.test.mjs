/**
 * 线路层的端到端测试：真的起一个 HTTP/WebSocket 服务器。
 *
 * 前面几个测试文件都在替身上验证「逻辑对不对」，这个文件补上「接起来能不能用」：
 * 路由前缀、认证拒绝、升级握手、attach 回放、write/resize、退出帧、类型不匹配的能力，
 * 以及 dispose 之后路由与连接都撤下。不测真 PTY（注册表注入假句柄），因为这里要覆盖的
 * 是协议与生命周期，不是 ConPTY。
 */

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import WebSocket from 'ws'
import { describe, test } from './harness.mjs'
import { fakeTerminalHandle } from './stubs.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const PREFIX = '/dsh-terminal'

/** 载入测试专用产物。 */
async function loadSelftest() {
  return await import(pathToFileURL(join(root, 'lib/selftest.js')).href)
}

/**
 * 起一个只挂了本插件路由的测试服务器。
 *
 * @param {{ reject?: 'none' | 'unauthorized' }} [options] 认证判定方式。
 * @returns {Promise<{
 *   origin: string,
 *   routes: object[],
 *   upgrades: object[],
 *   handles: object[],
 *   wire: object,
 *   close(): Promise<void>,
 * }>}
 */
async function startServer(options = {}) {
  const { registerTerminalWire, TerminalRegistry } = await loadSelftest()
  const handles = []
  /** 每次创建时交给注册表的 cwd（测试用它断言 sessionId 有没有被用上）。 */
  const spawnSpecs = []
  const registry = new TerminalRegistry({
    spawn: async (spec) => {
      spawnSpecs.push(spec)
      const fake = fakeTerminalHandle()
      handles.push(fake)
      return fake.handle
    },
    argv: ['/bin/bash'],
    cwd: process.cwd(),
    env: {},
    rows: 24,
    cols: 80,
    scrollbackBytes: 8192,
    maxTerminals: 2,
  })

  const routes = []
  const upgrades = []
  const server = createServer((req, res) => {
    // 让路由的 handler 拥有完整响应生命周期；匹配规则与 `webServer` 一致（前缀按路径段）。
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    for (const route of routes) {
      const matched = route.kind === 'prefix'
        ? pathname === route.path || pathname.startsWith(`${route.path}/`)
        : pathname === route.path
      if (matched) {
        void route.handler(req, res)
        return
      }
    }
    res.writeHead(404)
    res.end('not found')
  })
  server.on('upgrade', (req, socket, head) => {
    const route = upgrades.find(item => item.path === new URL(req.url ?? '/', 'http://localhost').pathname)
    if (route === undefined) {
      socket.destroy()
      return
    }
    void route.handler(req, socket, head)
  })
  await new Promise(resolveListen => { server.listen(0, '127.0.0.1', resolveListen) })
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0

  const assets = { rev: 'test-rev', get: () => null, names: () => [] }
  const wire = registerTerminalWire({
    /** @param {object} route 路由。 */
    register(route) { routes.push(route); return () => { routes.splice(routes.indexOf(route), 1) } },
    /** @param {object} route 升级路由。 */
    registerUpgrade(route) {
      upgrades.push(route)
      return () => { upgrades.splice(upgrades.indexOf(route), 1) }
    },
  }, {
    prefix: PREFIX,
    registry,
    assets,
    defaultCols: 80,
    defaultRows: 24,
    resolveCwd: sessionId => (options.resolveCwd === undefined ? process.cwd() : options.resolveCwd(sessionId)),
    reject: () => (options.reject === 'unauthorized' ? 401 : undefined),
    warn: () => {},
  })

  return {
    origin: `http://127.0.0.1:${String(port)}`,
    socketOrigin: `ws://127.0.0.1:${String(port)}`,
    routes,
    upgrades,
    handles,
    spawnSpecs,
    registry,
    wire,
    /** 关掉服务器、收掉终端并撤下线路层。 */
    async close() {
      await wire.dispose()
      await registry.closeAll()
      await new Promise(resolveClose => { server.close(() => { resolveClose() }) })
    },
  }
}

/** 连上一个 WebSocket 并收集收到的帧。 */
async function connect(server) {
  const socket = new WebSocket(`${server.socketOrigin}${PREFIX}/ws`)
  const frames = []
  socket.on('message', (raw) => { frames.push(JSON.parse(raw.toString())) })
  await new Promise((resolveOpen, rejectOpen) => {
    socket.once('open', resolveOpen)
    socket.once('error', rejectOpen)
  })
  return {
    socket,
    frames,
    /** 发一帧。 @param {object} frame 帧。 */
    send(frame) { socket.send(JSON.stringify(frame)) },
    /** 等到某个条件的帧出现。 @param {(frame: object) => boolean} predicate 判定。 */
    async waitFor(predicate, timeoutMs = 2000) {
      const started = Date.now()
      for (;;) {
        const found = frames.find(predicate)
        if (found !== undefined) return found
        if (Date.now() - started > timeoutMs) throw new Error(`等不到帧：${JSON.stringify(frames)}`)
        await new Promise(resolveWait => { setTimeout(resolveWait, 10) })
      }
    },
    /** 关掉连接。 */
    async close() {
      await new Promise((resolveClose) => {
        socket.once('close', resolveClose)
        socket.close()
      })
    },
  }
}

/** 发一个 JSON 请求。 */
async function request(server, path, init = {}) {
  return await fetch(`${server.origin}${path}`, init)
}

describe('线路层 HTTP', () => {
  test('创建 / 列出 / 关闭终端', async () => {
    const server = await startServer()
    try {
      const created = await request(server, `${PREFIX}/terminals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols: 100, rows: 30 }),
      })
      assert.equal(created.status, 201)
      const payload = await created.json()
      assert.match(payload.terminal.id, /^t/u)
      assert.equal(payload.terminal.state, 'running')

      const listed = await (await request(server, `${PREFIX}/terminals`)).json()
      assert.equal(listed.terminals.length, 1)

      const closed = await request(server, `${PREFIX}/terminals/${payload.terminal.id}`, { method: 'DELETE' })
      assert.equal(closed.status, 200)
      assert.equal(server.handles[0].terminateCalls(), 1)

      const empty = await (await request(server, `${PREFIX}/terminals`)).json()
      assert.equal(empty.terminals.length, 0)
    } finally {
      await server.close()
    }
  })

  test('上限用 409 表达，未知 id 用 404，坏 JSON 用 400', async () => {
    const server = await startServer()
    try {
      await request(server, `${PREFIX}/terminals`, { method: 'POST' })
      await request(server, `${PREFIX}/terminals`, { method: 'POST' })
      const tooMany = await request(server, `${PREFIX}/terminals`, { method: 'POST' })
      assert.equal(tooMany.status, 409)
      assert.equal((await tooMany.json()).code, 'TOO_MANY_TERMINALS')

      const missing = await request(server, `${PREFIX}/terminals/nope`, { method: 'DELETE' })
      assert.equal(missing.status, 404)

      const broken = await request(server, `${PREFIX}/terminals`, { method: 'POST', body: '{oops' })
      assert.equal(broken.status, 400)
    } finally {
      await server.close()
    }
  })

  test('工作目录非法时退回默认，不从 body 里信路径', async () => {
    const server = await startServer()
    try {
      const response = await request(server, `${PREFIX}/terminals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: 'C:\\definitely\\not\\here' }),
      })
      assert.equal(response.status, 201)
      assert.equal(server.handles.length, 1)
    } finally {
      await server.close()
    }
  })

  test('body 里的 sessionId 会交给 resolveCwd，其返回值成为新终端的 cwd', async () => {
    /** @type {(string | undefined)[]} */
    const seen = []
    const workspace = join(tmpdir(), 'dsh-terminal-workspace')
    mkdirSync(workspace, { recursive: true })
    const server = await startServer({
      resolveCwd: (sessionId) => {
        seen.push(sessionId)
        // 模拟宿主：拿 sessionId 取会话的 header.cwd（也就是那个工作区的路径）。
        return sessionId === 'session-dc-new-org' ? workspace : process.cwd()
      },
    })
    try {
      await request(server, `${PREFIX}/terminals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-dc-new-org' }),
      })
      assert.deepEqual(seen, ['session-dc-new-org'], 'sessionId 必须原样交给 resolveCwd')
      assert.equal(server.spawnSpecs.length, 1)
      assert.equal(server.spawnSpecs[0].cwd, workspace, 'PTY 应该在工作区里启动')
    } finally {
      await server.close()
    }
  })

  test('body 里的 cwd 优先于 sessionId（显式指定就照它走）', async () => {
    /** @type {(string | undefined)[]} */
    const seen = []
    const server = await startServer({
      resolveCwd: (sessionId) => { seen.push(sessionId); return process.cwd() },
    })
    try {
      await request(server, `${PREFIX}/terminals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'ignored', cwd: process.cwd() }),
      })
      assert.deepEqual(seen, [], '给了 cwd 时不该再去问会话目录')
      assert.equal(server.spawnSpecs[0].cwd, process.cwd())
    } finally {
      await server.close()
    }
  })

  test('认证判定为 401 时所有路由都拒绝', async () => {
    const server = await startServer({ reject: 'unauthorized' })
    try {
      assert.equal((await request(server, `${PREFIX}/terminals`)).status, 401)
      assert.equal((await request(server, `${PREFIX}/terminals`, { method: 'POST' })).status, 401)
    } finally {
      await server.close()
    }
  })

  test('未知子路径 404，前缀之外的路径不归本插件', async () => {
    const server = await startServer()
    try {
      const unknown = await request(server, `${PREFIX}/nope`)
      assert.equal(unknown.status, 404, `未知子路径应当 404，实际 ${String(unknown.status)}：${await unknown.text()}`)
      const outside = await request(server, '/other/terminals')
      assert.equal(outside.status, 404, `前缀之外的路径应当 404，实际 ${String(outside.status)}：${await outside.text()}`)
    } finally {
      await server.close()
    }
  })

  test('dispose 之后路由全部撤下', async () => {
    const server = await startServer()
    await server.close()
    assert.equal(server.routes.length, 0)
    assert.equal(server.upgrades.length, 0)
  })
})

describe('线路层 WebSocket', () => {
  test('attach 收到 hello，带上回放内容', async () => {
    const server = await startServer()
    const connection = await connect(server)
    try {
      const created = await (await request(server, `${PREFIX}/terminals`, { method: 'POST' })).json()
      server.handles[0].emit('already here')
      connection.send({ type: 'attach', terminalId: created.terminal.id, cols: 80, rows: 24 })
      const hello = await connection.waitFor(frame => frame.type === 'hello')
      assert.equal(hello.terminal.id, created.terminal.id)
      assert.equal(hello.buffer, 'already here')
      assert.equal(hello.truncated, false)
    } finally {
      await connection.close()
      await server.close()
    }
  })

  test('write 送到 PTY，后续输出以 output 帧到达', async () => {
    const server = await startServer()
    const connection = await connect(server)
    try {
      const created = await (await request(server, `${PREFIX}/terminals`, { method: 'POST' })).json()
      connection.send({ type: 'attach', terminalId: created.terminal.id, cols: 80, rows: 24 })
      await connection.waitFor(frame => frame.type === 'hello')
      connection.send({ type: 'write', terminalId: created.terminal.id, data: 'ls\n' })
      await new Promise(resolveWait => { setTimeout(resolveWait, 30) })
      assert.deepEqual(server.handles[0].writes, ['ls\n'])
      server.handles[0].emit('result')
      const output = await connection.waitFor(frame => frame.type === 'output')
      assert.equal(output.data, 'result')
    } finally {
      await connection.close()
      await server.close()
    }
  })

  test('attach 未知终端回 NO_TERMINAL；未 attach 就 write 也被拒', async () => {
    const server = await startServer()
    const connection = await connect(server)
    try {
      connection.send({ type: 'attach', terminalId: 'nope', cols: 80, rows: 24 })
      const error = await connection.waitFor(frame => frame.type === 'error')
      assert.equal(error.code, 'NO_TERMINAL')

      connection.send({ type: 'write', terminalId: 'nope', data: 'x' })
      const second = await connection.waitFor(frame => frame.type === 'error' && frame.message.includes('先 attach'))
      assert.equal(second.code, 'NO_TERMINAL')
    } finally {
      await connection.close()
      await server.close()
    }
  })

  test('进程退出推 exit 帧；多个订阅者各自收到输出', async () => {
    const server = await startServer()
    const first = await connect(server)
    const second = await connect(server)
    try {
      const created = await (await request(server, `${PREFIX}/terminals`, { method: 'POST' })).json()
      for (const connection of [first, second]) {
        connection.send({ type: 'attach', terminalId: created.terminal.id, cols: 80, rows: 24 })
        await connection.waitFor(frame => frame.type === 'hello')
      }
      server.handles[0].emit('shared')
      const [a, b] = await Promise.all([
        first.waitFor(frame => frame.type === 'output'),
        second.waitFor(frame => frame.type === 'output'),
      ])
      assert.equal(a.data, 'shared')
      assert.equal(b.data, 'shared')
      server.handles[0].exit(3)
      const exitFrame = await first.waitFor(frame => frame.type === 'exit')
      assert.equal(exitFrame.exitCode, 3)
    } finally {
      await first.close()
      await second.close()
      await server.close()
    }
  })

  test('认证判定为 401 时升级握手被拒（客户端拿不到 open）', async () => {
    const server = await startServer({ reject: 'unauthorized' })
    try {
      const socket = new WebSocket(`${server.socketOrigin}${PREFIX}/ws`)
      const outcome = await new Promise((resolveOutcome) => {
        socket.once('open', () => { resolveOutcome('open') })
        socket.once('error', () => { resolveOutcome('error') })
      })
      assert.equal(outcome, 'error')
    } finally {
      await server.close()
    }
  })
})
