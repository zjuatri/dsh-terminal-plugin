/**
 * 测试运行器：零依赖的极简收集器 + `node:assert`。
 *
 * 与同级 `dsh-browser-plugin` 的做法一致 —— 不引入测试框架。这样测试能在任何有 Node
 * 的地方跑，也不会因为框架版本变化而需要维护配置。
 *
 * 分工：
 *
 * - `test/harness.mjs` 提供 `describe` / `test` / `run`；
 * - 每个 `test/*.test.mjs` 在模块体里注册用例；
 * - 本文件先 import 全部测试文件（它们的模块体只做注册，不做 IO），再逐个执行。
 *
 * 用法：node --no-warnings test/run.mjs
 */

import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { run } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const files = readdirSync(here).filter(file => file.endsWith('.test.mjs')).sort()

for (const file of files) {
  await import(pathToFileURL(resolve(here, file)).href)
}

process.exitCode = await run(files.length)
