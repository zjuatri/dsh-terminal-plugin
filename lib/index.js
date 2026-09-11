//! 自动生成，请勿直接编辑 —— 由 scripts/build.mjs 从 src/*.ts 生成。
//!
//! profile 用 `file://` 行加载本文件，所以它必须是 Node 能直接 import 的 ESM：
//! 类型已剥离、相对 import 已内联、外部依赖在顶部导入一次。
import * as __ext_M1_0 from "node:fs"
import * as __ext_M1_1 from "node:path"
import * as __ext_M1_2 from "node:url"
import * as __ext_M2_3 from "@deepseek-ai/schemastery"
import * as __ext_M3_4 from "node:os"
import * as __ext_M8_5 from "ws"

/** 外部依赖的取用口：ESM 命名空间对象即导入表。 */
const __external = (specifier) => {
  switch (specifier) {
    case "node:fs": return __ext_M1_0
    case "node:path": return __ext_M1_1
    case "node:url": return __ext_M1_2
    case "node:os": return __ext_M3_4
    case "ws": return __ext_M8_5
    default: throw new Error(`dsh-terminal-plugin: 未声明外部依赖 ${specifier}`)
  }
}

/** 默认导入的取用口（对应 `import z from '…'`）。 */
const __externalDefault = (specifier) => {
  switch (specifier) {
    case "@deepseek-ai/schemastery": return __ext_M2_3.default
    default: throw new Error(`dsh-terminal-plugin: 未声明外部依赖 ${specifier}`)
  }
}

// ── src/assets.ts ──
const M1 = (() => {
  const __ext_M1_0 = __external("node:fs")
  const { readFileSync } = __ext_M1_0
  const __ext_M1_1 = __external("node:path")
  const { dirname, join } = __ext_M1_1
  const __ext_M1_2 = __external("node:url")
  const { fileURLToPath } = __ext_M1_2
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

// ── src/config.ts ──
const M2 = (() => {
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
const M3 = (() => {
  const __ext_M1_0 = __external("node:fs")
  const { existsSync } = __ext_M1_0
  const __ext_M3_4 = __external("node:os")
  const { homedir } = __ext_M3_4
  const __ext_M1_1 = __external("node:path")
  const { join } = __ext_M1_1
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
const M4 = (() => {
  const __ext_M1_0 = __external("node:fs")
  const { statSync } = __ext_M1_0
  const __ext_M1_1 = __external("node:path")
  const { isAbsolute } = __ext_M1_1
  const { expandCwdToken } = M3
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
const M5 = (() => {
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
const M6 = (() => {
  const { extractOscTitle } = M5
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
const M7 = (() => {
  const { PtySession } = M6
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

// ── src/wire.ts ──
const M8 = (() => {
  const __ext_M8_5 = __external("ws")
  const { WebSocketServer } = __ext_M8_5
  const { clampDimension } = M2
  const { TerminalLimitError } = M7
  const { BOOTSTRAP_GLOBAL } = M5
  const { usableDirectory } = M4
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
  const { loadAssets } = M1
  const { normalizePrefix, Config } = M2
  const { resolveWorkingDirectory, workspacePathForSession } = M4
  const { TerminalRegistry } = M7
  const { resolveShell, terminalEnv } = M3
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

// ── 入口模块的导出（cordis 读取 name / inject / apply 与 Config） ──
export const name = M9.name
export const inject = M9.inject
export const apply = M9.apply
export const Config = M9.Config
