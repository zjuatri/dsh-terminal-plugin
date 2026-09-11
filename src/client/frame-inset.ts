/**
 * 面板的几何与让位：面板只占**中间对话区**这一块 —— 高度压缩对话区，左右两侧的
 * 侧边栏都不动。
 *
 * 实测的产品布局（`dsh-web-frontend/dist` + `dsh-client-ui-layout`）是：
 *
 * ```html
 * <div id="root" style="height:100%">
 *   <div class="…_frame" style="grid-template-columns: 280px 1640px 0px">   <!-- display:grid -->
 *     <div class="…_sidebarCol">   <!-- 左栏，全高 -->
 *     <div class="…_centerCol">    <!-- 对话区 -->
 *     <div class="…_rightbarCol">  <!-- 右侧栏（收起时宽 0） -->
 *     <div class="…_overlayLayer"> <!-- 浮层，面板挂在这里 -->
 *   </div>
 * </div>
 * ```
 *
 * 于是：
 *
 * - **让位**只写中间列的高度：`.…_centerCol { height: calc(100% - var(--dsh-terminal-inset)) }`。
 *   左右两栏各自全高，一行内联样式都不写。
 * - **面板位置**从中间列量出来（`centerBox()`），左边缘与宽度都跟着对话区走，所以左栏收起、
 *   右栏展开/收起、拖分隔条三种情况下面板都自动对齐。
 *
 * 走过的弯路（都在代码里留了注释）：先改 `#root` 高度 → 把左栏一起压短、面板横跨整屏；
 * 再改成「压中间列 + 右栏、面板铺到视口右边缘」→ 右栏还是被面板占了。
 *
 * 例外：右侧栏**全屏**时它 `position:fixed` 盖住整个框架，任何让位都是无意义的视觉残影，
 * 所以那一档不写内联样式（框架自己会给它 `data-rightbar-fullscreen`）。
 *
 * 侵入面：中间列一条 `height` + 三个 CSS 变量；收起时**完全还原**（删掉内联样式与变量，
 * 而不是写回 0）。
 *
 * @module dsh-terminal-plugin/src/client/frame-inset
 */

import { INSET_VARIABLE, LEFT_VARIABLE, WIDTH_VARIABLE } from './styles.js'
/**
 * 认列的 class 名子串。
 *
 * 产品的 class 名是 CSS Modules 生成的（`pI_x6G_frame`、`pI_x6G_centerCol` …），带构建期
 * 哈希，所以只能按子串认。**后缀用 `\b` 而不是 `_`**：实测的类名就长成
 * `pI_x6G_centerCol`，`_centerCol_` 这种写法一个都匹配不上（坑过一次：面板照常渲染，
 * 但只有 CSS 变量被设上，列高一条都没写）。
 */
const FRAME_PATTERN = /_frame\b/
/** 对话区那一列：面板只在它里面。 */
const CENTER_PATTERN = /_centerCol\b/

/** 记录本模块写过的内联高度，还原时按原样放回。 */
const previousHeight = new WeakMap<HTMLElement, string>()
/**
 * 上一次生效的高度。
 *
 * `-1` 是「不确定」：面板卸载后下一次 `applyFrameInset(0)` 必须真的执行还原（清掉 CSS
 * 变量与内联高度），不能因为「上次数值也是 0」而提前返回。写内联样式会触发我们自己的
 * 观察器，所以正常的重复调用仍然靠这个值短路。
 */
let appliedInset = -1
/** 框架上的 `data-*` 观察器：右侧栏展开/全屏切换时重算。 */
let observer: MutationObserver | null = null

/** 按 class 名子串找元素（class 名带哈希，不能写死）。 */
function find(pattern: RegExp): HTMLElement | null {
  for (const node of document.querySelectorAll<HTMLElement>('div')) {
    if (pattern.test(node.className)) return node
  }
  return null
}

/**
 * 框架根元素。
 *
 * @returns 元素，或 null（产品换布局时不能让面板把页面搞坏）。
 */
export function findFrame(): HTMLElement | null {
  return find(FRAME_PATTERN)
}

/**
 * 对话区当前占的那块矩形 —— 面板的位置与宽度就是它。
 *
 * 从左栏与右栏的关系推不出来（左栏能收成 rail、右栏能在全屏与停靠之间切换），所以直接量
 * 中间列自己。
 *
 * @returns `{ left, width }`；量不到对话区时给一个保守兜底（贴左、铺满），至少不会挤成 0 宽。
 */
export function centerBox(): { left: number; width: number } {
  const center = find(CENTER_PATTERN)
  if (center === null) return { left: 0, width: globalThis.innerWidth ?? 0 }
  const rect = center.getBoundingClientRect()
  return { left: Math.max(0, Math.round(rect.left)), width: Math.max(0, Math.round(rect.width)) }
}

/**
 * 应用（或清除）对话区的让位。
 *
 * @param height - 面板占用的像素高度；0 表示收起。
 */
export function applyFrameInset(height: number): void {
  const frame = findFrame()
  const inset = Math.max(0, Math.round(height))
  const center = find(CENTER_PATTERN)
  // 右侧栏全屏时它盖住整个框架，让位只会留下残影。
  const effective = frame !== null && frame.hasAttribute('data-rightbar-fullscreen') ? 0 : inset

  // 数值没变就短路（写内联样式会触发我们自己的观察器）；`-1` 表示状态未知，必须重算。
  if (effective === appliedInset) return
  document.documentElement.style.setProperty(INSET_VARIABLE, `${String(effective)}px`)
  if (center !== null) {
    if (effective === 0) {
      const previous = previousHeight.get(center)
      if (previous === undefined) center.style.removeProperty('height')
      else center.style.height = previous
      previousHeight.delete(center)
    } else {
      if (!previousHeight.has(center)) previousHeight.set(center, center.style.height ?? '')
      center.style.height = `calc(100% - var(${INSET_VARIABLE}))`
    }
  }
  appliedInset = effective
  watchFrame(frame)
  nudgeLayout()
}

/**
 * 卸载时还原（幂等）。
 */
export function clearFrameInset(): void {
  observer?.disconnect()
  observer = null
  const center = find(CENTER_PATTERN)
  document.documentElement.style.removeProperty(INSET_VARIABLE)
  if (center !== null) {
    const previous = previousHeight.get(center)
    if (previous === undefined) center.style.removeProperty('height')
    else center.style.height = previous
    previousHeight.delete(center)
  }
  appliedInset = -1
  nudgeLayout()
}

/**
 * 观察框架上的右侧栏状态。
 *
 * 右侧栏自己报告 `data-rightbar-collapsed` / `data-rightbar-fullscreen`，属性一变就让位
 * 方案跟着变 —— 不需要知道侧边栏的状态机，也不会和它抢内联样式（改的是不同元素）。
 *
 * @param frame 框架根；null 时不挂观察。
 */
function watchFrame(frame: HTMLElement | null): void {
  if (observer !== null || frame === null) return
  observer = new MutationObserver(() => {
    if (observer === null) return
    observer.disconnect()
    observer = null
    // 重新走一遍完整计算（同时会重新挂上观察器）。
    const current = appliedInset
    appliedInset = -1
    applyFrameInset(current)
  })
  observer.observe(frame, { attributes: true, attributeFilter: ['data-rightbar-collapsed', 'data-rightbar-fullscreen'] })
}

/**
 * 触发布局重算。
 *
 * 框架自己的 ResizeObserver 会看到列高变化；这里额外派发一次 `resize`，让依赖
 * `window.innerHeight` 的组件也跟上。
 */
function nudgeLayout(): void {
  try {
    globalThis.dispatchEvent(new Event('resize'))
  } catch {
    // 非浏览器环境（测试）里没有 dispatchEvent：忽略。
  }
}

/**
 * 订阅 window 的尺寸事件（浏览器里 `globalThis` 就是 `window`；测试替身只挂了
 * `globalThis.window`，所以两处都试）。
 *
 * @param type - 事件名。
 * @param handler - 处理函数。
 * @returns 取消订阅的函数。
 */
export function onWindowEvent(type: string, handler: () => void): () => void {
  const target = typeof globalThis.addEventListener === 'function' ? globalThis : globalThis.window
  if (target === undefined || typeof target.addEventListener !== 'function') return () => {}
  target.addEventListener(type, handler)
  return () => { target.removeEventListener(type, handler) }
}
