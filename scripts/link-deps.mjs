/**
 * 开发期依赖链接（幂等）。
 *
 * 插件在 DSH 里运行时，Node 的解析基准是 `$DSH_HOME/profiles/` —— 那一层
 * `node_modules` 里已经有 `@deepseek-ai/*` 全套与 `ws`、`node-pty`。本仓库独立存放
 * 在工作区里，没有自己的依赖树，因此本脚本把缺失的包按**符号链接**补上，让构建脚本
 * 能真实 `import` 宿主产物做校验、让测试能真实加载模块。
 *
 * 链接而不是复制：版本升级时链接自动跟随，也不会把几百兆的依赖复制进仓库。
 *
 * 用法：node scripts/link-deps.mjs
 */

import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')

/** 候选源目录：profile 依赖树优先，其次 web profile 自己的树。 */
const SOURCES = [
  join(home, 'profiles', 'node_modules'),
  join(home, 'profiles', 'web', 'node_modules'),
]

/** 宿主产物导入或运行时会用到的包（含作用域包）。 */
const PACKAGES = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/schemastery',
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-subprocess',
  'ws',
]

const target = join(root, 'node_modules')
mkdirSync(target, { recursive: true })

/** 在源目录里找到某个包的实体位置。 */
function locate(pkg) {
  for (const source of SOURCES) {
    const candidate = join(source, pkg)
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** 为一个包建立符号链接（必要时先建作用域目录）。 */
function link(pkg) {
  const destination = join(target, pkg)
  if (existsSync(destination)) {
    // 已经存在但指向别处（换过 DSH 版本）时重建，避免拿着过期链接调错代码。
    const expected = locate(pkg)
    if (expected === null) return 'present'
    rmSync(destination, { recursive: true, force: true })
  }
  const source = locate(pkg)
  if (source === null) return 'missing'
  mkdirSync(dirname(destination), { recursive: true })
  try {
    symlinkSync(source, destination, 'junction')
    return 'linked'
  } catch (error) {
    return `failed: ${error.message}`
  }
}

const results = PACKAGES.map(pkg => [pkg, link(pkg)])
const missing = results.filter(([, status]) => status === 'missing').map(([pkg]) => pkg)

for (const [pkg, status] of results) {
  process.stdout.write(`link-deps: ${pkg} → ${status}\n`)
}
if (missing.length > 0) {
  process.stderr.write(`link-deps: 以下包在 ${SOURCES.join(' 与 ')} 里都找不到：${missing.join(', ')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`link-deps: 完成（${String(readdirSync(target).length)} 个条目）\n`)
}
