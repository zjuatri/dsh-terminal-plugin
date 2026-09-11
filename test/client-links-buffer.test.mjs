/**
 * 链接识别的「真 buffer」校验：拿 **真的 xterm** 解析输出，再从它的 buffer 里按我们的方式
 * 读行、跑 `detectLinks`，最后把算出来的列范围反着切回文本 —— 两边必须逐字相同。
 *
 * 为什么值得单独一个文件：`test/client-links.test.mjs` 喂的是手写字符串，而真实运行时的输入
 * 是 `line.translateToString(true)`（会剥掉 ANSI、裁掉行尾空白）。列号一列错开，链接就会点到
 * 隔壁字符上，而且这种错在 DOM 里很难看出来 —— 这里让真 xterm 来当裁判。
 *
 * 不需要浏览器：xterm 的 buffer 与解析器是纯 JS，`Terminal` 不 `open()` 也能 `write`。
 */

import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, test } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/**
 * 把一段输出喂给真 xterm，读出每一行的文本与链接。
 *
 * @param {string} input 终端输出（可含 ANSI）。
 * @param {number} lineCount 要读的行数。
 * @returns {Promise<{ text: string, links: object[] }[]>} 每行的文本与链接。
 */
async function feedXterm(input, lineCount) {
  const { Terminal } = await import(pathToFileURL(join(root, 'vendor/xterm.mjs')).href)
  const { detectLinks } = await import(pathToFileURL(join(root, 'lib/selftest.js')).href)
  const terminal = new Terminal({ cols: 80, rows: Math.max(lineCount, 6) })
  await new Promise(resolveWrite => { terminal.write(input, resolveWrite) })
  const buffer = terminal.buffer.active
  const rows = []
  for (let line = 1; line <= lineCount; line += 1) {
    const text = buffer.getLine(line - 1)?.translateToString(true) ?? ''
    rows.push({ text, links: detectLinks(text) })
  }
  terminal.dispose()
  return rows
}

/** 把列范围反向切回文本，验证与 link.text 一致。 */
function sliceByRange(text, link) {
  return text.slice(link.startIndex, link.endIndex)
}

describe('链接范围（真 xterm buffer）', () => {
  test('带 ANSI 颜色的一行：URL 的列范围切回来与文本逐字相同', async () => {
    const [row] = await feedXterm('\u001b[32m  - Local:\u001b[0m   http://localhost:3000\r\n', 1)
    assert.equal(row.text, '  - Local:   http://localhost:3000')
    assert.equal(row.links.length, 1)
    const [link] = row.links
    assert.equal(link.text, 'http://localhost:3000')
    assert.equal(sliceByRange(row.text, link), link.text)
    assert.equal(link.url, 'http://localhost:3000/')
    // 交给 xterm 的列是 1 基
    assert.equal(link.startIndex + 1, row.text.indexOf('http') + 1)
    assert.equal(link.endIndex, row.text.length)
  })

  test('ANSI 后面的第一段文本也能正确定位', async () => {
    const [row] = await feedXterm('\u001b[36m➜\u001b[0m \u001b[1mapp\u001b[0m http://localhost:5173/\r\n', 1)
    assert.equal(row.text, '➜ app http://localhost:5173/')
    assert.equal(row.links.length, 1)
    assert.equal(sliceByRange(row.text, row.links[0]), 'http://localhost:5173/')
    assert.equal(row.links[0].url, 'http://localhost:5173/')
  })

  test('Windows 路径带 :行:列 时范围不含行号', async () => {
    const [row] = await feedXterm('  at D:\\repo\\src\\index.ts:12:3\r\n', 1)
    assert.equal(row.links.length, 1)
    const [link] = row.links
    assert.equal(link.text, 'D:\\repo\\src\\index.ts:12:3', '标注的文本保留行号（和编辑器一致）')
    assert.equal(sliceByRange(row.text, link), link.text)
    assert.equal(link.url, 'file:///D:/repo/src/index.ts', '打开的地址不带行号')
  })

  test('一行里的 URL 与路径互不干扰', async () => {
    const [row] = await feedXterm('  open http://localhost:3000 then /tmp/app.log\r\n', 1)
    assert.deepEqual(row.links.map(link => link.url), ['http://localhost:3000/', 'file:///tmp/app.log'])
    for (const link of row.links) assert.equal(sliceByRange(row.text, link), link.text)
  })

  test('被终端折行的长 URL：折行处不会把两个片段拼错', async () => {
    // 80 列下这条 URL 会被折到第二行；两行各自独立解析，不会互相污染。
    const long = `http://localhost:3000/${'a'.repeat(70)}/end`
    const [first, second] = await feedXterm(`  ${long}\r\n`, 2)
    assert.equal(first.text.includes('http://localhost:3000/'), true)
    for (const row of [first, second]) {
      for (const link of row.links) assert.equal(sliceByRange(row.text, link), link.text, `行内容：${row.text}`)
    }
  })

  test('没有链接的行不产生任何链接', async () => {
    const [row] = await feedXterm('  plain output, nothing here\r\n', 1)
    assert.deepEqual(row.links, [])
  })
})
