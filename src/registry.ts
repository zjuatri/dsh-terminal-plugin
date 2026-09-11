/**
 * 终端会话注册表：负责「创建 / 查询 / 关闭 / 批量回收」，以及容量上限。
 *
 * 所有平台相关的决策都在构造时定死（shell 绝对路径、默认工作目录、尺寸），
 * `spawn` 是可注入的，因此测试不需要真起 PTY。
 *
 * @module dsh-terminal-plugin/src/registry
 */

import type { SubprocessTerminalHandle, SubprocessTerminalSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type { TerminalMeta } from './protocol.js'
import { PtySession, type PtySink } from './pty.js'

/** 一次创建请求（工作目录已解析、尺寸已夹紧）。 */
export interface CreateTerminalInput {
  /** 已经过校验的工作目录；`undefined` 表示用注册表的默认值。 */
  cwd?: string | undefined
  /** 初始列数。 */
  cols: number
  /** 初始行数。 */
  rows: number
  /** 可选标签名。 */
  name?: string | undefined
}

/** 容量上限被触及时抛出的错误（HTTP 层据此回 409）。 */
export class TerminalLimitError extends Error {
  /** 上限值，用于给用户一句人话。 */
  readonly limit: number

  /**
   * @param limit - 允许同时存在的终端数。
   */
  constructor(limit: number) {
    super(`同时最多 ${String(limit)} 个终端`)
    this.name = 'TerminalLimitError'
    this.limit = limit
  }
}

/** 注册表构造参数。 */
export interface TerminalRegistryOptions {
  /** 启动一个真终端；生产环境就是 `ctx.subprocess.spawnTerminal`。 */
  spawn(spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle>
  /** shell 的绝对路径与参数（`argv[0]` 是程序本身）。 */
  argv: readonly string[]
  /** 默认工作目录。 */
  cwd: string
  /** 额外环境变量（在 provider 的环境清洗之后合并）。 */
  env: Record<string, string>
  /** 初始尺寸。 */
  rows: number
  cols: number
  /** 每个终端的回放缓冲上限（字节）。 */
  scrollbackBytes: number
  /** 同时存在的终端上限。 */
  maxTerminals: number
  /** TERM→KILL 的清理宽限期。 @default 3000 */
  graceMs?: number
  /** 终端启动失败时给上层看的原因。 */
  onWarn?(message: string): void
}

/**
 * 终端注册表。
 *
 * 生命周期由调用方的 `ctx.effect` 负责：dispose 时 `closeAll()` 等所有终端静默。
 */
export class TerminalRegistry {
  /** id → 会话。 */
  private readonly sessions = new Map<string, PtySession>()
  /** 单调递增的编号，用于默认标签名 `终端 N`。 */
  private sequence = 0
  private disposed = false
  private readonly opening = new Set<Promise<unknown>>()
  private readonly options: TerminalRegistryOptions
  private readonly abort = new AbortController()

  /**
   * @param options - spawn 注入点与全部默认值。
   */
  constructor(options: TerminalRegistryOptions) {
    this.options = options
  }

  /** 当前所有终端的状态（按创建时间排序）。 */
  list(): TerminalMeta[] {
    return [...this.sessions.values()]
      .sort((left, right) => left.createdAt - right.createdAt)
      .map(session => session.meta())
  }

  /** 取一个会话；不存在时 undefined。 */
  get(id: string): PtySession | undefined {
    return this.sessions.get(id)
  }

  /**
   * 创建一个终端。
   *
   * @param input - 已解析的工作目录、已夹紧的尺寸与可选标签名。
   * @returns 新会话。
   * @throws {TerminalLimitError} 超过上限时；`spawn` 失败时原样抛出 provider 的错误。
   */
  async create(input: CreateTerminalInput): Promise<PtySession> {
    if (this.disposed) throw new Error('dsh-terminal-plugin: 插件已卸载，不能再创建终端')
    if (this.sessions.size + this.opening.size >= this.options.maxTerminals) {
      throw new TerminalLimitError(this.options.maxTerminals)
    }
    const id = `t${String(Date.now().toString(36))}-${String((this.sequence += 1))}`
    const name = input.name !== undefined && input.name.trim().length > 0
      ? input.name.trim()
      : `终端 ${String(this.sequence)}`
    const task = this.options.spawn({
      argv: [...this.options.argv],
      cwd: input.cwd ?? this.options.cwd,
      env: { ...this.options.env },
      rows: input.rows,
      cols: input.cols,
      graceMs: this.options.graceMs ?? 3000,
      signal: this.abort.signal,
    })
    this.opening.add(task)
    try {
      const handle = await task
      const session = new PtySession({
        id,
        name,
        handle,
        cols: input.cols,
        rows: input.rows,
        scrollbackBytes: this.options.scrollbackBytes,
      })
      this.sessions.set(id, session)
      session.start()
      // provider 已经退出（例如 shell 立刻报错）时不要留下注册表里的僵尸条目。
      if (session.exited) this.options.onWarn?.(`dsh-terminal-plugin: ${id} 在启动后立刻退出`)
      return session
    } finally {
      this.opening.delete(task)
    }
  }

  /**
   * 关闭并移除一个终端。
   *
   * @param id - 终端 id。
   * @returns 关掉了返回 true；本来就不存在返回 false。
   */
  async close(id: string): Promise<boolean> {
    const session = this.sessions.get(id)
    if (session === undefined) return false
    this.sessions.delete(id)
    await session.close()
    return true
  }

  /**
   * 把所有终端收干净（幂等）。
   * @returns 全部静默之后。
   */
  async closeAll(): Promise<void> {
    this.disposed = true
    this.abort.abort()
    const pending = [...this.opening]
    this.opening.clear()
    await Promise.allSettled(pending)
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
    await Promise.allSettled(sessions.map(session => session.close()))
  }

  /**
   * 把一个 WebSocket 订阅者挂到某个终端上。
   *
   * @param id - 终端 id。
   * @param sink - 输出订阅者。
   * @returns 取消订阅的函数；终端不存在时返回 null。
   */
  subscribe(id: string, sink: PtySink): (() => void) | null {
    const session = this.sessions.get(id)
    if (session === undefined) return null
    return session.attach(sink)
  }
}
