/**
 * React 门面：本插件所有组件从这里取 React，而不是各自 `from 'react'`。
 *
 * 两个原因：
 *
 * 1. **运行时合同**：客户端产物是 lazy-CJS，`factory(require)` 只能取到平台种子模块。
 *    构建脚本（`scripts/emit-client.mjs`）在工厂顶部一次性取出 `react` 的具名导出与
 *    `h = react.createElement`，再把它们挂到入口模块的命名空间上。这里显式 import
 *    这些名字，构建期就能把它们做成模块内绑定，运行期不会出现
 *    「`useState is not defined`」这种离原因很远的报错。
 * 2. **测试替身**：`test/client-apply.test.mjs` 用一组最小实现替换 React，验证槽位注册
 *    与样式注入。只有一处 import 面，替身才好写。
 *
 * @module dsh-terminal-plugin/src/client/react
 */

export { h, createElement, Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

/** 组件能返回的东西（用 `unknown` 是为了不让类型声明成为运行期依赖）。 */
export type ReactNode = unknown
