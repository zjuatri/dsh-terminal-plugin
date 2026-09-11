/**
 * 一次性依赖内置脚本：把 xterm.js 的前端产物复制进 `vendor/`。
 *
 * 客户端的终端渲染完全交给 xterm.js（MIT），但 DSH 的客户端插件产物必须是
 * lazy-CJS 自包含包，不能 require 第三方包；xterm 又没有出现在 profile 的依赖树里
 * 作为可 serve 的浏览器资源。因此这里把需要的三个文件**复制进仓库**，之后
 * `scripts/build.mjs` 只读本地 `vendor/`，构建不再需要网络。
 *
 * 只有升级 xterm 版本时才需要重跑本脚本。
 *
 * 用法：node scripts/vendor-xterm.mjs
 */

import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const vendor = join(root, 'vendor')

/** 内置哪些包、各取哪些文件。 */
const PACKAGES = [
  {
    specifier: '@xterm/xterm@6.0.0',
    files: [
      ['lib/xterm.mjs', 'xterm.mjs'],
      ['css/xterm.css', 'xterm.css'],
      ['LICENSE', 'LICENSE.xterm'],
    ],
  },
  {
    specifier: '@xterm/addon-fit@0.11.0',
    files: [
      ['lib/addon-fit.mjs', 'addon-fit.mjs'],
      ['LICENSE', 'LICENSE.addon-fit'],
    ],
  },
]

const work = mkdtempSync(join(tmpdir(), 'dsh-terminal-vendor-'))

/**
 * 用 npm pack 取包的 tarball 名（不落盘到仓库，只落在系统临时目录）。
 *
 * Windows 上没有 `npm` 这个可执行文件，只有 `npm.cmd`；直接给可执行文件名而不是
 * 打开 shell，这样参数不会被拼接、也不会触发 Node 的 DEP0190 警告。
 *
 * @param specifier - 带版本的包名，例如 `@xterm/xterm@6.0.0`。
 * @returns tarball 在本机临时目录里的绝对路径。
 */
function pack(specifier) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const output = execFileSync(npm, ['pack', specifier, '--silent'], { cwd: work, encoding: 'utf8' })
  return join(work, output.trim().split(/\r?\n/u).filter(Boolean).pop())
}

/** Windows 上 tar 是 bsdtar，能直接解 .tgz。 */
function extract(tarball, destination) {
  mkdirSync(destination, { recursive: true })
  execFileSync('tar', ['-xzf', tarball, '-C', destination], { stdio: 'inherit' })
  return join(destination, 'package')
}

mkdirSync(vendor, { recursive: true })
const recorded = []

for (const entry of PACKAGES) {
  const tarball = pack(entry.specifier)
  const extracted = extract(tarball, join(work, entry.specifier.replace(/[/@]/gu, '_')))
  const meta = JSON.parse(readFileSync(join(extracted, 'package.json'), 'utf8'))
  for (const [from, to] of entry.files) {
    cpSync(join(extracted, from), join(vendor, to))
    process.stdout.write(`vendor: ${entry.specifier} ${from} → vendor/${to}\n`)
  }
  recorded.push({ specifier: entry.specifier, version: meta.version, license: meta.license })
}

writeFileSync(join(vendor, 'README.md'), [
  '# vendor/',
  '',
  '这些文件是第三方构建输入，**不要手工编辑**。由 `node scripts/vendor-xterm.mjs` 从',
  'npm 取回并复制进来；`scripts/build.mjs` 只读本地文件，所以日常构建不需要网络。',
  '',
  '| 文件 | 来源 | 许可证 |',
  '| --- | --- | --- |',
  ...recorded.map(row => `| ${row.specifier.split('/').pop()} | ${row.specifier} | ${row.license} |`),
  '',
  '升级步骤：改上面的包版本号 → 重跑 `node scripts/vendor-xterm.mjs` → `npm run build`。',
  '',
  '为什么是这三个文件：',
  '',
  '- `xterm.mjs` —— 浏览器版终端模拟器（DOM 渲染器），宿主从',
  '  `GET <mountPrefix>/assets/xterm.mjs` 提供给页面。它没有任何 import、也没有动态',
  '  import，只有一个末尾的 `export { … as Terminal }`，所以既能被 `<script type="module">`',
  '  直接加载，也能在必要时内联进客户端产物。',
  '- `addon-fit.mjs` —— 按容器尺寸算 cols/rows；拖分隔条时必须靠它重算。',
  '- `xterm.css` —— xterm 自己的排版与滚动条样式，必须随终端一起注入。',
  '',
  '许可证：三者都是 MIT，原文见同目录的 `LICENSE.xterm` 与 `LICENSE.addon-fit`。',
  '',
].join('\n'), 'utf8')

rmSync(work, { recursive: true, force: true })
process.stdout.write(`vendor: 完成，${String(recorded.length)} 个包 → vendor/\n`)
