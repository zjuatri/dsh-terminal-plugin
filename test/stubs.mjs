/**
 * 测试替身：够用的 DOM、假 PTY 句柄、可控的 fetch。
 *
 * 这里刻意用「手写的、最小的」替身，而不是引入 jsdom / sinon：本插件的测试要守住的
 * 是**接线**（槽位注册、路由延迟、协议帧、进程回收），不是 UI 的小数点。手写替身让
 * 每条断言都指向真实的调用点，也让「测试为什么绿」一眼可见。
 *
 * @module dsh-terminal-plugin/test/stubs
 */

import { PassThrough } from 'node:stream'
import { EventEmitter } from 'node:events'

/**
 * 造一个 CSSStyleDeclaration 替身：`element.style` 的读法（`style.height`）走普通属性，
 * 自定义属性的读写走 `setProperty`/`getPropertyValue`/`removeProperty`。
 *
 * @param {FakeElement} element 归属元素。
 * @returns {Record<string, unknown>} 样式对象。
 */
function makeCssStyle(element) {
  return {
    /** 已设置属性个数（插件用它判断有没有内联高度）。 */
    length: 0,
    /** @param {string} name 变量名。 @param {string} value 值。 */
    setProperty(name, value) {
      this[name] = value
      this.length += 1
      element.cssVariables.set(name, String(value))
    },
    /** @param {string} name 变量名。 */
    getPropertyValue(name) {
      return element.cssVariables.get(name) ?? ''
    },
    /** @param {string} name 变量名。 */
    removeProperty(name) {
      if (name in this) {
        delete this[name]
        this.length = Math.max(0, this.length - 1)
      }
      element.cssVariables.delete(name)
    },
  }
}

/** 一个极简元素。 */
class FakeElement {
  /** @param {string} tagName 标签名。 */
  constructor(tagName) {
    this.tagName = tagName.toUpperCase()
    /** @type {Record<string, string>} */
    this.dataset = {}
    /** @type {Map<string, string>} */
    this.attributes = new Map()
    /** @type {FakeElement[]} */
    this.children = []
    /** @type {string} */
    this.textContent = ''
    /** @type {Record<string, string> & { length: number }} */
    this.style = { length: 0 }
    /** @type {string} */
    this.className = ''
    /** @type {string | null} */
    this.id = null
    /** @type {FakeElement | null} */
    this.parentElement = null
    /** @type {Map<string, Array<(event: unknown) => void>>} */
    this.listeners = new Map()
    /** @type {Map<string, string>} */
    this.cssVariables = new Map()
    /**
     * 测试注入的几何（真实浏览器里由布局算出）。
     * @type {{ x: number, y: number, right: number, width: number, height: number } | null}
     */
    this.rect = null
  }

  /** 几何读取：返回测试注入的矩形，或一个零矩形。 */
  getBoundingClientRect() {
    const rect = this.rect ?? { x: 0, y: 0, right: 0, width: 0, height: 0 }
    return {
      x: rect.x,
      y: rect.y,
      top: rect.y,
      left: rect.x,
      right: rect.right,
      bottom: rect.y + rect.height,
      width: rect.width,
      height: rect.height,
    }
  }

  /** @param {FakeElement} child 子元素。 */
  appendChild(child) {
    child.parentElement = this
    this.children.push(child)
    if (child.id !== null) this.ownerDocument?.byId.set(child.id, child)
    return child
  }

  /** 记录并触发一次属性写入（测试只关心存在性）。 */
  setAttribute(name, value) {
    this.attributes.set(name, String(value))
  }

  /** @param {string} name 属性名。 */
  removeAttribute(name) {
    this.attributes.delete(name)
  }

  /** @param {string} name 属性名。 */
  hasAttribute(name) {
    return this.attributes.has(name)
  }

  /** @param {string} name 选择器（只支持 `tag[data-plugin="x"]` 这一种）。 */
  querySelector(name) {
    const match = /^(\w+)\[data-plugin="([^"]+)"\]$/u.exec(name)
    if (match === null) return null
    return this.querySelectorAll(match[1]).find(node => node.dataset.plugin === match[2]) ?? null
  }

  /** @param {string} tag 标签名。 */
  querySelectorAll(tag) {
    /** @type {FakeElement[]} */
    const found = []
    const visit = (node) => {
      for (const child of node.children) {
        if (child.tagName === tag.toUpperCase()) found.push(child)
        visit(child)
      }
    }
    visit(this)
    return found
  }

  /** @param {string} type 事件名。 @param {(event: unknown) => void} handler 处理函数。 */
  addEventListener(type, handler) {
    const list = this.listeners.get(type) ?? []
    list.push(handler)
    this.listeners.set(type, list)
  }

  /** @param {string} type 事件名。 @param {(event: unknown) => void} handler 处理函数。 */
  removeEventListener(type, handler) {
    const list = this.listeners.get(type) ?? []
    this.listeners.set(type, list.filter(item => item !== handler))
  }

  /** 触发一次事件。 @param {string} type 事件名。 @param {unknown} event 事件对象。 */
  dispatch(type, event) {
    for (const handler of this.listeners.get(type) ?? []) handler(event)
  }

  /**
   * 模拟读取一个 CSS 自定义属性所在对象的长度（浏览器里 `style.length` 是已设置属性的个数）。
   *
   * @param {string} name 变量名。
   * @param {string} value 值。
   */
  setProperty(name, value) {
    this.cssVariables.set(name, value)
  }

  /** @param {string} name 变量名。 */
  getPropertyValue(name) {
    return this.cssVariables.get(name) ?? ''
  }

  /**
   * 删除一个 CSS 自定义属性。
   *
   * `element.style` 是属性袋，而 `documentElement.style` / `getComputedStyle(...)` 走的是
   * 本类的 `setProperty`/`getPropertyValue`/`removeProperty` 三件套；`style.length` 由
   * 构造函数的 `{ length: 0 }` 提供，插件会用它判断「有没有内联高度」。
   *
   * @param {string} name 变量名。
   */
  removeProperty(name) {
    this.cssVariables.delete(name)
  }

  /** 空实现：替身不关心布局。 */
  remove() {
    if (this.parentElement !== null) {
      this.parentElement.children = this.parentElement.children.filter(child => child !== this)
    }
  }
}

/** 极简 document。 */
class FakeDocument extends FakeElement {
  constructor() {
    super('#document')
    this.ownerDocument = this
    this.head = new FakeElement('head')
    this.body = new FakeElement('body')
    this.documentElement = new FakeElement('html')
    /** @type {Map<string, FakeElement>} */
    this.byId = new Map()
    this.appendChild(this.head)
    this.appendChild(this.body)
    this.appendChild(this.documentElement)
  }

  /** @param {string} tag 标签名。 */
  createElement(tag) {
    const element = new FakeElement(tag)
    element.ownerDocument = this
    // 每个元素都带一个 CSSStyleDeclaration 替身（插件会对 `#root` 写内联高度）。
    element.style = makeCssStyle(element)
    return element
  }

  /** @param {string} selector 选择器（支持 `#id` 与 `tag[data-plugin=…]`）。 */
  querySelector(selector) {
    const byId = super.querySelector(selector)
    if (byId !== null) return byId
    if (selector.startsWith('#')) return this.byId.get(selector.slice(1)) ?? null
    return null
  }
}

/**
 * 安装浏览器替身。
 *
 * `cleanup()` 会把 `document`/`window` **以及**测试期间可能被换掉的 `fetch`、
 * `localStorage` 一起还原。后者不是洁癖：`wire-protocol.test.mjs` 起真 HTTP 服务器并用
 * 真的 `fetch` 打它，而某个客户端测试装过假 `fetch` 就会把这个跨文件的用例打成一片红
 * （症状是「POST 返回 200 而不是 201」，离原因非常远）。
 *
 * @returns {{ document: FakeDocument, window: Record<string, unknown>, fire(type: string, event: unknown): void, cleanup(): void }}
 */
export function installDom() {
  const document = new FakeDocument()
  const root = document.createElement('div')
  root.id = 'root'
  document.byId.set('root', root)
  document.body.appendChild(root)
  // `documentElement.style` 与普通元素一样是 CSSStyleDeclaration：既支持 `setProperty`，
  // 也能直接读 `style.height`（插件用 `setProperty` 写变量、用 `style.height` 读写内联高度）。
  // `documentElement` 是构造期就建好的 FakeElement，这里补上样式对象。
  document.documentElement.style = makeCssStyle(document.documentElement)
  document.body.style = makeCssStyle(document.body)
  document.documentElement.cssVariables.set('--dsw-alias-bg-base', '#ffffff')
  document.documentElement.cssVariables.set('--dsw-alias-label-primary', '#111111')

  /** @type {Map<string, Array<(event: unknown) => void>>} */
  const listeners = new Map()
  const window = {
    location: { protocol: 'http:', host: '127.0.0.1:3080' },
    innerHeight: 900,
    innerWidth: 1440,
    addEventListener(type, handler) {
      const list = listeners.get(type) ?? []
      list.push(handler)
      listeners.set(type, list)
    },
    removeEventListener(type, handler) {
      listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== handler))
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type ?? 'resize') ?? []) handler(event)
    },
  }

  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const previousLocalStorage = globalThis.localStorage
  globalThis.document = document
  globalThis.window = window
  globalThis.MutationObserver = class {
    /** 替身不观察任何东西。 */
    observe() {}
    /** 空实现。 */
    disconnect() {}
  }
  globalThis.ResizeObserver = class {
    /** 替身不观察任何东西。 */
    observe() {}
    /** 空实现。 */
    disconnect() {}
  }
  globalThis.getComputedStyle = () => document.documentElement

  return {
    document,
    window,
    /** 触发 document 上的事件（keydown 用）。 @param {string} type 事件名。 @param {unknown} event 事件对象。 */
    fire(type, event) {
      document.dispatch(type, event)
    },
    cleanup() {
      globalThis.document = previousDocument
      globalThis.window = previousWindow
      globalThis.fetch = previousFetch
      globalThis.localStorage = previousLocalStorage
    },
  }
}

/**
 * 造一个可控的假 PTY 句柄。
 *
 * @param {{ pid?: number }} [options] 选项。
 * @returns {{
 *   handle: object,
 *   emit(text: string): void,
 *   writes: string[],
 *   terminateCalls(): number,
 *   exit(exitCode: number): void,
 * }}
 */
export function fakeTerminalHandle(options = {}) {
  const output = new PassThrough()
  const writes = []
  let terminateCalls = 0
  /** @type {(value: { exitCode: number, signal: string | null }) => void} */
  let settleDone = () => {}
  const done = new Promise(resolve => { settleDone = resolve })

  const handle = {
    pid: options.pid ?? 4242,
    output,
    done,
    /** @param {string} data 写入的内容。 */
    async write(data) { writes.push(data) },
    /** 空实现。 */
    async inspectForeground() { return undefined },
    /** @param {string} signal 信号名。 */
    async signalForeground(signal) { void signal; return 0 },
    /** 结束输出流并让所有等待者落地。 */
    async terminate() {
      terminateCalls += 1
      settleDone({ exitCode: 0, signal: null })
      output.end()
    },
  }

  return {
    handle,
    /** 推一段输出。 @param {string} text 文本。 */
    emit(text) { output.write(text) },
    writes,
    terminateCalls: () => terminateCalls,
    /** 报告退出。 @param {number} exitCode 退出码。 */
    exit(exitCode) { settleDone({ exitCode, signal: null }) },
  }
}

/**
 * 造一个记录所有请求的 fetch。
 *
 * @param {(input: string, init: object) => object} handler 返回 `{ status, body }` 的处理函数。
 * @returns {{ fetch: typeof fetch, calls: { url: string, init: object }[] }}
 */
export function fakeFetch(handler) {
  const calls = []
  const impl = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input)
    calls.push({ url, init })
    const result = handler(url, init)
    const body = result.body === undefined ? '' : JSON.stringify(result.body)
    return {
      ok: (result.status ?? 200) < 400,
      status: result.status ?? 200,
      async text() { return body },
      async json() { return JSON.parse(body) },
    }
  }
  return { fetch: impl, calls }
}

/** 让出一个事件循环轮次（等 async 副作用落地）。 */
export function tick() {
  return new Promise(resolve => { setTimeout(resolve, 0) })
}

/** 从 EventEmitter 上取一个只发一次的事件。 @param {EventEmitter} emitter 事件源。 @param {string} name 事件名。 */
export function once(emitter, name) {
  return new Promise(resolve => { emitter.once(name, resolve) })
}

export { EventEmitter }
