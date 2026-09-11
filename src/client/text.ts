/**
 * 界面文案：以中文为准，英文作对照。组件里不允许出现硬编码字符串。
 *
 * 工具说明与技能目录是**给模型看**的接口，本插件没有那半边；这里的文案只给人看。
 *
 * @module dsh-terminal-plugin/src/client/text
 */

/** 文案命名空间（`ctx.locale.register(NS, …)` 的键）。 */
export const NS = 'dsh-terminal'

/** 中文文案（主）。 */
export const zh = {
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
  'panel.linkHint': 'Ctrl+点击打开 {url}',
  'tab.close': '关闭终端',
  'tab.running': '运行中',
  'tab.exited': '已退出',
  'tab.busy': '有新输出',
  'error.tooMany': '同时打开的终端太多了，先关掉几个',
  'error.noTerminal': '这个终端已经不存在了',
  'error.spawn': '终端启动失败',
}

/** 英文对照。 */
export const en = {
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
  'panel.linkHint': 'Ctrl+click to open {url}',
  'tab.close': 'Close terminal',
  'tab.running': 'Running',
  'tab.exited': 'Exited',
  'tab.busy': 'New output',
  'error.tooMany': 'Too many terminals are open — close a few first',
  'error.noTerminal': 'That terminal no longer exists',
  'error.spawn': 'Terminal failed to start',
}

/** 文案键的联合类型（由中文文案推导）。 */
export type TerminalKey = keyof typeof zh

/** 槽位框架注入的翻译函数：取键、可带占位符替换。 */
export type Translate = (key: TerminalKey, params?: Record<string, string | number>) => string
