/**
 * 终端的线路层：HTTP 路由（创建/列出/关闭）+ WebSocket 升级（attach 一个终端）。
 *
 * 路径全部挂在一个前缀下（默认 `/dsh-terminal`），避免和产品自己的路由表抢位置。
 * 前缀路由自己做子路由分发，因为 `webServer.register` 只支持「精确」与「最长前缀」
 * 两种匹配，把四五个端点全注册成精确路由反而更难维护。
 *
 * 认证：每个请求（含升级握手）都先过调用方给的 `reject`。生产环境那是
 * `ctx.connection.requestRejection`，也就是产品自己给 `/api` 用的那套
 * 「Host/Origin 栅栏 + 浏览器 Cookie」，因此本插件在 `0.0.0.0` 部署下不会变成
 * 一个裸的远程 shell。
 *
 * @module dsh-terminal-plugin/src/wire
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import type { AssetService } from './assets.js'
import { clampDimension, type ResolvedConfig } from './config.js'
import type { TerminalRegistry } from './registry.js'
import { TerminalLimitError } from './registry.js'
import {
  BOOTSTRAP_GLOBAL,
  type ClientFrame,
  type CreateTerminalRequest,
  type ErrorResponse,
  type PanelBootstrap,
  type ServerFrame,
} from './protocol.js'
import { usableDirectory } from './cwd.js'

/** 尺寸夹紧范围：下界是「能用」，上界挡住离谱请求（xterm 自己也支持到几千列）。 */
const COLS_RANGE = { min: 20, max: 1000 } as const
const ROWS_RANGE = { min: 4, max: 500 } as const

/** 一次请求的认证判定：返回 HTTP 状态码表示拒绝，undefined 表示放行。 */
export type RequestReject = (request: IncomingMessage) => 401 | 403 | undefined

/** 挂上线路层所需的一切。 */
export interface TerminalWireOptions {
  /** 路径前缀，形如 `/dsh-terminal`（无尾斜杠）。 */
  prefix: string
  /** 终端注册表。 */
  registry: TerminalRegistry
  /** 静态资源（xterm.js）。 */
  assets: AssetService
  /**
   * 现算新终端的工作目录。
   *
   * 是函数而不是值：用户切了会话或工作区之后，下一个终端应该落在新目录里，而路由是
   * 在插件激活时一次性注册的。`sessionId` 是客户端报上来的「用户正在看哪个会话」，
   * 通常就是工作目录的来源；`undefined` 表示客户端没报，退回默认值。
   *
   * @param sessionId - 当前会话 id（可缺省）。
   * @returns 一个存在的绝对目录。
   */
  resolveCwd(sessionId?: string): string
  /** 初始尺寸（请求没带时用）。 */
  defaultCols: number
  /** 初始尺寸（请求没带时用）。 */
  defaultRows: number
  /** 认证判定。 */
  reject: RequestReject
  /** 回调式日志。 */
  warn(message: string): void
}

/** 注册后的句柄。 */
export interface TerminalWire {
  /**
   * 撤下所有路由与连接。
   * @returns disposer 完成之后。
   */
  dispose(): Promise<void>
  /** 注入到页面 `<head>` 的引导脚本（把挂载前缀与资源版本告诉客户端）。 */
  bootstrapTag(): string
}

/**
 * 注册 HTTP 路由与 WebSocket 升级路由。
 *
 * @param webServer - `ctx.webServer`（只用到 `register` 与 `registerUpgrade` 两个方法）。
 * @param options - 前缀、注册表、资源、认证与默认值。
 * @returns 可处置的线路句柄。
 */
export function registerTerminalWire(
  webServer: {
    register(route: { kind: 'exact' | 'prefix'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }): () => void
    registerUpgrade(route: { path: string; handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void> }): () => void
  },
  options: TerminalWireOptions,
): TerminalWire {
  const { prefix, registry, assets, reject } = options
  const wss = new WebSocketServer({ noServer: true })
  const sockets = new Set<WebSocket>()

  const disposers = [
    webServer.register({
      kind: 'prefix',
      path: prefix,
      handler: async (req, res) => { await handleHttp(req, res) },
    }),
    webServer.registerUpgrade({
      path: `${prefix}/ws`,
      handler: (req, socket, head) => {
        const rejection = reject(req)
        if (rejection !== undefined) {
          rejectUpgrade(socket, rejection)
          return
        }
        wss.handleUpgrade(req, socket, head, (client) => { acceptSocket(client) })
      },
    }),
  ]

  return {
    bootstrapTag(): string {
      const payload: PanelBootstrap = { mountPrefix: prefix, assetsRev: assets.rev }
      const json = JSON.stringify(payload).replace(/</gu, '\\u003c')
      return `<script>window.${BOOTSTRAP_GLOBAL}=${json}</script>`
    },
    async dispose(): Promise<void> {
      for (const dispose of disposers) dispose()
      for (const socket of sockets) socket.close(1001, 'plugin unloaded')
      sockets.clear()
      await new Promise<void>((resolve) => {
        wss.close(() => { resolve() })
      })
    },
  }

  /** 前缀下的子路由分发。 */
  async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rejection = reject(req)
    if (rejection !== undefined) return sendJson(res, rejection, { code: 'BAD_REQUEST', message: rejection === 401 ? 'unauthorized' : 'forbidden' })
    const url = new URL(req.url ?? '/', 'http://localhost')
    const rest = url.pathname.slice(prefix.length)
    const method = (req.method ?? 'GET').toUpperCase()

    if (rest === '/terminals' && method === 'GET') {
      return sendJson(res, 200, { terminals: registry.list() })
    }
    if (rest === '/terminals' && method === 'POST') {
      return await createTerminal(req, res)
    }
    if (rest.startsWith('/terminals/') && method === 'DELETE') {
      const id = decodeURIComponent(rest.slice('/terminals/'.length))
      const closed = await registry.close(id)
      if (!closed) return sendJson(res, 404, { code: 'NO_TERMINAL', message: `没有这个终端：${id}` } satisfies ErrorResponse)
      return sendJson(res, 200, { closed: id })
    }
    if (rest.startsWith('/assets/') && (method === 'GET' || method === 'HEAD')) {
      const name = decodeURIComponent(rest.slice('/assets/'.length))
      const asset = assets.get(name)
      if (asset === null) return sendJson(res, 404, { code: 'BAD_REQUEST', message: `没有这个资源：${name}` } satisfies ErrorResponse)
      res.writeHead(200, {
        'Content-Type': asset.type,
        'Content-Length': String(asset.body.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${assets.rev}"`,
      })
      res.end(method === 'HEAD' ? undefined : asset.body)
      return
    }
    return sendJson(res, 404, { code: 'BAD_REQUEST', message: `未知路径：${rest}` } satisfies ErrorResponse)
  }

  /** `POST /terminals`：校验 body、夹紧尺寸、创建。 */
  async function createTerminal(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let raw = ''
    for await (const chunk of req) {
      raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      if (raw.length > 64 * 1024) {
        return sendJson(res, 413, { code: 'BAD_REQUEST', message: '请求体过大' } satisfies ErrorResponse)
      }
    }
    let body: CreateTerminalRequest = {}
    if (raw.trim().length > 0) {
      try {
        body = JSON.parse(raw) as CreateTerminalRequest
      } catch {
        return sendJson(res, 400, { code: 'BAD_REQUEST', message: '请求体不是合法 JSON' } satisfies ErrorResponse)
      }
    }
    const cwd = usableDirectory(body.cwd) ?? options.resolveCwd(body.sessionId)
    try {
      const session = await registry.create({
        cwd,
        cols: clampDimension(body.cols, COLS_RANGE.min, COLS_RANGE.max, options.defaultCols),
        rows: clampDimension(body.rows, ROWS_RANGE.min, ROWS_RANGE.max, options.defaultRows),
        name: body.name,
      })
      return sendJson(res, 201, { terminal: session.meta() })
    } catch (error) {
      if (error instanceof TerminalLimitError) {
        return sendJson(res, 409, { code: 'TOO_MANY_TERMINALS', message: error.message, hint: error.message } satisfies ErrorResponse)
      }
      const message = error instanceof Error ? error.message : String(error)
      options.warn(`dsh-terminal-plugin: 创建终端失败：${message}`)
      return sendJson(res, 500, { code: 'SPAWN_FAILED', message } satisfies ErrorResponse)
    }
  }

  /** 一个 WebSocket 的生命周期：只 attach 一个终端。 */
  function acceptSocket(client: WebSocket): void {
    sockets.add(client)
    let detach: (() => void) | null = null
    const attached = new Set<string>()

    const send = (frame: ServerFrame): void => {
      if (client.readyState !== 1) return
      client.send(JSON.stringify(frame))
    }

    const dropAttachment = (): void => {
      detach?.()
      detach = null
      attached.clear()
    }

    client.on('message', (raw) => {
      let frame: ClientFrame
      try {
        frame = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as ClientFrame
      } catch {
        send({ type: 'error', code: 'BAD_REQUEST', message: '帧不是合法 JSON' })
        return
      }
      if (frame.type === 'attach') {
        dropAttachment()
        const session = registry.get(frame.terminalId)
        if (session === undefined) {
          send({ type: 'error', code: 'NO_TERMINAL', message: `没有这个终端：${frame.terminalId}` })
          return
        }
        session.resize(
          clampDimension(frame.cols, COLS_RANGE.min, COLS_RANGE.max, options.defaultCols),
          clampDimension(frame.rows, ROWS_RANGE.min, ROWS_RANGE.max, options.defaultRows),
        )
        const playback = session.playback()
        send({
          type: 'hello',
          terminal: session.meta(),
          buffer: playback.text,
          truncated: playback.truncated,
        })
        attached.add(session.id)
        detach = registry.subscribe(session.id, {
          data: (text) => { send({ type: 'output', terminalId: frame.terminalId, data: text }) },
          title: (title) => { send({ type: 'title', terminalId: frame.terminalId, title }) },
          exit: (exitCode) => { send({ type: 'exit', terminalId: frame.terminalId, exitCode }) },
        })
        return
      }
      if (!attached.has(frame.terminalId)) {
        send({ type: 'error', code: 'NO_TERMINAL', message: '请先 attach 再发消息' })
        return
      }
      const session = registry.get(frame.terminalId)
      if (session === undefined) {
        send({ type: 'error', code: 'NO_TERMINAL', message: `没有这个终端：${frame.terminalId}` })
        return
      }
      if (frame.type === 'write') session.write(frame.data)
      else if (frame.type === 'resize') {
        session.resize(
          clampDimension(frame.cols, COLS_RANGE.min, COLS_RANGE.max, options.defaultCols),
          clampDimension(frame.rows, ROWS_RANGE.min, ROWS_RANGE.max, options.defaultRows),
        )
      } else if (frame.type === 'detach') dropAttachment()
    })

    client.on('close', () => {
      dropAttachment()
      sockets.delete(client)
    })
    client.on('error', (error: Error) => {
      options.warn(`dsh-terminal-plugin: WebSocket 出错：${error.message}`)
      dropAttachment()
      sockets.delete(client)
    })
  }
}

/** 回写一个 HTTP 拒绝（升级握手阶段没有 `ServerResponse`，只能手写状态行）。 */
function rejectUpgrade(socket: Duplex, status: 401 | 403): void {
  const reason = status === 401 ? 'Unauthorized' : 'Forbidden'
  socket.write(`HTTP/1.1 ${String(status)} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.destroy()
}

/** JSON 响应。 */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

/** 给 `src/index.ts` 用的默认尺寸（范围常量只有这一份）。 */
export function wireDefaults(config: ResolvedConfig): { defaultCols: number; defaultRows: number } {
  return {
    defaultCols: clampDimension(config.cols, COLS_RANGE.min, COLS_RANGE.max, 80),
    defaultRows: clampDimension(config.rows, ROWS_RANGE.min, ROWS_RANGE.max, 24),
  }
}
