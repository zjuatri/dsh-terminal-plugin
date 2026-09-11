/**
 * 面板的可见部分：标签条、拖拽分隔条、一次性提示条。
 *
 * 与 `panel.tsx`（负责 store、快捷键、帧留白）分开，是为了让「状态机」与「长什么样」
 * 各自独立可读、也各自不超长。
 *
 * @module dsh-terminal-plugin/src/client/panel-chrome
 */

import { h, useRef } from './react.js'
import type { TerminalEntry } from './state.js'
import type { Translate } from './text.js'
import { ChevronDownGlyph, PlusGlyph } from './toggle-button.js'

/** 标签条 props。 */
export interface TabBarProps {
  /** 所有终端。 */
  terminals: readonly TerminalEntry[]
  /** 当前选中。 */
  activeId: string | null
  /** 翻译函数。 */
  t: Translate
  /** 切换。 */
  onFocus(id: string): void
  /** 关闭。 */
  onClose(id: string): void
  /** 新建。 */
  onCreate(): void
  /** 收起面板。 */
  onHide(): void
}

/** 单个标签的状态点语义。 */
function dotState(entry: TerminalEntry): string {
  if (entry.state === 'exited') return 'exited'
  if (entry.state === 'pending') return 'pending'
  return entry.unseen ? 'busy' : 'running'
}

/**
 * 标签条 + 右侧按钮。
 *
 * @param props - 终端列表与动作。
 * @returns 标签条元素。
 */
export function TabBar(props: TabBarProps): unknown {
  const { terminals, activeId, t, onFocus, onClose, onCreate, onHide } = props
  const tabs = terminals.map(entry => h('div', {
    key: entry.id,
    className: 'dsh-term-tab',
    'data-active': entry.id === activeId ? 'true' : 'false',
    role: 'tab',
    tabIndex: 0,
    'aria-selected': entry.id === activeId ? 'true' : 'false',
    title: entry.name,
    onClick: () => { onFocus(entry.id) },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onFocus(entry.id)
      }
    },
    onAuxClick: (event: MouseEvent) => {
      if (event.button === 1) onClose(entry.id)
    },
  }, [
    h('span', { key: 'dot', className: 'dsh-term-tabDot', 'data-state': dotState(entry) }),
    h('span', { key: 'label', className: 'dsh-term-tabLabel' }, entry.name),
    h('button', {
      key: 'close',
      type: 'button',
      className: 'dsh-term-tabClose',
      title: t('tab.close'),
      'aria-label': t('tab.close'),
      onClick: (event: MouseEvent) => {
        event.stopPropagation()
        onClose(entry.id)
      },
    }, '×'),
  ]))

  return h('div', { className: 'dsh-term-bar' }, [
    h('div', { key: 'tabs', className: 'dsh-term-tabs', role: 'tablist' }, tabs),
    h('button', {
      key: 'new',
      type: 'button',
      className: 'dsh-term-btn',
      title: t('panel.newHint'),
      'aria-label': t('panel.new'),
      onClick: onCreate,
    }, PlusGlyph()),
    h('button', {
      key: 'hide',
      type: 'button',
      className: 'dsh-term-btn',
      title: t('panel.closeHint'),
      'aria-label': t('panel.close'),
      onClick: onHide,
    }, ChevronDownGlyph()),
  ])
}

/** 拖拽分隔条的 props。 */
export interface ResizeHandleProps {
  /** 高度变化（px，已按视口夹紧）。 */
  onHeight(height: number): void
  /** 拖拽开始/结束（用于关掉过渡动画）。 */
  onDragging(dragging: boolean): void
  /** 翻译函数。 */
  t: Translate
}

/**
 * 面板上边缘的拖拽分隔条（行高方向的 resize 手柄）。
 *
 * @param props - 高度回调与拖拽状态回调。
 * @returns 手柄元素。
 */
export function ResizeHandle(props: ResizeHandleProps): unknown {
  const state = useRef({ startY: 0, startHeight: 0, dragging: false })
  const barRef = useRef<HTMLDivElement | null>(null)

  const end = (): void => {
    if (!state.current.dragging) return
    state.current.dragging = false
    props.onDragging(false)
  }

  return h('div', {
    ref: barRef,
    className: 'dsh-term-resize',
    title: props.t('panel.resizeHint'),
    role: 'separator',
    'aria-orientation': 'horizontal',
    onPointerDown: (event: PointerEvent) => {
      const panel = (event.currentTarget as HTMLElement).parentElement
      if (panel === null) return
      state.current = { startY: event.clientY, startHeight: panel.getBoundingClientRect().height, dragging: true }
      props.onDragging(true)
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: PointerEvent) => {
      if (!state.current.dragging) return
      // 手柄在面板顶部：往上拖 = 变高。
      const delta = state.current.startY - event.clientY
      props.onHeight(state.current.startHeight + delta)
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  })
}

/** 一次性提示条 props。 */
export interface NoticeProps {
  /** 提示文本。 */
  text: string
  /** 关掉。 */
  onDismiss(): void
}

/**
 * 右下角的一次性提示（例如「终端太多」）。
 *
 * @param props - 文本与关闭回调。
 * @returns 提示元素。
 */
export function Notice(props: NoticeProps): unknown {
  return h('div', {
    className: 'dsh-term-toast',
    role: 'status',
    onClick: props.onDismiss,
  }, props.text)
}
