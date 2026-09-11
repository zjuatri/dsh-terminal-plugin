/**
 * 插件配置：Schema 由加载器用来校验 profile 里的原始配置并补齐默认值，因此运行时拿到
 * 的 `config` 恰好带有 `ResolvedConfig` 声明的字段（`src/index.ts` 里直接断言）。
 *
 * 默认值刻意跟 VSCode 的集成终端对齐：人来操作的终端不该有生存期策略
 * （`idleCloseAfterMs` 默认 0 = 永不自动关闭），也不受 DSH 工具沙箱约束
 * （终端等价于人自己的 shell）。
 *
 * @module dsh-terminal-plugin/src/config
 */

import z from '@deepseek-ai/schemastery'

/** 宿主侧全部可配置项。 */
export interface Config {
  /**
   * 本插件所有 HTTP/WS 路径的前缀。改为别的值时客户端会从注入的引导行里读到新值，
   * 不需要两边同时改。
   * @default '/dsh-terminal'
   */
  mountPrefix?: string
  /**
   * 交互式 shell 的**绝对路径**。留空表示自动探测，见 `src/shell.ts`：
   * Windows 先找 `pwsh.exe`，退回 `powershell.exe`；Unix 用 `$SHELL`、`/bin/bash`。
   */
  shellPath?: string
  /** shell 参数。留空按探测到的方言给默认值。 */
  shellArgs?: string[]
  /**
   * 新终端的默认工作目录。`{cwd}` 会替换为宿主进程的工作目录；留空表示跟随当前
   * 会话的工作区（拿不到就退回进程工作目录）。
   */
  cwd?: string
  /** 附加到终端的显式环境变量（在 provider 的环境清洗之后合并）。 */
  env?: Record<string, string>
  /** 初始行数。 @default 24 */
  rows?: number
  /** 初始列数。 @default 80 */
  cols?: number
  /**
   * 每个终端保留多少字节用于断线重连回放。超过就从最早的输出开始丢。
   * @default 262144
   */
  scrollbackBytes?: number
  /**
   * 无人 attach 多久后自动关闭终端；0 表示永不自动关闭（VSCode 语义）。
   * @default 0
   */
  idleCloseAfterMs?: number
  /** 同时存在的终端上限，超出时创建请求被拒。 @default 20 */
  maxTerminals?: number
}

/** Schemastery 配置 schema；由插件的 `Config` 导出给 cordis 的加载器。 */
export const Config: z<Config> = z.object({
  mountPrefix: z.string().default('/dsh-terminal'),
  shellPath: z.string().required(false),
  shellArgs: z.array(z.string()).required(false),
  cwd: z.string().required(false),
  env: z.dict(z.string()).default({}),
  rows: z.number().default(24),
  cols: z.number().default(80),
  scrollbackBytes: z.number().default(256 * 1024),
  idleCloseAfterMs: z.number().default(0),
  maxTerminals: z.number().default(20),
})

/** 补齐默认值后的配置；`shellPath`/`shellArgs`/`cwd` 的解析在 `src/shell.ts`。 */
export type ResolvedConfig = Config & {
  mountPrefix: string
  env: Record<string, string>
  rows: number
  cols: number
  scrollbackBytes: number
  idleCloseAfterMs: number
  maxTerminals: number
}

/** 把路径前缀规范化成 `无尾斜杠 + 有前导斜杠` 的形式。 */
export function normalizePrefix(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/u, '')
  if (trimmed.length === 0) throw new Error('dsh-terminal-plugin: mountPrefix 不能为空')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/**
 * 夹紧终端尺寸，避免调用方给出非法值直接喂给 ConPTY。
 *
 * @param value - 请求值。
 * @param min - 下界。
 * @param max - 上界。
 * @param fallback - 非法（NaN/非整数）时的兜底值。
 * @returns 合法整数。
 */
export function clampDimension(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.floor(value)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}
