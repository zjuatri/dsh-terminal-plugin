/**
 * 输入框工具行左侧的终端按钮：鼠标入口（键盘入口是 Ctrl+`）。
 *
 * 注册进 `conversation.input.left`（会话级的列表槽位，放的就是输入框工具行左侧的紧凑
 * 控件）。按钮做两件事 —— 切换面板，以及**把「用户正在看哪个会话」告诉 store**：新终端的
 * 工作目录由它决定（宿主拿会话 id 去取那个会话的工作目录，也就是它所属工作区的路径）。
 *
 * @module dsh-terminal-plugin/src/client/toggle-button
 */

import { h, useEffect } from './react.js'
import type { Translate } from './text.js'
import type { TerminalPanelStore } from './state.js'

/** 本按钮的 props。 */
export interface TerminalToggleProps {
  /** 面板 store。 */
  store: TerminalPanelStore
  /** 面板快照（由 `PanelHost` 订阅后传入）。 */
  visible: boolean
  /** 已绑定的翻译函数。 */
  t: Translate
  /**
   * 用户当前正在看的会话 id。
   *
   * 槽位框架把它作为标准 prop 注入会话级正文；有值就同步给 store，供新建终端定位工作目录。
   * 面板正文在另一个 React 子树里，靠 store 传递而不是 props。
   */
  sessionId?: string
}

/**
 * 图标集：全部是内联 SVG，颜色一律走 `currentColor`，跟随按钮的主题令牌上色。
 *
 * 加号与向下箭头来自设计给的 48×48 线性图标（路径与 `viewBox` 原样保留，只把原来写死的
 * `#000000` 换成 `currentColor`，尺寸按面板工具栏收到 16）。
 */

/** 终端图标（本插件自己的画法）。 */
export function TerminalGlyph(): unknown {
  return h('svg', {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.2,
    'aria-hidden': 'true',
  }, [
    h('rect', { key: 'frame', x: 1.5, y: 2.5, width: 13, height: 11, rx: 2 }),
    h('path', { key: 'prompt', d: 'M4.6 6.4 6.6 8l-2 1.6' }),
    h('path', { key: 'line', d: 'M8.4 10h3.2' }),
  ])
}

/** 加号图标：新建终端。 */
export function PlusGlyph(): unknown {
  return h('svg', {
    width: 16,
    height: 16,
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 3,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }, [
    h('path', { key: 'vertical', d: 'M24.0605 10L24.0239 38' }),
    h('path', { key: 'horizontal', d: 'M10 24L38 24' }),
  ])
}

/** 向下箭头图标：收起面板。 */
export function ChevronDownGlyph(): unknown {
  return h('svg', {
    width: 16,
    height: 16,
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 3,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }, [
    h('path', { key: 'chevron', d: 'M36 18L24 30L12 18' }),
  ])
}

/**
 * 终端切换按钮。
 *
 * @param props - store、当前可见状态、翻译函数与当前会话 id。
 * @returns 按钮元素。
 */
export function TerminalToggle(props: TerminalToggleProps): unknown {
  const { store, visible, t, sessionId } = props

  // 会话一出现就登记它（会话切换时也会更新）。
  useEffect(() => {
    store.setActiveSession(sessionId)
  }, [store, sessionId])

  return h('button', {
    type: 'button',
    className: 'dsh-term-toggle',
    'data-active': visible ? 'true' : 'false',
    'aria-pressed': visible ? 'true' : 'false',
    'aria-label': t('toggle.label'),
    title: t('toggle.hint'),
    onClick: () => { store.toggle() },
  }, [TerminalGlyph()])
}
