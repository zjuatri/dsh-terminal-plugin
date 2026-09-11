/**
 * 客户端产物的拼接：把模块图变成 DSH 的 **lazy-CJS 客户端插件格式**。
 *
 * 执行产物只会**注册**工厂（`window.__ModuleLoader__.load({id, factory})`），真正的
 * 模块体（含样式注入）要等模块系统实体化这个插件时才跑。`factory(require)` 只能用平台
 * 种子说明符去 require（`react` 等），其余一切都已经内联在这个文件里。
 *
 * 两条必须守住的规则（同级 `dsh-browser-plugin` 的测试已经把踩过的坑记下来了）：
 *
 * 1. 具名导入的绑定必须进入模块命名空间，否则消费方拿到 `undefined` —— 现象是运行时的
 *    `useState is not defined`，离原因非常远。因此**模块里要显式 import 自己用到的
 *    React 具名导出**（本脚本会在入口模块的命名空间里放好这些绑定），而不是指望它们
 *    在工厂作用域里凭空可见。
 * 2. 平台种子模块的具名绑定由工厂顶部的 `require` 提供，模块里不能再写一行解构，
 *    否则会把真实的 React 模块对象覆盖成 `undefined`。
 *
 * 工厂作用域里另有一个 `h`（= `react.createElement`）：模块通过
 * `import { h } from '…/runtime.js'` 取用，避免每个组件都写一遍 `createElement`。
 *
 * @module dsh-terminal-plugin/scripts/emit-client
 */

/** @typedef {import('./bundler.mjs').ModuleRow} ModuleRow */

import { idOf, moduleFaces } from './bundler.mjs'

/** 客户端入口必须暴露的插件契约导出。 */
const ENTRY_EXPORTS = new Set(['apply', 'inject'])

/** 工厂顶部一次性取出的 React 具名导出（模块内解构的落点）。 */
const REACT_NAMES = [
  'useState',
  'useEffect',
  'useLayoutEffect',
  'useMemo',
  'useReducer',
  'useCallback',
  'useRef',
  'useContext',
  'useSyncExternalStore',
  'Fragment',
  'memo',
  'forwardRef',
  'createContext',
  'createElement',
  'cloneElement',
  'Children',
]

/**
 * 拼出 lazy-CJS 客户端产物。
 *
 * @param {readonly ModuleRow[]} rows 模块图（入口在最后）。
 * @param {string} pluginId 注册 id，必须是包名（要与宿主组装的 boot graph 行一致）。
 * @returns {string} 产物源码。
 */
export function emitClient(rows, pluginId) {
  const index = idOf(rows)

  const chunks = rows.map((row) => {
    const lines = [`    // ── ${shortPath(row.file)} ──`, `    const ${row.id} = (() => {`]
    for (const entry of row.imports) {
      if (entry.names.length === 0) continue
      const target = entry.file === null ? undefined : index.get(entry.file)
      // 只有本地模块才有命名空间对象可解构；平台种子的绑定由工厂顶部的 require 提供。
      if (target === undefined) {
        // 命名空间导入指向平台种子时没有可用的模块对象（工厂只解构了具名导出），
        // 这种情况在客户端产物里没有出现，明确报错而不是悄悄给个 undefined。
        if (entry.names.length === 1 && entry.names[0].imported === '*') {
          throw new Error(`emit-client: 客户端模块不支持命名空间导入平台种子 ${JSON.stringify(entry.specifier)}（${row.file}）`)
        }
        continue
      }
      if (entry.names.length === 1 && entry.names[0].imported === '*') {
        lines.push(`      const ${entry.names[0].local} = ${target}`)
        continue
      }
      const bindings = entry.names
        .map(({ imported, local }) => (imported === local ? imported : `${imported}: ${local}`))
        .join(', ')
      lines.push(`      const { ${bindings} } = ${target}`)
    }
    lines.push(indent(row.body.trimEnd(), '    '))
    lines.push('      return {')
    for (const name of moduleFaces(row)) lines.push(`        ${name},`)
    lines.push('      }')
    lines.push('    })()')
    lines.push('')
    return lines.join('\n')
  }).join('\n')

  const entryRow = rows[rows.length - 1]
  const forwarded = moduleFaces(entryRow)
    .filter(name => ENTRY_EXPORTS.has(name))
    .map(name => `    exports.${name} = ${entryRow.id}.${name}`)
    .join('\n')

  // 入口模块的命名空间补上工厂作用域里已有的 React 绑定：模块里 `import { h } from
  // './runtime.js'`（以及具名 hook）会从这里解构，于是每个模块只绑定自己用到的名字。
  const entryBindings = [...REACT_NAMES, 'h']
    .map(name => `    ${entryRow.id}.${name} = ${name};`)
    .join('\n')

  return `//! 自动生成，请勿直接编辑 —— 由 scripts/build.mjs 从 src/client/*.ts 生成。
//!
//! 本文件是 DSH 的 lazy-CJS 客户端插件格式：执行它只会**注册**工厂，什么都不会运行；
//! 真正的模块体（含样式注入）在模块系统实体化插件时才执行。只允许 require 平台种子：
//! \`react\`（以及 shell 提供的其它种子）。其余一切都已内联在本文件里。
window.__ModuleLoader__.load({
  id: ${JSON.stringify(pluginId)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");
    const h = react.createElement;
    const { ${REACT_NAMES.join(', ')} } = react;

${chunks}
    // ── 工厂作用域里的 React 绑定挂到入口命名空间（模块从这里解构） ──
${entryBindings}

    // ── 入口模块的契约导出（插件系统读取 apply / inject） ──
${forwarded}

    return module.exports;
  },
});
`
}

/** 只保留 `src/` 之后的相对路径。 */
function shortPath(file) {
  const normalized = file.replaceAll('\\', '/')
  const at = normalized.lastIndexOf('/src/')
  return at < 0 ? normalized : normalized.slice(at + 1)
}

/** 给正文统一加缩进（空行保持空行）。 */
function indent(body, prefix) {
  return body.split('\n').map(line => (line === '' ? '' : `${prefix}${line}`)).join('\n')
}
