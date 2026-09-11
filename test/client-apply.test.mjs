/**
 * 客户端产物的行为测试：在 Node 里搭一个最小 lazy-CJS 宿主，真实执行一遍 `apply`。
 *
 * 这是最有价值的一个测试：客户端产物是**手写打包器**拼出来的，最容易出的错（具名导入
 * 没进模块命名空间、平台种子被本地解构覆盖、入口只转发了一个导出）都只在运行期才暴露，
 * 而且现场离原因很远（典型症状是 `useState is not defined`）。这里把 `apply` 真的跑一遍，
 * 顺带断言三处槽位注册、样式的 `data-plugin` 归属，以及面板打开时**只压缩中间列与右侧栏**
 * （两边侧边栏保持全高，面板左边缘跟着左栏右边缘）。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, test } from './harness.mjs'
import { installDom, fakeFetch, tick } from './stubs.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** React 替身：够跑一遍注册与渲染，并且会把 effect 同步执行掉。 */
function fakeReact() {
  const calls = []
  /** 渲染期间收集的 effect，渲染返回后由 flushEffects 执行。 */
  const pending = []
  return {
    calls,
    pending,
    /** 执行并清空当前收集到的 effect（真实 React 在提交阶段做这件事）。 */
    flushEffects() {
      const effects = pending.splice(0, pending.length)
      const cleanups = []
      for (const fn of effects) {
        const cleanup = fn()
        if (typeof cleanup === 'function') cleanups.push(cleanup)
      }
      return () => { for (const cleanup of cleanups) cleanup() }
    },
    module: {
      /** @param {string} type 标签或组件。 @param {object} props 属性。 @param {...unknown} children 子节点。 */
      createElement(type, props, ...children) {
        const merged = { ...(props ?? {}) }
        if (children.length > 0) merged.children = children
        return { type, props: merged }
      },
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: (fn) => { calls.push({ name: 'useEffect' }); pending.push(fn) },
      useLayoutEffect: (fn) => { pending.push(fn) },
      useMemo: (fn) => fn(),
      useReducer: () => [undefined, () => {}],
      useCallback: (fn) => fn,
      useRef: (initial) => ({ current: initial }),
      useContext: () => ({}),
      useSyncExternalStore: (subscribe, getSnapshot) => { void subscribe; return getSnapshot() },
      Fragment: Symbol('Fragment'),
      memo: (component) => component,
      forwardRef: (component) => component,
      createContext: () => ({}),
      cloneElement: (element) => element,
      Children: { map: () => [] },
    },
  }
}

/**
 * 用最小宿主执行客户端产物。
 *
 * @param {(module: object) => void} body 拿到导出面之后要跑的断言/操作。
 * @returns {Promise<{ exports: object, react: object, registration: object }>}
 */
async function loadClient(body) {
  const code = readFileSync(join(root, 'lib/client.js'), 'utf8')
  const react = fakeReact()
  /** @type {{ id: string, factory: Function } | null} */
  let registration = null
  globalThis.window = {
    location: { protocol: 'http:', host: '127.0.0.1:3080' },
    innerHeight: 900,
    __ModuleLoader__: {
      /** @param {{ id: string, factory: Function }} input 注册。 */
      load(input) { registration = input },
    },
  }
  // 用 Function 包一层，模拟「浏览器执行一段 classic script」。
  new Function('window', code)(globalThis.window)
  assert.notEqual(registration, null, '产物应当注册一个 lazy-CJS 工厂')
  const requireStub = (spec) => {
    if (spec === 'react') return react.module
    throw new Error(`不认识的种子模块：${spec}`)
  }
  const exports = registration.factory(requireStub)
  body(exports)
  return { exports, react, registration }
}

/** 造一个记录所有槽位注册的客户端上下文。 */
function fakeClientContext() {
  /** @type {object[]} */
  const injections = []
  /** @type {object[]} */
  const registrations = []
  /** @type {string[]} */
  const dictionaries = []
  return {
    injections,
    registrations,
    dictionaries,
    ctx: {
      /** @param {Function} body 效果体。 @param {string} label 标签。 */
      effect(body, label) { void label; const dispose = body(); return typeof dispose === 'function' ? dispose : () => {} },
      locale: {
        /** @param {string} ns 命名空间。 @param {object} dicts 字典。 */
        register(ns, dicts) { dictionaries.push(`${ns}:${Object.keys(dicts).sort().join(',')}`); return () => {} },
        /** @param {string} _ns 命名空间。 */
        bind(_ns) { return (key) => `t:${key}` },
      },
      slots: {
        /** @param {string} name 槽位名。 @param {Function} callback 回调。 */
        inject(name, callback) { injections.push({ name, callback }); return () => {} },
        /** @param {object} options 注册项。 @param {Function} component 正文组件。 */
        register(options, component) { registrations.push({ options, component }); return () => {} },
      },
    },
  }
}

/**
 * 装一个带框架/三列的假 DOM，好让几何代码有东西可量。
 *
 * 列宽按实测的产品布局摆：左栏 0–280，对话区 280–1920（宽 1640），右侧栏在 1920 处收起
 * （宽 0）。列的几何用元素上的 `rect` 字段表示（见 `test/stubs.mjs` 的
 * `getBoundingClientRect`）。
 *
 * @param {{ sidebarWidth?: number, centerWidth?: number, rightbarWidth?: number }} [options] 覆盖列宽。
 * @returns {{ dom: object, frame: object, columns: Record<string, object>, net: object }}
 */
function installFramedDom(options = {}) {
  const dom = installDom()
  const document = dom.document
  const sidebarWidth = options.sidebarWidth ?? 280
  const rightbarWidth = options.rightbarWidth ?? 0
  const centerWidth = options.centerWidth ?? (1920 - sidebarWidth - rightbarWidth)
  const frame = document.createElement('div')
  frame.className = 'pI_x6G_frame'
  frame.rect = { x: 0, y: 0, right: 1920, width: 1920, height: 1080 }
  document.body.appendChild(frame)
  const columns = {}
  // class 名带构建期哈希（`pI_x6G_centerCol` 这种），几何代码只能按子串认 —— 测试
  // 用同样的形态，才真的测到那条子串匹配。
  for (const [key, cls, x, width] of [
    ['sidebar', 'pI_x6G_sidebarCol', 0, sidebarWidth],
    ['center', 'pI_x6G_centerCol', sidebarWidth, centerWidth],
    ['rightbar', 'pI_x6G_rightbarCol', sidebarWidth + centerWidth, rightbarWidth],
  ]) {
    const column = document.createElement('div')
    column.className = cls
    column.rect = { x, y: 0, right: x + width, width, height: 1080 }
    frame.appendChild(column)
    columns[key] = column
  }
  const storage = new Map()
  globalThis.localStorage = {
    /** @param {string} key 键。 */
    getItem(key) { return storage.get(key) ?? null },
    /** @param {string} key 键。 @param {string} value 值。 */
    setItem(key, value) { storage.set(key, value) },
  }
  const net = fakeFetch((url, init) => {
    if (url.endsWith('/terminals') && (init?.method ?? 'GET') === 'POST') {
      return {
        status: 201,
        body: { terminal: { id: 't1', name: '终端 1', pid: 1, state: 'running', exitCode: null, cols: 80, rows: 24, createdAt: 1 } },
      }
    }
    if (url.endsWith('/terminals')) return { status: 200, body: { terminals: [] } }
    return { status: 404, body: { code: 'BAD_REQUEST', message: 'nope' } }
  })
  globalThis.fetch = net.fetch
  return { dom, frame, columns, net }
}

describe('客户端产物', () => {
  test('注册了 lazy-CJS 工厂，id 是包名', async () => {
    await loadClient((exports) => { void exports })
    const code = readFileSync(join(root, 'lib/client.js'), 'utf8')
    assert.match(code, /__ModuleLoader__\.load\(/)
    assert.match(code, /id: "dsh-terminal-plugin"/)
    assert.match(code, /exports\.apply = /)
    assert.match(code, /exports\.inject = /)
  })

  test('工具栏的「新建 / 收起」用的是设计给的 svg 图标，不是 + 与 ⌄ 文本', async () => {
    // 渲染真实面板，从返回的组件树里取出那两个按钮 —— 走的是产物里的真代码，
    // 所以这条能挡住「有人又把图标改回文本字符」。
    /** 把嵌套的 children 摊平成一层元素数组（假 React 不渲染，数组会原样留着）。 */
    const flatten = children => (Array.isArray(children) ? children : [children]).flat(Infinity).filter(Boolean)
    const { dom, net } = installFramedDom()
    try {
      const { exports, react } = await loadClient(() => {})
      const harness = fakeClientContext()
      exports.apply(harness.ctx)
      for (const entry of harness.injections) entry.callback()
      harness.registrations.find(entry => entry.options.name === 'conversation.input.left')
        .component({ sessionId: 'session-1' }).props.onClick()
      const panel = harness.registrations.find(entry => entry.options.name === 'shell.overlay')
      const tree = panel.component()
      react.flushEffects()
      // 面板根节点：分隔条 / 标签条 / 正文 / （可选的提示）。假 React 不渲染函数组件，
      // 所以这里手动把标签条调一次。
      const barElement = flatten(tree.props.children).find(child => typeof child.type === 'function' && child.props.onHide !== undefined)
      assert.notEqual(barElement, undefined, `面板里应当有标签条组件，实际：${JSON.stringify(flatten(tree.props.children).map(child => child.type))}`)
      const bar = barElement.type(barElement.props)
      const buttons = flatten(bar.props.children).filter(child => child.type === 'button')
      assert.equal(buttons.length, 2, '工具栏是「新建」与「收起」两个按钮')
      const [create, hide] = buttons
      const createIcon = flatten(create.props.children)[0]
      const hideIcon = flatten(hide.props.children)[0]
      assert.equal(createIcon.type, 'svg', '新建按钮里应当是 svg 图标')
      assert.equal(createIcon.props.viewBox, '0 0 48 48')
      assert.equal(createIcon.props.stroke, 'currentColor', '不能写死 #000000')
      assert.deepEqual(
        flatten(createIcon.props.children).map(path => path.props.d),
        ['M24.0605 10L24.0239 38', 'M10 24L38 24'],
      )
      assert.equal(hideIcon.type, 'svg', '收起按钮里应当是 svg 图标')
      assert.deepEqual(
        flatten(hideIcon.props.children).map(path => path.props.d),
        ['M36 18L24 30L12 18'],
      )
      await tick()
      void net
    } finally {
      dom.cleanup()
    }
  })

  test('apply 注册两处槽位（输入框按钮 + 面板），并带上语言命名空间', async () => {
    const dom = installDom()
    try {
      const { exports } = await loadClient(() => {})
      assert.deepEqual(exports.inject, ['slots', 'locale'])
      const harness = fakeClientContext()
      exports.apply(harness.ctx)
      // 每个槽位都走 inject（不假设声明顺序），回调里才注册正文。
      assert.deepEqual(
        harness.injections.map(entry => entry.name).sort(),
        ['conversation.input.left', 'shell.overlay'],
      )
      for (const entry of harness.injections) entry.callback()
      assert.deepEqual(
        harness.registrations.map(entry => entry.options.name).sort(),
        ['conversation.input.left', 'shell.overlay'],
      )
      // 侧边栏里不放任何东西：终端只在对话区这一块。
      assert.equal(
        harness.injections.some(entry => entry.name === 'sidebar.footer.action'),
        false,
        '不该再注册侧边栏入口',
      )
      const panelRegistration = harness.registrations.find(entry => entry.options.name === 'shell.overlay')
      assert.equal(panelRegistration.options.id, 'dsh-terminal-plugin/panel')
      assert.equal(panelRegistration.options.order, 60)
      assert.equal(typeof panelRegistration.options.label, 'function')

      // 文案字典注册进自己的命名空间，语言齐全。
      assert.equal(harness.dictionaries.length, 1)
      assert.match(harness.dictionaries[0], /^dsh-terminal:en,zh$/)
    } finally {
      dom.cleanup()
    }
  })

  test('样式以 data-plugin 归属注入，且面板 CSS 不写死颜色', async () => {
    const dom = installDom()
    try {
      await loadClient((exports) => { void exports })
      // 从测试专用产物里读真正的 CSS 常量，而不是在 bundle 文本里切字符串。
      const { PANEL_CSS } = await import(pathToFileURL(join(root, 'lib/selftest.js')).href)
      assert.equal(typeof PANEL_CSS, 'string')
      // 面板 CSS 必须走设计令牌：不允许出现写死的彩色（十六进制一律不许）。
      assert.doesNotMatch(PANEL_CSS, /#[0-9a-fA-F]{3,8}\b/u, '面板 CSS 不该出现硬编码颜色')
      // 颜色函数只允许「中性 + 透明」的阴影兜底：它是覆盖层的形状提示，不携带品牌色。
      for (const match of PANEL_CSS.matchAll(/\b(?:rgb|hsl)a?\(([^)]*)\)/gu)) {
        assert.match(match[1], /^\s*0\s+0\s+0\s*\/\s*[\d.]+%?\s*$/u, `颜色函数只允许中性阴影兜底，实际：${match[0]}`)
      }
      assert.match(PANEL_CSS, /--dsw-alias-bg/)
      assert.match(PANEL_CSS, /--dsh-terminal-inset/)
      assert.match(PANEL_CSS, /--dsh-terminal-left/)
      // 注册归属标记：HMR 按 data-plugin 清理过期样式，名字必须是包名。
      const code = readFileSync(join(root, 'lib/client.js'), 'utf8')
      assert.match(code, /dataset\.plugin = PLUGIN_TAG/u)
      assert.match(code, /PLUGIN_TAG = ['"]dsh-terminal-plugin['"]/u)
    } finally {
      dom.cleanup()
    }
  })

  test('点按钮展开面板：只压对话区（左栏与右栏都不动），面板与对话区完全对齐', async () => {
    const { dom, columns, net } = installFramedDom()
    try {
      const { exports, react } = await loadClient(() => {})
      const harness = fakeClientContext()
      exports.apply(harness.ctx)
      for (const entry of harness.injections) entry.callback()

      const toggle = harness.registrations.find(entry => entry.options.name === 'conversation.input.left')
      // 会话级槽位会把当前 sessionId 注入进来；按钮负责把它同步给 store（新终端的 cwd 靠它）。
      let button = toggle.component({ sessionId: 'session-dc-new-org' })
      react.flushEffects()
      assert.equal(button.type, 'button')
      assert.equal(button.props['aria-pressed'], 'false')
      button.props.onClick()
      button = toggle.component({ sessionId: 'session-dc-new-org' })
      react.flushEffects()
      assert.equal(button.props['aria-pressed'], 'true')
      // 点开面板后自动建的终端，请求体里带着这个会话 id。
      await tick()
      const post = net.calls.find(call => (call.init?.method ?? 'GET') === 'POST')
      assert.notEqual(post, undefined, '展开空面板应当自动建一个终端')
      assert.equal(JSON.parse(post.init.body).sessionId, 'session-dc-new-org')

      const panelRegistration = harness.registrations.find(entry => entry.options.name === 'shell.overlay')
      const tree = panelRegistration.component()
      const cleanups = react.flushEffects()
      assert.equal(tree.type, 'div')
      // 假 React 不提交 DOM，所以手动执行一次 ref 回调（真实 React 会自己做），
      // 否则测不到「面板与对话区对齐」这条几何逻辑。
      const panelElement = { style: {} }
      tree.props.ref(panelElement)

      // 让位：只有对话区被压短，左右两栏都没有内联高度。
      assert.equal(columns.center.style.height, 'calc(100% - var(--dsh-terminal-inset))')
      assert.equal(columns.sidebar.style.height, undefined, '左栏不该被压缩')
      assert.equal(columns.rightbar.style.height, undefined, '右栏不该被压缩')
      assert.equal(dom.document.documentElement.getPropertyValue('--dsh-terminal-inset'), '340px')
      // 几何：面板就是对话区那一块（280 → 1920）。
      assert.equal(panelElement.style.left, '280px')
      assert.equal(panelElement.style.width, '1640px')
      assert.equal(dom.document.documentElement.getPropertyValue('--dsh-terminal-left'), '280px')
      assert.equal(dom.document.documentElement.getPropertyValue('--dsh-terminal-width'), '1640px')

      // Ctrl+` 收起 → 留白清零、内联高度还原，面板不再渲染。
      let prevented = false
      dom.fire('keydown', {
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        key: '`',
        code: 'Backquote',
        target: { blur() {} },
        preventDefault() { prevented = true },
        stopPropagation() {},
      })
      assert.equal(panelRegistration.component(), null, '收起后面板不该渲染')
      react.flushEffects()
      assert.equal(prevented, true, 'Ctrl+` 应当被拦截，避免反引号被打进草稿')
      // 收起：变量归零（0px 表示「没有留白」），两个列的内联高度还原成空。
      assert.equal(dom.document.documentElement.getPropertyValue('--dsh-terminal-inset'), '0px')
      assert.equal(columns.center.style.height ?? '', '', '收起时应当还原对话区的内联高度')
      await tick()
      assert.ok(net.calls.some(call => call.url.endsWith('/terminals')), '挂载时应当与宿主对账')
      cleanups()
    } finally {
      dom.cleanup()
    }
  })

  test('右栏展开时对话区（与面板）跟着变窄，面板不越界到右栏', async () => {
    // 右栏占 420px：对话区变成 280–1500，面板必须正好是这一块。
    const { dom, columns } = installFramedDom({ rightbarWidth: 420 })
    try {
      const { exports, react } = await loadClient(() => {})
      const harness = fakeClientContext()
      exports.apply(harness.ctx)
      for (const entry of harness.injections) entry.callback()
      const toggle = harness.registrations.find(entry => entry.options.name === 'conversation.input.left')
      toggle.component().props.onClick()
      react.flushEffects()
      const panel = harness.registrations.find(entry => entry.options.name === 'shell.overlay')
      const tree = panel.component()
      react.flushEffects()
      const panelElement = { style: {} }
      tree.props.ref(panelElement)
      assert.equal(columns.center.style.height, 'calc(100% - var(--dsh-terminal-inset))')
      assert.equal(columns.sidebar.style.height, undefined)
      assert.equal(columns.rightbar.style.height, undefined, '右栏展开时也不该被压缩')
      assert.equal(panelElement.style.left, '280px')
      assert.equal(panelElement.style.width, '1220px', '面板宽度 = 对话区宽度，不含右栏那 420px')
      assert.equal(
        Number.parseInt(panelElement.style.left, 10) + Number.parseInt(panelElement.style.width, 10),
        1500,
        '面板右边缘应当落在右栏左边缘上',
      )
    } finally {
      dom.cleanup()
    }
  })

  test('右侧栏全屏时不做让位（避免留下视觉残影）', async () => {
    const { dom, frame, columns } = installFramedDom()
    try {
      const { exports, react } = await loadClient(() => {})
      const harness = fakeClientContext()
      exports.apply(harness.ctx)
      for (const entry of harness.injections) entry.callback()
      const toggle = harness.registrations.find(entry => entry.options.name === 'conversation.input.left')
      toggle.component().props.onClick()
      react.flushEffects()
      // 右侧栏全屏：它 position:fixed 盖住整个框架，任何让位都是残影。
      frame.setAttribute('data-rightbar-fullscreen', '')
      const panel = harness.registrations.find(entry => entry.options.name === 'shell.overlay')
      panel.component()
      react.flushEffects()
      assert.equal(columns.center.style.height, undefined, '全屏右侧栏盖住框架，不该压中间列')
      assert.equal(dom.document.documentElement.getPropertyValue('--dsh-terminal-inset'), '0px')
    } finally {
      dom.cleanup()
    }
  })
})
