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

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { useSyncExternalStore } from './react.js'
import { en, NS, zh, type Translate } from './text.js'
import { ensureStyles } from './styles.js'
import { applyFrameInset, clearFrameInset } from './frame-inset.js'
import { disposeXtermHost } from './xterm-loader.js'
import { createTerminalPanelStore, type PanelSnapshot, type TerminalPanelStore } from './state.js'
import { TerminalToggle } from './toggle-button.js'
import { PanelHost } from './panel.js'

/** 本插件依赖的客户端服务。 */
export const inject = ['slots', 'locale']

/**
 * 订阅面板快照的小 hook。
 *
 * 三个注册点都要同一份快照，所以做成一次性 helper，而不是在组件里各写一遍
 * `useSyncExternalStore(store.subscribe, store.getSnapshot)`。
 *
 * @param store - 面板 store。
 * @returns 返回当前快照的函数。
 */
function makeSnapshotHook(store: TerminalPanelStore): () => PanelSnapshot {
  return () => useSyncExternalStore(
    (listener: () => void) => store.subscribe(listener),
    () => store.getSnapshot(),
  )
}

/**
 * 客户端插件主体：字典、样式、三处槽位注册。
 *
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
  ensureStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-terminal-plugin: 界面文案')
  const t = ctx.locale.bind(NS) as unknown as Translate
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
  }, (props: { sessionId?: string }) => {
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
    onInsetChange: (height: number) => { applyFrameInset(height) },
    onTitle: (id: string, title: string) => { store.setTitle(id, title) },
    onOutput: (id: string) => { store.markOutput(id) },
  }))), 'dsh-terminal-plugin: 终端面板')
}
