/**
 * 面板宿主：store、键盘入口、让位与几何，以及把可见部分拼起来。
 *
 * 打开/收起的语义（VSCode 的行为）：
 *
 * - **Ctrl+`** 切换；**Ctrl+Shift+`** 新建终端（面板收起时先展开再新建）。
 * - 面板收起不会杀掉终端：PTY 活在宿主进程里，`shell.overlay` 的注册也一直在，
 *   只是不渲染（`visible === false` 时返回 null），画面与连接都等着下一次展开。
 *
 * 几何：面板是「对话区下面的一条」。高度写进 `--dsh-terminal-inset`（由
 * `frame-inset.ts` 用来压缩中间列与右侧栏），左边缘写进 `--dsh-terminal-left`
 * （跟着左栏右边缘走，所以左栏收起或拖宽时面板自动跟着）。
 */

import { h, useCallback, useEffect, useRef, useSyncExternalStore } from './react.js'
import type { Translate } from './text.js'
import type { PanelSnapshot, TerminalPanelStore } from './state.js'
import { Notice, ResizeHandle, TabBar } from './panel-chrome.js'
import { TerminalView } from './view.js'
import { centerBox, onWindowEvent } from './frame-inset.js'
import { LEFT_VARIABLE, WIDTH_VARIABLE } from './styles.js'

/** 面板正文的 props。 */
export interface PanelHostProps {
  /** 面板 store。 */
  store: TerminalPanelStore
  /** 已绑定的翻译函数。 */
  t: Translate
  /** 订阅快照（由 `apply` 传入 `useSyncExternalStore(store.subscribe, store.getSnapshot)`）。 */
  useSnapshot(): PanelSnapshot
  /** 终端面板占用的高度变化时调用（`frame-inset` 用它压缩对话区）。 */
  onInsetChange(height: number): void
  /** shell 报告的标题。 */
  onTitle(id: string, title: string): void
  /** 有新输出。 */
  onOutput(id: string): void
}

/** 面板收起时留白为 0。 */
const HIDDEN_HEIGHT = 0

/**
 * 让面板始终对齐**中间对话区**（左边缘与宽度都跟着它）。
 *
 * 对话区的几何会因为「左栏收起/展开/拖分隔条」「右栏展开/收起」而变，而面板是
 * `position:fixed`，脱离网格后不会自己跟着走。三条触发路径都要覆盖：观察左栏、对话区、
 * 右栏与框架本身（收起与拖拽）、观察文档根（整体布局变化）、以及 window 的 resize。
 *
 * @returns 一个 ref 回调，挂到面板根元素上；元素出现时立刻测一次。
 */
function usePanelBox(): (element: HTMLElement | null) => void {
  const elementRef = useRef<HTMLElement | null>(null)
  const sync = useCallback(() => {
    const element = elementRef.current
    if (element === null) return
    const box = centerBox()
    element.style.left = `${String(box.left)}px`
    element.style.width = `${String(box.width)}px`
    document.documentElement.style.setProperty(LEFT_VARIABLE, `${String(box.left)}px`)
    document.documentElement.style.setProperty(WIDTH_VARIABLE, `${String(box.width)}px`)
  }, [])

  useEffect(() => {
    // 先同步一次：ref 回调可能早于布局稳定（例如刚好在侧边栏收起的那一帧）。
    sync()
    const observer = new ResizeObserver(sync)
    for (const node of document.querySelectorAll('div')) {
      if (/_sidebarCol\b/.test(node.className) || /_centerCol\b/.test(node.className) || /_rightbarCol\b/.test(node.className) || /_frame\b/.test(node.className)) {
        observer.observe(node)
      }
    }
    observer.observe(document.documentElement)
    const stopResize = onWindowEvent('resize', sync)
    return () => {
      observer.disconnect()
      stopResize()
      document.documentElement.style.removeProperty(LEFT_VARIABLE)
      document.documentElement.style.removeProperty(WIDTH_VARIABLE)
    }
  }, [sync])

  return useCallback((element: HTMLElement | null) => {
    elementRef.current = element
    if (element !== null) {
      const box = centerBox()
      element.style.left = `${String(box.left)}px`
      element.style.width = `${String(box.width)}px`
      document.documentElement.style.setProperty(LEFT_VARIABLE, `${String(box.left)}px`)
      document.documentElement.style.setProperty(WIDTH_VARIABLE, `${String(box.width)}px`)
    }
  }, [])
}

/**
 * 底部终端面板。
 *
 * @param props - store、翻译函数与三个回调。
 * @returns 面板元素（收起时为 null）。
 */
export function PanelHost(props: PanelHostProps): unknown {
  const { store, t, useSnapshot, onInsetChange, onTitle, onOutput } = props
  const snapshot = useSnapshot()
  const { visible, height, terminals, activeId, notice } = snapshot
  const panelRef = usePanelBox()

  // 快捷入口：捕获阶段监听，因此焦点在输入框或终端里也生效（VSCode 同样如此）。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey) return
      const isBackquote = event.key === '`' || event.code === 'Backquote'
      if (!isBackquote) return
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) {
        store.open()
        void store.create()
        return
      }
      const target = event.target as HTMLElement | null
      const showing = !visible
      store.toggle()
      // 展开时把焦点从输入框挪走：否则反引号会被当成普通字符打进草稿里。
      if (showing && target !== null && typeof target.blur === 'function') target.blur()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => { document.removeEventListener('keydown', onKeyDown, true) }
  }, [store, visible])

  // 与宿主对账一次：页面刷新后终端还在宿主里活着；对账完如果还是没有终端（首次使用、
  // 或宿主重启过），就自动建一个 —— 「打开面板」永远等于「有一个能用的终端」。
  const ensured = useRef(false)
  useEffect(() => {
    void store.refresh().then(() => {
      if (ensured.current) return
      ensured.current = true
      void store.ensureTerminal()
    })
  }, [store])

  // 高度 → 让位（压缩对话区的唯一入口）。
  useEffect(() => {
    onInsetChange(visible ? height : HIDDEN_HEIGHT)
  }, [visible, height, onInsetChange])

  if (!visible) return null

  const views = terminals.map(entry => h(TerminalView, {
    key: entry.id,
    terminalId: entry.id,
    active: entry.id === activeId,
    visible,
    t,
    onExit: (exitCode: number | null) => { store.markExited(entry.id, exitCode) },
    onTitle: (title: string) => { onTitle(entry.id, title) },
    onOutput: () => { onOutput(entry.id) },
    onMissing: () => { void store.recoverMissingTerminal(entry.id) },
  }))

  return h('div', {
    ref: panelRef,
    className: 'dsh-term-root',
    style: { height: `${String(height)}px` },
    'data-visible': 'true',
  }, [
    h(ResizeHandle, {
      key: 'handle',
      t,
      onHeight: (next: number) => { store.setHeight(next) },
      onDragging: () => { /* 过渡动画由 CSS 的 data 属性控制，这里不需要做事 */ },
    }),
    h(TabBar, {
      key: 'bar',
      terminals,
      activeId,
      t,
      onFocus: (id: string) => { store.focus(id) },
      onClose: (id: string) => { void store.closeTerminal(id) },
      onCreate: () => { void store.create() },
      onHide: () => { store.close() },
    }),
    h('div', { key: 'body', className: 'dsh-term-body' }, [
      terminals.length === 0
        ? h('div', { key: 'empty', className: 'dsh-term-note' }, t('panel.empty'))
        : null,
      ...views,
    ]),
    notice === null
      ? null
      : h(Notice, { key: 'notice', text: notice, onDismiss: () => { store.clearNotice() } }),
  ])
}
