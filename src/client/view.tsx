/**
 * 一个终端画面：xterm 实例 + 到宿主的连接。
 *
 * 每个终端一个组件、一个 xterm 实例、一条 WebSocket。**同一个终端可能被渲染两次**是
 * 常态：挂在 `shell.overlay` 里的面板正文与挂在 `conversation.input.left` 里的切换按钮
 * 分属两个插槽（两个 React 子树），因此每个子树各持一个 store、各有一份终端画面。
 * 同一个 PTY 被多条连接 attach 是服务端明确支持的（注册表的多订阅者扇出），两边内容
 * 一致，尺寸各按自己的容器算。
 *
 * 尺寸：`ResizeObserver` 观察自己的容器（拖分隔条只改容器尺寸、不触发 window resize），
 * 节流后 `fit()` 一次，把新的 cols/rows 报给宿主。
 *
 * @module dsh-terminal-plugin/src/client/view
 */

import { h, useEffect, useRef, useState } from './react.js'
import { TerminalConnection, type ConnectionState } from './pty-client.js'
import { currentXtermTheme, observeTheme, type XtermTheme } from './theme.js'
import { loadXterm, type FitAddonLike, type XtermTerminal } from './xterm-loader.js'
import { attachLinkProvider } from './link-provider.js'
import type { Translate } from './text.js'

/** 一个终端画面的 props。 */
export interface TerminalViewProps {
  /** 终端 id。 */
  terminalId: string
  /** 是否是当前选中的终端（只有选中的参与布局与自动聚焦）。 */
  active: boolean
  /** 父面板是否展开。 */
  visible: boolean
  /** 已绑定的翻译函数。 */
  t: Translate
  /** 终端进程退出。 */
  onExit(exitCode: number | null): void
  /** shell 报告的标题。 */
  onTitle(title: string): void
  /** 有新输出。 */
  onOutput(): void
}

/** 渲染器与连接都就绪之前的状态。 */
type Phase = 'loading' | 'ready' | 'error'

/** 面板内的字体栈：等宽字体优先，中文回退交给系统。 */
const FONT_FAMILY = "'Cascadia Mono','Cascadia Code',Consolas,'Courier New','Microsoft YaHei UI',monospace"
/** 字号（px）。 */
const FONT_SIZE = 12.5
/** 终端回滚行数。 */
const SCROLLBACK = 5000
/** 尺寸上报节流。 */
const RESIZE_THROTTLE_MS = 150

/**
 * 一个终端画面。
 *
 * @param props - 终端 id、激活状态与回调。
 * @returns 一个占满父容器的元素。
 */
export function TerminalView(props: TerminalViewProps): unknown {
  const { terminalId, active, visible, t, onExit, onTitle, onOutput } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<XtermTerminal | null>(null)
  const fitRef = useRef<FitAddonLike | null>(null)
  const connRef = useRef<TerminalConnection | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorText, setErrorText] = useState('')
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [attempt, setAttempt] = useState(0)

  // 回调放进 ref，这样重建渲染器的 effect 不必依赖父组件传下来的函数身份。
  const callbacks = useRef({ onExit, onTitle, onOutput, t })
  callbacks.current = { onExit, onTitle, onOutput, t }

  // ── 渲染器 + 连接（每次重试 attempt 变一次） ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (container === null) return undefined
    let disposed = false
    let teardown: (() => void) | null = null
    setPhase('loading')

    void (async () => {
      let module: Awaited<ReturnType<typeof loadXterm>>
      try {
        module = await loadXterm()
      } catch (error) {
        if (disposed) return
        setPhase('error')
        setErrorText(error instanceof Error ? error.message : String(error))
        return
      }
      if (disposed) return

      const terminal = new module.Terminal({
        cursorBlink: true,
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        scrollback: SCROLLBACK,
        allowProposedApi: true,
        theme: currentXtermTheme(),
      })
      const fit = new module.FitAddon()
      terminal.loadAddon(fit)
      terminal.open(container)
      termRef.current = terminal
      fitRef.current = fit
      try {
        fit.fit()
      } catch {
        // 容器尺寸还没量出来时会抛；下一次 ResizeObserver 会补上。
      }

      const connection = new TerminalConnection(terminalId)
      connRef.current = connection
      const dataSub = terminal.onData((data: string) => { connection.write(data) })
      const titleSub = terminal.onTitleChange((title: string) => { callbacks.current.onTitle(title) })

      connection.attach({
        ready: (meta, buffer, truncated) => {
          if (truncated) terminal.writeln(`\u001b[2m${callbacks.current.t('panel.truncated')}\u001b[0m`)
          if (buffer.length > 0) terminal.write(buffer)
          if (meta.state === 'exited') callbacks.current.onExit(meta.exitCode)
        },
        data: (text) => {
          terminal.write(text)
          callbacks.current.onOutput()
        },
        title: (title) => { callbacks.current.onTitle(title) },
        exit: (exitCode) => {
          terminal.writeln('')
          terminal.writeln(`\u001b[2m${callbacks.current.t('panel.exited', { code: exitCode ?? '?' })}\u001b[0m`)
          callbacks.current.onExit(exitCode)
        },
        state: (state) => { if (!disposed) setConnection(state) },
        error: (message) => { terminal.writeln(`\u001b[31m${message}\u001b[0m`) },
      }, { cols: terminal.cols, rows: terminal.rows })

      if (!disposed) setPhase('ready')

      // 尺寸跟随容器：拖分隔条不会触发 window resize，所以必须观察容器本身。
      let timer: ReturnType<typeof setTimeout> | null = null
      const observer = new ResizeObserver(() => {
        if (timer !== null) return
        timer = setTimeout(() => {
          timer = null
          if (disposed) return
          try {
            fit.fit()
            connection.resize({ cols: terminal.cols, rows: terminal.rows })
          } catch { /* 隐藏中的容器量不出尺寸，忽略 */ }
        }, RESIZE_THROTTLE_MS)
      })
      observer.observe(container)

      // 主题跟随：令牌写在 body 的内联样式上，变了就更新 xterm 主题。
      const stopTheme = observeTheme(() => {
        const theme: XtermTheme = currentXtermTheme()
        terminal.options.theme = theme
      })

      // 链接识别：Ctrl/Cmd + 点击打开输出里的 URL / 文件路径。
      const detachLinks = attachLinkProvider(terminal, {
        readLine: (lineNumber) => {
          const line = terminal.buffer?.active?.getLine?.(lineNumber)
          return line?.translateToString?.(true)
        },
      })

      teardown = () => {
        observer.disconnect()
        if (timer !== null) clearTimeout(timer)
        stopTheme()
        detachLinks()
        dataSub.dispose()
        titleSub.dispose()
      }
    })()

    return () => {
      disposed = true
      teardown?.()
      connRef.current?.close()
      connRef.current = null
      termRef.current?.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [terminalId, attempt])

  // ── 激活时聚焦，并补一次 fit（从 display:none 切回来时尺寸才量得准） ──────
  useEffect(() => {
    if (!active || !visible || phase !== 'ready') return undefined
    const timer = setTimeout(() => {
      try {
        fitRef.current?.fit()
      } catch { /* 同上 */ }
      termRef.current?.focus()
    }, 30)
    return () => { clearTimeout(timer) }
  }, [active, visible, phase])

  if (phase === 'error') {
    return h('div', { className: 'dsh-term-view', 'data-active': active ? 'true' : 'false' }, h('div', { className: 'dsh-term-note', 'data-tone': 'error' }, [
      h('span', { key: 'msg' }, `${t('panel.loadFailed')}：${errorText}`),
      h('button', {
        key: 'retry',
        type: 'button',
        className: 'dsh-term-btn',
        onClick: () => { setAttempt(value => value + 1) },
      }, t('panel.loadRetry')),
    ]))
  }

  return h('div', {
    className: 'dsh-term-view',
    'data-active': active ? 'true' : 'false',
    'data-terminal-id': terminalId,
    'data-connection': connection,
  }, [
    phase === 'loading'
      ? h('div', { key: 'loading', className: 'dsh-term-note' }, t('panel.loading'))
      : null,
    h('div', {
      key: 'mount',
      ref: containerRef,
      style: { height: '100%', width: '100%' },
    }),
  ])
}
