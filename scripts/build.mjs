/**
 * 构建入口：把 `src/**` 打成宿主与客户端两份产物，并把内置的 xterm.js 写进 `lib/`。
 *
 * 用法：node scripts/build.mjs
 *
 * 产物与校验：
 *
 * | 产物 | 形态 | 构建期校验 |
 * | --- | --- | --- |
 * | `lib/index.js` | Node 直接 import 的 ESM | `node --check` + 真实 `import()`（要看到 name/inject/apply/Config） |
 * | `lib/client.js` | DSH 的 lazy-CJS 客户端插件 | 逐个模块 + 整文件 `node --check` |
 * | `lib/assets.json` | 静态资源清单（名字 → 文件、内容类型、版本） | 读回来解析一次 |
 * | `lib/xterm.mjs` 等 | 从 `vendor/` 复制 | 存在性 |
 *
 * 客户端产物**不包含** xterm（345 KB）：它由宿主从 `<mountPrefix>/assets/xterm.mjs`
 * 提供给页面，页面再用一个 `<script type="module">` 把它挂到全局。这样刷新页面时
 * 那 345 KB 走 HTTP 缓存，客户端 bundle 保持小体积。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collect } from './bundler.mjs'
import { emitClient } from './emit-client.mjs'
import { emitHost } from './emit-host.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const lib = join(root, 'lib')
const checkDir = join(root, '.build-check')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** 要从 `vendor/` 复制进 `lib/` 的资源，以及它们的 Content-Type。 */
const ASSETS = [
  ['xterm.mjs', 'text/javascript; charset=utf-8'],
  ['addon-fit.mjs', 'text/javascript; charset=utf-8'],
  ['xterm.css', 'text/css; charset=utf-8'],
]

mkdirSync(lib, { recursive: true })
rmSync(checkDir, { recursive: true, force: true })
mkdirSync(checkDir, { recursive: true })

/** 把 vendor 资源复制进 lib 并生成 assets.json。 */
function buildAssets() {
  const entries = {}
  const revision = createHash('sha256')
  for (const [name, type] of ASSETS) {
    const source = join(root, 'vendor', name)
    if (!existsSync(source)) {
      throw new Error(`build: 缺少 vendor/${name}，请先运行 npm run vendor`)
    }
    const body = readFileSync(source)
    revision.update(name).update(body)
    copyFileSync(source, join(lib, name))
    entries[name] = { file: name, type }
  }
  const rev = revision.digest('hex').slice(0, 16)
  writeFileSync(join(lib, 'assets.json'), `${JSON.stringify({ rev, entries }, null, 2)}\n`, 'utf8')
  process.stdout.write(`build: ${String(ASSETS.length)} 个资源 → lib/（rev ${rev}）\n`)
  return rev
}

/** 跑一条 node 子命令并返回是否成功。 */
function node(args) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' })
  return { ok: result.status === 0, stderr: result.stderr ?? '', stdout: result.stdout ?? '' }
}

/** 语法校验一个文件。 */
function checkSyntax(file) {
  const result = node(['--check', file])
  if (!result.ok) process.stderr.write(`build: 语法校验失败 ${relative(root, file)}\n${result.stderr}\n`)
  return result.ok
}

/** 构建宿主产物。 */
async function buildHost() {
  const rows = collect(join(root, 'src/index.ts'))
  const output = join(lib, 'index.js')
  writeFileSync(output, emitHost(rows, root), 'utf8')
  if (!checkSyntax(output)) return false
  const load = await import(`${pathToFileURL(output).href}?t=${String(Date.now())}`)
  const missing = ['name', 'inject', 'apply', 'Config'].filter(key => load[key] === undefined)
  if (missing.length > 0) {
    process.stderr.write(`build: 宿主产物缺少导出：${missing.join(', ')}\n`)
    return false
  }
  process.stdout.write(`build: 宿主 ${String(rows.length)} 个模块 → lib/index.js\n`)
  return true
}

/**
 * 构建测试专用产物（`lib/selftest.js`）。
 *
 * 它只是把纯函数重新导出一次，好让 `test/*.test.mjs` 直接 import 构建后的真实代码，
 * 而不必为「源码里的 type-only import 指向未安装的包」付出代价（详见 `src/selftest.ts`）。
 *
 * @returns {Promise<boolean>} 是否成功。
 */
async function buildSelftest() {
  const rows = collect(join(root, 'src/selftest.ts'))
  const output = join(lib, 'selftest.js')
  // 测试产物要把入口的**全部**具名导出转发出去，而不是只转发插件契约那四个。
  writeFileSync(output, emitHost(rows, root, { entryExports: 'all' }), 'utf8')
  if (!checkSyntax(output)) return false
  const load = await import(`${pathToFileURL(output).href}?t=${String(Date.now())}`)
  const missing = ['clampDimension', 'resolveShell', 'TerminalRegistry', 'PtySession', 'extractOscTitle']
    .filter(key => load[key] === undefined)
  if (missing.length > 0) {
    process.stderr.write(`build: selftest 产物缺少导出：${missing.join(', ')}\n`)
    return false
  }
  process.stdout.write(`build: 测试用 ${String(rows.length)} 个模块 → lib/selftest.js\n`)
  return true
}

/** 构建客户端产物：先逐模块校验，再整文件校验。 */
function buildClient() {
  const rows = collect(join(root, 'src/client/index.tsx'))
  let failures = 0
  for (const row of rows) {
    const probe = join(checkDir, `module-${row.id}.mjs`)
    const bindings = row.imports
      .filter(entry => entry.names.length > 0)
      .map(entry => `const { ${entry.names.map(item => item.local).join(', ')} } = {};`)
      .join('\n')
    writeFileSync(probe, `${bindings}\n${row.body}\nexport {}\n`, 'utf8')
    const result = node(['--check', probe])
    if (!result.ok) {
      failures += 1
      process.stderr.write(`build: 客户端模块语法校验失败 ${relative(root, row.file)}\n${result.stderr}\n`)
    }
  }
  if (failures > 0) {
    process.stderr.write(`build: ${String(failures)} 个客户端模块未通过校验\n`)
    return false
  }
  const output = join(lib, 'client.js')
  writeFileSync(output, emitClient(rows, pkg.name), 'utf8')
  const probe = join(checkDir, 'bundle-check.cjs')
  writeFileSync(probe, readFileSync(output, 'utf8'), 'utf8')
  const result = node(['--check', probe])
  if (!result.ok) {
    process.stderr.write(`build: 客户端产物语法校验失败\n${result.stderr}\n`)
    return false
  }
  process.stdout.write(`build: 客户端 ${String(rows.length)} 个模块 → lib/client.js\n`)
  return true
}

/** 校验 assets.json 能被读回来。 */
function checkAssetsManifest() {
  try {
    const manifest = JSON.parse(readFileSync(join(lib, 'assets.json'), 'utf8'))
    for (const name of Object.keys(manifest.entries)) {
      if (!existsSync(join(lib, name))) throw new Error(`清单指向的 ${name} 不存在`)
    }
    return true
  } catch (error) {
    process.stderr.write(`build: assets.json 校验失败：${String(error)}\n`)
    return false
  }
}

const rev = buildAssets()
const hostOk = await buildHost()
const selftestOk = await buildSelftest()
const clientOk = buildClient()
const assetsOk = checkAssetsManifest()

if (hostOk && selftestOk && clientOk && assetsOk) {
  rmSync(checkDir, { recursive: true, force: true })
  process.stdout.write(`build: 完成（assets rev ${rev}）\n`)
} else {
  process.exitCode = 1
}
