/**
 * 终端会话与注册表的测试：注入假的 `spawnTerminal`，因此这里不起真进程。
 *
 * 要守住的是宿主侧的几件容易出错的事：回放缓冲的上限与截断标记、多订阅者扇出、
 * 退出只通知一次、`closeAll` 等所有终端静默、容量上限，以及 OSC 标题解析（它同样跨输出块）。
 */

import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, test } from './harness.mjs'
import { fakeTerminalHandle, tick } from './stubs.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** 载入测试专用产物。 */
async function loadSelftest() {
  return await import(pathToFileURL(join(root, 'lib/selftest.js')).href)
}

/** 造一个注入 fake spawn 的注册表。 */
async function makeRegistry(overrides = {}) {
  const { TerminalRegistry } = await loadSelftest()
  /** @type {ReturnType<typeof fakeTerminalHandle>[]} */
  const handles = []
  const registry = new TerminalRegistry({
    spawn: async () => {
      const fake = fakeTerminalHandle({ pid: 1000 + handles.length })
      handles.push(fake)
      return fake.handle
    },
    argv: ['/bin/bash', '--noprofile'],
    cwd: process.cwd(),
    env: { TERM: 'xterm-256color' },
    rows: 24,
    cols: 80,
    scrollbackBytes: 64,
    maxTerminals: 3,
    ...overrides,
  })
  return { registry, handles }
}

/** 造一个收集事件的订阅者。 */
function collector() {
  const events = { data: [], title: [], exit: [] }
  return {
    events,
    sink: {
      /** @param {string} text 输出。 */
      data(text) { events.data.push(text) },
      /** @param {string} title 标题。 */
      title(title) { events.title.push(title) },
      /** @param {number | null} exitCode 退出码。 */
      exit(exitCode) { events.exit.push(exitCode) },
    },
  }
}

describe('PtySession', () => {
  test('输出进入回放缓冲、扇出给所有订阅者', async () => {
    const { registry, handles } = await makeRegistry()
    const session = await registry.create({ cols: 80, rows: 24 })
    const first = collector()
    const second = collector()
    registry.subscribe(session.id, first.sink)
    registry.subscribe(session.id, second.sink)
    handles[0].emit('hello ')
    handles[0].emit('world')
    await tick()
    assert.equal(session.playback().text, 'hello world')
    assert.equal(session.playback().truncated, false)
    assert.deepEqual(first.events.data, ['hello ', 'world'])
    assert.deepEqual(second.events.data, ['hello ', 'world'])
  })

  test('超过上限时丢最早的输出，并标记 truncated', async () => {
    // 缓冲下限是 1024 字节（`PtySession` 会把更小的值抬上来），因此这里按 4 KB 测。
    const { registry, handles } = await makeRegistry({ scrollbackBytes: 4096 })
    const session = await registry.create({ cols: 80, rows: 24 })
    for (let i = 0; i < 8; i += 1) handles[0].emit('x'.repeat(900))
    handles[0].emit('TAIL')
    await tick()
    const playback = session.playback()
    assert.equal(playback.truncated, true, '超过上限后必须如实标记回放不完整')
    assert.ok(playback.text.endsWith('TAIL'))
    assert.ok(playback.text.length <= 4096, `回放缓冲不该超过上限：${playback.text.length}`)
  })

  test('OSC 标题被解析出来并通知订阅者', async () => {
    const { registry, handles } = await makeRegistry()
    const session = await registry.create({ cols: 80, rows: 24 })
    const sink = collector()
    registry.subscribe(session.id, sink.sink)
    handles[0].emit('\u001b]0;我的标题\u0007输出')
    await tick()
    assert.deepEqual(sink.events.title, ['我的标题'])
    assert.equal(session.meta().name, '我的标题')
    // 空标题不算标题变化。
    handles[0].emit('\u001b]2;\u0007')
    await tick()
    assert.deepEqual(sink.events.title, ['我的标题'])
  })

  test('write 送达 provider，空写入被跳过', async () => {
    const { registry, handles } = await makeRegistry()
    const session = await registry.create({ cols: 80, rows: 24 })
    session.write('ls\n')
    session.write('')
    await tick()
    assert.deepEqual(handles[0].writes, ['ls\n'])
  })

  test('进程退出只通知一次，状态变成 exited 并带上退出码', async () => {
    const { registry, handles } = await makeRegistry()
    const session = await registry.create({ cols: 80, rows: 24 })
    const sink = collector()
    registry.subscribe(session.id, sink.sink)
    handles[0].exit(7)
    await tick()
    await tick()
    assert.deepEqual(sink.events.exit, [7])
    assert.equal(session.meta().state, 'exited')
    assert.equal(session.meta().exitCode, 7)
    assert.equal(session.exited, true)
  })
})

describe('TerminalRegistry', () => {
  test('列表按创建顺序，id 各不相同', async () => {
    const { registry } = await makeRegistry()
    const first = await registry.create({ cols: 80, rows: 24 })
    const second = await registry.create({ cols: 80, rows: 24 })
    const ids = registry.list().map(entry => entry.id)
    assert.deepEqual(ids, [first.id, second.id])
    assert.notEqual(first.id, second.id)
    assert.match(registry.list()[0].name, /^终端 \d+$/u)
  })

  test('超过上限时抛 TerminalLimitError，且不产生新会话', async () => {
    const { registry } = await makeRegistry({ maxTerminals: 2 })
    await registry.create({ cols: 80, rows: 24 })
    await registry.create({ cols: 80, rows: 24 })
    await assert.rejects(
      () => registry.create({ cols: 80, rows: 24 }),
      error => error instanceof Error && error.name === 'TerminalLimitError',
    )
    assert.equal(registry.list().length, 2)
  })

  test('close 收掉终端并等 provider 静默，重复 close 返回 false', async () => {
    const { registry, handles } = await makeRegistry()
    const session = await registry.create({ cols: 80, rows: 24 })
    assert.equal(await registry.close(session.id), true)
    assert.equal(handles[0].terminateCalls(), 1)
    assert.equal(await registry.close(session.id), false)
    assert.equal(registry.list().length, 0)
  })

  test('closeAll 收掉所有终端，并且之后不能再创建', async () => {
    const { registry, handles } = await makeRegistry()
    await registry.create({ cols: 80, rows: 24 })
    await registry.create({ cols: 80, rows: 24 })
    await registry.closeAll()
    assert.equal(registry.list().length, 0)
    for (const fake of handles) assert.equal(fake.terminateCalls(), 1)
    await assert.rejects(() => registry.create({ cols: 80, rows: 24 }), /已卸载/u)
  })

  test('订阅不存在的终端返回 null', async () => {
    const { registry } = await makeRegistry()
    assert.equal(registry.subscribe('nope', collector().sink), null)
  })

  test('creation 时把 argv / cwd / 尺寸 / 环境透传给 provider', async () => {
    const { TerminalRegistry } = await loadSelftest()
    const specs = []
    const registry = new TerminalRegistry({
      spawn: async (spec) => {
        specs.push(spec)
        return fakeTerminalHandle().handle
      },
      argv: ['/bin/bash', '-i'],
      cwd: process.cwd(),
      env: { TERM: 'xterm-256color' },
      rows: 24,
      cols: 80,
      scrollbackBytes: 1024,
      maxTerminals: 2,
    })
    await registry.create({ cols: 100, rows: 30, cwd: process.cwd() })
    assert.equal(specs.length, 1)
    assert.deepEqual(specs[0].argv, ['/bin/bash', '-i'])
    assert.equal(specs[0].cols, 100)
    assert.equal(specs[0].rows, 30)
    assert.equal(specs[0].env.TERM, 'xterm-256color')
    assert.ok(specs[0].graceMs > 0)
  })
})

describe('协议纯函数', () => {
  test('extractOscTitle 取最后一个非空标题', async () => {
    const { extractOscTitle } = await loadSelftest()
    assert.equal(extractOscTitle('no title here'), null)
    assert.equal(extractOscTitle('\u001b]0;one\u0007\u001b]2;two\u001b\\'), 'two')
    assert.equal(extractOscTitle('\u001b]0;  \u0007'), null)
  })

  test('isLoopbackAuthority 只放行回环', async () => {
    const { isLoopbackAuthority } = await loadSelftest()
    for (const host of ['127.0.0.1:3080', 'localhost', 'LOCALHOST:80', '[::1]:3080']) {
      assert.equal(isLoopbackAuthority(host), true, host)
    }
    for (const host of ['10.0.0.5:3080', 'example.com', '', '[fe80::1]:3080']) {
      assert.equal(isLoopbackAuthority(host), false, host)
    }
  })
})
