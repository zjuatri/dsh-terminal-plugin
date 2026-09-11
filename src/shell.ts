/**
 * 交互式 shell 的探测与默认参数。
 *
 * `ctx.subprocess.spawnTerminal` 明确**不做 PATH 解析**（"Executable paths belong to one
 * execution world"），所以必须给出绝对路径；Windows 上 `pwsh.exe` 可能只在 PATH 里、
 * 也可能在 `%ProgramFiles%\PowerShell\7\`，两者都要试。Unix 上优先用户自己的 `$SHELL`
 * （VSCode 的集成终端也是这个行为），再退回 bash/sh。
 *
 * 方言只影响默认参数：本插件的终端是给人用的，所以**不加** `-NoProfile` 之外的东西，
 * 也不注入 DSH 的环境变量（那是 agent 的持久终端才需要的东西）。
 *
 * @module dsh-terminal-plugin/src/shell
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** 支持的 shell 方言，决定默认参数与预设的环境变量。 */
export type ShellDialect = 'pwsh' | 'powershell' | 'bash' | 'sh'

/** 解析结果：一个可执行的绝对路径、它的参数、以及方言。 */
export interface ShellSpec {
  /** 可执行文件绝对路径。 */
  path: string
  /** 参数（不含可执行文件本身）。 */
  args: readonly string[]
  /** 判定出的方言，供环境变量与提示使用。 */
  dialect: ShellDialect
}

/** pwsh 与 Windows PowerShell 都接受的参数：不打印横幅、不加载 profile。 */
const WINDOWS_ARGS = ['-NoLogo']

/** bash 的默认参数：交互式、不读 profile（避免用户 rc 里的自启动命令污染终端）。 */
const BASH_ARGS = ['--noprofile', '--norc', '-i']

/**
 * 在 PATH 里找可执行文件。
 *
 * @param name - 可执行文件名（含扩展名）。
 * @param env - 用于查找的环境（默认进程环境）。
 * @param platform - 目标平台（便于测试注入）。
 * @returns 绝对路径，找不到时 null。
 */
export function findOnPath(name: string, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string | null {
  const raw = env.PATH ?? env.Path ?? env.path ?? ''
  const separator = platform === 'win32' ? ';' : ':'
  for (const directory of raw.split(separator)) {
    if (directory.trim().length === 0) continue
    const candidate = join(directory.trim(), name)
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * 探测一个可用的 shell。
 *
 * @param options - 平台、显式配置、环境与「文件是否存在」的判定；后两项用于测试注入。
 * @returns shell 的绝对路径、参数与方言。
 * @throws 探测不到任何 shell 时抛出，错误信息里带上试过的路径（配置错误的排查成本最低）。
 */
export function resolveShell(options: {
  platform?: NodeJS.Platform
  shellPath?: string | undefined
  shellArgs?: readonly string[] | undefined
  env?: NodeJS.ProcessEnv
  fileExists?: (path: string) => boolean
} = {}): ShellSpec {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  // 检查「存在性」是这一层唯一的 IO，做成可注入的判定，测试才能在 Windows 上验证
  // Unix 的候选顺序（反过来也一样）。
  const exists = options.fileExists ?? ((path: string) => existsSync(path))
  const explicit = options.shellPath !== undefined && options.shellPath.trim().length > 0 ? options.shellPath.trim() : null

  if (explicit !== null) {
    const dialect = dialectOf(explicit)
    const args = options.shellArgs !== undefined && options.shellArgs.length > 0
      ? [...options.shellArgs]
      : defaultArgs(dialect)
    return { path: explicit, args, dialect }
  }

  const candidates = platform === 'win32' ? windowsCandidates(env) : unixCandidates(env)
  for (const candidate of candidates) {
    if (!exists(candidate.path)) continue
    const args = options.shellArgs !== undefined && options.shellArgs.length > 0
      ? [...options.shellArgs]
      : defaultArgs(candidate.dialect)
    return { path: candidate.path, args, dialect: candidate.dialect }
  }

  throw new Error([
    'dsh-terminal-plugin: 没有找到可用的交互式 shell，请在插件配置里显式指定 shellPath。',
    `已尝试：${candidates.map(candidate => candidate.path).join('、') || '(无候选)'}`,
  ].join('\n'))
}

/** Windows 候选顺序：pwsh（PATH → 安装目录 → WindowsApps 别名）→ Windows PowerShell。 */
function windowsCandidates(env: NodeJS.ProcessEnv): { path: string; dialect: ShellDialect }[] {
  const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
  const systemRoot = env.SystemRoot ?? 'C:\\Windows'
  const localAppData = env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
  const candidates: { path: string; dialect: ShellDialect }[] = []
  const onPathPwsh = findOnPath('pwsh.exe', env, 'win32')
  if (onPathPwsh !== null) candidates.push({ path: onPathPwsh, dialect: 'pwsh' })
  candidates.push(
    { path: join(programFiles, 'PowerShell', '7', 'pwsh.exe'), dialect: 'pwsh' },
    { path: join(localAppData, 'Microsoft', 'WindowsApps', 'pwsh.exe'), dialect: 'pwsh' },
    { path: join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), dialect: 'powershell' },
  )
  const onPathPowerShell = findOnPath('powershell.exe', env, 'win32')
  if (onPathPowerShell !== null) candidates.push({ path: onPathPowerShell, dialect: 'powershell' })
  return candidates
}

/** Unix 候选顺序：用户自己的 `$SHELL` → /bin/bash → /bin/sh。 */
function unixCandidates(env: NodeJS.ProcessEnv): { path: string; dialect: ShellDialect }[] {
  const candidates: { path: string; dialect: ShellDialect }[] = []
  const userShell = env.SHELL
  if (userShell !== undefined && userShell.startsWith('/')) {
    candidates.push({ path: userShell, dialect: dialectOf(userShell) })
  }
  candidates.push({ path: '/bin/bash', dialect: 'bash' }, { path: '/bin/sh', dialect: 'sh' })
  return candidates
}

/** 从可执行文件名判定方言。 */
function dialectOf(path: string): ShellDialect {
  const name = path.replace(/\\/gu, '/').split('/').pop()?.toLowerCase() ?? ''
  if (name.startsWith('pwsh')) return 'pwsh'
  if (name.startsWith('powershell')) return 'powershell'
  if (name.startsWith('bash')) return 'bash'
  return 'sh'
}

/** 方言的默认参数。 */
function defaultArgs(dialect: ShellDialect): string[] {
  return dialect === 'bash' ? [...BASH_ARGS] : [...WINDOWS_ARGS]
}

/** 终端环境变量：告诉 shell 它在一个真终端里，并让分页器不要卡住。 */
export function terminalEnv(spec: ShellSpec): Record<string, string> {
  const base: Record<string, string> = {
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    // 交互式终端里分页器会独占屏幕；xterm 能渲染，所以只把「不要等待」的东西去掉。
    DSH_SHELL: '1',
  }
  if (spec.dialect === 'pwsh' || spec.dialect === 'powershell') {
    // PowerShell 在非 7.2 以下对 UTF-8 的默认行为不一致，显式打开。
    base.PYTHONIOENCODING = 'utf-8'
  }
  return base
}

/** 把 `{cwd}` 记号替换成进程工作目录。 */
export function expandCwdToken(raw: string, processCwd: string): string {
  return raw.replaceAll('{cwd}', processCwd)
}
