/**
 * 主题桥：把 DSH 的设计令牌翻译成 xterm 的主题对象。
 *
 * 为什么不在 CSS 里做：xterm 的配色是它自己的 canvas/span 内联样式，不吃外部 CSS 变量，
 * 必须把值读出来喂给它。这也意味着**这里允许出现兜底颜色字面量** —— 读不到令牌时
 * （第三方部署的令牌版本不同、或主题包缺席）终端必须仍然可读，透明背景会变成
 * 「黑底黑字」或「白底白字」。面板自身的 CSS 依然零字面量，两者不矛盾：那边读不到
 * 令牌会退回继承色，仍然可读。
 *
 * 主题变化用 `MutationObserver` 观察 `body[data-ds-dark-theme]` 与 `body` 的内联
 * 样式：主题包把令牌写成 body 上的内联 CSS 变量，属性一变就是一次换肤。
 *
 * @module dsh-terminal-plugin/src/client/theme
 */

/** xterm 需要的那部分主题字段（避免依赖 xterm 的类型声明）。 */
export interface XtermTheme {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

/** ANSI 16 色的暗色兜底（VS Code Dark+ 一族的经典取值）。 */
const DARK_ANSI = {
  black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
  blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
  brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543',
  brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#ffffff',
} as const

/** ANSI 16 色的亮色兜底（VS Code Light+ 一族）。 */
const LIGHT_ANSI = {
  black: '#000000', red: '#cd3131', green: '#00bc00', yellow: '#949800',
  blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc', white: '#555555',
  brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#14ce14', brightYellow: '#b5ba00',
  brightBlue: '#0451a5', brightMagenta: '#bc05bc', brightCyan: '#0598bc', brightWhite: '#a5a5a5',
} as const

/** 从 document 上读一个已生效的 CSS 变量（读不到返回空串）。 */
export function readToken(name: string): string {
  const value = getComputedStyle(document.body).getPropertyValue(name)
  return value.trim()
}

/** 当前是否处于暗色主题。 */
export function isDark(): boolean {
  return document.body.hasAttribute('data-ds-dark-theme')
}

/**
 * 组装一份 xterm 主题。
 *
 * @returns 与当前主题匹配的 xterm 主题对象。
 */
export function currentXtermTheme(): XtermTheme {
  const dark = isDark()
  const ansi = dark ? DARK_ANSI : LIGHT_ANSI
  return {
    background: readToken('--dsw-alias-bg-base') || (dark ? '#151517' : '#ffffff'),
    foreground: readToken('--dsw-alias-label-primary') || (dark ? '#f9fafb' : '#0f1115'),
    cursor: readToken('--dsw-alias-label-primary') || (dark ? '#f9fafb' : '#0f1115'),
    cursorAccent: readToken('--dsw-alias-bg-base') || (dark ? '#151517' : '#ffffff'),
    selectionBackground: readToken('--dsw-alias-interactive-bg-active') || (dark ? '#3a3a3d' : '#d7e3f7'),
    ...ansi,
  }
}

/**
 * 观察主题变化。
 *
 * @param listener - 主题（亮/暗或令牌）变化时调用。
 * @returns 取消观察的函数。
 */
export function observeTheme(listener: () => void): () => void {
  const observer = new MutationObserver(() => { listener() })
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'style', 'class'] })
  return () => { observer.disconnect() }
}
