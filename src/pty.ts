/**
 * 一个终端会话：包装 `ctx.subprocess.spawnTerminal` 返回的句柄，补上浏览器终端需要
 * 的东西 —— 有界回放缓冲、多订阅者扇出、尺寸记忆、退出状态。
 *
 * 关键设计：**不做终端栅格模拟**。回放是「把最近的原始输出按顺序重发」，由浏览器侧的
 * xterm 重新解析。这比在宿主里跑 `@xterm/headless` 简单一个数量级，也是 xterm 自己的
 * 标准用法（页面刷新后重放 scrollback 是它的常规场景）。代价是回放期间被丢掉的中间
 * 输出不可恢复 —— 由 `truncated` 标记如实告诉用户。
 *
 * 关于 resize：provider 的 seam（`SubprocessTerminalSpawnSpec.rows/cols`）没有暴露
 * resize 动词，而真实实现（node-pty）有。这里不绕开 seam 去拿 provider 的私有句柄，
 * 因为那会把「执行世界」的绑定（沙箱、Linux scope）一起绕掉。于是拖分隔条之后，
 * ConPTY 仍然按旧宽度换行、全屏程序不会重排。这是已知限制，写进 README。
 *
 * @module dsh-terminal-plugin/src/pty
 */

import type { SubprocessOutcome, SubprocessTerminalHandle } from '@deepseek-ai/dsh-subprocess'
import { extractOscTitle, type TerminalMeta } from './protocol.js'

/** 输出订阅者：宿主把 `data` 原样转发给它的 WebSocket。 */
export interface PtySink {
  /** 一段新输出（UTF-8 文本，已经过解码）。 */
  data(text: string): void
  /** 标签名变化。 */
  title(title: string): void
  /** 进程退出。 */
  exit(exitCode: number | null): void
}

/** 构造一个终端会话所需的一切。 */
export interface PtySessionOptions {
  /** 宿主分配的不透明 id。 */
  id: string
  /** 人类可读的默认标签名。 */
  name: string
  /** 已经启动好的 provider 句柄。 */
  handle: SubprocessTerminalHandle
  /** 初始列数与行数。 */
  cols: number
  rows: number
  /** 回放缓冲上限（字节）。 */
  scrollbackBytes: number
}

/** 一帧回放内容与它的完整度。 */
export interface PlaybackFrame {
  /** 可回放的输出（超限时是尾部）。 */
  text: string
  /** 是否因为超过上限丢了开头。 */
  truncated: boolean
}

/**
 * 终端会话。
 *
 * 生命周期：`TerminalRegistry` 创建它，`close()` 或 provider 报告退出后它进入
 * `exited` 状态；退出后仍可回放缓冲，直到注册表把它清掉。
 */
export class PtySession {
  /** 宿主分配的不透明 id。 */
  readonly id: string
  /** PTY 顶层进程 id。 */
  readonly pid: number
  /** 创建时刻。 */
  readonly createdAt: number

  private name: string
  private cols: number
  private rows: number
  private exitCode: number | null = null
  private closed = false
  private readonly scrollbackBytes: number
  private readonly handle: SubprocessTerminalHandle
  private readonly sinks = new Set<PtySink>()
  /** 分块保存的输出，`chunks[0]` 最早；总量受 `scrollbackBytes` 约束。 */
  private chunks: string[] = []
  private bytes = 0
  /** 从头丢掉的字节数（>0 表示回放不完整）。 */
  private droppedBytes = 0
  private readonly decoder = new TextDecoder('utf-8')

  /**
   * @param options - id、名字、provider 句柄、初始尺寸与缓冲上限。
   */
  constructor(options: PtySessionOptions) {
    this.id = options.id
    this.name = options.name
    this.handle = options.handle
    this.cols = options.cols
    this.rows = options.rows
    this.pid = options.handle.pid
    this.scrollbackBytes = Math.max(1024, options.scrollbackBytes)
    this.createdAt = Date.now()
  }

  /** 当前对外可见的状态。 */
  meta(): TerminalMeta {
    return {
      id: this.id,
      name: this.name,
      pid: this.pid,
      state: this.closed ? 'exited' : 'running',
      exitCode: this.exitCode,
      cols: this.cols,
      rows: this.rows,
      createdAt: this.createdAt,
    }
  }

  /** 是否已经结束（进程退出或已被主动关闭）。 */
  get exited(): boolean {
    return this.closed
  }

  /**
   * 订阅输出。
   *
   * @param sink - 接收 data/title/exit 的订阅者。
   * @returns 取消订阅的函数（`detach` 即可）。
   */
  attach(sink: PtySink): () => void {
    this.sinks.add(sink)
    return () => { this.sinks.delete(sink) }
  }

  /** 当前的回放内容。 */
  playback(): PlaybackFrame {
    return { text: this.chunks.join(''), truncated: this.droppedBytes > 0 }
  }

  /**
   * 把一段文本写到终端 stdin。
   * @param data - 原样写入的 UTF-8 文本（不做换行转换）。
   */
  write(data: string): void {
    if (this.closed || data.length === 0) return
    void this.handle.write(data).catch(() => { /* 句柄已消失：退出路径会通知所有订阅者 */ })
  }

  /**
   * 记住新尺寸。
   *
   * 只用于回放元数据（`hello` 里回给客户端的 cols/rows）。真正的 PTY 尺寸改不了，
   * 原因见模块文档。
   *
   * @param cols - 新的列数。
   * @param rows - 新的行数。
   */
  resize(cols: number, rows: number): void {
    if (this.closed) return
    this.cols = cols
    this.rows = rows
  }

  /**
   * 开始跟随 provider 的输出流：喂缓冲、解析标题、扇出。
   *
   * 由 `TerminalRegistry.create` 调用一次；调用方不需要 await 它。
   */
  start(): void {
    this.handle.output.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true })
      if (text.length > 0) this.push(text)
    })
    this.handle.output.on('end', () => {
      const tail = this.decoder.decode()
      if (tail.length > 0) this.push(tail)
      this.settle(null)
    })
    this.handle.output.on('error', () => { this.settle(null) })
    void this.handle.done.then(
      (outcome: SubprocessOutcome) => { this.settle(outcome.exitCode ?? null) },
      () => { this.settle(null) },
    )
  }

  /**
   * 主动关闭：等 provider 把整个进程树收干净。
   * @returns 清理完成（幂等，重复调用直接返回）。
   */
  async close(): Promise<void> {
    if (this.closed) return
    try {
      await this.handle.terminate()
    } catch { /* 已经死透的句柄会在这里报错，不影响清理 */ }
    this.settle(this.exitCode)
  }

  /** 追加一段输出：更新缓冲、解析标题、扇出。 */
  private push(text: string): void {
    this.chunks.push(text)
    this.bytes += byteLength(text)
    while (this.bytes > this.scrollbackBytes && this.chunks.length > 1) {
      const dropped = this.chunks.shift()
      if (dropped === undefined) break
      const size = byteLength(dropped)
      this.bytes -= size
      this.droppedBytes += size
    }
    const title = extractOscTitle(text)
    if (title !== null && title !== this.name) {
      this.name = title
      for (const sink of this.sinks) sink.title(title)
    }
    for (const sink of this.sinks) sink.data(text)
  }

  /** 一次性收尾：标记退出、通知所有订阅者。 */
  private settle(exitCode: number | null): void {
    if (this.closed) return
    this.closed = true
    this.exitCode = exitCode
    for (const sink of this.sinks) sink.exit(exitCode)
    this.sinks.clear()
  }
}

/** UTF-8 字节数（`Buffer` 在 Node 里总是可用）。 */
function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8')
}
