/**
 * 工作目录解析：把「插件的配置」和「用户当前所在的会话 / 工作区」合成一个可用的
 * 终端初始目录。
 *
 * 优先级（VSCode 的集成终端也是这个顺序）：
 *
 * 1. 用户在本插件配置里写死的 `cwd`（支持 `{cwd}` 记号）；
 * 2. 当前会话头里的工作目录 —— `ctx.sessions` 的可选只读；
 * 3. 当前会话所属工作区注册的 canonical 路径 —— `ctx.workspaceRegistry` 的可选只读；
 * 4. 宿主进程的工作目录。
 *
 * 「可选」在这里是硬约束：`sessions` 与 `workspaceRegistry` 不是本插件的硬依赖，
 * 缺席时不能拖住激活，所以这里只接受外部传进来的、已经取到的值；探测本身由
 * `src/index.ts` 在 `ctx.inject` 回调里完成。
 *
 * @module dsh-terminal-plugin/src/cwd
 */

import { statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { expandCwdToken } from './shell.js'

/** 解析时用到的全部输入，全部可注入，便于测试。 */
export interface ResolveCwdOptions {
  /** 配置里的 `cwd`；空表示按会话/工作区推断。 */
  configured?: string | undefined
  /** 宿主进程工作目录（`{cwd}` 记号与兜底都用它）。 */
  processCwd: string
  /** 当前会话头里的工作目录（若取得到）。 */
  sessionCwd?: string | undefined
  /** 当前会话所属工作区的 canonical 路径（若取得到）。 */
  workspacePath?: string | undefined
}

/** 一个目录是否真实存在。 */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * 判断一个候选目录可用。
 *
 * 只有绝对路径才接受：相对路径的基准在「执行世界」里没有定义，猜一个等于埋一个
 * 只在生产环境才出现的坑。
 *
 * @param candidate - 候选路径。
 * @returns 可用时返回原值，否则 undefined。
 */
export function usableDirectory(candidate: string | undefined): string | undefined {
  if (candidate === undefined) return undefined
  const trimmed = candidate.trim()
  if (trimmed.length === 0 || !isAbsolute(trimmed)) return undefined
  return isDirectory(trimmed) ? trimmed : undefined
}

/**
 * 按优先级挑出终端的工作目录。
 *
 * @param options - 配置、会话、工作区与进程工作目录。
 * @returns 一个确定存在的绝对目录；全部候选都不可用时返回进程工作目录。
 */
export function resolveWorkingDirectory(options: ResolveCwdOptions): string {
  const { processCwd } = options
  const ordered: (string | undefined)[] = []
  if (options.configured !== undefined && options.configured.trim().length > 0) {
    ordered.push(expandCwdToken(options.configured, processCwd))
  }
  ordered.push(options.workspacePath, options.sessionCwd)
  for (const candidate of ordered) {
    const usable = usableDirectory(candidate)
    if (usable !== undefined) return usable
  }
  return processCwd
}

/** 一个工作区里本插件用到的只读子集。 */
export interface WorkspaceLike {
  /** canonical 目录路径。 */
  readonly path?: string
  /** 账下（header 校验过的）会话 id。 */
  readonly sessionIds?: readonly string[]
}

/** 一个会话里本插件用到的只读子集。 */
export interface SessionLike {
  /** 会话头（`cwd` 是创建时登记的工作目录）。 */
  readonly header?: { readonly cwd?: string }
}

/** 路径比较用的规范化：Windows 大小写不敏感，POSIX 敏感。 */
function normalizePath(path: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? path.toLowerCase() : path
}

/** 从会话头里取工作目录。 */
function headerCwd(session: SessionLike | undefined): string | undefined {
  const cwd = session?.header?.cwd
  return typeof cwd === 'string' && cwd.length > 0 ? cwd : undefined
}

/**
 * 找出一个会话所属的工作区 —— **这是「新终端该落在哪」的正确依据**。
 *
 * 为什么不能只看会话的 `header.cwd`：一个工作区下可以有多条会话，而 `header.cwd` 只是
 * 创建那条会话时的目录；工作区自己的账目（`sessionIds`）更权威，而且是 header 校验过的。
 *
 * 三种来源按顺序尝试：
 *
 * 1. `sessionIds` 命中 —— 会话就在这个工作区账下（最准）。
 * 2. `path === 会话 cwd` —— 账目还没建立（例如刚挂载）时按路径兜底；Windows 大小写不敏感。
 * 3. 第一条 `usableDirectory(path)` 能用的工作区 —— 会话与工作区都失联时，至少落在
 *    「用户当前所在的工作区」里。
 *
 * @param workspaces - 工作区列表（`ctx.workspaceRegistry.list()`）。
 * @param sessions - 取会话的函数（`ctx.sessions.get`）。
 * @param sessionId - 用户正在看的会话 id（可缺省）。
 * @param platform - 路径比较用的平台。 @default process.platform
 * @returns 工作区路径，或 undefined。
 */
export function workspacePathForSession(
  workspaces: readonly WorkspaceLike[] | undefined,
  sessions: ((id: string) => SessionLike | undefined) | undefined,
  sessionId: string | undefined,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const hasPath = (candidate: WorkspaceLike): candidate is WorkspaceLike & { path: string } =>
    typeof candidate.path === 'string' && candidate.path.length > 0
  if (sessionId !== undefined && sessionId.length > 0) {
    // 1) 会话在这个工作区的账下。
    const owner = workspaces?.find(candidate => hasPath(candidate) && candidate.sessionIds?.includes(sessionId) === true)
    if (owner !== undefined && hasPath(owner)) return owner.path
    // 2) 按会话 cwd 与工作区路径比对。
    const cwd = headerCwd(sessions?.(sessionId))
    if (cwd !== undefined) {
      const matched = workspaces?.find(candidate => hasPath(candidate) && normalizePath(candidate.path, platform) === normalizePath(cwd, platform))
      if (matched !== undefined && hasPath(matched)) return matched.path
    }
  }
  // 3) 兜底：真实存在的工作区目录。会话能给出 cwd 时优先挑「与它相同」的那个，先比精确
  //    写法再比规范化写法（Windows 大小写不敏感）—— 这样拿到的路径写法与用户所在目录一致，
  //    也不会因为工作区数组的顺序不同而给出大小写不同的路径。
  const sessionCwd = sessionId === undefined || sessionId.length === 0 ? undefined : headerCwd(sessions?.(sessionId))
  const candidates = (workspaces ?? []).filter(hasPath)
  if (sessionCwd !== undefined) {
    const exact = candidates.find(candidate => candidate.path === sessionCwd)
    if (exact !== undefined) return exact.path
    const same = candidates.find(candidate => normalizePath(candidate.path, platform) === normalizePath(sessionCwd, platform))
    if (same !== undefined) return same.path
  }
  for (const candidate of candidates) {
    if (usableDirectory(candidate.path) !== undefined) return candidate.path
  }
  return undefined
}
