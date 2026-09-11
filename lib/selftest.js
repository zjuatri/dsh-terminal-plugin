//! 自动生成，请勿直接编辑 —— 由 scripts/build.mjs 从 src/*.ts 生成。
//!
//! profile 用 `file://` 行加载本文件，所以它必须是 Node 能直接 import 的 ESM：
//! 类型已剥离、相对 import 已内联、外部依赖在顶部导入一次。
import * as __ext_M1_0 from "@deepseek-ai/schemastery"
import * as __ext_M2_1 from "node:fs"
import * as __ext_M2_2 from "node:os"
import * as __ext_M2_3 from "node:path"
import * as __ext_M7_4 from "node:url"
import * as __ext_M8_5 from "ws"

/** 外部依赖的取用口：ESM 命名空间对象即导入表。 */
const __external = (specifier) => {
  switch (specifier) {
    case "node:fs": return __ext_M2_1
    case "node:os": return __ext_M2_2
    case "node:path": return __ext_M2_3
    case "node:url": return __ext_M7_4
    case "ws": return __ext_M8_5
    default: throw new Error(`dsh-terminal-plugin: 未声明外部依赖 ${specifier}`)
  }
}

/** 默认导入的取用口（对应 `import z from '…'`）。 */
const __externalDefault = (specifier) => {
  switch (specifier) {
    case "@deepseek-ai/schemastery": return __ext_M1_0.default
    default: throw new Error(`dsh-terminal-plugin: 未声明外部依赖 ${specifier}`)
  }
}

// ── src/config.ts ──
const M1 = (() => {
  const z = __externalDefault("@deepseek-ai/schemastery")
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


  /** 宿主侧全部可配置项。 */
                           
       
                                                  
                
                               
       
                        
       
                                                     
                                                                             
       
                      
                                  
                        
       
                                                
                            
       
                
                                              
                                
                            
                 
                            
                 
       
                                       
                      
       
                            
       
                                                 
                 
       
                             
                                           
                         
   

  /** Schemastery 配置 schema；由插件的 `Config` 导出给 cordis 的加载器。 */
  const Config            = z.object({
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
                                         
                       
                               
                
                
                           
                            
                        
   

  /** 把路径前缀规范化成 `无尾斜杠 + 有前导斜杠` 的形式。 */
  function normalizePrefix(raw        )         {
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
  function clampDimension(value         , min        , max        , fallback        )         {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    const rounded = Math.floor(value)
    if (rounded < min) return min
    if (rounded > max) return max
    return rounded
  }
  return {
    Config,
    normalizePrefix,
    clampDimension,
    z,
  }
})()

// ── src/shell.ts ──
const M2 = (() => {
  const __ext_M2_1 = __external("node:fs")
  const { existsSync } = __ext_M2_1
  const __ext_M2_2 = __external("node:os")
  const { homedir } = __ext_M2_2
  const __ext_M2_3 = __external("node:path")
  const { join } = __ext_M2_3
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


  /** 支持的 shell 方言，决定默认参数与预设的环境变量。 */
                                                                  

  /** 解析结果：一个可执行的绝对路径、它的参数、以及方言。 */
                              
                     
                
                         
                           
                             
                         
   

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
  function findOnPath(name        , env                    = process.env, platform                  = process.platform)                {
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
  function resolveShell(options   
                              
                                  
                                             
                           
                                          
    = {})            {
    const platform = options.platform ?? process.platform
    const env = options.env ?? process.env
    // 检查「存在性」是这一层唯一的 IO，做成可注入的判定，测试才能在 Windows 上验证
    // Unix 的候选顺序（反过来也一样）。
    const exists = options.fileExists ?? ((path        ) => existsSync(path))
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
  function windowsCandidates(env                   )                                            {
    const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
    const systemRoot = env.SystemRoot ?? 'C:\\Windows'
    const localAppData = env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    const candidates                                            = []
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
  function unixCandidates(env                   )                                            {
    const candidates                                            = []
    const userShell = env.SHELL
    if (userShell !== undefined && userShell.startsWith('/')) {
      candidates.push({ path: userShell, dialect: dialectOf(userShell) })
    }
    candidates.push({ path: '/bin/bash', dialect: 'bash' }, { path: '/bin/sh', dialect: 'sh' })
    return candidates
  }

  /** 从可执行文件名判定方言。 */
  function dialectOf(path        )               {
    const name = path.replace(/\\/gu, '/').split('/').pop()?.toLowerCase() ?? ''
    if (name.startsWith('pwsh')) return 'pwsh'
    if (name.startsWith('powershell')) return 'powershell'
    if (name.startsWith('bash')) return 'bash'
    return 'sh'
  }

  /** 方言的默认参数。 */
  function defaultArgs(dialect              )           {
    return dialect === 'bash' ? [...BASH_ARGS] : [...WINDOWS_ARGS]
  }

  /** 终端环境变量：告诉 shell 它在一个真终端里，并让分页器不要卡住。 */
  function terminalEnv(spec           )                         {
    const base                         = {
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
  function expandCwdToken(raw        , processCwd        )         {
    return raw.replaceAll('{cwd}', processCwd)
  }
  return {
    WINDOWS_ARGS,
    BASH_ARGS,
    findOnPath,
    resolveShell,
    windowsCandidates,
    unixCandidates,
    dialectOf,
    defaultArgs,
    terminalEnv,
    expandCwdToken,
    existsSync,
    homedir,
    join,
  }
})()

// ── src/cwd.ts ──
const M3 = (() => {
  const __ext_M2_1 = __external("node:fs")
  const { statSync } = __ext_M2_1
  const __ext_M2_3 = __external("node:path")
  const { isAbsolute } = __ext_M2_3
  const { expandCwdToken } = M2
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


  /** 解析时用到的全部输入，全部可注入，便于测试。 */
                                      
                                   
                                   
                                      
                      
                             
                                   
                                         
                                      
   

  /** 一个目录是否真实存在。 */
  function isDirectory(path        )          {
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
  function usableDirectory(candidate                    )                     {
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
  function resolveWorkingDirectory(options                   )         {
    const { processCwd } = options
    const ordered                         = []
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
                                  
                          
                          
                                
                                           
   

  /** 一个会话里本插件用到的只读子集。 */
                                
                                  
                                               
   

  /** 路径比较用的规范化：Windows 大小写不敏感，POSIX 敏感。 */
  function normalizePath(path        , platform                 )         {
    return platform === 'win32' ? path.toLowerCase() : path
  }

  /** 从会话头里取工作目录。 */
  function headerCwd(session                         )                     {
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
  function workspacePathForSession(
    workspaces                                      ,
    sessions                                                       ,
    sessionId                    ,
    platform                  = process.platform,
  )                     {
    const hasPath = (candidate               )                                                =>
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
  return {
    isDirectory,
    usableDirectory,
    resolveWorkingDirectory,
    normalizePath,
    headerCwd,
    workspacePathForSession,
    statSync,
    isAbsolute,
    expandCwdToken,
  }
})()

// ── src/protocol.ts ──
const M4 = (() => {
  /**
   * 终端面板的线路协议：宿主（`src/wire.ts`）与浏览器（`src/client/pty-client.ts`）
   * 共用同一份声明，避免两端各写一遍判别联合而慢慢漂移。
   *
   * 一帧 = 一个 JSON 对象。文本帧而不是二进制：终端输出是 UTF-8 文本，JSON 字符串
   * 天然承载它（含控制字符，转义后仍是无损往返），两端都不必再做一层长度前缀。
   *
   * @module dsh-terminal-plugin/src/protocol
   */

  /** 一个终端当前的可观察状态（宿主 → 客户端、HTTP 列表与 WS hello 共用）。 */
                                 
                       
              
                                                 
                
                       
               
                                             
                               
                                               
                           
                
                
                
                
                            
                     
   

  /** 协议里用的错误码。 */
                                                                                                                

  /** 客户端 → 服务端。 */
                           
                                                                                                            
                                                              
                                                                                    
                                                                                                            

  /** 服务端 → 客户端。 */
                           
       
                            
                             
                                     
                                                          
                             
                              
                                 
     
                                                                                     
                                                                                     
                                                                                              
                                                                                        

  /** 创建终端的 HTTP 请求体。 */
                                          
                                         
                         
       
                     
      
                                                                  
                                                    
                                                            
       
                               
                
                          
                
                          
                  
                          
   

  /** 创建终端的 HTTP 响应体。 */
                                           
                                   
   

  /** 列出终端的 HTTP 响应体。 */
                                          
                                               
   

  /** HTTP 失败响应体。 */
                                  
                                
                            
                                   
                          
   

  /** 引导行注入到页面的全局名（客户端从这里读到挂载前缀与资产版本）。 */
  const BOOTSTRAP_GLOBAL = '__DSH_TERMINAL_PLUGIN__'
  /** 引导行携带的宿主事实。 */
                                   
                                       
                                
                                            
                              
   

  /** 解析输出里的 OSC 标题序列，取最后一个非空标题。 */
  function extractOscTitle(chunk        )                {
    // ESC ] 0 ; <title> BEL  或  ESC ] 2 ; <title> ESC \
    const pattern = /\u001b\](?:0|2);([^\u0007\u001b]*)(?:\u0007|\u001b\\)/gu
    let latest                = null
    for (const match of chunk.matchAll(pattern)) {
      const title = match[1].trim()
      if (title.length > 0) latest = title
    }
    return latest
  }
  return {
    BOOTSTRAP_GLOBAL,
    extractOscTitle,
  }
})()

// ── src/pty.ts ──
const M5 = (() => {
  const { extractOscTitle } = M4
  /**
   * 一个终端会话：包装 `ctx.subprocess.spawnTerminal` 返回的句柄，补上浏览器终端需要
   * 的东西 —— 有界回放缓冲、多订阅者扇出、尺寸记忆、退出状态。
   *
   * 关键设计：**不做终端栅格模拟**。回放是「把最近的原始输出按顺序重发」，由浏览器侧的
   * xterm 重新解析。这比在宿主里跑 `@xterm/headless` 简单一个数量级，也是 xterm 自己的
   * 标准用法（页面刷新后重放 scrollback 是它的常规场景）。代价是回放期间被丢掉的中间
   * 输出不可恢复 —— 由 `truncated` 标记如实告诉用户。
   *
   * 关于 resize：provider 的 seam（`SubprocessTerminalSpawnSpec.rows/cols`）没有暴露
   * resize 动词，而真实实现（node-pty）有。这里不绕开 seam 去拿 provider 的私有句柄，
   * 因为那会把「执行世界」的绑定（沙箱、Linux scope）一起绕掉。于是拖分隔条之后，
   * ConPTY 仍然按旧宽度换行、全屏程序不会重排。这是已知限制，写进 README。
   *
   * @module dsh-terminal-plugin/src/pty
   */

                                                                                                

  /** 输出订阅者：宿主把 `data` 原样转发给它的 WebSocket。 */
                            
                                 
                            
                 
                              
                
                                       
   

  /** 构造一个终端会话所需的一切。 */
                                      
                       
              
                      
                
                              
                                    
                   
                
                
                      
                           
   

  /** 一帧回放内容与它的完整度。 */
                                  
                          
                
                        
                      
   

  /**
   * 终端会话。
   *
   * 生命周期：`TerminalRegistry` 创建它，`close()` 或 provider 报告退出后它进入
   * `exited` 状态；退出后仍可回放缓冲，直到注册表把它清掉。
   */
  class PtySession {
    /** 宿主分配的不透明 id。 */
             id        
    /** PTY 顶层进程 id。 */
             pid        
    /** 创建时刻。 */
             createdAt        

            name        
            cols        
            rows        
            exitCode                = null
            closed = false
                     scrollbackBytes        
                     handle                          
                     sinks = new Set         ()
    /** 分块保存的输出，`chunks[0]` 最早；总量受 `scrollbackBytes` 约束。 */
            chunks           = []
            bytes = 0
    /** 从头丢掉的字节数（>0 表示回放不完整）。 */
            droppedBytes = 0
                     decoder = new TextDecoder('utf-8')

    /**
     * @param options - id、名字、provider 句柄、初始尺寸与缓冲上限。
     */
    constructor(options                   ) {
      this.id = options.id
      this.name = options.name
      this.handle = options.handle
      this.cols = options.cols
      this.rows = options.rows
      this.pid = options.handle.pid
      this.scrollbackBytes = Math.max(1024, options.scrollbackBytes)
      this.createdAt = Date.now()
    }

    /** 当前对外可见的状态。 */
    meta()               {
      return {
        id: this.id,
        name: this.name,
        pid: this.pid,
        state: this.closed ? 'exited' : 'running',
        exitCode: this.exitCode,
        cols: this.cols,
        rows: this.rows,
        createdAt: this.createdAt,
      }
    }

    /** 是否已经结束（进程退出或已被主动关闭）。 */
    get exited()          {
      return this.closed
    }

    /**
     * 订阅输出。
     *
     * @param sink - 接收 data/title/exit 的订阅者。
     * @returns 取消订阅的函数（`detach` 即可）。
     */
    attach(sink         )             {
      this.sinks.add(sink)
      return () => { this.sinks.delete(sink) }
    }

    /** 当前的回放内容。 */
    playback()                {
      return { text: this.chunks.join(''), truncated: this.droppedBytes > 0 }
    }

    /**
     * 把一段文本写到终端 stdin。
     * @param data - 原样写入的 UTF-8 文本（不做换行转换）。
     */
    write(data        )       {
      if (this.closed || data.length === 0) return
      void this.handle.write(data).catch(() => { /* 句柄已消失：退出路径会通知所有订阅者 */ })
    }

    /**
     * 记住新尺寸。
     *
     * 只用于回放元数据（`hello` 里回给客户端的 cols/rows）。真正的 PTY 尺寸改不了，
     * 原因见模块文档。
     *
     * @param cols - 新的列数。
     * @param rows - 新的行数。
     */
    resize(cols        , rows        )       {
      if (this.closed) return
      this.cols = cols
      this.rows = rows
    }

    /**
     * 开始跟随 provider 的输出流：喂缓冲、解析标题、扇出。
     *
     * 由 `TerminalRegistry.create` 调用一次；调用方不需要 await 它。
     */
    start()       {
      this.handle.output.on('data', (chunk                 ) => {
        const text = typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true })
        if (text.length > 0) this.push(text)
      })
      this.handle.output.on('end', () => {
        const tail = this.decoder.decode()
        if (tail.length > 0) this.push(tail)
        this.settle(null)
      })
      this.handle.output.on('error', () => { this.settle(null) })
      void this.handle.done.then(
        (outcome                   ) => { this.settle(outcome.exitCode ?? null) },
        () => { this.settle(null) },
      )
    }

    /**
     * 主动关闭：等 provider 把整个进程树收干净。
     * @returns 清理完成（幂等，重复调用直接返回）。
     */
    async close()                {
      if (this.closed) return
      try {
        await this.handle.terminate()
      } catch { /* 已经死透的句柄会在这里报错，不影响清理 */ }
      this.settle(this.exitCode)
    }

    /** 追加一段输出：更新缓冲、解析标题、扇出。 */
            push(text        )       {
      this.chunks.push(text)
      this.bytes += byteLength(text)
      while (this.bytes > this.scrollbackBytes && this.chunks.length > 1) {
        const dropped = this.chunks.shift()
        if (dropped === undefined) break
        const size = byteLength(dropped)
        this.bytes -= size
        this.droppedBytes += size
      }
      const title = extractOscTitle(text)
      if (title !== null && title !== this.name) {
        this.name = title
        for (const sink of this.sinks) sink.title(title)
      }
      for (const sink of this.sinks) sink.data(text)
    }

    /** 一次性收尾：标记退出、通知所有订阅者。 */
            settle(exitCode               )       {
      if (this.closed) return
      this.closed = true
      this.exitCode = exitCode
      for (const sink of this.sinks) sink.exit(exitCode)
      this.sinks.clear()
    }
  }
  /** UTF-8 字节数（`Buffer` 在 Node 里总是可用）。 */
  function byteLength(text        )         {
    return Buffer.byteLength(text, 'utf8')
  }
  return {
    PtySession,
    byteLength,
    extractOscTitle,
  }
})()

// ── src/registry.ts ──
const M6 = (() => {
  const { PtySession } = M5
  /**
   * 终端会话注册表：负责「创建 / 查询 / 关闭 / 批量回收」，以及容量上限。
   *
   * 所有平台相关的决策都在构造时定死（shell 绝对路径、默认工作目录、尺寸），
   * `spawn` 是可注入的，因此测试不需要真起 PTY。
   *
   * @module dsh-terminal-plugin/src/registry
   */

                                                                                                          
                                                   

  /** 一次创建请求（工作目录已解析、尺寸已夹紧）。 */
                                        
                                             
                            
                
                
                
                
                 
                             
   

  /** 容量上限被触及时抛出的错误（HTTP 层据此回 409）。 */
  class TerminalLimitError extends Error {
    /** 上限值，用于给用户一句人话。 */
             limit        

    /**
     * @param limit - 允许同时存在的终端数。
     */
    constructor(limit        ) {
      super(`同时最多 ${String(limit)} 个终端`)
      this.name = 'TerminalLimitError'
      this.limit = limit
    }
  }
  /** 注册表构造参数。 */
                                            
                                                         
                                                                               
                                           
                           
                  
               
                                        
                               
                
                
                
                           
                           
                     
                        
                                          
                    
                          
                                  
   

  /**
   * 终端注册表。
   *
   * 生命周期由调用方的 `ctx.effect` 负责：dispose 时 `closeAll()` 等所有终端静默。
   */
  class TerminalRegistry {
    /** id → 会话。 */
                     sessions = new Map                    ()
    /** 单调递增的编号，用于默认标签名 `终端 N`。 */
            sequence = 0
            disposed = false
                     opening = new Set                  ()
                     options                         
                     abort = new AbortController()

    /**
     * @param options - spawn 注入点与全部默认值。
     */
    constructor(options                         ) {
      this.options = options
    }

    /** 当前所有终端的状态（按创建时间排序）。 */
    list()                 {
      return [...this.sessions.values()]
        .sort((left, right) => left.createdAt - right.createdAt)
        .map(session => session.meta())
    }

    /** 取一个会话；不存在时 undefined。 */
    get(id        )                         {
      return this.sessions.get(id)
    }

    /**
     * 创建一个终端。
     *
     * @param input - 已解析的工作目录、已夹紧的尺寸与可选标签名。
     * @returns 新会话。
     * @throws {TerminalLimitError} 超过上限时；`spawn` 失败时原样抛出 provider 的错误。
     */
    async create(input                     )                      {
      if (this.disposed) throw new Error('dsh-terminal-plugin: 插件已卸载，不能再创建终端')
      if (this.sessions.size + this.opening.size >= this.options.maxTerminals) {
        throw new TerminalLimitError(this.options.maxTerminals)
      }
      const id = `t${String(Date.now().toString(36))}-${String((this.sequence += 1))}`
      const name = input.name !== undefined && input.name.trim().length > 0
        ? input.name.trim()
        : `终端 ${String(this.sequence)}`
      const task = this.options.spawn({
        argv: [...this.options.argv],
        cwd: input.cwd ?? this.options.cwd,
        env: { ...this.options.env },
        rows: input.rows,
        cols: input.cols,
        graceMs: this.options.graceMs ?? 3000,
        signal: this.abort.signal,
      })
      this.opening.add(task)
      try {
        const handle = await task
        const session = new PtySession({
          id,
          name,
          handle,
          cols: input.cols,
          rows: input.rows,
          scrollbackBytes: this.options.scrollbackBytes,
        })
        this.sessions.set(id, session)
        session.start()
        // provider 已经退出（例如 shell 立刻报错）时不要留下注册表里的僵尸条目。
        if (session.exited) this.options.onWarn?.(`dsh-terminal-plugin: ${id} 在启动后立刻退出`)
        return session
      } finally {
        this.opening.delete(task)
      }
    }

    /**
     * 关闭并移除一个终端。
     *
     * @param id - 终端 id。
     * @returns 关掉了返回 true；本来就不存在返回 false。
     */
    async close(id        )                   {
      const session = this.sessions.get(id)
      if (session === undefined) return false
      this.sessions.delete(id)
      await session.close()
      return true
    }

    /**
     * 把所有终端收干净（幂等）。
     * @returns 全部静默之后。
     */
    async closeAll()                {
      this.disposed = true
      this.abort.abort()
      const pending = [...this.opening]
      this.opening.clear()
      await Promise.allSettled(pending)
      const sessions = [...this.sessions.values()]
      this.sessions.clear()
      await Promise.allSettled(sessions.map(session => session.close()))
    }

    /**
     * 把一个 WebSocket 订阅者挂到某个终端上。
     *
     * @param id - 终端 id。
     * @param sink - 输出订阅者。
     * @returns 取消订阅的函数；终端不存在时返回 null。
     */
    subscribe(id        , sink         )                      {
      const session = this.sessions.get(id)
      if (session === undefined) return null
      return session.attach(sink)
    }
  }
  return {
    TerminalLimitError,
    TerminalRegistry,
    PtySession,
  }
})()

// ── src/assets.ts ──
const M7 = (() => {
  const __ext_M2_1 = __external("node:fs")
  const { readFileSync } = __ext_M2_1
  const __ext_M2_3 = __external("node:path")
  const { dirname, join } = __ext_M2_3
  const __ext_M7_4 = __external("node:url")
  const { fileURLToPath } = __ext_M7_4
  /**
   * 静态资源：把内置的 xterm.js 产物按固定路径提供给浏览器。
   *
   * 为什么不用 `lib/assets.generated.js` 这种「把文件内容当模块常量内联」的做法：
   * 那个文件里会有 345 KB 的 JS 源码字符串，构建脚本的转写规则（找 import/export、
   * 按列切缩进）要在这种内容上跑一遍，是把构建流程暴露在无谓的风险里。改成
   * **运行时读文件**：`scripts/build.mjs` 只负责把 vendor 产物和一份 JSON 清单写到
   * `lib/`，本模块用 `lib/assets.json` 找它们。清单在首次读取时懒加载并缓存。
   *
   * 版本（`rev`）取所有资源内容的 sha256 前 16 位，由构建脚本算好写进清单；页面引导行
   * 会带上它，于是资源路由可以安全地给 `immutable` 长缓存，升级插件后 URL 自动变。
   *
   * @module dsh-terminal-plugin/src/assets
   */


  /** 资源清单里的一个文件。 */
                        
                          
                         
                
                         
   

  /** 清单文件的结构。 */
                           
                
                        
                     
                                                
   

  /** 一个已经解析好的资源。 */
                          
                
                         
                
                         
   

  /** 资源服务：按名字取内容、给缓存头。 */
                                 
                
                        
       
             
                                             
                                 
       
                                   
                            
                     
   

  /** `lib/` 目录的绝对路径（本模块编译后也住在 lib 里）。 */
  function libDirectory()         {
    return dirname(fileURLToPath(import.meta.url))
  }

  /**
   * 载入资源清单。
   *
   * @param libDir - 覆盖的 `lib` 目录，仅用于测试。
   * @returns 只读的资源服务。
   * @throws 清单缺失或损坏时抛出（构建脚本没跑过时应当立刻可见，而不是静默给空资源）。
   */
  function loadAssets(libDir         = libDirectory())               {
    const manifestPath = join(libDir, 'assets.json')
    let manifest               
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))                 
    } catch (error) {
      throw new Error(`dsh-terminal-plugin: 读不到资源清单 ${manifestPath}，请先运行 npm run build\n${String(error)}`)
    }
    const cache = new Map               ()
    return {
      rev: manifest.rev,
      names: () => Object.keys(manifest.entries),
      get(name        )               {
        const cached = cache.get(name)
        if (cached !== undefined) return cached
        const entry = manifest.entries[name]
        if (entry === undefined) return null
        const body = readFileSync(join(libDir, entry.file))
        const asset        = { type: entry.type, body }
        cache.set(name, asset)
        return asset
      },
    }
  }
  /**
   * 资源响应用的请求头。
   *
   * @param asset - 已解析的资源。
   * @param rev - 内容版本。
   * @returns 头部键值对。
   */
  function assetHeaders(asset       , rev        )                         {
    return {
      'Content-Type': asset.type,
      'Content-Length': String(asset.body.byteLength),
      // 版本在 URL 里（引导行注入的 ?rev=），所以内容本身可以永久缓存。
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${rev}-${asset.type}"`,
    }
  }
  return {
    libDirectory,
    loadAssets,
    assetHeaders,
    readFileSync,
    dirname,
    join,
    fileURLToPath,
  }
})()

// ── src/wire.ts ──
const M8 = (() => {
  const __ext_M8_5 = __external("ws")
  const { WebSocketServer } = __ext_M8_5
  const { clampDimension } = M1
  const { TerminalLimitError } = M6
  const { BOOTSTRAP_GLOBAL } = M4
  const { usableDirectory } = M3
  /**
   * 终端的线路层：HTTP 路由（创建/列出/关闭）+ WebSocket 升级（attach 一个终端）。
   *
   * 路径全部挂在一个前缀下（默认 `/dsh-terminal`），避免和产品自己的路由表抢位置。
   * 前缀路由自己做子路由分发，因为 `webServer.register` 只支持「精确」与「最长前缀」
   * 两种匹配，把四五个端点全注册成精确路由反而更难维护。
   *
   * 认证：每个请求（含升级握手）都先过调用方给的 `reject`。生产环境那是
   * `ctx.connection.requestRejection`，也就是产品自己给 `/api` 用的那套
   * 「Host/Origin 栅栏 + 浏览器 Cookie」，因此本插件在 `0.0.0.0` 部署下不会变成
   * 一个裸的远程 shell。
   *
   * @module dsh-terminal-plugin/src/wire
   */

                                                                  
                                           
                                                 
                                                       

  /** 尺寸夹紧范围：下界是「能用」，上界挡住离谱请求（xterm 自己也支持到几千列）。 */
  const COLS_RANGE = { min: 20, max: 1000 }         
  const ROWS_RANGE = { min: 4, max: 500 }         

  /** 一次请求的认证判定：返回 HTTP 状态码表示拒绝，undefined 表示放行。 */
                                                                                 

  /** 挂上线路层所需的一切。 */
                                        
                                         
                  
                 
                              
                          
                        
       
                  
      
                                              
                                                    
                                             
      
                                       
                          
       
                                          
                        
                       
                        
                       
                
                         
                 
                               
   

  /** 注册后的句柄。 */
                                 
       
                 
                              
       
                            
                                                 
                          
   

  /**
   * 注册 HTTP 路由与 WebSocket 升级路由。
   *
   * @param webServer - `ctx.webServer`（只用到 `register` 与 `registerUpgrade` 两个方法）。
   * @param options - 前缀、注册表、资源、认证与默认值。
   * @returns 可处置的线路句柄。
   */
  function registerTerminalWire(
    webServer   
                                                                                                                                                           
                                                                                                                                                 
     ,
    options                     ,
  )               {
    const { prefix, registry, assets, reject } = options
    const wss = new WebSocketServer({ noServer: true })
    const sockets = new Set           ()

    const disposers = [
      webServer.register({
        kind: 'prefix',
        path: prefix,
        handler: async (req, res) => { await handleHttp(req, res) },
      }),
      webServer.registerUpgrade({
        path: `${prefix}/ws`,
        handler: (req, socket, head) => {
          const rejection = reject(req)
          if (rejection !== undefined) {
            rejectUpgrade(socket, rejection)
            return
          }
          wss.handleUpgrade(req, socket, head, (client) => { acceptSocket(client) })
        },
      }),
    ]

    return {
      bootstrapTag()         {
        const payload                 = { mountPrefix: prefix, assetsRev: assets.rev }
        const json = JSON.stringify(payload).replace(/</gu, '\\u003c')
        return `<script>window.${BOOTSTRAP_GLOBAL}=${json}</script>`
      },
      async dispose()                {
        for (const dispose of disposers) dispose()
        for (const socket of sockets) socket.close(1001, 'plugin unloaded')
        sockets.clear()
        await new Promise      ((resolve) => {
          wss.close(() => { resolve() })
        })
      },
    }

    /** 前缀下的子路由分发。 */
    async function handleHttp(req                 , res                )                {
      const rejection = reject(req)
      if (rejection !== undefined) return sendJson(res, rejection, { code: 'BAD_REQUEST', message: rejection === 401 ? 'unauthorized' : 'forbidden' })
      const url = new URL(req.url ?? '/', 'http://localhost')
      const rest = url.pathname.slice(prefix.length)
      const method = (req.method ?? 'GET').toUpperCase()

      if (rest === '/terminals' && method === 'GET') {
        return sendJson(res, 200, { terminals: registry.list() })
      }
      if (rest === '/terminals' && method === 'POST') {
        return await createTerminal(req, res)
      }
      if (rest.startsWith('/terminals/') && method === 'DELETE') {
        const id = decodeURIComponent(rest.slice('/terminals/'.length))
        const closed = await registry.close(id)
        if (!closed) return sendJson(res, 404, { code: 'NO_TERMINAL', message: `没有这个终端：${id}` }                        )
        return sendJson(res, 200, { closed: id })
      }
      if (rest.startsWith('/assets/') && (method === 'GET' || method === 'HEAD')) {
        const name = decodeURIComponent(rest.slice('/assets/'.length))
        const asset = assets.get(name)
        if (asset === null) return sendJson(res, 404, { code: 'BAD_REQUEST', message: `没有这个资源：${name}` }                        )
        res.writeHead(200, {
          'Content-Type': asset.type,
          'Content-Length': String(asset.body.byteLength),
          'Cache-Control': 'public, max-age=31536000, immutable',
          ETag: `"${assets.rev}"`,
        })
        res.end(method === 'HEAD' ? undefined : asset.body)
        return
      }
      return sendJson(res, 404, { code: 'BAD_REQUEST', message: `未知路径：${rest}` }                        )
    }

    /** `POST /terminals`：校验 body、夹紧尺寸、创建。 */
    async function createTerminal(req                 , res                )                {
      let raw = ''
      for await (const chunk of req) {
        raw += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
        if (raw.length > 64 * 1024) {
          return sendJson(res, 413, { code: 'BAD_REQUEST', message: '请求体过大' }                        )
        }
      }
      let body                        = {}
      if (raw.trim().length > 0) {
        try {
          body = JSON.parse(raw)                         
        } catch {
          return sendJson(res, 400, { code: 'BAD_REQUEST', message: '请求体不是合法 JSON' }                        )
        }
      }
      const cwd = usableDirectory(body.cwd) ?? options.resolveCwd(body.sessionId)
      try {
        const session = await registry.create({
          cwd,
          cols: clampDimension(body.cols, COLS_RANGE.min, COLS_RANGE.max, options.defaultCols),
          rows: clampDimension(body.rows, ROWS_RANGE.min, ROWS_RANGE.max, options.defaultRows),
          name: body.name,
        })
        return sendJson(res, 201, { terminal: session.meta() })
      } catch (error) {
        if (error instanceof TerminalLimitError) {
          return sendJson(res, 409, { code: 'TOO_MANY_TERMINALS', message: error.message, hint: error.message }                        )
        }
        const message = error instanceof Error ? error.message : String(error)
        options.warn(`dsh-terminal-plugin: 创建终端失败：${message}`)
        return sendJson(res, 500, { code: 'SPAWN_FAILED', message }                        )
      }
    }

    /** 一个 WebSocket 的生命周期：只 attach 一个终端。 */
    function acceptSocket(client           )       {
      sockets.add(client)
      let detach                      = null
      const attached = new Set        ()

      const send = (frame             )       => {
        if (client.readyState !== 1) return
        client.send(JSON.stringify(frame))
      }

      const dropAttachment = ()       => {
        detach?.()
        detach = null
        attached.clear()
      }

      client.on('message', (raw) => {
        let frame             
        try {
          frame = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'))               
        } catch {
          send({ type: 'error', code: 'BAD_REQUEST', message: '帧不是合法 JSON' })
          return
        }
        if (frame.type === 'attach') {
          dropAttachment()
          const session = registry.get(frame.terminalId)
          if (session === undefined) {
            send({ type: 'error', code: 'NO_TERMINAL', message: `没有这个终端：${frame.terminalId}` })
            return
          }
          session.resize(
            clampDimension(frame.cols, COLS_RANGE.min, COLS_RANGE.max, options.defaultCols),
            clampDimension(frame.rows, ROWS_RANGE.min, ROWS_RANGE.max, options.defaultRows),
          )
          const playback = session.playback()
          send({
            type: 'hello',
            terminal: session.meta(),
            buffer: playback.text,
            truncated: playback.truncated,
          })
          attached.add(session.id)
          detach = registry.subscribe(session.id, {
            data: (text) => { send({ type: 'output', terminalId: frame.terminalId, data: text }) },
            title: (title) => { send({ type: 'title', terminalId: frame.terminalId, title }) },
            exit: (exitCode) => { send({ type: 'exit', terminalId: frame.terminalId, exitCode }) },
          })
          return
        }
        if (!attached.has(frame.terminalId)) {
          send({ type: 'error', code: 'NO_TERMINAL', message: '请先 attach 再发消息' })
          return
        }
        const session = registry.get(frame.terminalId)
        if (session === undefined) {
          send({ type: 'error', code: 'NO_TERMINAL', message: `没有这个终端：${frame.terminalId}` })
          return
        }
        if (frame.type === 'write') session.write(frame.data)
        else if (frame.type === 'resize') {
          session.resize(
            clampDimension(frame.cols, COLS_RANGE.min, COLS_RANGE.max, options.defaultCols),
            clampDimension(frame.rows, ROWS_RANGE.min, ROWS_RANGE.max, options.defaultRows),
          )
        } else if (frame.type === 'detach') dropAttachment()
      })

      client.on('close', () => {
        dropAttachment()
        sockets.delete(client)
      })
      client.on('error', (error       ) => {
        options.warn(`dsh-terminal-plugin: WebSocket 出错：${error.message}`)
        dropAttachment()
        sockets.delete(client)
      })
    }
  }
  /** 回写一个 HTTP 拒绝（升级握手阶段没有 `ServerResponse`，只能手写状态行）。 */
  function rejectUpgrade(socket        , status           )       {
    const reason = status === 401 ? 'Unauthorized' : 'Forbidden'
    socket.write(`HTTP/1.1 ${String(status)} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
    socket.destroy()
  }

  /** JSON 响应。 */
  function sendJson(res                , status        , body         )       {
    const payload = JSON.stringify(body)
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
      'Cache-Control': 'no-store',
    })
    res.end(payload)
  }

  /** 给 `src/index.ts` 用的默认尺寸（范围常量只有这一份）。 */
  function wireDefaults(config                )                                               {
    return {
      defaultCols: clampDimension(config.cols, COLS_RANGE.min, COLS_RANGE.max, 80),
      defaultRows: clampDimension(config.rows, ROWS_RANGE.min, ROWS_RANGE.max, 24),
    }
  }
  return {
    COLS_RANGE,
    ROWS_RANGE,
    registerTerminalWire,
    rejectUpgrade,
    sendJson,
    wireDefaults,
    WebSocketServer,
    clampDimension,
    TerminalLimitError,
    BOOTSTRAP_GLOBAL,
    usableDirectory,
  }
})()

// ── src/index.ts ──
const M9 = (() => {
  const { loadAssets } = M7
  const { normalizePrefix, Config } = M1
  const { resolveWorkingDirectory, workspacePathForSession } = M3
  const { TerminalRegistry } = M6
  const { resolveShell, terminalEnv } = M2
  const { registerTerminalWire, wireDefaults } = M8
  /**
   * dsh-terminal-plugin 宿主侧入口：给 DSH Web GUI 提供一个**真终端**的底部面板。
   *
   * 与产品自带终端的区别（这点决定了整个实现）：
   *
   * - `@deepseek-ai/dsh-terminal` 的 `ctx.terminals` 是**给 agent 用**的持久终端，会话被
   *   owner 围栏（一个会话只能被创建它的那个 agent 操作），人无法直接键入；它的输出是
   *   经过 sanitize 的文本，不是交互画面。
   * - 本插件要的是**给人用**的终端：和 VSCode 集成终端一样，PTY 直接连到一个 xterm 画面，
   *   人敲什么就是什么。因此这里不碰 `ctx.terminals`，只用它下面的那一层 ——
   *   `ctx.subprocess.spawnTerminal`（真 PTY，Windows 走 ConPTY）。
   *
   * 接线分两半：
   *
   * 1. `webServer` 就绪后注册 HTTP 路由（创建/列出/关闭、静态资源）与 WebSocket 升级路由。
   *    **必须用 `ctx.inject(['webServer'], …)` 等**，不能 `ctx.get('webServer')` 顺手探一下：
   *    插件可能排在 Web 服务器之前被应用，那时服务还不存在，探到 `undefined`；而 fiber 跑完
   *    就再没人回头补跑一次，结果是所有路由整批缺失且没有任何报错。
   * 2. 注入一段引导脚本，把挂载前缀与资源版本告诉页面。
   *
   * 终端本身在 `ctx.effect` 里持有，卸载插件时等所有 PTY 及其进程树静默。
   *
   * @module dsh-terminal-plugin/src/index
   */

                                                    
  // 仅类型导入：激活 cordis 对 `ctx.webServer` / `ctx.subprocess` 的 Context 合并。
                                                       
                                                   

  /** cordis 插件名，用于加载器诊断。 */
  const name = 'dsh-terminal-plugin'
  /** 本插件的硬依赖：没有 Web 服务器就没有终端面板，没有 subprocess 就没有 PTY。 */
  const inject = ['webServer', 'subprocess']
  // 重新导出 schemastery 的 `Config`：加载器用它校验 profile 配置并补齐默认值。
                                                                                   

  /** `ctx.sessions` 里本插件用到的只读子集。 */
                              
                                                   
                                                                                 
                         
                                                                       
   

  /** `ctx.workspaceRegistry` 里本插件用到的只读子集。 */
                                 
                                                            
                                     
   

  /**
   * 读一个会话的工作目录。
   *
   * @param sessions - `ctx.sessions`（可缺省）。
   * @param sessionId - 客户端报上来的当前会话 id（可缺省）。
   * @returns cwd，读不到时 undefined。
   */
  function readSessionCwd(sessions                              , sessionId         )                     {
    const fromHeader = (entry                                                             )                     => {
      const cwd = entry?.header?.cwd
      return typeof cwd === 'string' && cwd.length > 0 ? cwd : undefined
    }
    // 1) 用户正在看的那个会话：唯一能区分「在哪个工作区」的信息。
    if (sessionId !== undefined && sessionId.length > 0) {
      const current = fromHeader(sessions?.get?.(sessionId))
      if (current !== undefined) return current
    }
    // 2) 退而求其次：任一活着的会话（多会话时顺序没有语义，但总比进程工作目录接近意图）。
    for (const entry of sessions?.list?.() ?? []) {
      const cwd = fromHeader(entry)
      if (cwd !== undefined) return cwd
    }
    return undefined
  }

  /**
   * 套用插件。
   *
   * @param ctx - 宿主上下文。
   * @param config - 已由加载器补齐默认值的配置。
   */
  function apply(ctx         , config        )       {
    // 安全性：cordis 已在 `apply` 运行之前用导出的 `Config` schema 校验原始 profile 配置
    // 并补齐全部默认值，因此运行时对象恰好带有 `ResolvedConfig` 声明的字段。
    const resolved = config                  
    const prefix = normalizePrefix(resolved.mountPrefix)
    const logger = ctx.logger('dsh-terminal-plugin')

    // shell 探测放在这里，而不是每次创建终端时：探测失败要在插件加载时就喊出来，
    // 而不是等用户按下 Ctrl+` 才收到一个 500。
    const shell = resolveShell({ shellPath: resolved.shellPath, shellArgs: resolved.shellArgs })

    /**
     * 取某个会话所属工作区的路径 —— 新终端的工作目录。
     *
     * 依据优先级：
     *
     * 1. **工作区账目**：`ctx.workspaceRegistry.list()` 里哪个工作区的 `sessionIds` 含这个
     *    会话，它的 `path` 就是答案。这是唯一能区分「用户在哪个工作区」的信息 —— 一个进程里
     *    会同时存在多个会话（每个工作区一条），`ctx.sessions.list()` 的顺序没有语义。
     * 2. **会话头 + 路径比对**：账目还没建立时，拿 `ctx.sessions.get(id).header.cwd` 与工作区
     *    路径比对。
     * 3. **任一活着的会话的 cwd**：工作区服务缺席时退一步，至少比进程工作目录接近用户意图。
     *
     * 三者都可能缺席（无头组合、会话已被回收），所以每个字段都是可选的。
     *
     * @param current - 已注入 webServer 的上下文（`sessions`/`workspaceRegistry` 从它可选读取）。
     * @param sessionId - 客户端报上来的当前会话 id（可缺省）。
     * @returns 用于 `resolveWorkingDirectory` 的候选值。
     */
    function readFacts(current         , sessionId         )                                                  {
      const sessions = current.get('sessions')                                
      const workspaces = current.get('workspaceRegistry')                                   
      const workspacePath = workspacePathForSession(
        workspaces?.list?.(),
        sessions?.get === undefined ? undefined : id => sessions.get?.(id),
        sessionId,
      )
      const sessionCwd = workspacePath !== undefined ? undefined : readSessionCwd(sessions, sessionId)
      return {
        ...(sessionCwd === undefined ? {} : { sessionCwd }),
        ...(workspacePath === undefined ? {} : { workspacePath }),
      }
    }

    const registry = new TerminalRegistry({
      spawn: spec => ctx.subprocess.spawnTerminal(spec),
      argv: [shell.path, ...shell.args],
      env: terminalEnvFor(shell, resolved),
      rows: resolved.rows,
      cols: resolved.cols,
      scrollbackBytes: resolved.scrollbackBytes,
      maxTerminals: resolved.maxTerminals,
      onWarn: message => { logger.warn(message) },
    })

    // 终端生命周期绑定在插件 fiber 上：卸载时 closeAll() 等所有 PTY 与其进程树静默。
    ctx.effect(function* () {
      yield () => { void registry.closeAll() }
    }, 'dsh-terminal-plugin: 终端注册表')

    // HTTP + WebSocket：必须等 webServer 真正就绪（理由见模块文档）。
    ctx.inject(['webServer'], (scoped         ) => {
      const assets = loadAssets()
      const defaults = wireDefaults(resolved)
      const wire = registerTerminalWire(scoped.webServer, {
        prefix,
        registry,
        assets,
        defaultCols: defaults.defaultCols,
        defaultRows: defaults.defaultRows,
        // 每次创建终端时现算工作目录：用户切了会话/工作区之后新终端应该落在新目录里。
        resolveCwd: sessionId => resolveWorkingDirectory({
          configured: resolved.cwd,
          processCwd: process.cwd(),
          ...readFacts(scoped, sessionId),
        }),
        reject: request => rejectRequest(scoped, request),
        warn: message => { scoped.logger('dsh-terminal-plugin').warn(message) },
      })
      const untap = scoped.webServer.tapIndex(html => injectBootstrap(html, wire.bootstrapTag()))
      return () => {
        untap()
        void wire.dispose()
      }
    })
  }

  /** 把配置里的 `env` 合进方言默认值（用户显式配置的优先）。 */
  function terminalEnvFor(shell           , config                )                         {
    return { ...terminalEnv(shell), ...config.env }
  }

  /**
   * 请求认证：优先用产品自己的 Host/Origin 栅栏 + 浏览器 Cookie。
   *
   * `ctx.connection` 缺席时（例如没有 Web 客户端包的组合）退回「只接受回环 Host」——
   * 明确比默认放行安全，也比默认拒绝可用。
   *
   * @param ctx - 已注入 webServer 的上下文（`connection` 从中可选读取）。
   * @param request - 待判定的请求（HTTP 与升级握手一致，判定只看 headers）。
   * @returns 401/403 表示拒绝，undefined 表示放行。
   */
  function rejectRequest(
    ctx         ,
    request                                                            ,
  )                        {
    const connection = ctx.get('connection')     
                                                                          
                 
    if (connection !== undefined) return connection.requestRejection({ headers: request.headers })
    const host = request.headers.host
    const authority = typeof host === 'string' ? host : ''
    return isLoopbackAuthority(authority) ? undefined : 403
  }

  /** 只接受回环 authority 的降级判定。 */
  function isLoopbackAuthority(authority        )          {
    const withoutPort = authority.startsWith('[')
      ? authority.slice(0, authority.indexOf(']') + 1)
      : authority.split(':')[0] ?? ''
    const host = withoutPort.replace(/^\[|\]$/gu, '').toLowerCase()
    return host === '127.0.0.1' || host === 'localhost' || host === '::1'
  }

  /** 把引导脚本插到 `</head>` 之前（`tag` 为空时原样返回）。 */
  function injectBootstrap(html        , tag        )         {
    if (tag.length === 0) return html
    const at = html.lastIndexOf('</head>')
    if (at < 0) return `${tag}\n${html}`
    return `${html.slice(0, at)}${tag}\n${html.slice(at)}`
  }
  return {
    name,
    inject,
    readSessionCwd,
    apply,
    terminalEnvFor,
    rejectRequest,
    isLoopbackAuthority,
    injectBootstrap,
    loadAssets,
    normalizePrefix,
    Config,
    resolveWorkingDirectory,
    workspacePathForSession,
    TerminalRegistry,
    resolveShell,
    terminalEnv,
    registerTerminalWire,
    wireDefaults,
  }
})()

// ── src/client/styles.ts ──
const M10 = (() => {
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
  const PLUGIN_TAG = 'dsh-terminal-plugin'
  /** 面板高度的 CSS 变量名。 */
  const INSET_VARIABLE = '--dsh-terminal-inset'
  /** 面板左边缘的 CSS 变量名（等于对话区左边缘，由 `frame-inset.ts` 量出来）。 */
  const LEFT_VARIABLE = '--dsh-terminal-left'
  /** 面板宽度的 CSS 变量名（等于对话区宽度；右栏展开时对话区变窄，面板跟着变窄）。 */
  const WIDTH_VARIABLE = '--dsh-terminal-width'
  /** 面板样式表本体（导出给测试断言「没有硬编码颜色」）。 */
  const PANEL_CSS = `
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
  function ensureStyles()       {
    if (document.head.querySelector(`style[data-plugin="${PLUGIN_TAG}"]`) !== null) return
    const tag = document.createElement('style')
    tag.dataset.plugin = PLUGIN_TAG
    tag.textContent = PANEL_CSS
    document.head.appendChild(tag)
  }
  return {
    PLUGIN_TAG,
    INSET_VARIABLE,
    LEFT_VARIABLE,
    WIDTH_VARIABLE,
    PANEL_CSS,
    ensureStyles,
  }
})()

// ── src/client/frame-inset.ts ──
const M11 = (() => {
  const { INSET_VARIABLE, LEFT_VARIABLE, WIDTH_VARIABLE } = M10
  /**
   * 面板的几何与让位：面板只占**中间对话区**这一块 —— 高度压缩对话区，左右两侧的
   * 侧边栏都不动。
   *
   * 实测的产品布局（`dsh-web-frontend/dist` + `dsh-client-ui-layout`）是：
   *
   * ```html
   * <div id="root" style="height:100%">
   *   <div class="…_frame" style="grid-template-columns: 280px 1640px 0px">   <!-- display:grid -->
   *     <div class="…_sidebarCol">   <!-- 左栏，全高 -->
   *     <div class="…_centerCol">    <!-- 对话区 -->
   *     <div class="…_rightbarCol">  <!-- 右侧栏（收起时宽 0） -->
   *     <div class="…_overlayLayer"> <!-- 浮层，面板挂在这里 -->
   *   </div>
   * </div>
   * ```
   *
   * 于是：
   *
   * - **让位**只写中间列的高度：`.…_centerCol { height: calc(100% - var(--dsh-terminal-inset)) }`。
   *   左右两栏各自全高，一行内联样式都不写。
   * - **面板位置**从中间列量出来（`centerBox()`），左边缘与宽度都跟着对话区走，所以左栏收起、
   *   右栏展开/收起、拖分隔条三种情况下面板都自动对齐。
   *
   * 走过的弯路（都在代码里留了注释）：先改 `#root` 高度 → 把左栏一起压短、面板横跨整屏；
   * 再改成「压中间列 + 右栏、面板铺到视口右边缘」→ 右栏还是被面板占了。
   *
   * 例外：右侧栏**全屏**时它 `position:fixed` 盖住整个框架，任何让位都是无意义的视觉残影，
   * 所以那一档不写内联样式（框架自己会给它 `data-rightbar-fullscreen`）。
   *
   * 侵入面：中间列一条 `height` + 三个 CSS 变量；收起时**完全还原**（删掉内联样式与变量，
   * 而不是写回 0）。
   *
   * @module dsh-terminal-plugin/src/client/frame-inset
   */

  /**
   * 认列的 class 名子串。
   *
   * 产品的 class 名是 CSS Modules 生成的（`pI_x6G_frame`、`pI_x6G_centerCol` …），带构建期
   * 哈希，所以只能按子串认。**后缀用 `\b` 而不是 `_`**：实测的类名就长成
   * `pI_x6G_centerCol`，`_centerCol_` 这种写法一个都匹配不上（坑过一次：面板照常渲染，
   * 但只有 CSS 变量被设上，列高一条都没写）。
   */
  const FRAME_PATTERN = /_frame\b/
  /** 对话区那一列：面板只在它里面。 */
  const CENTER_PATTERN = /_centerCol\b/

  /** 记录本模块写过的内联高度，还原时按原样放回。 */
  const previousHeight = new WeakMap                     ()
  /**
   * 上一次生效的高度。
   *
   * `-1` 是「不确定」：面板卸载后下一次 `applyFrameInset(0)` 必须真的执行还原（清掉 CSS
   * 变量与内联高度），不能因为「上次数值也是 0」而提前返回。写内联样式会触发我们自己的
   * 观察器，所以正常的重复调用仍然靠这个值短路。
   */
  let appliedInset = -1
  /** 框架上的 `data-*` 观察器：右侧栏展开/全屏切换时重算。 */
  let observer                          = null

  /** 按 class 名子串找元素（class 名带哈希，不能写死）。 */
  function find(pattern        )                     {
    for (const node of document.querySelectorAll             ('div')) {
      if (pattern.test(node.className)) return node
    }
    return null
  }

  /**
   * 框架根元素。
   *
   * @returns 元素，或 null（产品换布局时不能让面板把页面搞坏）。
   */
  function findFrame()                     {
    return find(FRAME_PATTERN)
  }
  /**
   * 对话区当前占的那块矩形 —— 面板的位置与宽度就是它。
   *
   * 从左栏与右栏的关系推不出来（左栏能收成 rail、右栏能在全屏与停靠之间切换），所以直接量
   * 中间列自己。
   *
   * @returns `{ left, width }`；量不到对话区时给一个保守兜底（贴左、铺满），至少不会挤成 0 宽。
   */
  function centerBox()                                  {
    const center = find(CENTER_PATTERN)
    if (center === null) return { left: 0, width: globalThis.innerWidth ?? 0 }
    const rect = center.getBoundingClientRect()
    return { left: Math.max(0, Math.round(rect.left)), width: Math.max(0, Math.round(rect.width)) }
  }
  /**
   * 应用（或清除）对话区的让位。
   *
   * @param height - 面板占用的像素高度；0 表示收起。
   */
  function applyFrameInset(height        )       {
    const frame = findFrame()
    const inset = Math.max(0, Math.round(height))
    const center = find(CENTER_PATTERN)
    // 右侧栏全屏时它盖住整个框架，让位只会留下残影。
    const effective = frame !== null && frame.hasAttribute('data-rightbar-fullscreen') ? 0 : inset

    // 数值没变就短路（写内联样式会触发我们自己的观察器）；`-1` 表示状态未知，必须重算。
    if (effective === appliedInset) return
    document.documentElement.style.setProperty(INSET_VARIABLE, `${String(effective)}px`)
    if (center !== null) {
      if (effective === 0) {
        const previous = previousHeight.get(center)
        if (previous === undefined) center.style.removeProperty('height')
        else center.style.height = previous
        previousHeight.delete(center)
      } else {
        if (!previousHeight.has(center)) previousHeight.set(center, center.style.height ?? '')
        center.style.height = `calc(100% - var(${INSET_VARIABLE}))`
      }
    }
    appliedInset = effective
    watchFrame(frame)
    nudgeLayout()
  }
  /**
   * 卸载时还原（幂等）。
   */
  function clearFrameInset()       {
    observer?.disconnect()
    observer = null
    const center = find(CENTER_PATTERN)
    document.documentElement.style.removeProperty(INSET_VARIABLE)
    if (center !== null) {
      const previous = previousHeight.get(center)
      if (previous === undefined) center.style.removeProperty('height')
      else center.style.height = previous
      previousHeight.delete(center)
    }
    appliedInset = -1
    nudgeLayout()
  }
  /**
   * 观察框架上的右侧栏状态。
   *
   * 右侧栏自己报告 `data-rightbar-collapsed` / `data-rightbar-fullscreen`，属性一变就让位
   * 方案跟着变 —— 不需要知道侧边栏的状态机，也不会和它抢内联样式（改的是不同元素）。
   *
   * @param frame 框架根；null 时不挂观察。
   */
  function watchFrame(frame                    )       {
    if (observer !== null || frame === null) return
    observer = new MutationObserver(() => {
      if (observer === null) return
      observer.disconnect()
      observer = null
      // 重新走一遍完整计算（同时会重新挂上观察器）。
      const current = appliedInset
      appliedInset = -1
      applyFrameInset(current)
    })
    observer.observe(frame, { attributes: true, attributeFilter: ['data-rightbar-collapsed', 'data-rightbar-fullscreen'] })
  }

  /**
   * 触发布局重算。
   *
   * 框架自己的 ResizeObserver 会看到列高变化；这里额外派发一次 `resize`，让依赖
   * `window.innerHeight` 的组件也跟上。
   */
  function nudgeLayout()       {
    try {
      globalThis.dispatchEvent(new Event('resize'))
    } catch {
      // 非浏览器环境（测试）里没有 dispatchEvent：忽略。
    }
  }

  /**
   * 订阅 window 的尺寸事件（浏览器里 `globalThis` 就是 `window`；测试替身只挂了
   * `globalThis.window`，所以两处都试）。
   *
   * @param type - 事件名。
   * @param handler - 处理函数。
   * @returns 取消订阅的函数。
   */
  function onWindowEvent(type        , handler            )             {
    const target = typeof globalThis.addEventListener === 'function' ? globalThis : globalThis.window
    if (target === undefined || typeof target.addEventListener !== 'function') return () => {}
    target.addEventListener(type, handler)
    return () => { target.removeEventListener(type, handler) }
  }
  return {
    FRAME_PATTERN,
    CENTER_PATTERN,
    previousHeight,
    appliedInset,
    observer,
    find,
    findFrame,
    centerBox,
    applyFrameInset,
    clearFrameInset,
    watchFrame,
    nudgeLayout,
    onWindowEvent,
    INSET_VARIABLE,
    LEFT_VARIABLE,
    WIDTH_VARIABLE,
  }
})()

// ── src/client/bootstrap.ts ──
const M12 = (() => {
  const { BOOTSTRAP_GLOBAL } = M4
  /**
   * 引导信息与路径拼接。
   *
   * 宿主在 index.html 的 `</head>` 前注入一段引导脚本，把挂载前缀与资源版本交给页面
   * （见 `src/wire.ts` 的 `bootstrapTag()`）；本模块负责读它，并把前缀拼成完整的请求
   * 路径。前缀可配置，所以客户端里的任何路径都**不能**写死。
   *
   * @module dsh-terminal-plugin/src/client/bootstrap
   */


  /** 默认前缀：引导行还没跑到时（理论上不会发生）用的兜底。 */
  const FALLBACK_PREFIX = '/dsh-terminal'

  /** 读到的引导信息；重复调用返回同一个对象。 */
  let cached                        = null

  /**
   * 读取宿主注入的引导信息。
   *
   * @returns 挂载前缀与资源版本。
   */
  function bootstrap()                 {
    if (cached !== null) return cached
    const raw = (globalThis                           )[BOOTSTRAP_GLOBAL]
    if (typeof raw === 'object' && raw !== null) {
      const candidate = raw                           
      if (typeof candidate.mountPrefix === 'string' && candidate.mountPrefix.length > 0) {
        cached = {
          mountPrefix: candidate.mountPrefix.replace(/\/+$/u, ''),
          assetsRev: typeof candidate.assetsRev === 'string' ? candidate.assetsRev : 'dev',
        }
        return cached
      }
    }
    cached = { mountPrefix: FALLBACK_PREFIX, assetsRev: 'unknown' }
    return cached
  }
  /**
   * 拼接本插件的一个路径。
   *
   * @param suffix - 前缀之后的部分，例如 `/terminals`。
   * @returns 完整路径。
   */
  function pluginPath(suffix        )         {
    return `${bootstrap().mountPrefix}${suffix}`
  }
  /**
   * 资源 URL（带版本查询串，便于 CDN / 浏览器缓存命中）。
   *
   * @param name - 资源文件名，例如 `xterm.mjs`。
   * @returns 带 `?rev=` 的绝对路径。
   */
  function assetUrl(name        )         {
    const info = bootstrap()
    return `${info.mountPrefix}/assets/${name}?rev=${encodeURIComponent(info.assetsRev)}`
  }
  /**
   * WebSocket 地址。
   *
   * @param suffix - 前缀之后的部分，例如 `/ws`。
   * @returns `ws:` 或 `wss:` 开头的绝对地址（跟随页面协议，https 页面不会因为明文 ws 被拦）。
   */
  function socketUrl(suffix        )         {
    const protocol = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${globalThis.location?.host ?? 'localhost'}${pluginPath(suffix)}`
  }
  return {
    FALLBACK_PREFIX,
    cached,
    bootstrap,
    pluginPath,
    assetUrl,
    socketUrl,
    BOOTSTRAP_GLOBAL,
  }
})()

// ── src/client/state.ts ──
const M13 = (() => {
  const { pluginPath } = M12
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

                                                                                                                 

  /** 标签页上显示的一个终端。 */
                                  
                    
              
               
                
                
                                           
                                       
                           
                                
                   
   

  /** 对外发布的不可变快照。 */
                                  
                  
                    
                    
                  
                      
                           
                       
                                       
                                                      
                 
       
                     
      
                                                                     
                                        
       
                                  
                                      
                         
   

  /** 高度夹紧范围。 */
  const HEIGHT_MIN = 160
  const HEIGHT_MAX_RATIO = 0.8
  const HEIGHT_DEFAULT = 340

  /** localStorage 的键。 */
  const STORAGE_KEY = 'dsh-terminal:ui'

  /** 需要落盘的偏好。 */
                         
                     
                   
                            
   

  /** 面板状态与动作。 */
                                       
                                                      
                                
                
                                               
       
             
      
                                                         
                                       
       
                  
                                                      
                
                
                 
       
                 
      
                                        
      
                            
                                                
       
                                               
       
                                     
      
                                                                  
       
                                                         
                                                    
                                      
                       
                                   
                   
                           
                                     
                                       
                               
                                            
                              
                              
                       
                                                         
                     
                                             
                   
                                
                          
                            
                   
                       
   

  /** 创建 store 时可注入的依赖（测试用）。 */
                                 
                                                        
                                 
                                       
                                                  
                                              
                            
       
                                     
                    
       
                                 
   

  /** 从 localStorage 读回偏好（任何异常都当作没有）。 */
  function readPersisted(storage                                      )              {
    try {
      const raw = storage?.getItem(STORAGE_KEY)
      if (raw === null || raw === undefined) return {}
      const parsed = JSON.parse(raw)               
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }

  /** 把终端元数据映射成标签条目。 */
  function toEntry(meta              )                {
    return { id: meta.id, name: meta.name, state: meta.state, exitCode: meta.exitCode, unseen: false }
  }

  /**
   * 创建 store。
   *
   * @param options - 可注入的窗口、存储与 fetch（测试替身）。
   * @returns 面板 store。
   */
  function createTerminalPanelStore(options               = {})                     {
    const viewportHeight = options.viewportHeight ?? (() => globalThis.innerHeight || 800)
    const storage = options.storage ?? globalThis.localStorage
    const doFetch = options.fetchImpl ?? globalThis.fetch
    const autoCreateTerminals = options.autoCreateTerminals ?? true

    const persisted = readPersisted(storage)
    let snapshot                = {
      visible: persisted.visible === true,
      height: clampHeight(persisted.height ?? HEIGHT_DEFAULT, viewportHeight()),
      activeId: typeof persisted.activeId === 'string' ? persisted.activeId : null,
      terminals: [],
      count: 0,
      activeSessionId: null,
      notice: null,
    }
    const listeners = new Set            ()

    /** 发布一个新快照（浅比较由调用方负责；这里只在真的变了时通知）。 */
    const publish = (patch                        )       => {
      const next                = { ...snapshot, ...patch }
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
    const persist = ()       => {
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify({
          visible: snapshot.visible,
          height: snapshot.height,
          activeId: snapshot.activeId,
        }                      ))
      } catch {
        // 隐私模式下 localStorage 可能抛错；UI 偏好丢了不影响功能。
      }
    }

    /** 替换终端列表（并保持 activeId 有效）。 */
    const setTerminals = (terminals                 , activeId                )       => {
      const nextActive = activeId !== undefined
        ? activeId
        : (snapshot.activeId !== null && terminals.some(entry => entry.id === snapshot.activeId)
          ? snapshot.activeId
          : (terminals[0]?.id ?? null))
      publish({ terminals, count: terminals.length, activeId: nextActive })
    }

    /** 读一个 HTTP 响应并处理错误体。 */
    const readJson = async    (response          )             => {
      const text = await response.text()
      if (!response.ok) {
        let message = `HTTP ${String(response.status)}`
        try {
          const body = JSON.parse(text)                 
          if (typeof body.message === 'string') message = body.message
        } catch { /* 非 JSON 错误体就用状态码 */ }
        throw new Error(message)
      }
      return JSON.parse(text)     
    }

    // 先声明再赋值：`closeTerminal` 里要复用 `store.create()`，用 `store` 这个常量引用拿到
    // 完整对象，而不是写两遍创建逻辑（那样两处的错误处理迟早会漂移）。
    const store                     = {
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
        const pending                = { id: pendingId, name: '…', state: 'pending', exitCode: null, unseen: false }
        const pendingList = [...snapshot.terminals, pending]
        publish({ terminals: pendingList, count: pendingList.length, activeId: pendingId, visible: true })
        try {
          const body                        = { cols: 80, rows: 24 }
          if (cwd !== undefined && cwd.length > 0) body.cwd = cwd
          // 带上「用户正在看哪个会话」：宿主据此取那个会话的工作目录（工作区路径），
          // 于是 `DC-new-org` 工作区里开的终端就落在 `D:\desktop\repos\DC-new-org`。
          if (snapshot.activeSessionId !== null) body.sessionId = snapshot.activeSessionId
          const response = await doFetch(pluginPath('/terminals'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const payload = await readJson                            (response)
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
          const payload = await readJson                       (response)
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
  function clampHeight(height        , viewport        )         {
    const max = Math.max(HEIGHT_MIN, Math.round(viewport * HEIGHT_MAX_RATIO))
    if (!Number.isFinite(height)) return Math.min(HEIGHT_DEFAULT, max)
    return Math.max(HEIGHT_MIN, Math.min(max, Math.round(height)))
  }
  return {
    HEIGHT_MIN,
    HEIGHT_MAX_RATIO,
    HEIGHT_DEFAULT,
    STORAGE_KEY,
    readPersisted,
    toEntry,
    createTerminalPanelStore,
    clampHeight,
    pluginPath,
  }
})()

// ── src/client/link-provider.ts ──
const M14 = (() => {
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
  function trimTrailingPunctuation(raw        )         {
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
  function fileUrlForPath(raw        )                     {
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
  function openableUrl(raw        )                     {
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
  function detectLinks(line        )                 {
    if (typeof line !== 'string' || line.length === 0) return []
    /** @type {DetectedLink[]} */
    const schemes                 = []
    const paths                 = []

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
    const kept                 = []
    for (const candidate of found) {
      if (kept.some(existing => candidate.startIndex < existing.endIndex && existing.startIndex < candidate.endIndex)) continue
      kept.push(candidate)
    }
    return kept.slice(0, MAX_LINKS)
  }
  /** 一行里最多返回多少条链接（真实终端里不会更多）。 */
  const MAX_LINKS = 8

  /** xterm 的 `ILinkDecorations` 形状。 */                                  
                          
                      
   

  /** xterm 的 `IBufferCellPosition` 形状（列与行都是 1 基）。 */
                                 
             
             
   

  /** xterm 的 `ILink` 形状。 */
                                 
                                                     
                
                                 
                                                   
                                     
                                                 
                  
                                                 
   

  /** xterm 的 `ILinkProvider` 形状。 */
                                 
                                                                                                       
   

  /** xterm buffer 里一个格子的最小面（`IBufferCell` 的子集）。 */
                                   
                                        
                       
                                              
                       
   

  /** xterm buffer 里一行的最小面（`IBufferLine` 的子集）。 */
                                   
                                                                                             
                                                        
   

  /** xterm buffer 的最小面（`IBuffer` 的子集，只用到取行）。 */
                               
                                                      
   

  /** 一行文本，外加「字符串下标 → 列」的对照表。 */
                             
                                                         
                
       
                                                                
      
                                                            
                                                                    
                                              
      
                                                       
       
                      
   

  /** 取一行文本的函数（由调用方从 xterm 的 buffer 里读）。 */
                                                                                      

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
  function buildColumnMap(line                , text        )                       {
    if (typeof line.getCell !== 'function') return undefined
    const columns           = []
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
  function readBufferLine(buffer                        , bufferLineNumber        )                       {
    if (buffer === undefined) return undefined
    const line = buffer.getLine?.(bufferLineNumber - 1)
    if (line === undefined) return undefined
    const text = line.translateToString?.(true)
    if (text === undefined) return undefined
    return { text, columns: buildColumnMap(line, text) }
  }
  /** 打开一个地址（可注入，便于测试）。 */
                                             

  /** 悬停提示的宿主（`terminal.element` 就够用，只写 `title`）。 */
                                
                  
   

  /** 创建 link provider 需要的一切。 */
                                        
                     
                        
                                                                           
                  
       
                                         
                                                                          
       
                                  
                                             
                                         
   

  /**
   * 当前平台是否把 Cmd（而不是 Ctrl）当作链接的修饰键。
   *
   * @returns macOS 上为 true。
   */
  function prefersMeta()          {
    const platform = globalThis.navigator?.userAgentData?.platform ?? globalThis.navigator?.platform ?? ''
    return /mac|iphone|ipad|ipod/iu.test(platform)
  }

  /**
   * 这次点击算不算「跟随链接」—— 也就是按住了 Ctrl（macOS 上 Cmd）。
   *
   * @param event - xterm 交回来的 `mouseup` 事件。
   * @returns 按住时为 true。
   */
  function isFollowClick(event                                                      )          {
    if (event === undefined) return false
    return prefersMeta() ? event.metaKey === true : event.ctrlKey === true
  }
  /**
   * 默认的打开方式：新标签页打开，并且不让被打开的页面拿到 `window.opener`。
   *
   * @param url - 要打开的地址。
   */
  function openInNewTab(url        )       {
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
  function setHint(target                         , value        )       {
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
  function createLinkProvider(options                     )               {
    const open = options.open ?? openInNewTab
    const hint = options.hint
    const hoverTarget = options.hoverTarget

    const makeLink = (link              , bufferLineNumber        , columnOf                           )               => {
      const url = link.url
      const created               = {
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
          const columnOf = (index        )         => columns?.[index] ?? index
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
  function attachLinkProvider(
    terminal                                                                                                          ,
    options                     ,
  )             {
    const withTarget                      = { ...options, hoverTarget: options.hoverTarget ?? terminal.element }
    const registration = terminal.registerLinkProvider(createLinkProvider(withTarget))
    return () => { registration.dispose() }
  }
  return {
    OPENABLE_PROTOCOLS,
    MAX_PATH_LENGTH,
    SCHEME_PATTERN,
    LOCALHOST_PATTERN,
    PATH_PATTERN,
    trimTrailingPunctuation,
    fileUrlForPath,
    openableUrl,
    detectLinks,
    MAX_LINKS,
    buildColumnMap,
    readBufferLine,
    prefersMeta,
    isFollowClick,
    openInNewTab,
    setHint,
    createLinkProvider,
    attachLinkProvider,
  }
})()

// ── src/client/clipboard.ts ──
const M15 = (() => {
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
                                    
                     
                            
                 
                           
                
                           
                                                         
                              
   

  /** 剪贴板读写（可注入，便于测试）。 */
                                    
                  
                               
                  
                                          
   

  /** 用 `navigator.clipboard` 实现的默认剪贴板访问。 */
  function systemClipboard()                  {
    return {
      async readText() {
        return await navigator.clipboard.readText()
      },
      async writeText(text        ) {
        await navigator.clipboard.writeText(text)
      },
    }
  }
  /** 一次右键的分流结果（测试与诊断用）。 */
                                                                 

  /** 挂右键行为时的可选注入。 */
                                       
                                              
                               
                           
                                              
   

  /**
   * 给终端挂上右键行为。
   *
   * @param target - 终端（xterm 实例）。
   * @param container - 面板容器：只接管落在它内部的右键事件。
   * @param options - 可注入的剪贴板与回调。
   * @returns 解绑函数。
   */
  function attachContextMenu(
    target                 ,
    container             ,
    options                     = {},
  )             {
    const clipboard = options.clipboard ?? systemClipboard()
    const report = (action                   )       => {
      try {
        options.onAction?.(action)
      } catch {
        // 回调是调用方的东西，出错不该影响终端。
      }
    }

    const onContextMenu = (event            )       => {
      // 只处理终端区域内的右键：面板其它地方（标签条等）保持浏览器默认行为。
      const node = event.target
      if (!(node instanceof Node) || !container.contains(node)) return
      event.preventDefault()
      event.stopPropagation()
      void handle(target)
    }

    const handle = async (current                 )                => {
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
  return {
    systemClipboard,
    attachContextMenu,
  }
})()

// ── src/selftest.ts ──
const M16 = (() => {
  const configModule = M1
  const shellModule = M2
  const cwdModule = M3
  const protocolModule = M4
  const ptyModule = M5
  const registryModule = M6
  const indexModule = M9
  const wireModule = M8
  const stylesModule = M10
  const frameInsetModule = M11
  const stateModule = M13
  const linkModule = M14
  const clipboardModule = M15
  /**
   * 测试专用入口：把**纯函数与内部构件**重新导出成一个独立产物，好让 `test/*.test.mjs`
   * 直接 `import` 构建后的真实代码。
   *
   * 为什么不直接从 `src/*.ts` import：源码里那几处 `import type {} from
   * '@deepseek-ai/…'` 是给 TypeScript 看的声明合并开关，Node 的类型剥离会保留成
   * `import '…'` 形式，于是测试会因为「包不存在」而失败 —— 而给测试链接那些包会白白拖
   * 一大堆依赖进度。
   *
   * 为什么不从 `lib/index.js`（插件产物）import：那会把这些内部函数变成插件的事实 API，
   * 别人就会开始依赖它们。单独一个入口，意图也清楚：这些是给测试看的。
   *
   * **写法约束**：本文件的每条导出都必须落在一个局部绑定上（`const x = mod.x`），不能写
   * ``。手写打包器按命名空间对象重接模块关系，裸再导出语句只提供
   * 名字、不提供本地声明，拼出来的模块命名空间会是空的，症状是测试里
   * 「xxx is not a function」，离原因（构建脚本的转写规则）很远。
   *
   * 构建产物：`lib/selftest.js`（见 `scripts/build.mjs`）。
   *
   * @module dsh-terminal-plugin/src/selftest
   */


  // ── 配置 ────────────────────────────────────────────────────────────────────
  /** @see ./config.ts */
  const clampDimension = configModule.clampDimension
  /** @see ./config.ts */
  const normalizePrefix = configModule.normalizePrefix

  // ── shell ───────────────────────────────────────────────────────────────────
  /** @see ./shell.ts */
  const resolveShell = shellModule.resolveShell
  /** @see ./shell.ts */
  const findOnPath = shellModule.findOnPath
  /** @see ./shell.ts */
  const terminalEnv = shellModule.terminalEnv
  /** @see ./shell.ts */
  const expandCwdToken = shellModule.expandCwdToken

  // ── 工作目录 ────────────────────────────────────────────────────────────────
  /** @see ./cwd.ts */
  const usableDirectory = cwdModule.usableDirectory
  /** @see ./cwd.ts */
  const resolveWorkingDirectory = cwdModule.resolveWorkingDirectory
  /** @see ./cwd.ts */
  const workspacePathForSession = cwdModule.workspacePathForSession

  // ── 线路协议 ────────────────────────────────────────────────────────────────
  /** @see ./protocol.ts */
  const extractOscTitle = protocolModule.extractOscTitle

  // ── 终端会话与注册表 ────────────────────────────────────────────────────────
  /** @see ./pty.ts */
  const PtySession = ptyModule.PtySession
  /** @see ./registry.ts */
  const TerminalRegistry = registryModule.TerminalRegistry
  /** @see ./registry.ts */
  const TerminalLimitError = registryModule.TerminalLimitError
  /** @see ./wire.ts */
  const registerTerminalWire = wireModule.registerTerminalWire
  /** @see ./wire.ts */
  const wireDefaults = wireModule.wireDefaults
  /** @see ./index.ts */
  const isLoopbackAuthority = indexModule.isLoopbackAuthority

  // ── 客户端纯常量 ────────────────────────────────────────────────────────────
  /** @see ./client/styles.ts */
  const PANEL_CSS = stylesModule.PANEL_CSS
  /** @see ./client/styles.ts */
  const PLUGIN_TAG = stylesModule.PLUGIN_TAG
  /** @see ./client/styles.ts */
  const INSET_VARIABLE = stylesModule.INSET_VARIABLE
  /** @see ./client/styles.ts */
  const LEFT_VARIABLE = stylesModule.LEFT_VARIABLE
  /** @see ./client/styles.ts */
  const WIDTH_VARIABLE = stylesModule.WIDTH_VARIABLE

  // ── 客户端布局 ──────────────────────────────────────────────────────────────
  /** @see ./client/frame-inset.ts */
  const applyFrameInset = frameInsetModule.applyFrameInset
  /** @see ./client/frame-inset.ts */
  const clearFrameInset = frameInsetModule.clearFrameInset
  /** @see ./client/frame-inset.ts */
  const findFrame = frameInsetModule.findFrame
  /** @see ./client/frame-inset.ts */
  const centerBox = frameInsetModule.centerBox
  /** @see ./client/frame-inset.ts */
  const sidebarRightEdge = frameInsetModule.sidebarRightEdge

  // ── 客户端面板状态 ──────────────────────────────────────────────────────────
  /** @see ./client/state.ts */
  const createTerminalPanelStore = stateModule.createTerminalPanelStore
  /** @see ./client/state.ts */
  const clampHeight = stateModule.clampHeight

  // ── 客户端链接识别 ──────────────────────────────────────────────────────────
  /** @see ./client/link-provider.ts */
  const detectLinks = linkModule.detectLinks
  /** @see ./client/link-provider.ts */
  const openableUrl = linkModule.openableUrl
  /** @see ./client/link-provider.ts */
  const fileUrlForPath = linkModule.fileUrlForPath
  /** @see ./client/link-provider.ts */
  const createLinkProvider = linkModule.createLinkProvider
  /** @see ./client/link-provider.ts */
  const attachLinkProvider = linkModule.attachLinkProvider
  /** @see ./client/link-provider.ts */
  const isFollowClick = linkModule.isFollowClick
  /** @see ./client/link-provider.ts */
  const readBufferLine = linkModule.readBufferLine

  // ── 客户端剪贴板 ────────────────────────────────────────────────────────────
  /** @see ./client/clipboard.ts */
  const attachContextMenu = clipboardModule.attachContextMenu
  return {
    clampDimension,
    normalizePrefix,
    resolveShell,
    findOnPath,
    terminalEnv,
    expandCwdToken,
    usableDirectory,
    resolveWorkingDirectory,
    workspacePathForSession,
    extractOscTitle,
    PtySession,
    TerminalRegistry,
    TerminalLimitError,
    registerTerminalWire,
    wireDefaults,
    isLoopbackAuthority,
    PANEL_CSS,
    PLUGIN_TAG,
    INSET_VARIABLE,
    LEFT_VARIABLE,
    WIDTH_VARIABLE,
    applyFrameInset,
    clearFrameInset,
    findFrame,
    centerBox,
    sidebarRightEdge,
    createTerminalPanelStore,
    clampHeight,
    detectLinks,
    openableUrl,
    fileUrlForPath,
    createLinkProvider,
    attachLinkProvider,
    isFollowClick,
    readBufferLine,
    attachContextMenu,
    configModule,
    shellModule,
    cwdModule,
    protocolModule,
    ptyModule,
    registryModule,
    indexModule,
    wireModule,
    stylesModule,
    frameInsetModule,
    stateModule,
    linkModule,
    clipboardModule,
  }
})()

// ── 入口模块的导出（cordis 读取 name / inject / apply 与 Config） ──
export const clampDimension = M16.clampDimension
export const normalizePrefix = M16.normalizePrefix
export const resolveShell = M16.resolveShell
export const findOnPath = M16.findOnPath
export const terminalEnv = M16.terminalEnv
export const expandCwdToken = M16.expandCwdToken
export const usableDirectory = M16.usableDirectory
export const resolveWorkingDirectory = M16.resolveWorkingDirectory
export const workspacePathForSession = M16.workspacePathForSession
export const extractOscTitle = M16.extractOscTitle
export const PtySession = M16.PtySession
export const TerminalRegistry = M16.TerminalRegistry
export const TerminalLimitError = M16.TerminalLimitError
export const registerTerminalWire = M16.registerTerminalWire
export const wireDefaults = M16.wireDefaults
export const isLoopbackAuthority = M16.isLoopbackAuthority
export const PANEL_CSS = M16.PANEL_CSS
export const PLUGIN_TAG = M16.PLUGIN_TAG
export const INSET_VARIABLE = M16.INSET_VARIABLE
export const LEFT_VARIABLE = M16.LEFT_VARIABLE
export const WIDTH_VARIABLE = M16.WIDTH_VARIABLE
export const applyFrameInset = M16.applyFrameInset
export const clearFrameInset = M16.clearFrameInset
export const findFrame = M16.findFrame
export const centerBox = M16.centerBox
export const sidebarRightEdge = M16.sidebarRightEdge
export const createTerminalPanelStore = M16.createTerminalPanelStore
export const clampHeight = M16.clampHeight
export const detectLinks = M16.detectLinks
export const openableUrl = M16.openableUrl
export const fileUrlForPath = M16.fileUrlForPath
export const createLinkProvider = M16.createLinkProvider
export const attachLinkProvider = M16.attachLinkProvider
export const isFollowClick = M16.isFollowClick
export const readBufferLine = M16.readBufferLine
export const attachContextMenu = M16.attachContextMenu
export const configModule = M16.configModule
export const shellModule = M16.shellModule
export const cwdModule = M16.cwdModule
export const protocolModule = M16.protocolModule
export const ptyModule = M16.ptyModule
export const registryModule = M16.registryModule
export const indexModule = M16.indexModule
export const wireModule = M16.wireModule
export const stylesModule = M16.stylesModule
export const frameInsetModule = M16.frameInsetModule
export const stateModule = M16.stateModule
export const linkModule = M16.linkModule
export const clipboardModule = M16.clipboardModule
