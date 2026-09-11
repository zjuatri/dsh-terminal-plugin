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

import { pluginPath } from './bootstrap.js'
import type { CreateTerminalRequest, ErrorResponse, ListTerminalsResponse, TerminalMeta } from '../protocol.js'

/** 标签页上显示的一个终端。 */
export interface TerminalEntry {
  /** 宿主分配的 id。 */
  id: string
  /** 标签名。 */
  name: string
  /** 进程状态。 */
  state: 'running' | 'exited' | 'pending'
  /** 退出码（`state === 'exited'` 时）。 */
  exitCode: number | null
  /** 是否有未看过的输出（用于标签上的脉冲点）。 */
  unseen: boolean
}

/** 对外发布的不可变快照。 */
export interface PanelSnapshot {
  /** 面板是否展开。 */
  visible: boolean
  /** 面板高度（px）。 */
  height: number
  /** 当前选中的终端 id。 */
  activeId: string | null
  /** 所有终端（按创建顺序）。 */
  terminals: readonly TerminalEntry[]
  /** 终端数量（含正在创建中的占位）；单独给出，方便 UI 用它做判断而不必每次读数组长度。 */
  count: number
  /**
   * 用户当前正在看的会话 id。
   *
   * 新终端的工作目录由它决定：宿主拿这个 id 去 `ctx.sessions.get(id).header.cwd` 取会话的
   * 工作目录（也就是那个工作区的路径）。界面上切换会话时由组件更新它。
   */
  activeSessionId: string | null
  /** 一次性提示（例如「终端太多」），显示后由 UI 清掉。 */
  notice: string | null
}

/** 高度夹紧范围。 */
const HEIGHT_MIN = 160
const HEIGHT_MAX_RATIO = 0.8
const HEIGHT_DEFAULT = 340

/** localStorage 的键。 */
const STORAGE_KEY = 'dsh-terminal:ui'

/** 需要落盘的偏好。 */
interface PersistedUi {
  visible?: boolean
  height?: number
  activeId?: string | null
}

/** 面板状态与动作。 */
export interface TerminalPanelStore {
  /** 当前快照（`useSyncExternalStore` 的 getSnapshot）。 */
  getSnapshot(): PanelSnapshot
  /** 订阅变化。 */
  subscribe(listener: () => void): () => void
  /**
   * 展开/收起。
   *
   * 语义与 VSCode 的 Ctrl+` 一致：**展开时若一个终端都没有，先建一个**。因此收起只在
   * 「面板开着且确实有终端」时发生，不会出现「按一下开了个空面板」。
   */
  toggle(): void
  /** 明确展开（不自动建终端；要「展开并保证有终端」用 `ensureTerminal`）。 */
  open(): void
  /** 明确收起。 */
  close(): void
  /**
   * 保证至少有一个终端。
   *
   * 面板打开时调用：没有任何终端（也包含正在创建中的占位）就新建一个。
   *
   * @param cwd - 可选的起始目录。
   * @returns 新终端的创建 Promise；已经有终端时立即 resolve。
   */
  ensureTerminal(cwd?: string): Promise<void>
  /**
   * 记录用户当前正在看的会话 id（新终端的工作目录由它决定）。
   *
   * @param sessionId - 会话 id；`undefined`/空串表示「没有会话」，此时退回进程工作目录。
   */
  setActiveSession(sessionId: string | undefined): void
  /** 设置面板可见性（`setVisible(false)` 用于「收起但不改终端」）。 */
  setVisible(visible: boolean): void
  /** 设置高度（夹紧后落盘）。 */
  setHeight(height: number): void
  /** 切换到某个终端。 */
  focus(id: string): void
  /** 新建一个终端（内部完成 POST；会顺带展开面板）。 */
  create(cwd?: string): Promise<void>
  /** 关闭一个终端（内部完成 DELETE）。 */
  closeTerminal(id: string): Promise<void>
  /** 标记某个终端「看过」了（清掉脉冲点）。 */
  markSeen(id: string): void
  /** 终端进程退出时更新状态。 */
  markExited(id: string, exitCode: number | null): void
  /** 宿主报告的标题变化。 */
  setTitle(id: string, title: string): void
  /** 有新输出时打点。 */
  markOutput(id: string): void
  /** 与宿主对账（挂载时调用一次）。 */
  refresh(): Promise<void>
  /** 清掉一次性提示。 */
  clearNotice(): void
}

/** 创建 store 时可注入的依赖（测试用）。 */
export interface StoreOptions {
  /** 取窗口高度，用于夹紧。 @default () => window.innerHeight */
  viewportHeight?: () => number
  /** 持久化后端。 @default localStorage */
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  /** fetch 实现。 @default globalThis.fetch */
  fetchImpl?: typeof fetch
  /**
   * 面板展开时是否自动保证有终端（关掉最后一个也会立刻补一个）。
   * @default true
   */
  autoCreateTerminals?: boolean
}

/** 从 localStorage 读回偏好（任何异常都当作没有）。 */
function readPersisted(storage: Pick<Storage, 'getItem'> | undefined): PersistedUi {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (raw === null || raw === undefined) return {}
    const parsed = JSON.parse(raw) as PersistedUi
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

/** 把终端元数据映射成标签条目。 */
function toEntry(meta: TerminalMeta): TerminalEntry {
  return { id: meta.id, name: meta.name, state: meta.state, exitCode: meta.exitCode, unseen: false }
}

/**
 * 创建 store。
 *
 * @param options - 可注入的窗口、存储与 fetch（测试替身）。
 * @returns 面板 store。
 */
export function createTerminalPanelStore(options: StoreOptions = {}): TerminalPanelStore {
  const viewportHeight = options.viewportHeight ?? (() => globalThis.innerHeight || 800)
  const storage = options.storage ?? globalThis.localStorage
  const doFetch = options.fetchImpl ?? globalThis.fetch
  const autoCreateTerminals = options.autoCreateTerminals ?? true

  const persisted = readPersisted(storage)
  let snapshot: PanelSnapshot = {
    visible: persisted.visible === true,
    height: clampHeight(persisted.height ?? HEIGHT_DEFAULT, viewportHeight()),
    activeId: typeof persisted.activeId === 'string' ? persisted.activeId : null,
    terminals: [],
    count: 0,
    activeSessionId: null,
    notice: null,
  }
  const listeners = new Set<() => void>()

  /** 发布一个新快照（浅比较由调用方负责；这里只在真的变了时通知）。 */
  const publish = (patch: Partial<PanelSnapshot>): void => {
    const next: PanelSnapshot = { ...snapshot, ...patch }
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
  const persist = (): void => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify({
        visible: snapshot.visible,
        height: snapshot.height,
        activeId: snapshot.activeId,
      } satisfies PersistedUi))
    } catch {
      // 隐私模式下 localStorage 可能抛错；UI 偏好丢了不影响功能。
    }
  }

  /** 替换终端列表（并保持 activeId 有效）。 */
  const setTerminals = (terminals: TerminalEntry[], activeId?: string | null): void => {
    const nextActive = activeId !== undefined
      ? activeId
      : (snapshot.activeId !== null && terminals.some(entry => entry.id === snapshot.activeId)
        ? snapshot.activeId
        : (terminals[0]?.id ?? null))
    publish({ terminals, count: terminals.length, activeId: nextActive })
  }

  /** 读一个 HTTP 响应并处理错误体。 */
  const readJson = async <T>(response: Response): Promise<T> => {
    const text = await response.text()
    if (!response.ok) {
      let message = `HTTP ${String(response.status)}`
      try {
        const body = JSON.parse(text) as ErrorResponse
        if (typeof body.message === 'string') message = body.message
      } catch { /* 非 JSON 错误体就用状态码 */ }
      throw new Error(message)
    }
    return JSON.parse(text) as T
  }

  // 先声明再赋值：`closeTerminal` 里要复用 `store.create()`，用 `store` 这个常量引用拿到
  // 完整对象，而不是写两遍创建逻辑（那样两处的错误处理迟早会漂移）。
  const store: TerminalPanelStore = {
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
      const pending: TerminalEntry = { id: pendingId, name: '…', state: 'pending', exitCode: null, unseen: false }
      const pendingList = [...snapshot.terminals, pending]
      publish({ terminals: pendingList, count: pendingList.length, activeId: pendingId, visible: true })
      try {
        const body: CreateTerminalRequest = { cols: 80, rows: 24 }
        if (cwd !== undefined && cwd.length > 0) body.cwd = cwd
        // 带上「用户正在看哪个会话」：宿主据此取那个会话的工作目录（工作区路径），
        // 于是 `DC-new-org` 工作区里开的终端就落在 `D:\desktop\repos\DC-new-org`。
        if (snapshot.activeSessionId !== null) body.sessionId = snapshot.activeSessionId
        const response = await doFetch(pluginPath('/terminals'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await readJson<{ terminal: TerminalMeta }>(response)
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
        const payload = await readJson<ListTerminalsResponse>(response)
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
export function clampHeight(height: number, viewport: number): number {
  const max = Math.max(HEIGHT_MIN, Math.round(viewport * HEIGHT_MAX_RATIO))
  if (!Number.isFinite(height)) return Math.min(HEIGHT_DEFAULT, max)
  return Math.max(HEIGHT_MIN, Math.min(max, Math.round(height)))
}
