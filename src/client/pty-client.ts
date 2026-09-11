/**
 * 一个终端到宿主的连接：WebSocket 上跑 `src/protocol.ts` 里那套帧。
 *
 * 每个终端一条独立连接（而不是一条连接多路复用）：背压天然隔离，一个终端的洪水输出
 * 不会拖住别的终端；重连逻辑也只需要管一条。
 *
 * 重连是有意义的：PTY 活在宿主进程里，页面刷新、网络抖动都不会杀掉它；重连后宿主会把
 * 回放缓冲发回来，于是用户的终端看上去「一直在那儿」。这也是本插件不追求实时同步
 * 终端栅格的原因 —— 回放由 xterm 自己重新解析。
 *
 * @module dsh-terminal-plugin/src/client/pty-client
 */

import { socketUrl } from './bootstrap.js'
import type { ClientFrame, ServerFrame, TerminalMeta } from '../protocol.js'

/** 连接状态。 */
export type ConnectionState = 'connecting' | 'open' | 'closed'

/** 一个终端连接的订阅者。 */
export interface ConnectionSink {
  /** attach 成功，宿主回放了缓冲。 */
  ready(meta: TerminalMeta, buffer: string, truncated: boolean): void
  /** 新输出。 */
  data(text: string): void
  /** shell 报告的标题（OSC 0/2）。 */
  title(title: string): void
  /** 终端进程退出。 */
  exit(exitCode: number | null): void
  /** 连接状态变化（用于标签上的小圆点与提示条）。 */
  state(state: ConnectionState): void
  /** 协议层或宿主返回的错误。 */
  error(message: string): void
}

/** 重连退避参数。 */
const RETRY_MIN_MS = 800
const RETRY_MAX_MS = 8000

/** 只取用得到的 WebSocket 常量，避免依赖全局对象的具体实现。 */
function isOpen(socket: WebSocket | null): boolean {
  return socket !== null && socket.readyState === 1
}

/**
 * 一个终端的连接。
 *
 * 生命周期：`attach(sink, size)` 建立（或复用）连接；`close()` 主动断开并停止重连。
 */
export class TerminalConnection {
  /** 目标终端 id。 */
  readonly terminalId: string

  private socket: WebSocket | null = null
  private sink: ConnectionSink | null = null
  private state: ConnectionState = 'closed'
  private cols = 80
  private rows = 24
  private retryDelay = RETRY_MIN_MS
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  /**
   * @param terminalId - 宿主分配的终端 id。
   */
  constructor(terminalId: string) {
    this.terminalId = terminalId
  }

  /** 当前连接状态。 */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * 绑定订阅者并建立连接（重复调用只换订阅者）。
   *
   * @param sink - 事件订阅者。
   * @param size - 终端当前的列数与行数。
   */
  attach(sink: ConnectionSink, size: { cols: number; rows: number }): void {
    this.sink = sink
    this.cols = size.cols
    this.rows = size.rows
    this.stopped = false
    if (isOpen(this.socket)) {
      this.sendAttach()
      return
    }
    this.connect()
  }

  /**
   * 把用户输入写到 PTY。
   * @param data - 原样发送的文本（含控制字符）。
   */
  write(data: string): void {
    this.send({ type: 'write', terminalId: this.terminalId, data })
  }

  /**
   * 上报新尺寸。
   *
   * 宿主目前只把它记进回放元数据（provider 的 seam 没有 resize 动词），所以这里不去
   * 纠结「一定送达」，只保证不因为断线而抛错。
   *
   * @param size - 新的列数与行数。
   */
  resize(size: { cols: number; rows: number }): void {
    if (size.cols === this.cols && size.rows === this.rows) return
    this.cols = size.cols
    this.rows = size.rows
    this.send({ type: 'resize', terminalId: this.terminalId, cols: size.cols, rows: size.rows })
  }

  /** 主动断开并停止重连（关闭标签时调用）。 */
  close(): void {
    this.stopped = true
    this.clearRetry()
    const socket = this.socket
    this.socket = null
    if (socket !== null) {
      try { socket.close(1000, 'client closed') } catch { /* 已经关了 */ }
    }
    this.setState('closed')
  }

  /** 建立一条连接。 */
  private connect(): void {
    this.setState('connecting')
    let socket: WebSocket
    try {
      socket = new WebSocket(socketUrl('/ws'))
    } catch (error) {
      this.sink?.error(error instanceof Error ? error.message : String(error))
      this.scheduleRetry()
      return
    }
    this.socket = socket
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return
      this.retryDelay = RETRY_MIN_MS
      this.setState('open')
      this.sendAttach()
    })
    socket.addEventListener('message', (event: MessageEvent) => {
      if (this.socket !== socket) return
      this.onFrame(event.data)
    })
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return
      this.socket = null
      this.setState('closed')
      this.scheduleRetry()
    })
    socket.addEventListener('error', () => {
      // 浏览器不给错误细节；`close` 一定会跟上，所以只记录状态。
      if (this.socket !== socket) return
      this.setState('closed')
    })
  }

  /** 发一帧 attach（带当前尺寸，宿主据此决定回放的元数据）。 */
  private sendAttach(): void {
    this.send({ type: 'attach', terminalId: this.terminalId, cols: this.cols, rows: this.rows })
  }

  /** 安排一次重连（退避到上限为止）。 */
  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer !== null) return
    const delay = this.retryDelay
    this.retryDelay = Math.min(RETRY_MAX_MS, Math.round(this.retryDelay * 1.6))
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.stopped) return
      this.connect()
    }, delay)
  }

  /** 清掉待执行的重连。 */
  private clearRetry(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  /** 发一帧客户端消息（未连上时静默丢弃：输入本来就该在断线时丢）。 */
  private send(frame: ClientFrame): void {
    if (!isOpen(this.socket)) return
    try {
      this.socket?.send(JSON.stringify(frame))
    } catch (error) {
      this.sink?.error(error instanceof Error ? error.message : String(error))
    }
  }

  /** 解析一帧服务端消息。 */
  private onFrame(raw: unknown): void {
    if (typeof raw !== 'string') return
    let frame: ServerFrame
    try {
      frame = JSON.parse(raw) as ServerFrame
    } catch {
      return
    }
    switch (frame.type) {
      case 'hello':
        this.sink?.ready(frame.terminal, frame.buffer, frame.truncated)
        return
      case 'output':
        this.sink?.data(frame.data)
        return
      case 'title':
        this.sink?.title(frame.title)
        return
      case 'exit':
        this.sink?.exit(frame.exitCode)
        return
      case 'error':
        this.sink?.error(frame.message)
        return
      default:
        return
    }
  }

  /** 更新状态并通知订阅者（相同状态不重复通知）。 */
  private setState(state: ConnectionState): void {
    if (this.state === state) return
    this.state = state
    this.sink?.state(state)
  }
}
