/**
 * 终端渲染器的加载：把内置的 xterm.js 挂到全局，再把它的 CSS 注入页面。
 *
 * 为什么走 `<script type="module">` 而不是动态 `import()`：DSH 的客户端插件产物是
 * lazy-CJS 的 classic script，`await import(url)` 在这里的行为依赖宿主页面环境；
 * 而 `<script src="…">` 是完全受控的加载方式 —— 脚本自己执行
 * `import * as xterm from '…/xterm.mjs'` 并把导出挂到全局，主 bundle 只轮询全局。
 * 一个 345 KB 的资源交给浏览器 HTTP 缓存，比塞进 bundle 每次刷新都重新解析要划算。
 *
 * xterm 的 CSS 也走资源路由（`fetch` + `<style>` 注入），因为 DSH 的构建脚本只认
 * JS 模块，不让 `.css` 进模块图。
 *
 * @module dsh-terminal-plugin/src/client/xterm-loader
 */

import { assetUrl } from './bootstrap.js'

/** xterm 终端实例里本插件真正用到的那部分（结构性类型，不引入 xterm 的类型声明）。 */
export interface XtermTerminal {
  readonly cols: number
  readonly rows: number
  open(container: HTMLElement): void
  write(data: string): void
  writeln(data: string): void
  focus(): void
  dispose(): void
  loadAddon(addon: unknown): void
  onData(listener: (data: string) => void): { dispose(): void }
  onTitleChange(listener: (title: string) => void): { dispose(): void }
  onResize(listener: (size: { cols: number; rows: number }) => void): { dispose(): void }
  options: Record<string, unknown>
}

/** fit addon 的实例面。 */
export interface FitAddonLike {
  fit(): void
  proposeDimensions(): { cols: number; rows: number } | undefined
  activate(terminal: unknown): void
  dispose(): void
}

/** 全局挂钩的名字。 */
const HOST_GLOBAL = '__DSH_TERMINAL_XTERM__'

/** 渲染器模块的导出面。 */
interface XtermModule {
  Terminal: new (options: Record<string, unknown>) => XtermTerminal
  FitAddon: new () => FitAddonLike
}

/** 加载状态：in-flight 或已完成，避免并发重复注入。 */
let loading: Promise<XtermModule> | null = null
/** 已注入的 `<script>`，便于插件卸载时清理。 */
let injectedScript: HTMLScriptElement | null = null
/** CSS 是否注入过。 */
let cssInjected = false

/** 已挂到全局的模块（脚本执行完成后）。 */
function readGlobal(): XtermModule | null {
  const raw = (globalThis as Record<string, unknown>)[HOST_GLOBAL]
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Partial<XtermModule>
  return typeof candidate.Terminal === 'function' && typeof candidate.FitAddon === 'function'
    ? (candidate as XtermModule)
    : null
}

/** 等全局出现，或等超时 / 脚本报错。 */
function waitForGlobal(timeoutMs: number): Promise<XtermModule> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = (): void => {
      const found = readGlobal()
      if (found !== null) { resolve(found); return }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('xterm 加载超时'))
        return
      }
      setTimeout(tick, 25)
    }
    tick()
  })
}

/** 在页面里注入一个只跑一次的渲染器引导脚本。 */
function injectBootstrap(): void {
  if (injectedScript !== null) return
  const script = document.createElement('script')
  script.type = 'module'
  script.dataset.plugin = 'dsh-terminal-plugin/xterm'
  script.textContent = [
    `import * as xterm from ${JSON.stringify(assetUrl('xterm.mjs'))};`,
    `import * as fit from ${JSON.stringify(assetUrl('addon-fit.mjs'))};`,
    `window.${HOST_GLOBAL} = { Terminal: xterm.Terminal, FitAddon: fit.FitAddon };`,
  ].join('\n')
  script.addEventListener('error', () => {
    // 让等待方看到失败：把全局清掉，超时逻辑负责报错。
    delete (globalThis as Record<string, unknown>)[HOST_GLOBAL]
  })
  document.head.appendChild(script)
  injectedScript = script
}

/** 注入 xterm 自己的 CSS（幂等）。 */
async function injectCss(): Promise<void> {
  if (cssInjected) return
  cssInjected = true
  try {
    const response = await fetch(assetUrl('xterm.css'))
    if (!response.ok) return
    const text = await response.text()
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-terminal-plugin/xterm'
    style.textContent = text
    document.head.appendChild(style)
  } catch {
    // CSS 拿不到只影响排版细节，终端仍然能用，所以不在这里拦。
  }
}

/**
 * 载入终端渲染器（缓存，可并发调用）。
 *
 * @returns Terminal 与 FitAddon 两个构造函数。
 * @throws 资源拿不到或脚本报错时抛出（由面板显示成可重试的错误态）。
 */
export async function loadXterm(): Promise<XtermModule> {
  const existing = readGlobal()
  if (existing !== null) {
    void injectCss()
    return existing
  }
  if (loading === null) {
    injectBootstrap()
    loading = waitForGlobal(15000)
      .then(async (module) => {
        await injectCss()
        return module
      })
      .catch((error: unknown) => {
        // 失败后允许下一次重试重新注入脚本。
        loading = null
        injectedScript?.remove()
        injectedScript = null
        throw error
      })
  }
  return await loading
}

/** 插件卸载时清掉注入的脚本与样式（幂等）。 */
export function disposeXtermHost(): void {
  injectedScript?.remove()
  injectedScript = null
  loading = null
  cssInjected = false
  for (const node of document.querySelectorAll('style[data-plugin="dsh-terminal-plugin/xterm"]')) {
    node.remove()
  }
  delete (globalThis as Record<string, unknown>)[HOST_GLOBAL]
}
