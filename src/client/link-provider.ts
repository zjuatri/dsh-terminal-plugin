/**
 * 终端里的链接识别：把输出里的 URL 与文件路径变成可点击的链接。
 *
 * 触发方式是 **Ctrl/Cmd + 点击** —— 这件事**必须由这一层自己做**：翻 `vendor/xterm.mjs`
 * 可以看到 xterm 完全不做修饰键判断（`_handleMouseMove` 只按格子算链接，`_handleMouseUp`
 * 直接调用 `ILink.activate`），所以「按住修饰键才算数」是调用方的责任。
 *
 * 门控放在 **`activate` 里**，而不是「不按 Ctrl 时 `provideLinks` 回 undefined」：xterm 把
 * 每个 provider 的结果按行缓存在 `_activeProviderReplies` 里，`_askForLink` 的 force 分支
 * 只读缓存、不再问 provider，于是「按下 Ctrl 那一刻这一行才突然有链接」在鼠标没换行时根本
 * 不生效 —— 同一格上的链接会时灵时不灵。`activate` 拿得到真实的 `mouseup` 事件，直接读
 * `event.ctrlKey` 最稳，行为也和 VS Code 一致：悬停就显示下划线，按住 Ctrl/Cmd 点才打开。
 *
 * dev server 打印的 `http://localhost:3000`、报错里的 `D:\repo\src\foo.ts:12:3` 都属于这类；
 * 但形如 `(Turbopack)` 里的 `/Turbopack` **不算** —— 假链接比漏标更烦人，见 `PATH_PATTERN`。
 *
 * 列与行的口径是这里最容易出错的地方：`provideLinks` 给的是 **1 基的绝对行号**（要减 1 才
 * 能喂给 `buffer.getLine`），而 `ILink.range` 用的是**列**（宽字符占两列，字符串下标不能直接
 * 当列用）。两处都有专门的函数与测试钉着。
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
export interface DetectedLink {
  /** 起始下标（基于 `translateToString(true)` 的字符串）。 */
  startIndex: number
  /** 结束下标（不含）。 */
  endIndex: number
  /** 文本形态（显示/调试用）。 */
  text: string
  /** 要打开的地址；`undefined` 表示这条只标注、不可打开（例如被排除的协议）。 */
  url?: string
}

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
 * 文件路径。
 *
 * 三段设计都是为了**不标错**（假链接比漏标更烦人）：
 *
 * 1. 前缀必须是显式的路径开头：`./`、`../`、`/`、`X:\`、`\\`。因此 `foo.ts` 这种裸文件名不算。
 * 2. 扩展名要求 **2–10 位**（`\.[A-Za-z][\w]{1,9}`）。早先只要求 1 位，于是
 *    `▲ Next.js 16.2.3 (Turbopack)` 里最后那位 `k` 被当成「盘符」，切出 `/Turbopack`
 *    并算成绝对路径 —— 点它就会去打开 `file:///Turbopack`。把最短长度提到 2 就挡住了这类。
 * 3. 开头不能紧跟 `:` 或 `\w`（`(?<![:\w])`），避免把 `data://x/y` 里紧跟冒号的 `/` 再切一段。
 */
const PATH_PATTERN = /(?<![:\w])(?:\.{1,2}[\\/]|[A-Za-z]:[\\/]|[\\/])[\w.@+-]+(?:[\\/][\w.@+-]+)*\.[A-Za-z][\w]{1,9}(?::\d+(?::\d+)?)?/gu

/**
 * 收尾时去掉挂在末尾的标点 —— 终端里的 URL 经常被括号或句号包住。
 *
 * @param raw - 正则命中的原始文本。
 * @returns 收拾干净的文本。
 */
function trimTrailingPunctuation(raw: string): string {
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
export function fileUrlForPath(raw: string): string | undefined {
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
export function openableUrl(raw: string): string | undefined {
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
export function detectLinks(line: string): DetectedLink[] {
  if (typeof line !== 'string' || line.length === 0) return []
  /** @type {DetectedLink[]} */
  const schemes: DetectedLink[] = []
  const paths: DetectedLink[] = []

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
  const kept: DetectedLink[] = []
  for (const candidate of found) {
    if (kept.some(existing => candidate.startIndex < existing.endIndex && existing.startIndex < candidate.endIndex)) continue
    kept.push(candidate)
  }
  return kept.slice(0, MAX_LINKS)
}

/** 一行里最多返回多少条链接（真实终端里不会更多）。 */
export const MAX_LINKS = 8

/** xterm 的 `ILinkDecorations` 形状。 */
export interface LinkDecorations {
  pointerCursor: boolean
  underline: boolean
}

/** xterm 的 `IBufferCellPosition` 形状（列与行都是 1 基）。 */
export interface CellPosition {
  x: number
  y: number
}

/** xterm 的 `ILink` 形状。 */
export interface TerminalLink {
  range: { start: CellPosition; end: CellPosition }
  text: string
  decorations?: LinkDecorations
  activate(event: MouseEvent, text: string): void
  /** 鼠标停在链接上（用来给出「Ctrl+点击」的提示）。 */
  hover?(event: MouseEvent, text: string): void
  /** 鼠标离开链接。 */
  leave?(event: MouseEvent, text: string): void
}

/** xterm 的 `ILinkProvider` 形状。 */
export interface LinkProvider {
  provideLinks(bufferLineNumber: number, callback: (links: TerminalLink[] | undefined) => void): void
}

/** xterm buffer 里一个格子的最小面（`IBufferCell` 的子集）。 */
export interface BufferCellLike {
  /** 这个格子占几列：宽字符 2、普通 1、宽字符的第二格 0。 */
  getWidth?(): number
  /** 格子里的字符（可能是代理对或「基字符 + 组合字符」，长度大于 1）。 */
  getChars?(): string
}

/** xterm buffer 里一行的最小面（`IBufferLine` 的子集）。 */
export interface BufferLineLike {
  translateToString?(trimRight?: boolean, startColumn?: number, endColumn?: number): string
  getCell?(column: number): BufferCellLike | undefined
}

/** xterm buffer 的最小面（`IBuffer` 的子集，只用到取行）。 */
export interface BufferLike {
  getLine?(line: number): BufferLineLike | undefined
}

/** 一行文本，外加「字符串下标 → 列」的对照表。 */
export interface LineText {
  /** 纯文本（`translateToString(true)`：剥掉 ANSI、裁掉行尾空白）。 */
  text: string
  /**
   * `columns[i]` 是 `text[i]` 所在的 **0 基列**（末尾多一个元素给出文本右侧的结束列）。
   *
   * 宽字符（CJK、部分符号）占两列，于是字符串下标与列号不再相等：`中文 http://x` 里 URL 的
   * 字符串下标是 5，列号却是 9（`中`/`文` 各占两格）。xterm 的 `ILink.range` 用的是**列**，
   * 拿下标当列用会让链接整体左移，点 A 打开 B —— 和行号错一行是同一类错。
   *
   * 拿不到格子信息时为 undefined，此时按「一字符一列」处理（纯 ASCII 行两者相等）。
   */
  columns?: number[]
}

/** 取一行文本的函数（由调用方从 xterm 的 buffer 里读）。 */
export type LineReader = (bufferLineNumber: number) => LineText | string | undefined

/**
 * 建一张「字符串下标 → 列」的对照表。
 *
 * 列宽只能问 xterm 的格子（`getCell(x).getWidth()`）：宽字符的第 2 格宽度为 0，不该产生字符；
 * 空格子在 `translateToString` 里是 `' '`，而 `getChars()` 给的是空串 —— 两个特例都要照顾到，
 * 表才和 `text` 严格对齐（长度不符时宁可退回 undefined，也不给出错位的列）。
 *
 * @param line - xterm 的一行。
 * @param text - 同一行的 `translateToString(true)` 结果。
 * @returns 长度为 `text.length + 1` 的列数组，或 undefined（拿不到格子）。
 */
function buildColumnMap(line: BufferLineLike, text: string): number[] | undefined {
  if (typeof line.getCell !== 'function') return undefined
  const columns: number[] = []
  let trimmedLength = 0
  for (let column = 0; columns.length < text.length; column += 1) {
    const cell = line.getCell(column)
    if (cell === undefined) return undefined
    const width = cell.getWidth?.() ?? 1
    if (width === 0) continue
    const chars = cell.getChars?.() || ' '
    for (let index = 0; index < chars.length && columns.length < text.length; index += 1) {
      columns.push(column)
    }
    trimmedLength = column + width
  }
  if (columns.length !== text.length) return undefined
  columns.push(trimmedLength)
  return columns
}

/**
 * 按 xterm 的 `provideLinks` 行号读一行。
 *
 * **行号口径必须在这里统一**，这是踩过的坑：`provideLinks(bufferLineNumber)` 收到的是
 * **1 基的绝对行号**（xterm 内部算的是 `视口行 + ydisp`，连它自带的 OSC 链接实现都写
 * `buffer.lines.get(t - 1)`），而 `buffer.active.getLine(n)` 收的是 **0 基下标**。
 * 直接把行号透传给 `getLine` 会整体错开一行 —— 下划线还画在正确的行上（那是拿
 * `range.start.y` 算的），读到的文本却来自下一行，于是「点 Local 打开 Network」。
 *
 * @param buffer - 终端缓冲区（`terminal.buffer.active`）。
 * @param bufferLineNumber - xterm 给的 1 基绝对行号。
 * @returns 该行文本与列对照表，读不到时 undefined。
 */
export function readBufferLine(buffer: BufferLike | undefined, bufferLineNumber: number): LineText | undefined {
  if (buffer === undefined) return undefined
  const line = buffer.getLine?.(bufferLineNumber - 1)
  if (line === undefined) return undefined
  const text = line.translateToString?.(true)
  if (text === undefined) return undefined
  return { text, columns: buildColumnMap(line, text) }
}

/** 打开一个地址（可注入，便于测试）。 */
export type OpenUrl = (url: string) => void

/** 悬停提示的宿主（`terminal.element` 就够用，只写 `title`）。 */
export interface HoverTarget {
  title?: string
}

/** 创建 link provider 需要的一切。 */
export interface LinkProviderOptions {
  /** 读第 n 行的文本。 */
  readLine: LineReader
  /** 打开地址。 @default window.open(url, '_blank', 'noopener,noreferrer') */
  open?: OpenUrl
  /**
   * 悬停到链接时的提示文案（例如「Ctrl+点击打开 …」）。给了就写进
   * {@link LinkProviderOptions.hoverTarget} 的 `title`，用原生气泡说明「要按 Ctrl」。
   */
  hint?: (url: string) => string
  /** 提示写到哪个元素上（通常是 `terminal.element`）。 */
  hoverTarget?: HoverTarget | undefined
}

/**
 * 当前平台是否把 Cmd（而不是 Ctrl）当作链接的修饰键。
 *
 * @returns macOS 上为 true。
 */
function prefersMeta(): boolean {
  const platform = globalThis.navigator?.userAgentData?.platform ?? globalThis.navigator?.platform ?? ''
  return /mac|iphone|ipad|ipod/iu.test(platform)
}

/**
 * 这次点击算不算「跟随链接」—— 也就是按住了 Ctrl（macOS 上 Cmd）。
 *
 * @param event - xterm 交回来的 `mouseup` 事件。
 * @returns 按住时为 true。
 */
export function isFollowClick(event: { ctrlKey?: boolean; metaKey?: boolean } | undefined): boolean {
  if (event === undefined) return false
  return prefersMeta() ? event.metaKey === true : event.ctrlKey === true
}

/**
 * 默认的打开方式：新标签页打开，并且不让被打开的页面拿到 `window.opener`。
 *
 * @param url - 要打开的地址。
 */
export function openInNewTab(url: string): void {
  try {
    globalThis.open?.(url, '_blank', 'noopener,noreferrer')
  } catch {
    // 被弹窗拦截器拦下时什么都不做 —— 终端不该因此报错。
  }
}

/**
 * 写悬停提示（原生 `title` 气泡）。
 *
 * @param target - 提示元素；没有就什么都不做。
 * @param value - 提示文本（空串即清掉）。
 */
function setHint(target: HoverTarget | undefined, value: string): void {
  try {
    if (target !== undefined) target.title = value
  } catch {
    // 终端不该因为一次提示而报错。
  }
}

/**
 * 造一个 xterm 的 link provider。
 *
 * 门控在 `activate` 里（见模块文档）：链接**总是**提供给 xterm（悬停照样有下划线与手型
 * 光标），但只有按住 Ctrl/Cmd 的那次点击才会真的打开地址。
 *
 * @param options - 读行、打开地址与悬停提示。
 * @returns 可以直接交给 `terminal.registerLinkProvider` 的 provider。
 */
export function createLinkProvider(options: LinkProviderOptions): LinkProvider {
  const open = options.open ?? openInNewTab
  const hint = options.hint
  const hoverTarget = options.hoverTarget

  const makeLink = (link: DetectedLink, bufferLineNumber: number, columnOf: (index: number) => number): TerminalLink => {
    const url = link.url
    const created: TerminalLink = {
      range: {
        start: { x: columnOf(link.startIndex) + 1, y: bufferLineNumber },
        end: { x: columnOf(link.endIndex), y: bufferLineNumber },
      },
      text: link.text,
      decorations: { pointerCursor: true, underline: true },
      activate(event) {
        if (url === undefined) return
        if (!isFollowClick(event)) return
        open(url)
      },
    }
    if (url !== undefined && hint !== undefined) {
      created.hover = () => { setHint(hoverTarget, hint(url)) }
      created.leave = () => { setHint(hoverTarget, '') }
    }
    return created
  }

  return {
    provideLinks(bufferLineNumber, callback) {
      try {
        const read = options.readLine(bufferLineNumber)
        const text = typeof read === 'string' ? read : read?.text
        const columns = typeof read === 'string' ? undefined : read?.columns
        if (text === undefined || text.length === 0) {
          callback(undefined)
          return
        }
        const links = detectLinks(text)
        if (links.length === 0) {
          callback(undefined)
          return
        }
        // 字符串下标 → xterm 的列号：`start.x` 是 1 基的起点，`end.x` 是**闭区间**的终点
        // （xterm 用 `start <= 点击格 <= end` 判定命中），见 LineText.columns。
        const columnOf = (index: number): number => columns?.[index] ?? index
        callback(links.map(link => makeLink(link, bufferLineNumber, columnOf)))
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
 * @param terminal - 已经 `open()` 过的终端（`element` 用来挂悬停提示）。
 * @param options - 读行、打开地址与悬停提示。
 * @returns 取消注册的函数。
 */
export function attachLinkProvider(
  terminal: { registerLinkProvider(provider: LinkProvider): { dispose(): void }; element?: HoverTarget | undefined },
  options: LinkProviderOptions,
): () => void {
  const withTarget: LinkProviderOptions = { ...options, hoverTarget: options.hoverTarget ?? terminal.element }
  const registration = terminal.registerLinkProvider(createLinkProvider(withTarget))
  return () => { registration.dispose() }
}
