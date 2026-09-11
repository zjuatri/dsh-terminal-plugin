/**
 * 终端面板的线路协议：宿主（`src/wire.ts`）与浏览器（`src/client/pty-client.ts`）
 * 共用同一份声明，避免两端各写一遍判别联合而慢慢漂移。
 *
 * 一帧 = 一个 JSON 对象。文本帧而不是二进制：终端输出是 UTF-8 文本，JSON 字符串
 * 天然承载它（含控制字符，转义后仍是无损往返），两端都不必再做一层长度前缀。
 *
 * @module dsh-terminal-plugin/src/protocol
 */

/** 一个终端当前的可观察状态（宿主 → 客户端、HTTP 列表与 WS hello 共用）。 */
export interface TerminalMeta {
  /** 宿主分配的不透明 id。 */
  id: string
  /** 标签名；默认 `终端 N`，被 shell 的 OSC 标题覆盖后变成标题。 */
  name: string
  /** PTY 顶层进程 id。 */
  pid: number
  /** `running` 表示还活着，`exited` 表示进程已经结束。 */
  state: 'running' | 'exited'
  /** 进程退出码；`state === 'running'` 时为 null。 */
  exitCode: number | null
  /** 当前列数。 */
  cols: number
  /** 当前行数。 */
  rows: number
  /** 创建时刻（毫秒时间戳），用于排序。 */
  createdAt: number
}

/** 协议里用的错误码。 */
export type WireErrorCode = 'NO_TERMINAL' | 'TOO_MANY_TERMINALS' | 'SPAWN_FAILED' | 'BAD_REQUEST' | 'INTERNAL'

/** 客户端 → 服务端。 */
export type ClientFrame =
  | { readonly type: 'attach'; readonly terminalId: string; readonly cols: number; readonly rows: number }
  | { readonly type: 'detach'; readonly terminalId: string }
  | { readonly type: 'write'; readonly terminalId: string; readonly data: string }
  | { readonly type: 'resize'; readonly terminalId: string; readonly cols: number; readonly rows: number }

/** 服务端 → 客户端。 */
export type ServerFrame =
  | {
    readonly type: 'hello'
    /** attach 成功后的终端状态。 */
    readonly terminal: TerminalMeta
    /** 最近输出回放；`terminal.state === 'exited'` 时仍会带上尾部。 */
    readonly buffer: string
    /** 回放缓冲是否因为超过上限丢了开头。 */
    readonly truncated: boolean
  }
  | { readonly type: 'output'; readonly terminalId: string; readonly data: string }
  | { readonly type: 'title'; readonly terminalId: string; readonly title: string }
  | { readonly type: 'exit'; readonly terminalId: string; readonly exitCode: number | null }
  | { readonly type: 'error'; readonly code: WireErrorCode; readonly message: string }

/** 创建终端的 HTTP 请求体。 */
export interface CreateTerminalRequest {
  /** 请求的工作目录；宿主会做存在性与目录校验，非法时退回默认值。 */
  readonly cwd?: string
  /**
   * 用户当前正在看的会话 id。
   *
   * 新终端的工作目录优先取它：宿主拿它去 `ctx.sessions.get(id).header.cwd` 取那个会话的
   * 工作目录（也就是所属工作区的路径），所以「在 DC-new-org 工作区里开终端」就落在
   * `D:\desktop\repos\DC-new-org`。显式给了 `cwd` 时以 `cwd` 为准。
   */
  readonly sessionId?: string
  /** 初始列数。 */
  readonly cols?: number
  /** 初始行数。 */
  readonly rows?: number
  /** 可选的标签名。 */
  readonly name?: string
}

/** 创建终端的 HTTP 响应体。 */
export interface CreateTerminalResponse {
  readonly terminal: TerminalMeta
}

/** 列出终端的 HTTP 响应体。 */
export interface ListTerminalsResponse {
  readonly terminals: readonly TerminalMeta[]
}

/** HTTP 失败响应体。 */
export interface ErrorResponse {
  readonly code: WireErrorCode
  readonly message: string
  /** 可选的人话补充，例如「同时最多 20 个终端」。 */
  readonly hint?: string
}

/** 引导行注入到页面的全局名（客户端从这里读到挂载前缀与资产版本）。 */
export const BOOTSTRAP_GLOBAL = '__DSH_TERMINAL_PLUGIN__'

/** 引导行携带的宿主事实。 */
export interface PanelBootstrap {
  /** 本插件的路径前缀，例如 `/dsh-terminal`。 */
  readonly mountPrefix: string
  /** 资产内容版本（sha256 前 16 位），用于资源路由的长缓存。 */
  readonly assetsRev: string
}

/** 解析输出里的 OSC 标题序列，取最后一个非空标题。 */
export function extractOscTitle(chunk: string): string | null {
  // ESC ] 0 ; <title> BEL  或  ESC ] 2 ; <title> ESC \
  const pattern = /\u001b\](?:0|2);([^\u0007\u001b]*)(?:\u0007|\u001b\\)/gu
  let latest: string | null = null
  for (const match of chunk.matchAll(pattern)) {
    const title = match[1].trim()
    if (title.length > 0) latest = title
  }
  return latest
}
