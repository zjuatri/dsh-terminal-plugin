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
}

/** xterm 的 `ILinkProvider` 形状。 */
export interface LinkProvider {
  provideLinks(bufferLineNumber: number, callback: (links: TerminalLink[] | undefined) => void): void
}

/** 取一行文本的函数（由调用方从 xterm 的 buffer 里读）。 */
export type LineReader = (bufferLineNumber: number) => string | undefined

/** 打开一个地址（可注入，便于测试）。 */
export type OpenUrl = (url: string) => void

/** 创建 link provider 需要的一切。 */
export interface LinkProviderOptions {
  /** 读第 n 行的文本。 */
  readLine: LineReader
  /** 打开地址。 @default window.open(url, '_blank', 'noopener,noreferrer') */
  open?: OpenUrl
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
 * 造一个 xterm 的 link provider。
 *
 * 触发条件是 xterm 自己管的：它只在按住 Ctrl/Cmd 时才对链接调用 `activate`，所以这里
 * 不需要再判断修饰键。
 *
 * @param options - 读行与打开地址的方式。
 * @returns 可以直接交给 `terminal.registerLinkProvider` 的 provider。
 */
export function createLinkProvider(options: LinkProviderOptions): LinkProvider {
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
        } satisfies TerminalLink)))
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
export function attachLinkProvider(
  terminal: { registerLinkProvider(provider: LinkProvider): { dispose(): void } },
  options: LinkProviderOptions,
): () => void {
  const registration = terminal.registerLinkProvider(createLinkProvider(options))
  return () => { registration.dispose() }
}
