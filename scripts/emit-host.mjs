/**
 * 宿主产物的拼接：把模块图变成一个 Node 能直接 `import` 的 ESM 文件。
 *
 * 与客户端产物的区别只有包装方式（见 `emit-client.mjs`）：
 *
 * - 外部依赖（`node:*`、`@deepseek-ai/*`、`ws`）在文件顶部按说明符静态 `import * as`
 *   一次，各模块通过取用口按需取用；默认导入取 `.default`。
 * - 每个模块包一个 IIFE，导出面是它返回的命名空间对象；跨模块引用靠模块顶部的解构。
 * - 入口模块只转发插件契约导出（`name`/`inject`/`apply`/`Config`），内部构件不对外。
 *
 * @module dsh-terminal-plugin/scripts/emit-host
 */

/** @typedef {import('./bundler.mjs').ModuleRow} ModuleRow */

import { idOf, moduleFaces } from './bundler.mjs'

/** 宿主入口默认必须暴露给 cordis 与插件加载器的契约导出。 */
const PLUGIN_ENTRY_EXPORTS = ['name', 'inject', 'apply', 'Config']

/**
 * 拼出宿主 ESM 产物。
 *
 * @param {readonly ModuleRow[]} rows 模块图（入口在最后）。
 * @param {string} root 仓库根目录，仅用于把路径写成相对形式。
 * @param {{ entryExports?: readonly string[] | 'all' }} [options] 入口转发哪些导出。
 *   默认只转发插件契约（`name`/`inject`/`apply`/`Config`）；`'all'` 转发入口的全部具名
 *   导出，测试专用产物（`lib/selftest.js`）用它。
 * @returns {string} 产物源码。
 */
export function emitHost(rows, root, options = {}) {
  const index = idOf(rows)
  /**
   * 外部依赖取用口：键是 `n:<specifier>` / `d:<specifier>`，值是别名。
   * @type {Map<string, { specifier: string, alias: string, wantsDefault: boolean }>}
   */
  const externals = new Map()

  /**
   * 登记一个外部依赖，返回它的别名。
   *
   * @param {string} moduleId 引用它的模块（别名里带上，便于读产物时定位）。
   * @param {string} specifier 模块说明符。
   * @param {boolean} wantsDefault 是否要 `.default`。
   * @returns {string} 该说明符的别名。
   */
  const register = (moduleId, specifier, wantsDefault) => {
    const key = `${wantsDefault ? 'd' : 'n'}:${specifier}`
    const existing = externals.get(key)
    if (existing !== undefined) return existing.alias
    const alias = `__ext_${moduleId}_${String(externals.size)}`
    externals.set(key, { specifier, alias, wantsDefault })
    return alias
  }

  const chunks = rows.map((row) => {
    const lines = [`// ── ${shortPath(row.file, root)} ──`, `const ${row.id} = (() => {`]
    for (const entry of row.imports) {
      if (entry.names.length === 0) continue
      const target = entry.file === null ? undefined : index.get(entry.file)
      const isNamespace = entry.names.length === 1 && entry.names[0].imported === '*'
      if (isNamespace) {
        // 命名空间导入：本地模块直接绑定到它的命名空间对象，外部的走取用口。
        const source = target !== undefined
          ? target
          : register(row.id, entry.specifier, false)
        if (target === undefined) lines.push(`  const ${source} = __external(${JSON.stringify(entry.specifier)})`)
        lines.push(`  const ${entry.names[0].local} = ${source}`)
        continue
      }
      const isDefault = entry.names.length === 1 && entry.names[0].imported === 'default'
      if (isDefault) {
        register(row.id, entry.specifier, true)
        lines.push(`  const ${entry.names[0].local} = __externalDefault(${JSON.stringify(entry.specifier)})`)
        continue
      }
      let source
      if (target === undefined) {
        source = register(row.id, entry.specifier, false)
        lines.push(`  const ${source} = __external(${JSON.stringify(entry.specifier)})`)
      } else {
        source = target
      }
      const bindings = entry.names
        .map(({ imported, local }) => (imported === local ? imported : `${imported}: ${local}`))
        .join(', ')
      lines.push(`  const { ${bindings} } = ${source}`)
    }
    lines.push(indent(row.body.trimEnd(), '  '))
    lines.push('  return {')
    for (const name of moduleFaces(row)) lines.push(`    ${name},`)
    lines.push('  }')
    lines.push('})()')
    lines.push('')
    return lines.join('\n')
  }).join('\n')

  const entries = [...externals.values()]
  const externalImports = entries
    .map(entry => `import * as ${entry.alias} from ${JSON.stringify(entry.specifier)}`)
    .join('\n')
  const externalCases = entries
    .filter(entry => !entry.wantsDefault)
    .map(entry => `    case ${JSON.stringify(entry.specifier)}: return ${entry.alias}`)
    .join('\n')
  const externalDefaultCases = entries
    .filter(entry => entry.wantsDefault)
    .map(entry => `    case ${JSON.stringify(entry.specifier)}: return ${entry.alias}.default`)
    .join('\n')

  const entryRow = rows[rows.length - 1]
  const faces = moduleFaces(entryRow)
  const requested = options.entryExports ?? PLUGIN_ENTRY_EXPORTS
  const forwarded = (requested === 'all' ? faces : requested)
    .filter(name => faces.includes(name))
    .map(name => `export const ${name} = ${entryRow.id}.${name}`)
    .join('\n')

  return `//! 自动生成，请勿直接编辑 —— 由 scripts/build.mjs 从 src/*.ts 生成。
//!
//! profile 用 \`file://\` 行加载本文件，所以它必须是 Node 能直接 import 的 ESM：
//! 类型已剥离、相对 import 已内联、外部依赖在顶部导入一次。
${externalImports}

/** 外部依赖的取用口：ESM 命名空间对象即导入表。 */
const __external = (specifier) => {
  switch (specifier) {
${externalCases}
    default: throw new Error(\`dsh-terminal-plugin: 未声明外部依赖 \${specifier}\`)
  }
}

/** 默认导入的取用口（对应 \`import z from '…'\`）。 */
const __externalDefault = (specifier) => {
  switch (specifier) {
${externalDefaultCases}
    default: throw new Error(\`dsh-terminal-plugin: 未声明外部依赖 \${specifier}\`)
  }
}

${chunks}
// ── 入口模块的导出（cordis 读取 name / inject / apply 与 Config） ──
${forwarded}
`
}

/** 把绝对路径写成仓库内相对路径。 */
function shortPath(file, root) {
  return file.startsWith(root) ? file.slice(root.length).replace(/^[\\/]/u, '').replaceAll('\\', '/') : file
}

/** 给正文统一加缩进（空行保持空行）。 */
function indent(body, prefix) {
  return body.split('\n').map(line => (line === '' ? '' : `${prefix}${line}`)).join('\n')
}
