/**
 * dsh-terminal-plugin 宿主侧入口：给 DSH Web GUI 提供一个**真终端**的底部面板。
 *
 * 与产品自带终端的区别（这点决定了整个实现）：
 *
 * - `@deepseek-ai/dsh-terminal` 的 `ctx.terminals` 是**给 agent 用**的持久终端，会话被
 *   owner 围栏（一个会话只能被创建它的那个 agent 操作），人无法直接键入；它的输出是
 *   经过 sanitize 的文本，不是交互画面。
 * - 本插件要的是**给人用**的终端：和 VSCode 集成终端一样，PTY 直接连到一个 xterm 画面，
 *   人敲什么就是什么。因此这里不碰 `ctx.terminals`，只用它下面的那一层 ——
 *   `ctx.subprocess.spawnTerminal`（真 PTY，Windows 走 ConPTY）。
 *
 * 接线分两半：
 *
 * 1. `webServer` 就绪后注册 HTTP 路由（创建/列出/关闭、静态资源）与 WebSocket 升级路由。
 *    **必须用 `ctx.inject(['webServer'], …)` 等**，不能 `ctx.get('webServer')` 顺手探一下：
 *    插件可能排在 Web 服务器之前被应用，那时服务还不存在，探到 `undefined`；而 fiber 跑完
 *    就再没人回头补跑一次，结果是所有路由整批缺失且没有任何报错。
 * 2. 注入一段引导脚本，把挂载前缀与资源版本告诉页面。
 *
 * 终端本身在 `ctx.effect` 里持有，卸载插件时等所有 PTY 及其进程树静默。
 *
 * @module dsh-terminal-plugin/src/index
 */

import type { Context } from '@deepseek-ai/cordis'
// 仅类型导入：激活 cordis 对 `ctx.webServer` / `ctx.subprocess` 的 Context 合并。
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-subprocess'
import { loadAssets } from './assets.js'
import { normalizePrefix, Config, type ResolvedConfig } from './config.js'
import { resolveWorkingDirectory, workspacePathForSession, type WorkspaceLike } from './cwd.js'
import { TerminalRegistry } from './registry.js'
import { resolveShell, terminalEnv, type ShellSpec } from './shell.js'
import { registerTerminalWire, wireDefaults } from './wire.js'

/** cordis 插件名，用于加载器诊断。 */
export const name = 'dsh-terminal-plugin'

/** 本插件的硬依赖：没有 Web 服务器就没有终端面板，没有 subprocess 就没有 PTY。 */
export const inject = ['webServer', 'subprocess']

// 重新导出 schemastery 的 `Config`：加载器用它校验 profile 配置并补齐默认值。
export { Config }
export type { Config as TerminalPluginConfig, ResolvedConfig } from './config.js'

/** `ctx.sessions` 里本插件用到的只读子集。 */
interface SessionCwdSource {
  /** 按 id 取一个会话；它的 `header.cwd` 就是创建时登记的工作目录。 */
  get?(id: string): { readonly header?: { readonly cwd?: string } } | undefined
  /** 列出全部会话（活着的那些）。 */
  list?(): readonly { readonly header?: { readonly cwd?: string } }[]
}

/** `ctx.workspaceRegistry` 里本插件用到的只读子集。 */
interface WorkspacePathSource {
  /** 全部工作区（`Workspace` 的 `path` 与 `sessionIds` 是只读字段）。 */
  list?(): readonly WorkspaceLike[]
}

/**
 * 读一个会话的工作目录。
 *
 * @param sessions - `ctx.sessions`（可缺省）。
 * @param sessionId - 客户端报上来的当前会话 id（可缺省）。
 * @returns cwd，读不到时 undefined。
 */
function readSessionCwd(sessions: SessionCwdSource | undefined, sessionId?: string): string | undefined {
  const fromHeader = (entry: { readonly header?: { readonly cwd?: string } } | undefined): string | undefined => {
    const cwd = entry?.header?.cwd
    return typeof cwd === 'string' && cwd.length > 0 ? cwd : undefined
  }
  // 1) 用户正在看的那个会话：唯一能区分「在哪个工作区」的信息。
  if (sessionId !== undefined && sessionId.length > 0) {
    const current = fromHeader(sessions?.get?.(sessionId))
    if (current !== undefined) return current
  }
  // 2) 退而求其次：任一活着的会话（多会话时顺序没有语义，但总比进程工作目录接近意图）。
  for (const entry of sessions?.list?.() ?? []) {
    const cwd = fromHeader(entry)
    if (cwd !== undefined) return cwd
  }
  return undefined
}

/**
 * 套用插件。
 *
 * @param ctx - 宿主上下文。
 * @param config - 已由加载器补齐默认值的配置。
 */
export function apply(ctx: Context, config: Config): void {
  // 安全性：cordis 已在 `apply` 运行之前用导出的 `Config` schema 校验原始 profile 配置
  // 并补齐全部默认值，因此运行时对象恰好带有 `ResolvedConfig` 声明的字段。
  const resolved = config as ResolvedConfig
  const prefix = normalizePrefix(resolved.mountPrefix)
  const logger = ctx.logger('dsh-terminal-plugin')

  // shell 探测放在这里，而不是每次创建终端时：探测失败要在插件加载时就喊出来，
  // 而不是等用户按下 Ctrl+` 才收到一个 500。
  const shell = resolveShell({ shellPath: resolved.shellPath, shellArgs: resolved.shellArgs })

  /**
   * 取某个会话所属工作区的路径 —— 新终端的工作目录。
   *
   * 依据优先级：
   *
   * 1. **工作区账目**：`ctx.workspaceRegistry.list()` 里哪个工作区的 `sessionIds` 含这个
   *    会话，它的 `path` 就是答案。这是唯一能区分「用户在哪个工作区」的信息 —— 一个进程里
   *    会同时存在多个会话（每个工作区一条），`ctx.sessions.list()` 的顺序没有语义。
   * 2. **会话头 + 路径比对**：账目还没建立时，拿 `ctx.sessions.get(id).header.cwd` 与工作区
   *    路径比对。
   * 3. **任一活着的会话的 cwd**：工作区服务缺席时退一步，至少比进程工作目录接近用户意图。
   *
   * 三者都可能缺席（无头组合、会话已被回收），所以每个字段都是可选的。
   *
   * @param current - 已注入 webServer 的上下文（`sessions`/`workspaceRegistry` 从它可选读取）。
   * @param sessionId - 客户端报上来的当前会话 id（可缺省）。
   * @returns 用于 `resolveWorkingDirectory` 的候选值。
   */
  function readFacts(current: Context, sessionId?: string): { sessionCwd?: string; workspacePath?: string } {
    const sessions = current.get('sessions') as SessionCwdSource | undefined
    const workspaces = current.get('workspaceRegistry') as WorkspacePathSource | undefined
    const workspacePath = workspacePathForSession(
      workspaces?.list?.(),
      sessions?.get === undefined ? undefined : id => sessions.get?.(id),
      sessionId,
    )
    const sessionCwd = workspacePath !== undefined ? undefined : readSessionCwd(sessions, sessionId)
    return {
      ...(sessionCwd === undefined ? {} : { sessionCwd }),
      ...(workspacePath === undefined ? {} : { workspacePath }),
    }
  }

  const registry = new TerminalRegistry({
    spawn: spec => ctx.subprocess.spawnTerminal(spec),
    argv: [shell.path, ...shell.args],
    env: terminalEnvFor(shell, resolved),
    rows: resolved.rows,
    cols: resolved.cols,
    scrollbackBytes: resolved.scrollbackBytes,
    maxTerminals: resolved.maxTerminals,
    onWarn: message => { logger.warn(message) },
  })

  // 终端生命周期绑定在插件 fiber 上：卸载时 closeAll() 等所有 PTY 与其进程树静默。
  ctx.effect(function* () {
    yield () => { void registry.closeAll() }
  }, 'dsh-terminal-plugin: 终端注册表')

  // HTTP + WebSocket：必须等 webServer 真正就绪（理由见模块文档）。
  ctx.inject(['webServer'], (scoped: Context) => {
    const assets = loadAssets()
    const defaults = wireDefaults(resolved)
    const wire = registerTerminalWire(scoped.webServer, {
      prefix,
      registry,
      assets,
      defaultCols: defaults.defaultCols,
      defaultRows: defaults.defaultRows,
      // 每次创建终端时现算工作目录：用户切了会话/工作区之后新终端应该落在新目录里。
      resolveCwd: sessionId => resolveWorkingDirectory({
        configured: resolved.cwd,
        processCwd: process.cwd(),
        ...readFacts(scoped, sessionId),
      }),
      reject: request => rejectRequest(scoped, request),
      warn: message => { scoped.logger('dsh-terminal-plugin').warn(message) },
    })
    const untap = scoped.webServer.tapIndex(html => injectBootstrap(html, wire.bootstrapTag()))
    return () => {
      untap()
      void wire.dispose()
    }
  })
}

/** 把配置里的 `env` 合进方言默认值（用户显式配置的优先）。 */
function terminalEnvFor(shell: ShellSpec, config: ResolvedConfig): Record<string, string> {
  return { ...terminalEnv(shell), ...config.env }
}

/**
 * 请求认证：优先用产品自己的 Host/Origin 栅栏 + 浏览器 Cookie。
 *
 * `ctx.connection` 缺席时（例如没有 Web 客户端包的组合）退回「只接受回环 Host」——
 * 明确比默认放行安全，也比默认拒绝可用。
 *
 * @param ctx - 已注入 webServer 的上下文（`connection` 从中可选读取）。
 * @param request - 待判定的请求（HTTP 与升级握手一致，判定只看 headers）。
 * @returns 401/403 表示拒绝，undefined 表示放行。
 */
function rejectRequest(
  ctx: Context,
  request: { headers: Record<string, string | string[] | undefined> },
): 401 | 403 | undefined {
  const connection = ctx.get('connection') as {
    requestRejection(input: { headers: unknown }): 401 | 403 | undefined
  } | undefined
  if (connection !== undefined) return connection.requestRejection({ headers: request.headers })
  const host = request.headers.host
  const authority = typeof host === 'string' ? host : ''
  return isLoopbackAuthority(authority) ? undefined : 403
}

/** 只接受回环 authority 的降级判定。 */
export function isLoopbackAuthority(authority: string): boolean {
  const withoutPort = authority.startsWith('[')
    ? authority.slice(0, authority.indexOf(']') + 1)
    : authority.split(':')[0] ?? ''
  const host = withoutPort.replace(/^\[|\]$/gu, '').toLowerCase()
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
}

/** 把引导脚本插到 `</head>` 之前（`tag` 为空时原样返回）。 */
function injectBootstrap(html: string, tag: string): string {
  if (tag.length === 0) return html
  const at = html.lastIndexOf('</head>')
  if (at < 0) return `${tag}\n${html}`
  return `${html.slice(0, at)}${tag}\n${html.slice(at)}`
}
