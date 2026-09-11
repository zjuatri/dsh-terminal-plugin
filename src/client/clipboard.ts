/**
 * 终端的右键行为：**有选中就复制，没选中就粘贴**（VS Code 集成终端的习惯）。
 *
 * xterm 自己不带右键行为，浏览器默认会弹出自己的菜单，所以这里在面板容器上接管
 * `contextmenu`：落在终端区域内的右键一律 `preventDefault`，然后按有没有选区分流。
 *
 * 两个平台细节：
 *
 * - 粘贴走 xterm 的公开 `paste()`，而不是自己拼字节 —— `paste()` 会处理 bracketed paste
 *   （`ESC[200~…ESC[201~`）与换行转换，和终端内 Ctrl+V 的行为完全一致。
 * - 剪贴板读写用 `navigator.clipboard`，它要求安全上下文与用户手势；被拒绝时**静默失败**
 *   （不改选区、不报错），右键就表现为「什么都没发生」，而不是把终端搞坏。
 *
 * @module dsh-terminal-plugin/src/client/clipboard
 */

/** 右键需要的终端能力（xterm 的公开 API 子集）。 */
export interface ClipboardTarget {
  /** 当前是否有选中内容。 */
  hasSelection?(): boolean
  /** 取选中内容。 */
  getSelection?(): string
  /** 清掉选区。 */
  clearSelection?(): void
  /** 按 xterm 的粘贴语义把文本写进终端（含 bracketed paste 与换行转换）。 */
  paste?(data: string): void
}

/** 剪贴板读写（可注入，便于测试）。 */
export interface ClipboardAccess {
  /** 读剪贴板文本。 */
  readText(): Promise<string>
  /** 写剪贴板文本。 */
  writeText(text: string): Promise<void>
}

/** 用 `navigator.clipboard` 实现的默认剪贴板访问。 */
export function systemClipboard(): ClipboardAccess {
  return {
    async readText() {
      return await navigator.clipboard.readText()
    },
    async writeText(text: string) {
      await navigator.clipboard.writeText(text)
    },
  }
}

/** 一次右键的分流结果（测试与诊断用）。 */
export type ContextMenuAction = 'copied' | 'pasted' | 'nothing'

/** 挂右键行为时的可选注入。 */
export interface ContextMenuOptions {
  /** 剪贴板读写。 @default navigator.clipboard */
  clipboard?: ClipboardAccess
  /** 每次分流后回调（测试与日志用）。 */
  onAction?(action: ContextMenuAction): void
}

/**
 * 给终端挂上右键行为。
 *
 * @param target - 终端（xterm 实例）。
 * @param container - 面板容器：只接管落在它内部的右键事件。
 * @param options - 可注入的剪贴板与回调。
 * @returns 解绑函数。
 */
export function attachContextMenu(
  target: ClipboardTarget,
  container: HTMLElement,
  options: ContextMenuOptions = {},
): () => void {
  const clipboard = options.clipboard ?? systemClipboard()
  const report = (action: ContextMenuAction): void => {
    try {
      options.onAction?.(action)
    } catch {
      // 回调是调用方的东西，出错不该影响终端。
    }
  }

  const onContextMenu = (event: MouseEvent): void => {
    // 只处理终端区域内的右键：面板其它地方（标签条等）保持浏览器默认行为。
    const node = event.target
    if (!(node instanceof Node) || !container.contains(node)) return
    event.preventDefault()
    event.stopPropagation()
    void handle(target)
  }

  const handle = async (current: ClipboardTarget): Promise<void> => {
    if (current.hasSelection?.() === true) {
      const selection = current.getSelection?.() ?? ''
      if (selection.length === 0) return
      try {
        await clipboard.writeText(selection)
        current.clearSelection?.()
        report('copied')
      } catch {
        // 写剪贴板失败：保留选区，用户可以重试或改用 Ctrl+C。
      }
      return
    }
    try {
      const text = await clipboard.readText()
      if (text.length === 0) return
      // xterm 的 paste() 会自己处理 bracketed paste 与换行转换。
      if (typeof current.paste === 'function') {
        current.paste(text)
        report('pasted')
      }
    } catch {
      // 读剪贴板失败（权限被拒 / 非安全上下文）：静默。
    }
  }

  container.addEventListener('contextmenu', onContextMenu, true)
  return () => { container.removeEventListener('contextmenu', onContextMenu, true) }
}
