/**
 * 终端链接识别的测试：URL、裸 `localhost:端口`、文件路径，以及交给 xterm 的链接形状。
 *
 * 这一层没有 DOM、没有 React，所以直接喂字符串断言。触发方式（Ctrl/Cmd + 点击）是 xterm
 * 自己管的 —— 这里只保证「找得准」和「activate 时打开的是白名单里的地址」。
 */

import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, test } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** 载入测试专用产物。 */
async function loadSelftest() {
  return await import(pathToFileURL(join(root, 'lib/selftest.js')).href)
}

/** 取一条命中的文本与地址，便于断言。 */
function summarize(line) {
  return detectLinksCache(line).map(link => `${link.text} -> ${link.url ?? '(不可打开)'}`)
}

/** 小缓存，避免每个断言都 await 一次。 */
let detectLinksImpl = null
function detectLinksCache(line) {
  return detectLinksImpl(line)
}

describe('终端链接识别', () => {
  test('dev server 那两行：Local 与 Network 都能点', async () => {
    const { detectLinks } = await loadSelftest()
    detectLinksImpl = detectLinks
    assert.deepEqual(summarize('   - Local:        http://localhost:3000'), [
      'http://localhost:3000 -> http://localhost:3000/',
    ])
    assert.deepEqual(summarize('   - Network:      http://198.18.0.1:3000'), [
      'http://198.18.0.1:3000 -> http://198.18.0.1:3000/',
    ])
  })

  test('裸 localhost:端口（没有协议）也算', async () => {
    const { detectLinks } = await loadSelftest()
    assert.deepEqual(detectLinks('ready on localhost:5173/app').map(link => link.url), [
      'http://localhost:5173/app',
    ])
  })

  test('末尾的标点不算链接的一部分', async () => {
    const { detectLinks } = await loadSelftest()
    assert.deepEqual(detectLinks('see https://example.com/a.').map(link => link.text), ['https://example.com/a'])
    assert.deepEqual(detectLinks('(https://example.com/b)').map(link => link.text), ['https://example.com/b'])
    assert.deepEqual(detectLinks('"https://example.com/c",').map(link => link.text), ['https://example.com/c'])
  })

  test('文件路径：绝对路径可打开并带 file:// 前缀，相对路径只标注', async () => {
    const { detectLinks, fileUrlForPath } = await loadSelftest()
    const windows = detectLinks('at D:\\repo\\src\\index.ts:12:3')
    assert.deepEqual(windows.map(link => link.url), ['file:///D:/repo/src/index.ts'])
    const posix = detectLinks('at /home/u/app/main.js:7')
    assert.deepEqual(posix.map(link => link.url), ['file:///home/u/app/main.js'])
    // 相对路径没有基准，不打开。
    assert.deepEqual(detectLinks('import ./src/a.ts').map(link => link.url), [undefined])
    assert.equal(fileUrlForPath('./x.ts'), undefined)
    assert.equal(fileUrlForPath('../x.ts'), undefined)
    assert.equal(fileUrlForPath('src/x.ts'), undefined)
  })

  test('一段文本里多条链接按位置排序，重叠的只留一条', async () => {
    const { detectLinks } = await loadSelftest()
    const links = detectLinks('a http://x.dev/1 then /tmp/b.log then b')
    assert.deepEqual(links.map(link => link.text), ['http://x.dev/1', '/tmp/b.log'])
    assert.ok(links[0].startIndex < links[1].startIndex)
    // URL 与它内部的路径片段重叠时只保留 URL。
    const nested = detectLinks('http://example.com/some/file.ts')
    assert.deepEqual(nested.map(link => link.text), ['http://example.com/some/file.ts'])
  })

  test('只对 http/https/ftp 打开：javascript: 与 data: 一律拒绝', async () => {
    const { openableUrl, detectLinks } = await loadSelftest()
    assert.equal(openableUrl('https://a.dev'), 'https://a.dev/')
    assert.equal(openableUrl('http://a.dev/x'), 'http://a.dev/x')
    assert.equal(openableUrl('javascript:alert(1)'), undefined)
    assert.equal(openableUrl('data:text/html,x'), undefined)
    assert.equal(openableUrl('file:///etc/passwd'), undefined)
    // `javascript:` 没有 `//`，连候选都算不上 —— 整行不会被标注。
    assert.deepEqual(detectLinks('payload javascript:alert(1)'), [])
    // 带 `//` 但协议不在白名单里：被标注（下划线/指针），但没有可打开的地址。
    const dataUrl = detectLinks('payload data://example.com/x')
    assert.equal(dataUrl.length, 1)
    assert.equal(dataUrl[0].url, undefined, '不在白名单里的协议不给可打开地址')
    // 大小写混写也不放过。
    assert.equal(openableUrl('JavaScript:alert(1)'), undefined)
    const mixed = detectLinks('payload JavaScript://example.com/x')
    assert.equal(mixed.some(link => link.url !== undefined), false)
  })

  test('没有链接的行返回空数组；长度异常的路径被丢掉', async () => {
    const { detectLinks } = await loadSelftest()
    assert.deepEqual(detectLinks(''), [])
    assert.deepEqual(detectLinks('   '), [])
    assert.deepEqual(detectLinks('plain output, nothing to open'), [])
    const huge = `/${'a'.repeat(600)}.ts`
    assert.deepEqual(detectLinks(huge), [])
  })

  test('Next.js banner：`(Turbopack)` 不是链接', async () => {
    const { detectLinks } = await loadSelftest()
    // 曾经的 bug：扩展名只要求 1 位，`Turbopack)` 里最后那位 `k` 被当成盘符，
    // 切出 `/Turbopack` 并算成绝对路径 —— 点它会去打开 file:///Turbopack。
    assert.deepEqual(detectLinks('▲ Next.js 16.2.3 (Turbopack)'), [])
    assert.deepEqual(detectLinks('✓ Ready in 338ms'), [])
    assert.deepEqual(detectLinks('- Environments: .env.local'), [])
  })

  test('Next.js banner：每条 URL 的地址与文本一一对应（防「点 A 开 B」）', async () => {
    const { detectLinks } = await loadSelftest()
    const banner = [
      '   ▲ Next.js 16.2.3 (Turbopack)',
      '   - Local:        http://localhost:3000',
      '   - Network:      http://198.18.0.1:3000',
      '   - Environments: .env.local',
    ]
    for (const line of banner) {
      for (const link of detectLinks(line)) {
        // 用同一套下标反切回文本，它必须与 link.text 逐字相同，地址也必须正好由它得来。
        const slice = line.slice(link.startIndex, link.endIndex)
        assert.equal(slice, link.text, `行：${line}`)
        const expected = link.text.startsWith('http')
          ? `${link.text}/`
          : undefined
        if (expected !== undefined) assert.equal(link.url, expected, `行：${line}`)
      }
    }
    // 两个地址行各自只有一条链接，且互不混淆。
    assert.deepEqual(
      detectLinks('   - Local:        http://localhost:3000').map(link => link.url),
      ['http://localhost:3000/'],
    )
    assert.deepEqual(
      detectLinks('   - Network:      http://198.18.0.1:3000').map(link => link.url),
      ['http://198.18.0.1:3000/'],
    )
  })

  test('扩展名至少两位：`/a.ts` 命中，`/Turbopack` 不命中', async () => {
    const { detectLinks } = await loadSelftest()
    assert.deepEqual(detectLinks('at /a.ts').map(link => link.text), ['/a.ts'])
    assert.deepEqual(detectLinks('see /Turbopack'), [])
    assert.deepEqual(detectLinks('open C:\\x\\a.ts:12').map(link => link.url), ['file:///C:/x/a.ts'])
  })
})

describe('xterm link provider', () => {
  test('给一行造出链接：范围按 1 基列，带下划线与指针', async () => {
    const { createLinkProvider } = await loadSelftest()
    const opened = []
    const lines = {
      3: '  - Local: http://localhost:3000',
    }
    const provider = createLinkProvider({
      readLine: line => lines[line],
      open: url => { opened.push(url) },
    })
    /** @type {object[] | undefined} */
    let links
    provider.provideLinks(3, result => { links = result })
    assert.equal(links.length, 1)
    const [link] = links
    assert.equal(link.text, 'http://localhost:3000')
    assert.equal(link.range.start.y, 3)
    // 列是 1 基：`  - Local: ` 占 11 列（两空格 + 7 个字的 `- Local` 组合 + 冒号 + 空格），
    // 所以第 12 列就是 URL 的第一个字符。
    assert.equal(link.range.start.x, 12)
    assert.equal(link.range.end.x, link.range.start.x + link.text.length - 1)
    assert.deepEqual(link.decorations, { pointerCursor: true, underline: true })
    assert.equal(opened.length, 0, '只提供链接不该打开任何东西')
  })

  test('要按 Ctrl 才打开：不按修饰键的点击什么都不做', async () => {
    const { createLinkProvider, isFollowClick } = await loadSelftest()
    const opened = []
    const provider = createLinkProvider({
      readLine: () => '  - Local: http://localhost:3000',
      open: url => { opened.push(url) },
    })
    let links
    provider.provideLinks(1, result => { links = result })
    const [link] = links
    link.activate({ type: 'mouseup' }, link.text)
    assert.deepEqual(opened, [], '普通点击不该打开链接（这正是之前的 bug）')
    link.activate({ type: 'mouseup', ctrlKey: true }, link.text)
    assert.deepEqual(opened, ['http://localhost:3000/'], 'Ctrl+点击才打开')
    // 修饰键的判断按平台走：macOS 认 Cmd，其它平台认 Ctrl。
    const mac = /mac|iphone|ipad|ipod/iu.test(globalThis.navigator?.platform ?? '')
    assert.equal(isFollowClick({ ctrlKey: true }), !mac)
    assert.equal(isFollowClick({ metaKey: true }), mac)
    assert.equal(isFollowClick(undefined), false, '没有事件时当作没按')
  })

  test('悬停提示：给了 hint 就写 title，离开时清掉', async () => {
    const { createLinkProvider } = await loadSelftest()
    const target = { title: '' }
    const provider = createLinkProvider({
      readLine: () => 'see http://localhost:3000 now',
      hint: url => `Ctrl+点击打开 ${url}`,
      hoverTarget: target,
      open: () => {},
    })
    let links
    provider.provideLinks(1, result => { links = result })
    const [link] = links
    assert.equal(typeof link.hover, 'function')
    assert.equal(typeof link.leave, 'function')
    link.hover({ type: 'mousemove' }, link.text)
    assert.equal(target.title, 'Ctrl+点击打开 http://localhost:3000/')
    link.leave({ type: 'mousemove' }, link.text)
    assert.equal(target.title, '')
  })

  test('不可打开的条目（协议被拒）没有提示，也不会打开', async () => {
    const { createLinkProvider } = await loadSelftest()
    const opened = []
    const target = { title: '' }
    const provider = createLinkProvider({
      readLine: () => 'see data://example.com/x now',
      hint: url => url,
      hoverTarget: target,
      open: url => { opened.push(url) },
    })
    let links
    provider.provideLinks(1, result => { links = result })
    // `data://…` 会被识别成一条「只标注、不可打开」的链接。
    for (const link of links ?? []) {
      assert.equal(typeof link.hover, 'undefined', '不可打开的条目不提示')
      link.activate({ type: 'mouseup', ctrlKey: true }, link.text)
    }
    assert.deepEqual(opened, [])
  })

  test('没有链接或读不到行时回调 undefined', async () => {
    const { createLinkProvider } = await loadSelftest()
    const provider = createLinkProvider({ readLine: () => 'plain text' })
    assert.equal(provider.provideLinks(1, result => result), undefined)
    let called = 'not called'
    provider.provideLinks(1, result => { called = result })
    assert.equal(called, undefined)
    const missing = createLinkProvider({ readLine: () => undefined })
    let missingResult = 'not called'
    missing.provideLinks(9, result => { missingResult = result })
    assert.equal(missingResult, undefined)
  })

  test('readLine 抛错时当作没有链接（终端不该因此报错）', async () => {
    const { createLinkProvider } = await loadSelftest()
    const provider = createLinkProvider({ readLine: () => { throw new Error('boom') } })
    let result = 'not called'
    provider.provideLinks(1, r => { result = r })
    assert.equal(result, undefined)
  })

  test('attachLinkProvider 把 provider 注册进终端、带上 hoverTarget，并返回可释放的函数', async () => {
    const { attachLinkProvider } = await loadSelftest()
    const registered = []
    let disposed = 0
    const element = { title: '' }
    const detach = attachLinkProvider({
      element,
      registerLinkProvider(provider) {
        registered.push(provider)
        return { dispose() { disposed += 1 } }
      },
    }, { readLine: () => 'http://a.dev', hint: url => url })
    assert.equal(registered.length, 1, '只注册一次')
    let links
    registered[0].provideLinks(1, result => { links = result })
    links[0].hover({ type: 'mousemove' }, links[0].text)
    assert.equal(element.title, 'http://a.dev/', 'element 被当成默认的提示宿主')
    detach()
    assert.equal(disposed, 1)
  })
})
