/**
 * 测试专用入口：把**纯函数与内部构件**重新导出成一个独立产物，好让 `test/*.test.mjs`
 * 直接 `import` 构建后的真实代码。
 *
 * 为什么不直接从 `src/*.ts` import：源码里那几处 `import type {} from
 * '@deepseek-ai/…'` 是给 TypeScript 看的声明合并开关，Node 的类型剥离会保留成
 * `import '…'` 形式，于是测试会因为「包不存在」而失败 —— 而给测试链接那些包会白白拖
 * 一大堆依赖进度。
 *
 * 为什么不从 `lib/index.js`（插件产物）import：那会把这些内部函数变成插件的事实 API，
 * 别人就会开始依赖它们。单独一个入口，意图也清楚：这些是给测试看的。
 *
 * **写法约束**：本文件的每条导出都必须落在一个局部绑定上（`const x = mod.x`），不能写
 * `export { … } from '…'`。手写打包器按命名空间对象重接模块关系，裸再导出语句只提供
 * 名字、不提供本地声明，拼出来的模块命名空间会是空的，症状是测试里
 * 「xxx is not a function」，离原因（构建脚本的转写规则）很远。
 *
 * 构建产物：`lib/selftest.js`（见 `scripts/build.mjs`）。
 *
 * @module dsh-terminal-plugin/src/selftest
 */

import * as configModule from './config.js'
import * as shellModule from './shell.js'
import * as cwdModule from './cwd.js'
import * as protocolModule from './protocol.js'
import * as ptyModule from './pty.js'
import * as registryModule from './registry.js'
import * as indexModule from './index.js'
import * as wireModule from './wire.js'
import * as stylesModule from './client/styles.js'
import * as frameInsetModule from './client/frame-inset.js'
import * as stateModule from './client/state.js'
import * as linkModule from './client/link-provider.js'
import * as clipboardModule from './client/clipboard.js'

// ── 配置 ────────────────────────────────────────────────────────────────────
/** @see ./config.ts */
export const clampDimension = configModule.clampDimension
/** @see ./config.ts */
export const normalizePrefix = configModule.normalizePrefix

// ── shell ───────────────────────────────────────────────────────────────────
/** @see ./shell.ts */
export const resolveShell = shellModule.resolveShell
/** @see ./shell.ts */
export const findOnPath = shellModule.findOnPath
/** @see ./shell.ts */
export const terminalEnv = shellModule.terminalEnv
/** @see ./shell.ts */
export const expandCwdToken = shellModule.expandCwdToken

// ── 工作目录 ────────────────────────────────────────────────────────────────
/** @see ./cwd.ts */
export const usableDirectory = cwdModule.usableDirectory
/** @see ./cwd.ts */
export const resolveWorkingDirectory = cwdModule.resolveWorkingDirectory
/** @see ./cwd.ts */
export const workspacePathForSession = cwdModule.workspacePathForSession

// ── 线路协议 ────────────────────────────────────────────────────────────────
/** @see ./protocol.ts */
export const extractOscTitle = protocolModule.extractOscTitle

// ── 终端会话与注册表 ────────────────────────────────────────────────────────
/** @see ./pty.ts */
export const PtySession = ptyModule.PtySession
/** @see ./registry.ts */
export const TerminalRegistry = registryModule.TerminalRegistry
/** @see ./registry.ts */
export const TerminalLimitError = registryModule.TerminalLimitError
/** @see ./wire.ts */
export const registerTerminalWire = wireModule.registerTerminalWire
/** @see ./wire.ts */
export const wireDefaults = wireModule.wireDefaults
/** @see ./index.ts */
export const isLoopbackAuthority = indexModule.isLoopbackAuthority

// ── 客户端纯常量 ────────────────────────────────────────────────────────────
/** @see ./client/styles.ts */
export const PANEL_CSS = stylesModule.PANEL_CSS
/** @see ./client/styles.ts */
export const PLUGIN_TAG = stylesModule.PLUGIN_TAG
/** @see ./client/styles.ts */
export const INSET_VARIABLE = stylesModule.INSET_VARIABLE
/** @see ./client/styles.ts */
export const LEFT_VARIABLE = stylesModule.LEFT_VARIABLE
/** @see ./client/styles.ts */
export const WIDTH_VARIABLE = stylesModule.WIDTH_VARIABLE

// ── 客户端布局 ──────────────────────────────────────────────────────────────
/** @see ./client/frame-inset.ts */
export const applyFrameInset = frameInsetModule.applyFrameInset
/** @see ./client/frame-inset.ts */
export const clearFrameInset = frameInsetModule.clearFrameInset
/** @see ./client/frame-inset.ts */
export const findFrame = frameInsetModule.findFrame
/** @see ./client/frame-inset.ts */
export const centerBox = frameInsetModule.centerBox
/** @see ./client/frame-inset.ts */
export const sidebarRightEdge = frameInsetModule.sidebarRightEdge

// ── 客户端面板状态 ──────────────────────────────────────────────────────────
/** @see ./client/state.ts */
export const createTerminalPanelStore = stateModule.createTerminalPanelStore
/** @see ./client/state.ts */
export const clampHeight = stateModule.clampHeight

// ── 客户端链接识别 ──────────────────────────────────────────────────────────
/** @see ./client/link-provider.ts */
export const detectLinks = linkModule.detectLinks
/** @see ./client/link-provider.ts */
export const openableUrl = linkModule.openableUrl
/** @see ./client/link-provider.ts */
export const fileUrlForPath = linkModule.fileUrlForPath
/** @see ./client/link-provider.ts */
export const createLinkProvider = linkModule.createLinkProvider
/** @see ./client/link-provider.ts */
export const attachLinkProvider = linkModule.attachLinkProvider
/** @see ./client/link-provider.ts */
export const isFollowClick = linkModule.isFollowClick
/** @see ./client/link-provider.ts */
export const readBufferLine = linkModule.readBufferLine

// ── 客户端剪贴板 ────────────────────────────────────────────────────────────
/** @see ./client/clipboard.ts */
export const attachContextMenu = clipboardModule.attachContextMenu
