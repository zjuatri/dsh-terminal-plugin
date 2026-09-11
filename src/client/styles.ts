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
export const PLUGIN_TAG = 'dsh-terminal-plugin'

/** 面板高度的 CSS 变量名。 */
export const INSET_VARIABLE = '--dsh-terminal-inset'

/** 面板左边缘的 CSS 变量名（等于对话区左边缘，由 `frame-inset.ts` 量出来）。 */
export const LEFT_VARIABLE = '--dsh-terminal-left'

/** 面板宽度的 CSS 变量名（等于对话区宽度；右栏展开时对话区变窄，面板跟着变窄）。 */
export const WIDTH_VARIABLE = '--dsh-terminal-width'

/** 面板样式表本体（导出给测试断言「没有硬编码颜色」）。 */
export const PANEL_CSS = `
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
export function ensureStyles(): void {
  if (document.head.querySelector(`style[data-plugin="${PLUGIN_TAG}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_TAG
  tag.textContent = PANEL_CSS
  document.head.appendChild(tag)
}
