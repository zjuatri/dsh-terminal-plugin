//! 自动生成，请勿直接编辑 —— 由 scripts/build.mjs 从 src/client/*.ts 生成。
//!
//! 本文件是 DSH 的 lazy-CJS 客户端插件格式：执行它只会**注册**工厂，什么都不会运行；
//! 真正的模块体（含样式注入）在模块系统实体化插件时才执行。只允许 require 平台种子：
//! `react`（以及 shell 提供的其它种子）。其余一切都已内联在本文件里。
window.__ModuleLoader__.load({
  id: "dsh-terminal-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");
    const h = react.createElement;
    const { useState, useEffect, useLayoutEffect, useMemo, useReducer, useCallback, useRef, useContext, useSyncExternalStore, Fragment, memo, forwardRef, createContext, createElement, cloneElement, Children } = react;

    // ── src/client/react.ts ──
    const M1 = (() => {
    /**
     * React 门面：本插件所有组件从这里取 React，而不是各自 `from 'react'`。
     *
     * 两个原因：
     *
     * 1. **运行时合同**：客户端产物是 lazy-CJS，`factory(require)` 只能取到平台种子模块。
     *    构建脚本（`scripts/emit-client.mjs`）在工厂顶部一次性取出 `react` 的具名导出与
     *    `h = react.createElement`，再把它们挂到入口模块的命名空间上。这里显式 import
     *    这些名字，构建期就能把它们做成模块内绑定，运行期不会出现
     *    「`useState is not defined`」这种离原因很远的报错。
     * 2. **测试替身**：`test/client-apply.test.mjs` 用一组最小实现替换 React，验证槽位注册
     *    与样式注入。只有一处 import 面，替身才好写。
     *
     * @module dsh-terminal-plugin/src/client/react
     */


    /** 组件能返回的东西（用 `unknown` 是为了不让类型声明成为运行期依赖）。 */
      return {
        h,
        createElement,
        Fragment,
        useCallback,
        useEffect,
        useMemo,
        useRef,
        useState,
        useSyncExternalStore,
      }
    })()

    // ── src/client/text.ts ──
    const M2 = (() => {
    /**
     * 界面文案：以中文为准，英文作对照。组件里不允许出现硬编码字符串。
     *
     * 工具说明与技能目录是**给模型看**的接口，本插件没有那半边；这里的文案只给人看。
     *
     * @module dsh-terminal-plugin/src/client/text
     */

    /** 文案命名空间（`ctx.locale.register(NS, …)` 的键）。 */
    const NS = 'dsh-terminal'
    /** 中文文案（主）。 */
    const zh = {
      'toggle.label': '切换终端面板',
      'toggle.hint': 'Ctrl+` 打开或收起底部终端',
      'panel.label': '终端面板',
      'panel.new': '新建终端',
      'panel.newHint': '新建终端（Ctrl+Shift+`）',
      'panel.close': '收起面板',
      'panel.closeHint': '收起面板（Ctrl+`）',
      'panel.resizeHint': '拖动调整高度',
      'panel.empty': '还没有终端，点「+」新建一个',
      'panel.loading': '正在加载终端…',
      'panel.loadFailed': '终端渲染器加载失败',
      'panel.loadRetry': '重试',
      'panel.connecting': '正在连接…',
      'panel.connected': '已连接',
      'panel.disconnected': '连接已断开，正在重连',
      'panel.exited': '进程已退出（代码 {code}）',
      'panel.truncated': '（更早的输出已超过回放上限，未显示）',
      'panel.terminated': '终端已结束',
      'panel.retryHint': '重试',
      'tab.close': '关闭终端',
      'tab.running': '运行中',
      'tab.exited': '已退出',
      'tab.busy': '有新输出',
      'error.tooMany': '同时打开的终端太多了，先关掉几个',
      'error.noTerminal': '这个终端已经不存在了',
      'error.spawn': '终端启动失败',
    }
    /** 英文对照。 */
    const en = {
      'toggle.label': 'Toggle terminal panel',
      'toggle.hint': 'Ctrl+` opens the bottom terminal',
      'panel.label': 'Terminal panel',
      'panel.new': 'New terminal',
      'panel.newHint': 'New terminal (Ctrl+Shift+`)',
      'panel.close': 'Hide panel',
      'panel.closeHint': 'Hide panel (Ctrl+`)',
      'panel.resizeHint': 'Drag to resize',
      'panel.empty': 'No terminal yet — click “+” to create one',
      'panel.loading': 'Loading terminal…',
      'panel.loadFailed': 'Terminal renderer failed to load',
      'panel.loadRetry': 'Retry',
      'panel.connecting': 'Connecting…',
      'panel.connected': 'Connected',
      'panel.disconnected': 'Disconnected, reconnecting',
      'panel.exited': 'Process exited (code {code})',
      'panel.truncated': '(earlier output dropped: replay buffer limit)',
      'panel.terminated': 'Terminal closed',
      'panel.retryHint': 'Retry',
      'tab.close': 'Close terminal',
      'tab.running': 'Running',
      'tab.exited': 'Exited',
      'tab.busy': 'New output',
      'error.tooMany': 'Too many terminals are open — close a few first',
      'error.noTerminal': 'That terminal no longer exists',
      'error.spawn': 'Terminal failed to start',
    }
    /** 文案键的联合类型（由中文文案推导）。 */
                                             

    /** 槽位框架注入的翻译函数：取键、可带占位符替换。 */
      return {
        NS,
        zh,
        en,
      }
    })()

    // ── src/client/styles.ts ──
    const M3 = (() => {
    /**
     * 面板样式表。
     *
     * 配色原则跟同级 `dsh-browser-plugin` 一致：**不写死任何颜色**，全部走 DSH 的设计令牌
     * （`--dsw-alias-*`、`--dsw-static-*`），由主题包按当前亮/暗模式定义，因此这里的样式
     * 在亮色与暗色主题下都成立，不需要两份。
     *
     * 两个自己拥有的变量：
     *
     * - `--dsh-terminal-inset` —— 面板占用的高度，同时是面板自身的高度与 `#root` 的压缩量。
     *   由 `frame-inset.ts` 写、`panel.tsx` 读，保证「面板多高、对话区就让出多少」只由一处决定。
     * - `--dsh-terminal-panel-*` —— 面板内部的间距常量，避免在十几个地方重复写魔数。
     *
     * 样式挂在 `<style data-plugin="dsh-terminal-plugin">` 上；`data-plugin` 必须是本包的
     * 准确名字，客户端 HMR 就是按这个键清理过期样式的。
     *
     * @module dsh-terminal-plugin/src/client/styles
     */

    /** 本包名，作为 `<style>` 标签的归属标记（HMR 清理用）。 */
    const PLUGIN_TAG = 'dsh-terminal-plugin'
    /** 面板高度的 CSS 变量名。 */
    const INSET_VARIABLE = '--dsh-terminal-inset'
    /** 面板左边缘的 CSS 变量名（等于对话区左边缘，由 `frame-inset.ts` 量出来）。 */
    const LEFT_VARIABLE = '--dsh-terminal-left'
    /** 面板宽度的 CSS 变量名（等于对话区宽度；右栏展开时对话区变窄，面板跟着变窄）。 */
    const WIDTH_VARIABLE = '--dsh-terminal-width'
    /** 面板样式表本体（导出给测试断言「没有硬编码颜色」）。 */
    const PANEL_CSS = `
    .dsh-term-root{
      position:fixed;
      /*
       * 面板只占**中间对话区**这一块：左边缘与宽度都从对话区量出来
       * （frame-inset.ts 的 centerBox），底部贴视口底，高度由 inset 决定。
       * 左右两个侧边栏都不碰，各自保持全高。
       */
      left:var(${LEFT_VARIABLE},280px);width:var(${WIDTH_VARIABLE},100%);right:auto;bottom:0;z-index:12;
      height:var(${INSET_VARIABLE},0px);
      display:flex;flex-direction:column;min-height:0;
      background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,transparent));
      border-top:.5px solid var(--dsw-alias-border-l3,currentColor);
      color:var(--dsw-alias-label-primary,inherit);
      font-size:var(--dsh-content-font-size-secondary,13px);
      transition:height var(--ds-transition-duration-slow,0ms) var(--ds-ease-in-out,ease);
    }
    .dsh-term-root[data-resizing="true"]{transition:none}
    .dsh-term-resize{
      position:absolute;left:0;right:0;top:-3px;height:7px;cursor:row-resize;touch-action:none;
    }
    .dsh-term-bar{
      display:flex;align-items:center;gap:4px;padding:4px 6px;flex:0 0 auto;
      border-bottom:.5px solid var(--dsw-alias-border-l2,currentColor);
    }
    .dsh-term-tabs{display:flex;align-items:center;gap:2px;flex:1 1 auto;min-width:0;overflow-x:auto}
    .dsh-term-tab{
      display:flex;align-items:center;gap:5px;flex:0 0 auto;max-width:200px;
      padding:3px 4px 3px 8px;border-radius:6px;cursor:pointer;user-select:none;
      color:var(--dsw-alias-label-secondary,inherit);
      background:transparent;border:.5px solid transparent;
    }
    .dsh-term-tab:hover{background:var(--dsw-alias-interactive-bg-hover,transparent)}
    .dsh-term-tab[data-active="true"]{
      color:var(--dsw-alias-label-primary,inherit);
      background:var(--dsw-static-blue-50,var(--dsw-alias-bg-layer-2,transparent));
      border-color:var(--dsw-static-blue-100,var(--dsw-alias-border-l3,transparent));
    }
    .dsh-term-tabLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dsh-term-tabDot{
      width:6px;height:6px;border-radius:50%;flex:0 0 auto;
      background:var(--dsw-alias-state-success-primary,currentColor);
    }
    .dsh-term-tabDot[data-state="exited"]{background:var(--dsw-alias-label-caption,currentColor)}
    .dsh-term-tabDot[data-state="busy"]{background:var(--dsw-static-blue-500,currentColor)}
    .dsh-term-tabClose{
      appearance:none;border:0;background:transparent;cursor:pointer;padding:0 3px;
      color:inherit;opacity:.55;font-size:12px;line-height:1;border-radius:4px;
    }
    .dsh-term-tabClose:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover,transparent)}
    .dsh-term-btn{
      appearance:none;flex:0 0 auto;cursor:pointer;font:inherit;
      padding:4px 7px;border-radius:6px;
      /* 图标按钮：inline-flex 居中，图标自己带尺寸，所以行高不参与排版。 */
      display:inline-flex;align-items:center;justify-content:center;line-height:0;
      color:var(--dsw-alias-label-secondary,inherit);
      background:transparent;border:.5px solid transparent;
    }
    .dsh-term-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,transparent)}
    .dsh-term-btn:disabled{opacity:.5;cursor:not-allowed}
    .dsh-term-btn svg{display:block}
    .dsh-term-body{position:relative;flex:1 1 auto;min-height:0;background:transparent}
    .dsh-term-view{position:absolute;inset:0;padding:4px 6px;display:none}
    .dsh-term-view[data-active="true"]{display:block}
    .dsh-term-view .xterm{height:100%}
    .dsh-term-note{
      display:flex;align-items:center;gap:8px;padding:14px 16px;
      color:var(--dsw-alias-label-tertiary,inherit);line-height:1.6;
    }
    .dsh-term-note[data-tone="error"]{color:var(--dsw-alias-state-error-primary,inherit)}
    .dsh-term-toast{
      position:absolute;right:10px;bottom:10px;max-width:70%;
      padding:6px 10px;border-radius:8px;
      background:var(--dsw-alias-bg-layer-2,transparent);
      border:.5px solid var(--dsw-alias-border-l3,currentColor);
      color:var(--dsw-alias-label-secondary,inherit);
      box-shadow:var(--dsw-shadow-overlay,0 4px 14px rgb(0 0 0 / 12%));
    }
    .dsh-term-toggle{
      appearance:none;display:inline-flex;align-items:center;justify-content:center;
      width:28px;height:28px;padding:0;border-radius:6px;cursor:pointer;
      color:var(--dsw-alias-label-secondary,inherit);
      background:transparent;border:.5px solid transparent;
    }
    .dsh-term-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,transparent)}
    .dsh-term-toggle[data-active="true"]{
      color:var(--dsw-alias-label-primary,inherit);
      background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover,transparent));
    }
    .dsh-term-toggle svg{display:block}
    `
    /** 注入样式表（幂等）。 */
    function ensureStyles()       {
      if (document.head.querySelector(`style[data-plugin="${PLUGIN_TAG}"]`) !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = PLUGIN_TAG
      tag.textContent = PANEL_CSS
      document.head.appendChild(tag)
    }
      return {
        PLUGIN_TAG,
        INSET_VARIABLE,
        LEFT_VARIABLE,
        WIDTH_VARIABLE,
        PANEL_CSS,
        ensureStyles,
      }
    })()

    // ── src/client/frame-inset.ts ──
    const M4 = (() => {
      const { INSET_VARIABLE, LEFT_VARIABLE, WIDTH_VARIABLE } = M3
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
    const previousHeight = new WeakMap                     ()
    /**
     * 上一次生效的高度。
     *
     * `-1` 是「不确定」：面板卸载后下一次 `applyFrameInset(0)` 必须真的执行还原（清掉 CSS
     * 变量与内联高度），不能因为「上次数值也是 0」而提前返回。写内联样式会触发我们自己的
     * 观察器，所以正常的重复调用仍然靠这个值短路。
     */
    let appliedInset = -1
    /** 框架上的 `data-*` 观察器：右侧栏展开/全屏切换时重算。 */
    let observer                          = null

    /** 按 class 名子串找元素（class 名带哈希，不能写死）。 */
    function find(pattern        )                     {
      for (const node of document.querySelectorAll             ('div')) {
        if (pattern.test(node.className)) return node
      }
      return null
    }

    /**
     * 框架根元素。
     *
     * @returns 元素，或 null（产品换布局时不能让面板把页面搞坏）。
     */
    function findFrame()                     {
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
    function centerBox()                                  {
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
    function applyFrameInset(height        )       {
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
    function clearFrameInset()       {
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
    function watchFrame(frame                    )       {
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
    function nudgeLayout()       {
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
    function onWindowEvent(type        , handler            )             {
      const target = typeof globalThis.addEventListener === 'function' ? globalThis : globalThis.window
      if (target === undefined || typeof target.addEventListener !== 'function') return () => {}
      target.addEventListener(type, handler)
      return () => { target.removeEventListener(type, handler) }
    }
      return {
        FRAME_PATTERN,
        CENTER_PATTERN,
        previousHeight,
        appliedInset,
        observer,
        find,
        findFrame,
        centerBox,
        applyFrameInset,
        clearFrameInset,
        watchFrame,
        nudgeLayout,
        onWindowEvent,
        INSET_VARIABLE,
        LEFT_VARIABLE,
        WIDTH_VARIABLE,
      }
    })()

    // ── src/protocol.ts ──
    const M5 = (() => {
    /**
     * 终端面板的线路协议：宿主（`src/wire.ts`）与浏览器（`src/client/pty-client.ts`）
     * 共用同一份声明，避免两端各写一遍判别联合而慢慢漂移。
     *
     * 一帧 = 一个 JSON 对象。文本帧而不是二进制：终端输出是 UTF-8 文本，JSON 字符串
     * 天然承载它（含控制字符，转义后仍是无损往返），两端都不必再做一层长度前缀。
     *
     * @module dsh-terminal-plugin/src/protocol
     */

    /** 一个终端当前的可观察状态（宿主 → 客户端、HTTP 列表与 WS hello 共用）。 */
                                   
                         
                
                                                   
                  
                         
                 
                                               
                                 
                                                 
                             
                  
                  
                  
                  
                              
                       
     

    /** 协议里用的错误码。 */
                                                                                                                  

    /** 客户端 → 服务端。 */
                             
                                                                                                              
                                                                
                                                                                      
                                                                                                              

    /** 服务端 → 客户端。 */
                             
         
                              
                               
                                       
                                                            
                               
                                
                                   
       
                                                                                       
                                                                                       
                                                                                                
                                                                                          

    /** 创建终端的 HTTP 请求体。 */
                                            
                                           
                           
         
                       
        
                                                                    
                                                      
                                                              
         
                                 
                  
                            
                  
                            
                    
                            
     

    /** 创建终端的 HTTP 响应体。 */
                                             
                                     
     

    /** 列出终端的 HTTP 响应体。 */
                                            
                                                 
     

    /** HTTP 失败响应体。 */
                                    
                                  
                              
                                     
                            
     

    /** 引导行注入到页面的全局名（客户端从这里读到挂载前缀与资产版本）。 */
    const BOOTSTRAP_GLOBAL = '__DSH_TERMINAL_PLUGIN__'
    /** 引导行携带的宿主事实。 */
                                     
                                         
                                  
                                              
                                
     

    /** 解析输出里的 OSC 标题序列，取最后一个非空标题。 */
    function extractOscTitle(chunk        )                {
      // ESC ] 0 ; <title> BEL  或  ESC ] 2 ; <title> ESC \
      const pattern = /\u001b\](?:0|2);([^\u0007\u001b]*)(?:\u0007|\u001b\\)/gu
      let latest                = null
      for (const match of chunk.matchAll(pattern)) {
        const title = match[1].trim()
        if (title.length > 0) latest = title
      }
      return latest
    }
      return {
        BOOTSTRAP_GLOBAL,
        extractOscTitle,
      }
    })()

    // ── src/client/bootstrap.ts ──
    const M6 = (() => {
      const { BOOTSTRAP_GLOBAL } = M5
    /**
     * 引导信息与路径拼接。
     *
     * 宿主在 index.html 的 `</head>` 前注入一段引导脚本，把挂载前缀与资源版本交给页面
     * （见 `src/wire.ts` 的 `bootstrapTag()`）；本模块负责读它，并把前缀拼成完整的请求
     * 路径。前缀可配置，所以客户端里的任何路径都**不能**写死。
     *
     * @module dsh-terminal-plugin/src/client/bootstrap
     */


    /** 默认前缀：引导行还没跑到时（理论上不会发生）用的兜底。 */
    const FALLBACK_PREFIX = '/dsh-terminal'

    /** 读到的引导信息；重复调用返回同一个对象。 */
    let cached                        = null

    /**
     * 读取宿主注入的引导信息。
     *
     * @returns 挂载前缀与资源版本。
     */
    function bootstrap()                 {
      if (cached !== null) return cached
      const raw = (globalThis                           )[BOOTSTRAP_GLOBAL]
      if (typeof raw === 'object' && raw !== null) {
        const candidate = raw                           
        if (typeof candidate.mountPrefix === 'string' && candidate.mountPrefix.length > 0) {
          cached = {
            mountPrefix: candidate.mountPrefix.replace(/\/+$/u, ''),
            assetsRev: typeof candidate.assetsRev === 'string' ? candidate.assetsRev : 'dev',
          }
          return cached
        }
      }
      cached = { mountPrefix: FALLBACK_PREFIX, assetsRev: 'unknown' }
      return cached
    }
    /**
     * 拼接本插件的一个路径。
     *
     * @param suffix - 前缀之后的部分，例如 `/terminals`。
     * @returns 完整路径。
     */
    function pluginPath(suffix        )         {
      return `${bootstrap().mountPrefix}${suffix}`
    }
    /**
     * 资源 URL（带版本查询串，便于 CDN / 浏览器缓存命中）。
     *
     * @param name - 资源文件名，例如 `xterm.mjs`。
     * @returns 带 `?rev=` 的绝对路径。
     */
    function assetUrl(name        )         {
      const info = bootstrap()
      return `${info.mountPrefix}/assets/${name}?rev=${encodeURIComponent(info.assetsRev)}`
    }
    /**
     * WebSocket 地址。
     *
     * @param suffix - 前缀之后的部分，例如 `/ws`。
     * @returns `ws:` 或 `wss:` 开头的绝对地址（跟随页面协议，https 页面不会因为明文 ws 被拦）。
     */
    function socketUrl(suffix        )         {
      const protocol = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${globalThis.location?.host ?? 'localhost'}${pluginPath(suffix)}`
    }
      return {
        FALLBACK_PREFIX,
        cached,
        bootstrap,
        pluginPath,
        assetUrl,
        socketUrl,
        BOOTSTRAP_GLOBAL,
      }
    })()

    // ── src/client/xterm-loader.ts ──
    const M7 = (() => {
      const { assetUrl } = M6
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


    /** xterm 终端实例里本插件真正用到的那部分（结构性类型，不引入 xterm 的类型声明）。 */
                                    
                           
                           
                                        
                               
                                 
                   
                     
                                     
                                     
                                                                   
                                                                   
                                                                           
                                                                                             
                                      
                             
                
                  
                                                                                                 
         
       
     

    /** fit addon 的实例面。 */
                                   
                 
                                                                     
                                       
                     
     

    /** 全局挂钩的名字。 */
    const HOST_GLOBAL = '__DSH_TERMINAL_XTERM__'

    /** 渲染器模块的导出面。 */
                           
                                                                       
                                      
     

    /** 加载状态：in-flight 或已完成，避免并发重复注入。 */
    let loading                              = null
    /** 已注入的 `<script>`，便于插件卸载时清理。 */
    let injectedScript                           = null
    /** CSS 是否注入过。 */
    let cssInjected = false

    /** 已挂到全局的模块（脚本执行完成后）。 */
    function readGlobal()                     {
      const raw = (globalThis                           )[HOST_GLOBAL]
      if (typeof raw !== 'object' || raw === null) return null
      const candidate = raw                        
      return typeof candidate.Terminal === 'function' && typeof candidate.FitAddon === 'function'
        ? (candidate               )
        : null
    }

    /** 等全局出现，或等超时 / 脚本报错。 */
    function waitForGlobal(timeoutMs        )                       {
      return new Promise((resolve, reject) => {
        const started = Date.now()
        const tick = ()       => {
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
    function injectBootstrap()       {
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
        delete (globalThis                           )[HOST_GLOBAL]
      })
      document.head.appendChild(script)
      injectedScript = script
    }

    /** 注入 xterm 自己的 CSS（幂等）。 */
    async function injectCss()                {
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
    async function loadXterm()                       {
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
          .catch((error         ) => {
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
    function disposeXtermHost()       {
      injectedScript?.remove()
      injectedScript = null
      loading = null
      cssInjected = false
      for (const node of document.querySelectorAll('style[data-plugin="dsh-terminal-plugin/xterm"]')) {
        node.remove()
      }
      delete (globalThis                           )[HOST_GLOBAL]
    }
      return {
        HOST_GLOBAL,
        loading,
        injectedScript,
        cssInjected,
        readGlobal,
        waitForGlobal,
        injectBootstrap,
        injectCss,
        loadXterm,
        disposeXtermHost,
        assetUrl,
      }
    })()

    // ── src/client/state.ts ──
    const M8 = (() => {
      const { pluginPath } = M6
    /**
     * 面板状态的唯一真相源。
     *
     * 一个手写 pub/sub store（`getSnapshot` / `subscribe`），配合 React 的
     * `useSyncExternalStore` 订阅 —— 不引入状态库，也不需要 `useState` 在多个组件之间
     * 传递。**终端列表的真相源是宿主**：挂载时 `GET /terminals` 对账，本地只保存
     * 「面板开没开、多高、当前选中哪个」这类纯 UI 偏好（写进 `localStorage`）。
     *
     * 网络出入口（`refresh` / `create` / `close`）也在这里，因为它们是状态迁移本身，
     * 交给组件做会出现「组件卸载了但请求还在飞」的经典问题。
     *
     * @module dsh-terminal-plugin/src/client/state
     */

                                                                                                                   

    /** 标签页上显示的一个终端。 */
                                    
                      
                
                 
                  
                  
                                             
                                         
                             
                                  
                     
     

    /** 对外发布的不可变快照。 */
                                    
                    
                      
                      
                    
                        
                             
                         
                                         
                                                        
                   
         
                       
        
                                                                       
                                          
         
                                    
                                        
                           
     

    /** 高度夹紧范围。 */
    const HEIGHT_MIN = 160
    const HEIGHT_MAX_RATIO = 0.8
    const HEIGHT_DEFAULT = 340

    /** localStorage 的键。 */
    const STORAGE_KEY = 'dsh-terminal:ui'

    /** 需要落盘的偏好。 */
                           
                       
                     
                              
     

    /** 面板状态与动作。 */
                                         
                                                        
                                  
                  
                                                 
         
               
        
                                                           
                                         
         
                    
                                                        
                  
                  
                   
         
                   
        
                                          
        
                              
                                                  
         
                                                 
         
                                       
        
                                                                    
         
                                                           
                                                      
                                        
                         
                                     
                     
                             
                                       
                                         
                                 
                                              
                                
                                
                         
                                                           
                       
                                               
                     
                                  
                            
                              
                     
                         
     

    /** 创建 store 时可注入的依赖（测试用）。 */
                                   
                                                          
                                   
                                         
                                                    
                                                
                              
         
                                       
                      
         
                                   
     

    /** 从 localStorage 读回偏好（任何异常都当作没有）。 */
    function readPersisted(storage                                      )              {
      try {
        const raw = storage?.getItem(STORAGE_KEY)
        if (raw === null || raw === undefined) return {}
        const parsed = JSON.parse(raw)               
        return typeof parsed === 'object' && parsed !== null ? parsed : {}
      } catch {
        return {}
      }
    }

    /** 把终端元数据映射成标签条目。 */
    function toEntry(meta              )                {
      return { id: meta.id, name: meta.name, state: meta.state, exitCode: meta.exitCode, unseen: false }
    }

    /**
     * 创建 store。
     *
     * @param options - 可注入的窗口、存储与 fetch（测试替身）。
     * @returns 面板 store。
     */
    function createTerminalPanelStore(options               = {})                     {
      const viewportHeight = options.viewportHeight ?? (() => globalThis.innerHeight || 800)
      const storage = options.storage ?? globalThis.localStorage
      const doFetch = options.fetchImpl ?? globalThis.fetch
      const autoCreateTerminals = options.autoCreateTerminals ?? true

      const persisted = readPersisted(storage)
      let snapshot                = {
        visible: persisted.visible === true,
        height: clampHeight(persisted.height ?? HEIGHT_DEFAULT, viewportHeight()),
        activeId: typeof persisted.activeId === 'string' ? persisted.activeId : null,
        terminals: [],
        count: 0,
        activeSessionId: null,
        notice: null,
      }
      const listeners = new Set            ()

      /** 发布一个新快照（浅比较由调用方负责；这里只在真的变了时通知）。 */
      const publish = (patch                        )       => {
        const next                = { ...snapshot, ...patch }
        if (next.visible === snapshot.visible
          && next.height === snapshot.height
          && next.activeId === snapshot.activeId
          && next.terminals === snapshot.terminals
          && next.count === snapshot.count
          && next.activeSessionId === snapshot.activeSessionId
          && next.notice === snapshot.notice) {
          return
        }
        snapshot = next
        persist()
        for (const listener of listeners) listener()
      }

      /** 落盘纯 UI 偏好。 */
      const persist = ()       => {
        try {
          storage?.setItem(STORAGE_KEY, JSON.stringify({
            visible: snapshot.visible,
            height: snapshot.height,
            activeId: snapshot.activeId,
          }                      ))
        } catch {
          // 隐私模式下 localStorage 可能抛错；UI 偏好丢了不影响功能。
        }
      }

      /** 替换终端列表（并保持 activeId 有效）。 */
      const setTerminals = (terminals                 , activeId                )       => {
        const nextActive = activeId !== undefined
          ? activeId
          : (snapshot.activeId !== null && terminals.some(entry => entry.id === snapshot.activeId)
            ? snapshot.activeId
            : (terminals[0]?.id ?? null))
        publish({ terminals, count: terminals.length, activeId: nextActive })
      }

      /** 读一个 HTTP 响应并处理错误体。 */
      const readJson = async    (response          )             => {
        const text = await response.text()
        if (!response.ok) {
          let message = `HTTP ${String(response.status)}`
          try {
            const body = JSON.parse(text)                 
            if (typeof body.message === 'string') message = body.message
          } catch { /* 非 JSON 错误体就用状态码 */ }
          throw new Error(message)
        }
        return JSON.parse(text)     
      }

      // 先声明再赋值：`closeTerminal` 里要复用 `store.create()`，用 `store` 这个常量引用拿到
      // 完整对象，而不是写两遍创建逻辑（那样两处的错误处理迟早会漂移）。
      const store                     = {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        toggle() {
          // 展开时若一个终端都没有，先建一个 —— 否则会按出一个空面板。
          if (!snapshot.visible || snapshot.count === 0) {
            void store.ensureTerminal()
            return
          }
          publish({ visible: false })
        },
        open() {
          publish({ visible: true })
        },
        close() {
          publish({ visible: false })
        },
        setVisible(visible) {
          publish({ visible })
        },
        async ensureTerminal(cwd) {
          if (snapshot.count > 0) {
            publish({ visible: true })
            return
          }
          await store.create(cwd)
        },
        setActiveSession(sessionId) {
          const next = sessionId !== undefined && sessionId.length > 0 ? sessionId : null
          if (next === snapshot.activeSessionId) return
          publish({ activeSessionId: next })
        },
        setHeight(height) {
          publish({ height: clampHeight(height, viewportHeight()) })
        },
        focus(id) {
          const terminals = snapshot.terminals.map(entry => (entry.id === id ? { ...entry, unseen: false } : entry))
          publish({ activeId: id, terminals })
        },
        async create(cwd) {
          const pendingId = `pending-${String(Date.now())}-${String(snapshot.terminals.length)}`
          const pending                = { id: pendingId, name: '…', state: 'pending', exitCode: null, unseen: false }
          const pendingList = [...snapshot.terminals, pending]
          publish({ terminals: pendingList, count: pendingList.length, activeId: pendingId, visible: true })
          try {
            const body                        = { cols: 80, rows: 24 }
            if (cwd !== undefined && cwd.length > 0) body.cwd = cwd
            // 带上「用户正在看哪个会话」：宿主据此取那个会话的工作目录（工作区路径），
            // 于是 `DC-new-org` 工作区里开的终端就落在 `D:\desktop\repos\DC-new-org`。
            if (snapshot.activeSessionId !== null) body.sessionId = snapshot.activeSessionId
            const response = await doFetch(pluginPath('/terminals'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            const payload = await readJson                            (response)
            const entry = toEntry(payload.terminal)
            const terminals = snapshot.terminals.map(item => (item.id === pendingId ? entry : item))
            publish({ terminals, count: terminals.length, activeId: entry.id })
          } catch (error) {
            const terminals = snapshot.terminals.filter(item => item.id !== pendingId)
            publish({ terminals, count: terminals.length, notice: error instanceof Error ? error.message : String(error) })
          }
        },
        async closeTerminal(id) {
          const terminals = snapshot.terminals.filter(entry => entry.id !== id)
          const wasActive = snapshot.activeId === id
          // 关掉最后一个：如果开着「自动建终端」，就不收起面板 —— 紧接着会补一个新终端，
          // 先收起再展开会闪一下。关掉自动建的开关时，保持 VSCode 的行为（面板一起收起）。
          const keepOpen = terminals.length > 0 || (autoCreateTerminals && snapshot.visible)
          publish({
            terminals,
            count: terminals.length,
            activeId: wasActive ? (terminals[0]?.id ?? null) : snapshot.activeId,
            visible: keepOpen ? snapshot.visible : false,
          })
          if (id.startsWith('pending-')) return
          try {
            await doFetch(pluginPath(`/terminals/${encodeURIComponent(id)}`), { method: 'DELETE' })
          } catch (error) {
            publish({ notice: error instanceof Error ? error.message : String(error) })
          }
          // 关掉的是最后一个（且面板还开着）→ 立刻补一个，面板不会空着。
          if (terminals.length === 0 && autoCreateTerminals && snapshot.visible) await store.create()
        },
        markSeen(id) {
          if (!snapshot.terminals.some(entry => entry.id === id && entry.unseen)) return
          publish({ terminals: snapshot.terminals.map(entry => (entry.id === id ? { ...entry, unseen: false } : entry)) })
        },
        markExited(id, exitCode) {
          publish({
            terminals: snapshot.terminals.map((entry) => {
              if (entry.id !== id) return entry
              return { ...entry, state: 'exited', exitCode, unseen: snapshot.activeId === id ? entry.unseen : true }
            }),
          })
        },
        setTitle(id, title) {
          const trimmed = title.trim()
          if (trimmed.length === 0) return
          publish({ terminals: snapshot.terminals.map(entry => (entry.id === id ? { ...entry, name: trimmed } : entry)) })
        },
        markOutput(id) {
          if (snapshot.activeId === id) return
          if (!snapshot.terminals.some(entry => entry.id === id && !entry.unseen)) return
          publish({ terminals: snapshot.terminals.map(entry => (entry.id === id ? { ...entry, unseen: true } : entry)) })
        },
        async refresh() {
          try {
            const response = await doFetch(pluginPath('/terminals'), { method: 'GET' })
            const payload = await readJson                       (response)
            const terminals = payload.terminals.map(toEntry)
            setTerminals(terminals)
          } catch (error) {
            publish({ notice: error instanceof Error ? error.message : String(error) })
          }
        },
        clearNotice() {
          if (snapshot.notice === null) return
          publish({ notice: null })
        },
      }
      return store
    }
    /**
     * 把高度夹进合法范围。
     *
     * @param height - 请求高度。
     * @param viewport - 视口高度。
     * @returns 夹紧后的整数像素。
     */
    function clampHeight(height        , viewport        )         {
      const max = Math.max(HEIGHT_MIN, Math.round(viewport * HEIGHT_MAX_RATIO))
      if (!Number.isFinite(height)) return Math.min(HEIGHT_DEFAULT, max)
      return Math.max(HEIGHT_MIN, Math.min(max, Math.round(height)))
    }
      return {
        HEIGHT_MIN,
        HEIGHT_MAX_RATIO,
        HEIGHT_DEFAULT,
        STORAGE_KEY,
        readPersisted,
        toEntry,
        createTerminalPanelStore,
        clampHeight,
        pluginPath,
      }
    })()

    // ── src/client/toggle-button.tsx ──
    const M9 = (() => {
      const { h, useEffect } = M1
    /**
     * 输入框工具行左侧的终端按钮：鼠标入口（键盘入口是 Ctrl+`）。
     *
     * 注册进 `conversation.input.left`（会话级的列表槽位，放的就是输入框工具行左侧的紧凑
     * 控件）。按钮做两件事 —— 切换面板，以及**把「用户正在看哪个会话」告诉 store**：新终端的
     * 工作目录由它决定（宿主拿会话 id 去取那个会话的工作目录，也就是它所属工作区的路径）。
     *
     * @module dsh-terminal-plugin/src/client/toggle-button
     */

                                              
                                                        

    /** 本按钮的 props。 */
                                          
                      
                               
                                       
                      
                      
                  
         
                       
        
                                                          
                                                
         
                        
     

    /**
     * 图标集：全部是内联 SVG，颜色一律走 `currentColor`，跟随按钮的主题令牌上色。
     *
     * 加号与向下箭头来自设计给的 48×48 线性图标（路径与 `viewBox` 原样保留，只把原来写死的
     * `#000000` 换成 `currentColor`，尺寸按面板工具栏收到 16）。
     */

    /** 终端图标（本插件自己的画法）。 */
    function TerminalGlyph()          {
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
    function PlusGlyph()          {
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
    function ChevronDownGlyph()          {
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
    function TerminalToggle(props                     )          {
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
      return {
        TerminalGlyph,
        PlusGlyph,
        ChevronDownGlyph,
        TerminalToggle,
        h,
        useEffect,
      }
    })()

    // ── src/client/panel-chrome.tsx ──
    const M10 = (() => {
      const { h, useRef } = M1
      const { ChevronDownGlyph, PlusGlyph } = M9
    /**
     * 面板的可见部分：标签条、拖拽分隔条、一次性提示条。
     *
     * 与 `panel.tsx`（负责 store、快捷键、帧留白）分开，是为了让「状态机」与「长什么样」
     * 各自独立可读、也各自不超长。
     *
     * @module dsh-terminal-plugin/src/client/panel-chrome
     */

                                                   
                                              

    /** 标签条 props。 */
                                  
                  
                                         
                  
                             
                  
                  
                
                               
                
                               
                
                      
                  
                    
     

    /** 单个标签的状态点语义。 */
    function dotState(entry               )         {
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
    function TabBar(props             )          {
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
        onKeyDown: (event               ) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onFocus(entry.id)
          }
        },
        onAuxClick: (event            ) => {
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
          onClick: (event            ) => {
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
                                        
                             
                                    
                               
                                         
                  
                  
     

    /**
     * 面板上边缘的拖拽分隔条（行高方向的 resize 手柄）。
     *
     * @param props - 高度回调与拖拽状态回调。
     * @returns 手柄元素。
     */
    function ResizeHandle(props                   )          {
      const state = useRef({ startY: 0, startHeight: 0, dragging: false })
      const barRef = useRef                       (null)

      const end = ()       => {
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
        onPointerDown: (event              ) => {
          const panel = (event.currentTarget               ).parentElement
          if (panel === null) return
          state.current = { startY: event.clientY, startHeight: panel.getBoundingClientRect().height, dragging: true }
          props.onDragging(true)
          ;(event.currentTarget               ).setPointerCapture(event.pointerId)
        },
        onPointerMove: (event              ) => {
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
                                  
                  
                  
                
                       
     

    /**
     * 右下角的一次性提示（例如「终端太多」）。
     *
     * @param props - 文本与关闭回调。
     * @returns 提示元素。
     */
    function Notice(props             )          {
      return h('div', {
        className: 'dsh-term-toast',
        role: 'status',
        onClick: props.onDismiss,
      }, props.text)
    }
      return {
        dotState,
        TabBar,
        ResizeHandle,
        Notice,
        h,
        useRef,
        ChevronDownGlyph,
        PlusGlyph,
      }
    })()

    // ── src/client/pty-client.ts ──
    const M11 = (() => {
      const { socketUrl } = M6
    /**
     * 一个终端到宿主的连接：WebSocket 上跑 `src/protocol.ts` 里那套帧。
     *
     * 每个终端一条独立连接（而不是一条连接多路复用）：背压天然隔离，一个终端的洪水输出
     * 不会拖住别的终端；重连逻辑也只需要管一条。
     *
     * 重连是有意义的：PTY 活在宿主进程里，页面刷新、网络抖动都不会杀掉它；重连后宿主会把
     * 回放缓冲发回来，于是用户的终端看上去「一直在那儿」。这也是本插件不追求实时同步
     * 终端栅格的原因 —— 回放由 xterm 自己重新解析。
     *
     * @module dsh-terminal-plugin/src/client/pty-client
     */

                                                                                

    /** 连接状态。 */
                                                                  

    /** 一个终端连接的订阅者。 */
                                     
                               
                                                                         
                 
                              
                                  
                                
                    
                                         
                                   
                                         
                         
                                  
     

    /** 重连退避参数。 */
    const RETRY_MIN_MS = 800
    const RETRY_MAX_MS = 8000

    /** 只取用得到的 WebSocket 常量，避免依赖全局对象的具体实现。 */
    function isOpen(socket                  )          {
      return socket !== null && socket.readyState === 1
    }

    /**
     * 一个终端的连接。
     *
     * 生命周期：`attach(sink, size)` 建立（或复用）连接；`close()` 主动断开并停止重连。
     */
    class TerminalConnection {
      /** 目标终端 id。 */
               terminalId        

              socket                   = null
              sink                        = null
              state                  = 'closed'
              cols = 80
              rows = 24
              retryDelay = RETRY_MIN_MS
              retryTimer                                       = null
              stopped = false

      /**
       * @param terminalId - 宿主分配的终端 id。
       */
      constructor(terminalId        ) {
        this.terminalId = terminalId
      }

      /** 当前连接状态。 */
      getState()                  {
        return this.state
      }

      /**
       * 绑定订阅者并建立连接（重复调用只换订阅者）。
       *
       * @param sink - 事件订阅者。
       * @param size - 终端当前的列数与行数。
       */
      attach(sink                , size                                )       {
        this.sink = sink
        this.cols = size.cols
        this.rows = size.rows
        this.stopped = false
        if (isOpen(this.socket)) {
          this.sendAttach()
          return
        }
        this.connect()
      }

      /**
       * 把用户输入写到 PTY。
       * @param data - 原样发送的文本（含控制字符）。
       */
      write(data        )       {
        this.send({ type: 'write', terminalId: this.terminalId, data })
      }

      /**
       * 上报新尺寸。
       *
       * 宿主目前只把它记进回放元数据（provider 的 seam 没有 resize 动词），所以这里不去
       * 纠结「一定送达」，只保证不因为断线而抛错。
       *
       * @param size - 新的列数与行数。
       */
      resize(size                                )       {
        if (size.cols === this.cols && size.rows === this.rows) return
        this.cols = size.cols
        this.rows = size.rows
        this.send({ type: 'resize', terminalId: this.terminalId, cols: size.cols, rows: size.rows })
      }

      /** 主动断开并停止重连（关闭标签时调用）。 */
      close()       {
        this.stopped = true
        this.clearRetry()
        const socket = this.socket
        this.socket = null
        if (socket !== null) {
          try { socket.close(1000, 'client closed') } catch { /* 已经关了 */ }
        }
        this.setState('closed')
      }

      /** 建立一条连接。 */
              connect()       {
        this.setState('connecting')
        let socket           
        try {
          socket = new WebSocket(socketUrl('/ws'))
        } catch (error) {
          this.sink?.error(error instanceof Error ? error.message : String(error))
          this.scheduleRetry()
          return
        }
        this.socket = socket
        socket.addEventListener('open', () => {
          if (this.socket !== socket) return
          this.retryDelay = RETRY_MIN_MS
          this.setState('open')
          this.sendAttach()
        })
        socket.addEventListener('message', (event              ) => {
          if (this.socket !== socket) return
          this.onFrame(event.data)
        })
        socket.addEventListener('close', () => {
          if (this.socket !== socket) return
          this.socket = null
          this.setState('closed')
          this.scheduleRetry()
        })
        socket.addEventListener('error', () => {
          // 浏览器不给错误细节；`close` 一定会跟上，所以只记录状态。
          if (this.socket !== socket) return
          this.setState('closed')
        })
      }

      /** 发一帧 attach（带当前尺寸，宿主据此决定回放的元数据）。 */
              sendAttach()       {
        this.send({ type: 'attach', terminalId: this.terminalId, cols: this.cols, rows: this.rows })
      }

      /** 安排一次重连（退避到上限为止）。 */
              scheduleRetry()       {
        if (this.stopped || this.retryTimer !== null) return
        const delay = this.retryDelay
        this.retryDelay = Math.min(RETRY_MAX_MS, Math.round(this.retryDelay * 1.6))
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null
          if (this.stopped) return
          this.connect()
        }, delay)
      }

      /** 清掉待执行的重连。 */
              clearRetry()       {
        if (this.retryTimer !== null) {
          clearTimeout(this.retryTimer)
          this.retryTimer = null
        }
      }

      /** 发一帧客户端消息（未连上时静默丢弃：输入本来就该在断线时丢）。 */
              send(frame             )       {
        if (!isOpen(this.socket)) return
        try {
          this.socket?.send(JSON.stringify(frame))
        } catch (error) {
          this.sink?.error(error instanceof Error ? error.message : String(error))
        }
      }

      /** 解析一帧服务端消息。 */
              onFrame(raw         )       {
        if (typeof raw !== 'string') return
        let frame             
        try {
          frame = JSON.parse(raw)               
        } catch {
          return
        }
        switch (frame.type) {
          case 'hello':
            this.sink?.ready(frame.terminal, frame.buffer, frame.truncated)
            return
          case 'output':
            this.sink?.data(frame.data)
            return
          case 'title':
            this.sink?.title(frame.title)
            return
          case 'exit':
            this.sink?.exit(frame.exitCode)
            return
          case 'error':
            this.sink?.error(frame.message)
            return
          default:
            return
        }
      }

      /** 更新状态并通知订阅者（相同状态不重复通知）。 */
              setState(state                 )       {
        if (this.state === state) return
        this.state = state
        this.sink?.state(state)
      }
    }
      return {
        RETRY_MIN_MS,
        RETRY_MAX_MS,
        isOpen,
        TerminalConnection,
        socketUrl,
      }
    })()

    // ── src/client/theme.ts ──
    const M12 = (() => {
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
                                 
                        
                        
                    
                          
                                 
                   
                 
                   
                    
                  
                     
                  
                   
                         
                       
                         
                          
                        
                           
                        
                         
     

    /** ANSI 16 色的暗色兜底（VS Code Dark+ 一族的经典取值）。 */
    const DARK_ANSI = {
      black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
      blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
      brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543',
      brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#ffffff',
    }         

    /** ANSI 16 色的亮色兜底（VS Code Light+ 一族）。 */
    const LIGHT_ANSI = {
      black: '#000000', red: '#cd3131', green: '#00bc00', yellow: '#949800',
      blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc', white: '#555555',
      brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#14ce14', brightYellow: '#b5ba00',
      brightBlue: '#0451a5', brightMagenta: '#bc05bc', brightCyan: '#0598bc', brightWhite: '#a5a5a5',
    }         

    /** 从 document 上读一个已生效的 CSS 变量（读不到返回空串）。 */
    function readToken(name        )         {
      const value = getComputedStyle(document.body).getPropertyValue(name)
      return value.trim()
    }
    /** 当前是否处于暗色主题。 */
    function isDark()          {
      return document.body.hasAttribute('data-ds-dark-theme')
    }
    /**
     * 组装一份 xterm 主题。
     *
     * @returns 与当前主题匹配的 xterm 主题对象。
     */
    function currentXtermTheme()             {
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
    function observeTheme(listener            )             {
      const observer = new MutationObserver(() => { listener() })
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'style', 'class'] })
      return () => { observer.disconnect() }
    }
      return {
        DARK_ANSI,
        LIGHT_ANSI,
        readToken,
        isDark,
        currentXtermTheme,
        observeTheme,
      }
    })()

    // ── src/client/link-provider.ts ──
    const M13 = (() => {
    /**
     * 终端里的链接识别：把输出里的 URL 与文件路径变成可点击的链接。
     *
     * 触发方式与 xterm 一致：**Ctrl/Cmd + 点击**（xterm 自己在触发 `ILink.activate` 时就已经
     * 要求了修饰键，这里不需要再判断）。dev server 打印的 `http://localhost:3000`、报错里的
     * `src/foo.ts:12:3`、`at /abs/path/file.js:1` 都属于这一类。
     *
     * 为什么自己写而不是用 `@xterm/addon-web-links`：那是一个 30 KB 的包，而它的核心只是
     * 「一行正则 + 一个 link provider」——本文件就是那部分，且能把「哪些算路径」按自己的
     * 需要调紧（例如排除 `:` 后面的行号）。
     *
     * 安全：只对 `http` / `https` / `ftp` 协议调用打开动作，`javascript:`、`data:`、`file:`
     * 一律不打开（终端输出是不可信内容，不能让它拿到一个执行入口）。
     *
     * @module dsh-terminal-plugin/src/client/link-provider
     */

    /** 一条命中的链接：一行的 UTF-16 下标范围与要打开的地址。 */
                                   
                                                     
                        
                      
                      
                          
                  
                                                       
                  
     

    /** 允许打开的协议白名单。 */
    const OPENABLE_PROTOCOLS = new Set(['http:', 'https:', 'ftp:'])

    /** 文件路径的最大长度（挡住把一整行误判成路径）。 */
    const MAX_PATH_LENGTH = 512

    /**
     * 带协议的 URL：scheme + `://`。
     *
     * scheme 用通用的 URI 形态（而不是只列白名单那几个），因为这条正则的作用是**圈出 URL 的范围**
     * —— 只有把 `data://x/y` 整体圈住，它里面的 `/x/y` 才不会又被当成文件路径单独标一条。
     * 能不能打开由 {@link openableUrl} 的白名单决定。
     */
    const SCHEME_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>()[\]{}]+/giu
    /** 裸 `localhost:3000/x`（没有协议）。 */
    const LOCALHOST_PATTERN = /\blocalhost:\d{1,5}(?:\/[^\s"'`<>()[\]{}]*)?/giu
    /**
     * 文件路径。三段可选前缀（`./`、`../`、`/`、`盘符:\`、Windows 反斜杠）之一是必须的，
     * 因此 `foo.ts:1` 这种相对裸文件名不会被误判（它更可能是普通文本）。
     */
    const PATH_PATTERN = /(?:\.{1,2}[\\/]|[A-Za-z]:[\\/]|[\\/])[\w.@+-]+(?:[\\/][\w.@+-]+)*\.[A-Za-z][\w]{0,9}(?::\d+(?::\d+)?)?/gu

    /**
     * 收尾时去掉挂在末尾的标点 —— 终端里的 URL 经常被括号或句号包住。
     *
     * @param raw - 正则命中的原始文本。
     * @returns 收拾干净的文本。
     */
    function trimTrailingPunctuation(raw        )         {
      return raw.replace(/[.,;:!?'"`)\]}]+$/u, '')
    }

    /**
     * 把一条文件路径转成可以打开的地址。
     *
     * 相对路径（`./a/b.ts`、`../x.ts`）没有基准，打开它只会得到浏览器自己的解析结果，
     * 所以只处理绝对路径：POSIX 的 `/...` 与 Windows 的 `C:\...` / `\\server\share`。
     *
     * @param raw - 命中的路径文本（可能带 `:行:列`）。
     * @returns 可打开的 `file://` 地址，或 undefined。
     */
    function fileUrlForPath(raw        )                     {
      const withoutLocation = raw.replace(/:\d+(?::\d+)?$/u, '').replaceAll('\\', '/')
      const isPosix = withoutLocation.startsWith('/')
      const isWindowsDrive = /^[A-Za-z]:\//u.test(withoutLocation)
      const isUnc = withoutLocation.startsWith('//')
      if (!isPosix && !isWindowsDrive && !isUnc) return undefined
      const withLeadingSlash = isWindowsDrive ? `/${withoutLocation}` : withoutLocation
      // `encodeURI` 保留 `:` 与 `/`，只把空格等字符转义。
      return `file://${encodeURI(withLeadingSlash)}`
    }
    /**
     * 从一个地址里取出可打开的版本。
     *
     * @param raw - 候选地址（可能没有协议，例如 `localhost:3000`）。
     * @returns 可打开的绝对 URL，或 undefined（协议不在白名单里 / 解析不了）。
     */
    function openableUrl(raw        )                     {
      try {
        const parsed = new URL(raw)
        return OPENABLE_PROTOCOLS.has(parsed.protocol) ? parsed.href : undefined
      } catch {
        return undefined
      }
    }
    /**
     * 在一行文本里找出所有链接。
     *
     * 三类候选合并后按位置排好，然后：
     *
     * 1. **落在带协议 URL 内部的路径候选一律丢掉** —— `data://example.com/x` 里的
     *    `/example.com` 不是路径，只是 URL 的一截；不丢的话整行会被标成两条链接。
     * 2. 其余重叠只保留先到的那条（更长的优先，因为排序里同位置时长的那条在前）。
     *
     * @param line - 一行的纯文本（建议用 `translateToString(true)`，行尾空白被裁掉）。
     * @returns 按位置排好的链接，最多 {@link MAX_LINKS} 条。
     */
    function detectLinks(line        )                 {
      if (typeof line !== 'string' || line.length === 0) return []
      /** @type {DetectedLink[]} */
      const schemes                 = []
      const paths                 = []

      for (const match of line.matchAll(SCHEME_PATTERN)) {
        const text = trimTrailingPunctuation(match[0])
        const start = match.index ?? 0
        schemes.push({ startIndex: start, endIndex: start + text.length, text, url: openableUrl(text) })
      }
      for (const match of line.matchAll(LOCALHOST_PATTERN)) {
        const text = trimTrailingPunctuation(match[0])
        const start = match.index ?? 0
        schemes.push({ startIndex: start, endIndex: start + text.length, text, url: openableUrl(`http://${text}`) })
      }
      for (const match of line.matchAll(PATH_PATTERN)) {
        const text = trimTrailingPunctuation(match[0])
        if (text.length > MAX_PATH_LENGTH) continue
        const start = match.index ?? 0
        const insideUrl = schemes.some(existing => start >= existing.startIndex && start < existing.endIndex)
        if (insideUrl) continue
        paths.push({ startIndex: start, endIndex: start + text.length, text, url: fileUrlForPath(text) })
      }

      const found = [...schemes, ...paths]
      found.sort((left, right) => left.startIndex - right.startIndex || right.endIndex - left.endIndex)
      const kept                 = []
      for (const candidate of found) {
        if (kept.some(existing => candidate.startIndex < existing.endIndex && existing.startIndex < candidate.endIndex)) continue
        kept.push(candidate)
      }
      return kept.slice(0, MAX_LINKS)
    }
    /** 一行里最多返回多少条链接（真实终端里不会更多）。 */
    const MAX_LINKS = 8

    /** xterm 的 `ILinkDecorations` 形状。 */                                  
                            
                        
     

    /** xterm 的 `IBufferCellPosition` 形状（列与行都是 1 基）。 */
                                   
               
               
     

    /** xterm 的 `ILink` 形状。 */
                                   
                                                       
                  
                                   
                                                     
     

    /** xterm 的 `ILinkProvider` 形状。 */
                                   
                                                                                                         
     

    /** 取一行文本的函数（由调用方从 xterm 的 buffer 里读）。 */
                                                                             

    /** 打开一个地址（可注入，便于测试）。 */
                                               

    /** 创建 link provider 需要的一切。 */
                                          
                       
                          
                                                                             
                    
     

    /**
     * 默认的打开方式：新标签页打开，并且不让被打开的页面拿到 `window.opener`。
     *
     * @param url - 要打开的地址。
     */
    function openInNewTab(url        )       {
      try {
        globalThis.open?.(url, '_blank', 'noopener,noreferrer')
      } catch {
        // 被弹窗拦截器拦下时什么都不做 —— 终端不该因此报错。
      }
    }
    /**
     * 造一个 xterm 的 link provider。
     *
     * 触发条件是 xterm 自己管的：它只在按住 Ctrl/Cmd 时才对链接调用 `activate`，所以这里
     * 不需要再判断修饰键。
     *
     * @param options - 读行与打开地址的方式。
     * @returns 可以直接交给 `terminal.registerLinkProvider` 的 provider。
     */
    function createLinkProvider(options                     )               {
      const open = options.open ?? openInNewTab
      return {
        provideLinks(bufferLineNumber, callback) {
          try {
            const line = options.readLine(bufferLineNumber)
            if (line === undefined || line.length === 0) {
              callback(undefined)
              return
            }
            const links = detectLinks(line)
            if (links.length === 0) {
              callback(undefined)
              return
            }
            callback(links.map(link => ({
              range: {
                start: { x: link.startIndex + 1, y: bufferLineNumber },
                end: { x: link.endIndex, y: bufferLineNumber },
              },
              text: link.text,
              decorations: { pointerCursor: true, underline: true },
              activate: () => {
                if (link.url !== undefined) open(link.url)
              },
            }                       )))
          } catch {
            // 任何意外都当作「这一行没有链接」：终端不应该因为链接识别而报错。
            callback(undefined)
          }
        },
      }
    }
    /**
     * 把一个 link provider 挂到终端上。
     *
     * @param terminal - 已经 `open()` 过的终端。
     * @param options - 读行与打开地址的方式。
     * @returns 取消注册的函数。
     */
    function attachLinkProvider(
      terminal                                                                       ,
      options                     ,
    )             {
      const registration = terminal.registerLinkProvider(createLinkProvider(options))
      return () => { registration.dispose() }
    }
      return {
        OPENABLE_PROTOCOLS,
        MAX_PATH_LENGTH,
        SCHEME_PATTERN,
        LOCALHOST_PATTERN,
        PATH_PATTERN,
        trimTrailingPunctuation,
        fileUrlForPath,
        openableUrl,
        detectLinks,
        MAX_LINKS,
        openInNewTab,
        createLinkProvider,
        attachLinkProvider,
      }
    })()

    // ── src/client/view.tsx ──
    const M14 = (() => {
      const { h, useEffect, useRef, useState } = M1
      const { TerminalConnection } = M11
      const { currentXtermTheme, observeTheme } = M12
      const { loadXterm } = M7
      const { attachLinkProvider } = M13
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

                                              

    /** 一个终端画面的 props。 */
                                        
                   
                        
                                        
                     
                     
                      
                      
                  
                    
                                           
                         
                                  
                  
                      
     

    /** 渲染器与连接都就绪之前的状态。 */
                                              

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
    function TerminalView(props                   )          {
      const { terminalId, active, visible, t, onExit, onTitle, onOutput } = props
      const containerRef = useRef                       (null)
      const termRef = useRef                      (null)
      const fitRef = useRef                     (null)
      const connRef = useRef                           (null)
      const [phase, setPhase] = useState       ('loading')
      const [errorText, setErrorText] = useState('')
      const [connection, setConnection] = useState                 ('connecting')
      const [attempt, setAttempt] = useState(0)

      // 回调放进 ref，这样重建渲染器的 effect 不必依赖父组件传下来的函数身份。
      const callbacks = useRef({ onExit, onTitle, onOutput, t })
      callbacks.current = { onExit, onTitle, onOutput, t }

      // ── 渲染器 + 连接（每次重试 attempt 变一次） ──────────────────────────────
      useEffect(() => {
        const container = containerRef.current
        if (container === null) return undefined
        let disposed = false
        let teardown                      = null
        setPhase('loading')

        void (async () => {
          let module                                       
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
          const dataSub = terminal.onData((data        ) => { connection.write(data) })
          const titleSub = terminal.onTitleChange((title        ) => { callbacks.current.onTitle(title) })

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
          let timer                                       = null
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
            const theme             = currentXtermTheme()
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
      return {
        FONT_FAMILY,
        FONT_SIZE,
        SCROLLBACK,
        RESIZE_THROTTLE_MS,
        TerminalView,
        h,
        useEffect,
        useRef,
        useState,
        TerminalConnection,
        currentXtermTheme,
        observeTheme,
        loadXterm,
        attachLinkProvider,
      }
    })()

    // ── src/client/panel.tsx ──
    const M15 = (() => {
      const { h, useCallback, useEffect, useRef, useSyncExternalStore } = M1
      const { Notice, ResizeHandle, TabBar } = M10
      const { TerminalView } = M14
      const { centerBox, onWindowEvent } = M4
      const { LEFT_VARIABLE, WIDTH_VARIABLE } = M3
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

                                              
                                                                       

    /** 面板正文的 props。 */
                                     
                      
                               
                      
                  
                                                                                           
                                  
                                                   
                                         
                         
                                              
                  
                                
     

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
    function usePanelBox()                                        {
      const elementRef = useRef                    (null)
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

      return useCallback((element                    ) => {
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
    function PanelHost(props                )          {
      const { store, t, useSnapshot, onInsetChange, onTitle, onOutput } = props
      const snapshot = useSnapshot()
      const { visible, height, terminals, activeId, notice } = snapshot
      const panelRef = usePanelBox()

      // 快捷入口：捕获阶段监听，因此焦点在输入框或终端里也生效（VSCode 同样如此）。
      useEffect(() => {
        const onKeyDown = (event               )       => {
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
          const target = event.target                      
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
        onExit: (exitCode               ) => { store.markExited(entry.id, exitCode) },
        onTitle: (title        ) => { onTitle(entry.id, title) },
        onOutput: () => { onOutput(entry.id) },
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
          onHeight: (next        ) => { store.setHeight(next) },
          onDragging: () => { /* 过渡动画由 CSS 的 data 属性控制，这里不需要做事 */ },
        }),
        h(TabBar, {
          key: 'bar',
          terminals,
          activeId,
          t,
          onFocus: (id        ) => { store.focus(id) },
          onClose: (id        ) => { void store.closeTerminal(id) },
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
      return {
        HIDDEN_HEIGHT,
        usePanelBox,
        PanelHost,
        h,
        useCallback,
        useEffect,
        useRef,
        useSyncExternalStore,
        Notice,
        ResizeHandle,
        TabBar,
        TerminalView,
        centerBox,
        onWindowEvent,
        LEFT_VARIABLE,
        WIDTH_VARIABLE,
      }
    })()

    // ── src/client/index.tsx ──
    const M16 = (() => {
      const { useSyncExternalStore } = M1
      const { en, NS, zh } = M2
      const { ensureStyles } = M3
      const { applyFrameInset, clearFrameInset } = M4
      const { disposeXtermHost } = M7
      const { createTerminalPanelStore } = M8
      const { TerminalToggle } = M9
      const { PanelHost } = M15
    /**
     * 客户端插件入口：把底部终端面板挂进 DSH 的两个槽位。
     *
     * 两处注册，都是**加法**（列表槽位里用一个自己的 id，不替换任何产品自带的条目）：
     *
     * 1. `conversation.input.left` —— 输入框工具行左侧的终端图标按钮（鼠标入口）。
     * 2. `shell.overlay` —— 贴在**对话区下方**的终端面板本体（frame-wide 浮层槽位，条目的
     *    直接子元素自动恢复 pointer-events；面板的几何见 `src/client/frame-inset.ts`）。
     *
     * 侧边栏里刻意**不放任何东西**：终端只在对话区这一块，左栏底部那个入口按钮已按需求去掉
     * （`sidebar.footer.action` 不再注册）。
     *
     * 两处共用**同一个 store 实例**（`apply` 作用域里创建）：它们分属不同的 React 子树，
     * 共享实例才能让「按钮点亮」与「面板展开」永远一致，也避免对同一批 WS 连接重复建连。
     *
     * 槽位注册都经 `ctx.slots.inject(槽位名, …)`：`dsh.client.inject` 的包依赖边只是加载/
     * 预取元数据（产品自己的 `ui-workspace` 文档也这么说），**不保证 apply 顺序**，所以不能
     * 假设槽位已经存在。
     *
     * @module dsh-terminal-plugin/src/client/index
     */

                                                                       

    /** 本插件依赖的客户端服务。 */
    const inject = ['slots', 'locale']
    /**
     * 订阅面板快照的小 hook。
     *
     * 三个注册点都要同一份快照，所以做成一次性 helper，而不是在组件里各写一遍
     * `useSyncExternalStore(store.subscribe, store.getSnapshot)`。
     *
     * @param store - 面板 store。
     * @returns 返回当前快照的函数。
     */
    function makeSnapshotHook(store                    )                      {
      return () => useSyncExternalStore(
        (listener            ) => store.subscribe(listener),
        () => store.getSnapshot(),
      )
    }

    /**
     * 客户端插件主体：字典、样式、三处槽位注册。
     *
     * @param ctx - 客户端根上下文。
     */
    function apply(ctx               )       {
      ensureStyles()
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-terminal-plugin: 界面文案')
      const t = ctx.locale.bind(NS)                        
      const store = createTerminalPanelStore()
      const useSnapshot = makeSnapshotHook(store)

      ctx.effect(() => () => {
        clearFrameInset()
        disposeXtermHost()
      }, 'dsh-terminal-plugin: 帧留白与渲染器')

      // 1. 输入框工具行左侧的按钮。
      ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left',
        id: 'dsh-terminal-plugin/toggle',
        order: 40,
        label: () => t('toggle.label'),
      }, (props                        ) => {
        const snapshot = useSnapshot()
        // 这个槽位是会话级的，框架会把当前 sessionId 注入进来；按钮顺手把它同步给 store，
        // 新终端因此能落在「当前会话所属工作区」而不是宿主进程的目录。
        return TerminalToggle({ store, visible: snapshot.visible, t, sessionId: props?.sessionId })
      })), 'dsh-terminal-plugin: 终端按钮')

      // 2. 贴底的终端面板。
      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-terminal-plugin/panel',
        order: 60,
        label: () => t('panel.label'),
      }, () => PanelHost({
        store,
        t,
        useSnapshot,
        onInsetChange: (height        ) => { applyFrameInset(height) },
        onTitle: (id        , title        ) => { store.setTitle(id, title) },
        onOutput: (id        ) => { store.markOutput(id) },
      }))), 'dsh-terminal-plugin: 终端面板')
    }
      return {
        inject,
        makeSnapshotHook,
        apply,
        useSyncExternalStore,
        en,
        NS,
        zh,
        ensureStyles,
        applyFrameInset,
        clearFrameInset,
        disposeXtermHost,
        createTerminalPanelStore,
        TerminalToggle,
        PanelHost,
      }
    })()

    // ── 工厂作用域里的 React 绑定挂到入口命名空间（模块从这里解构） ──
    M16.useState = useState;
    M16.useEffect = useEffect;
    M16.useLayoutEffect = useLayoutEffect;
    M16.useMemo = useMemo;
    M16.useReducer = useReducer;
    M16.useCallback = useCallback;
    M16.useRef = useRef;
    M16.useContext = useContext;
    M16.useSyncExternalStore = useSyncExternalStore;
    M16.Fragment = Fragment;
    M16.memo = memo;
    M16.forwardRef = forwardRef;
    M16.createContext = createContext;
    M16.createElement = createElement;
    M16.cloneElement = cloneElement;
    M16.Children = Children;
    M16.h = h;

    // ── 入口模块的契约导出（插件系统读取 apply / inject） ──
    exports.inject = M16.inject
    exports.apply = M16.apply

    return module.exports;
  },
});
