/**
 * 模块图的收集与拼接（宿主与客户端两条产物共用）。
 *
 * 两个产物的**包装**不同（宿主是 Node 直接 import 的 ESM，客户端是 lazy-CJS），但
 * 「沿相对 import 收模块 → 剥 TypeScript 类型 → 按依赖顺序拼成一份文件」这件事是同一件。
 * 放在一个文件里，两边的转写规则（多行具名 import、裸再导出、`export default` 等）
 * 就只会有一份实现，不会慢慢漂移。
 *
 * 类型剥除交给 Node 内置的 `stripTypeScriptTypes({ mode: 'strip' })`：它按真正的
 * TypeScript 解析器工作，而不是靠正则删类型。
 *
 * @typedef {object} ImportRow 一条 import 语句。
 * @property {string} specifier 原始模块说明符。
 * @property {{ imported: string, local: string }[]} names 具名/默认绑定。
 * @property {string | null} file 解析到的本地文件；外部依赖为 null。
 *
 * @typedef {object} ModuleRow 模块图里的一行。
 * @property {string} file 源文件绝对路径。
 * @property {string} body 已剥类型、已去掉 `export` 关键字与 import 语句的正文。
 * @property {ImportRow[]} imports 该模块的 import 表。
 * @property {string[]} bareReexports 裸再导出（`export { a as b }`）暴露出去的名字。
 * @property {string} id 拼接时的命名空间变量名（`M1`、`M2`…）。
 *
 * @module dsh-terminal-plugin/scripts/bundler
 */

import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { dirname, resolve } from 'node:path'

/**
 * 用 Node 内置解析器剥掉类型语法。
 *
 * @param {string} source TypeScript 源码。
 * @param {string} file 源码路径（只用于报错）。
 * @returns {string} 纯 JavaScript 源码。
 */
function stripTypes(source, file) {
  try {
    return stripTypeScriptTypes(source, { mode: 'strip' })
  } catch (error) {
    throw new Error(`bundler: 类型剥离失败 ${file}\n${String(error)}`)
  }
}

/**
 * 从 `start` 处读出一条完整语句（import/export 专用）。
 *
 * 逐字符扫描，跟踪花括号深度与引号（含模板串），**只有满足下面任一条件才收尾**：
 *
 * 1. 深度为 0 时遇到 `;` 或换行，且本语句已经出现过引号（模块说明符已读到）；
 * 2. 深度为 0 时遇到换行，且花括号刚闭合、这一行以 `}` 收尾
 *    （`export {}`、`export { A, B }` 这类没有说明符的语句）。
 *
 * 条件 2 必须看**行尾字符**，而不是「曾经打开过花括号」。`export {}` 与
 * `export {\n A,\n} from 'x'` 都会打开花括号；区别是后者在换行处的深度还是 1。
 * 把条件 2 写成「出现过花括号就收尾」会让 `export {}` 永远读不到结尾，一路吃进下一条
 * 语句（注释、声明），症状是模块命名空间莫名变空、或解析出「不支持的 import 形态」。
 *
 * @param {string} source 源码。
 * @param {number} start 语句起点。
 * @returns {string} 语句文本（不含结尾换行）。
 */
function readStatement(source, start) {
  let i = start
  let depth = 0
  let sawBrace = false
  let sawQuote = false
  let quote = null
  while (i < source.length) {
    const ch = source[i]
    if (quote !== null) {
      if (ch === '\\') { i += 2; continue }
      if (ch === quote) quote = null
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      sawQuote = true
      i++
      continue
    }
    if (ch === '{') {
      depth++
      sawBrace = true
    } else if (ch === '}') {
      depth--
    }
    if (depth === 0 && (ch === ';' || ch === '\n')) {
      const closedOnThisLine = ch === '\n' && sawBrace && source[i - 1].trim() === '}'
      if (sawQuote || closedOnThisLine) return source.slice(start, i)
    }
    i++
  }
  return source.slice(start)
}

/**
 * 取出模块的全部导入语句并返回其余正文。
 *
 * 返回值里的 `bareReexports` 是**裸再导出**（`export { A, B as C }`，不带 `from`）暴露出去
 * 的名字。它必须单独记下来：那条语句本身在打包后没有对应物（模块之间靠命名空间对象取用），
 * 但它导的是本模块已有的绑定，名字要进导出面。典型现场是 `src/client/react.ts` 整个模块
 * 只有一条 `export { h, useState, … } from 'react'`，漏掉这些名字就会得到「空的命名空间」，
 * 运行期表现为 `useSyncExternalStore is not a function`，而原因在构建脚本里。
 *
 * 带 `from` 的再导出（`export { A } from 'x'`）不在这里处理：它引的是**另一个**模块的绑定，
 * 与 `import … from 'x'` 等价；`processModule` 会把它归一化成 `export {}`，值导入则被照常
 * 收进导入表。
 *
 * @param {string} source 已剥掉类型的源码。
 * @param {string} file 源码路径。
 * @returns {{ imports: ImportRow[], bareReexports: string[], body: string }} 导入表、裸再导出的名字与剩余正文。
 */
export function splitImports(source, file) {
  /** @type {ImportRow[]} */
  const imports = []
  /** @type {string[]} */
  const bareReexports = []
  let body = ''
  let i = 0
  while (i < source.length) {
    const atLineStart = i === 0 || source[i - 1] === '\n'
    if (atLineStart && /^[ \t]*(?:import|export)\b/u.test(source.slice(i, i + 13))) {
      const statement = readStatement(source, i)
      i += statement.length
      if (source[i] === ';' || source[i] === '\n') i++
      if (/^[ \t]*import\s+type\b/u.test(statement)) continue
      if (/^[ \t]*import\s*\(/u.test(statement)) {
        body += statement
        continue
      }
      // 1) 不携带模块说明符、且没有任何本地绑定的语句：直接丢。
      if (/^[ \t]*export\s*(?:\*|type\s*\{)/u.test(statement)) continue
      // 2) 不带 `from` 的具名再导出（`export { a as b }`）：名下的绑定都是本模块已有的，
      //    语句本身没有对应物，只把暴露出去的名字记下来。
      const bareReexport = /^[ \t]*export\s*\{([^}]*)\}(?![\s\S]*\bfrom\b)\s*;?$/u.exec(statement)
      if (bareReexport !== null) {
        for (const specifier of parseSpecifiers(bareReexport[1])) bareReexports.push(specifier.exported)
        continue
      }
      // 3) `export { a as b } from 'x'`：与 `import { a as b } from 'x'` 在本模块里等价
      //    （跨模块取用一律走命名空间对象），只是 `b` 同时属于导出面。
      const reexportFrom = /^[ \t]*export\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/u.exec(statement)
      if (reexportFrom !== null) {
        const names = parseSpecifiers(reexportFrom[1]).map(({ imported, exported }) => ({ imported, local: exported }))
        if (names.length > 0) imports.push({ specifier: reexportFrom[2], names, file: null })
        continue
      }
      // 4) `export const …` / `export default …`：内容留着，`export` 关键字由
      //    `stripExportKeyword` 去掉。
      if (/^[ \t]*export\b/u.test(statement)) {
        body += statement
        continue
      }
      // 5) 普通导入。`import type …` 与动态 `import(…)` 在前面已经筛掉了。
      const named = /^[ \t]*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/u.exec(statement)
      const namespace = /^[ \t]*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]/u.exec(statement)
      const defaultImport = /^[ \t]*import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[\s\S]*?\})?\s*from\s*['"]([^'"]+)['"]/u.exec(statement)
      const bare = /^[ \t]*import\s*['"]([^'"]+)['"]/u.exec(statement)
      if (namespace !== null) {
        // `import * as ns from 'x'`：命名空间导入。打包后本地模块的命名空间对象就是
        // 那个变量本身，外部的由取用口提供 —— 两种都由拼接阶段决定，这里只记录意图。
        imports.push({ specifier: namespace[2], names: [{ imported: '*', local: namespace[1] }], file: null })
        continue
      }
      if (named !== null) {
        const names = parseSpecifiers(named[1]).map(({ imported, local }) => ({ imported, local }))
        if (names.length > 0) imports.push({ specifier: named[2], names, file: null })
        continue
      }      if (defaultImport !== null) {
        imports.push({ specifier: defaultImport[2], names: [{ imported: 'default', local: defaultImport[1] }], file: null })
        continue
      }
      if (bare !== null) {
        imports.push({ specifier: bare[1], names: [], file: null })
        continue
      }
      throw new Error(`bundler: 不支持的 import 形态（${file}）：${statement.trim()}`)
    }
    body += source[i]
    i++
  }
  return { imports, bareReexports, body }
}

/**
 * 解析 `{A, B as C}` 形式的绑定列表。
 *
 * @param {string} raw 花括号内的原文。
 * @returns {{ imported: string, exported: string, local: string }[]} 绑定列表
 *   （`imported` 是来源侧名字，`exported`/`local` 是本模块侧名字；空项被跳过）。
 */
function parseSpecifiers(raw) {
  return raw.split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map((part) => {
      const [imported, alias] = part.split(/\s+as\s+/u)
      const local = alias ?? imported
      return { imported, exported: local, local }
    })
}

/**
 * 去掉顶层 `export` 关键字（导出关系稍后按模块命名空间重新建立）。
 *
 * 两种 `export` 语句分别处理：
 *
 * - 带 `from` 的再导出（`export { A, B } from 'x'`）**没有对应物**：拼接后模块之间靠
 *   命名空间对象取用，这条语句里的名字既不会在本模块声明，也不该被消费方看见，直接删。
 * - 不带 `from` 的裸再导出（`export { h, useState }`）导的是本模块的 import 绑定，
 *   由 `moduleFaces` 通过导入表自然带上，因此也直接删。
 *
 * 但**插入的替代注释里绝对不能出现 `export` 这个词** —— 它是「本文件不含导出语句」
 * 的标记，后面按 `export` 定位时的锚点。踩过的坑：`react.ts` 整个模块就是一条裸再导出，
 * 早先的实现在这里插了一句 “export 关系由命名空间承载”，于是模块正文里既没有声明、
 * 又留下一个假的 `export` 关键字，最后只拼出一个空的命名空间对象，症状是运行期的
 * `useSyncExternalStore is not a function` —— 离原因（构建脚本自己写的注释）非常远。
 *
 * @param {string} body 已剥掉类型的模块正文。
 * @returns {string} 去掉 `export` 的正文。
 */
export function stripExportKeyword(body) {
  const withKeyword = body
    .replace(/^([ \t]*)export\s+(?=(?:const|let|var|function|class|async)\b)/gmu, '$1')
    .replace(/^([ \t]*)export\s+default\s+/gmu, '$1const __default = ')
  // 两条替换都**不带行首锚点**：`processModule` 把 `export … from 'x'` 归一化成
  // `export {}` 时丢掉了原语句的换行，于是同一行上可能出现好几个（`export {}export {}…`）。
  // 带锚点的写法只会清掉第一个，剩下的会在产物里变成真正的 `export` 语句 —— 症状是
  // 「模块命名空间是空的」或「SyntaxError: Unexpected token 'export'」，离原因都很远。
  return withKeyword
    .replace(/[ \t]*export\s*\{[^}]*\}(?:\s*from\s*['"][^'"]+['"])?\s*;?/gu, '')
}

/**
 * 列出模块真正的顶层具名绑定。
 *
 * 只认第 0 列开始的声明：函数体里的临时变量不是导出面。具名解构
 * （`const { a, b } = …`）是跨模块导入的落点，必须一并列出。
 *
 * @param {string} body 已剥掉类型的模块正文。
 * @returns {string[]} 顶层绑定名（去重）。
 */
export function declaredNames(body) {
  /** @type {Set<string>} */
  const names = new Set()
  for (const match of body.matchAll(/^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gmu)) {
    names.add(match[1])
  }
  for (const match of body.matchAll(/^(?:const|let|var)\s*\{([^}]*)\}\s*=/gmu)) {
    for (const part of match[1].split(',')) {
      const name = part.split(':').pop()?.trim().split(/\s*=/u)[0]?.trim()
      if (name !== undefined && /^[A-Za-z_$][\w$]*$/u.test(name)) names.add(name)
    }
  }
  return [...names]
}

/**
 * 一个模块的完整导出面：顶层声明，**加上**它引入的绑定与裸再导出的名字。
 *
 * 后两项都不可省。`export { Config }`（Config 由 `import` 进来）与
 * `export { h, useState } from 'react'` 这类裸再导出提供的名字不是本模块声明的，漏掉
 * 任何一个都等于把模块的公开面少报一个名字，消费方拿到的是 `undefined`。
 *
 * @param {ModuleRow} row 模块图里的一行。
 * @returns {string[]} 导出面名字（去重）。
 */
export function moduleFaces(row) {
  /** @type {Set<string>} */
  const names = new Set(declaredNames(row.body))
  for (const entry of row.imports) {
    for (const { local } of entry.names) names.add(local)
  }
  for (const name of row.bareReexports) names.add(name)
  return [...names]
}

/**
 * 把相对说明符解析到实际源码文件。
 *
 * `.js` 说明符按源码惯例允许对应 `.ts`/`.tsx`，也允许**真的就是** `.js`
 * （生成产物一律在 `lib/`，不进模块图）。
 *
 * @param {string} specifier import 说明符。
 * @param {string} fromFile 发起 import 的文件。
 * @returns {string | null} 实际文件路径，或 null（外部依赖）。
 */
export function resolveModule(specifier, fromFile) {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [
    base.replace(/\.js$/u, '.ts'),
    base.replace(/\.js$/u, '.tsx'),
    `${base}.ts`,
    `${base}.tsx`,
    base,
  ]
  for (const candidate of candidates) {
    try {
      readFileSync(candidate)
      return candidate
    } catch { /* 试下一个 */ }
  }
  throw new Error(`bundler: 无法解析 ${specifier}（来自 ${fromFile}）`)
}

/**
 * 读入并处理一个模块。
 *
 * 这里**不做任何归一化**：`export { A } from 'x'` 这类语句由 `splitImports` 收进导入表
 * （值导入），`export * from 'x'` / `export type { A } from 'x'` 这类没有本地绑定的语句在
 * 那里被跳过，`export { A }`（不带 `from`）则被记成裸再导出。
 *
 * 曾经在这里把带 `from` 的再导出替换成 `export {}`，是个反效果：替换丢掉了原来的换行，
 * 而且 `readStatement` 的语句边界本来就是按行判定的，被改写过的源码反而更容易读错；
 * 更糟的是那条替换会连**不带** `from` 的 `export { h, useState } from 'react'` 一起吃掉，
 * 于是 `react.ts` 这类模块拼出一个空命名空间（运行期
 * `useSyncExternalStore is not a function`）。
 *
 * @param {string} file 源码路径。
 * @returns {{ imports: ImportRow[], bareReexports: string[], body: string }} 导入表、裸再导出的名字与正文。
 */
function processModule(file) {
  return splitImports(stripTypes(readFileSync(file, 'utf8'), file), file)
}

/**
 * 深度优先地按依赖顺序收集模块（入口排在最后）。
 *
 * @param {string} entry 入口文件绝对路径。
 * @returns {ModuleRow[]} 模块行，依赖在前。
 */
export function collect(entry) {
  /** @type {ModuleRow[]} */
  const order = []
  /** @type {Set<string>} */
  const seen = new Set()
  /** @param {string} file */
  const visit = (file) => {
    if (seen.has(file)) return
    seen.add(file)
    const { imports, bareReexports, body } = processModule(file)
    /** @type {ImportRow[]} */
    const deps = []
    for (const entryImport of imports) {
      const resolved = resolveModule(entryImport.specifier, file)
      deps.push({ ...entryImport, file: resolved })
      if (resolved !== null) visit(resolved)
    }
    order.push({
      file,
      body: stripExportKeyword(body),
      imports: deps,
      bareReexports,
      id: `M${String(order.length + 1)}`,
    })
  }
  visit(entry)
  return order
}

/**
 * 按模块行生成「变量名 → 文件」索引。
 *
 * @param {readonly ModuleRow[]} rows 模块行。
 * @returns {Map<string, string>} 文件 → 变量名。
 */
export function idOf(rows) {
  return new Map(rows.map(row => [row.file, row.id]))
}
