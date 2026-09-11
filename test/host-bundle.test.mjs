/**
 * 宿主产物的接线测试：契约导出、路由延迟注册、尺寸夹紧、外壳探测。
 *
 * 「延迟注册」这条是刻意钉住的：插件可能排在 Web 服务器**之前**被应用，那时
 * `ctx.get('webServer')` 探到的是 undefined；而 fiber 一旦跑完就没有人回头补跑，
 * 结果是所有路由整批缺失且没有任何报错（同级 `dsh-browser-plugin` 的 README 记录过
 * 这个坑）。所以宿主必须用 `ctx.inject(['webServer'], …)` 等，本文件断言的就是它。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, test } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** 造一个足够真的 cordis Context 替身。 */
function fakeContext() {
  /** @type {string[]} */
  const effects = []
  /** @type {{ services: string[], callback: Function }[]} */
  const injections = []
  const provided = new Map()
  const server = {
    /** @type {object[]} */
    routes: [],
    /** @type {object[]} */
    upgrades: [],
    /** @type {((html: string) => string)[]} */
    taps: [],
    /** @param {object} route 路由。 */
    register(route) { this.routes.push(route); return () => { this.routes = this.routes.filter(item => item !== route) } },
    /** @param {object} route 升级路由。 */
    registerUpgrade(route) { this.upgrades.push(route); return () => { this.upgrades = this.upgrades.filter(item => item !== route) } },
    /** @param {(html: string) => string} tap 索引变换。 */
    tapIndex(tap) { this.taps.push(tap); return () => { this.taps = this.taps.filter(item => item !== tap) } },
  }
  provided.set('webServer', server)
  const logger = { warn() {}, info() {}, error() {}, debug() {} }
  const ctx = {
    // 真实 cordis 会把服务同时挂成 `ctx.<service>` 与 `ctx.get('<service>')`；替身两者都提供，
    // 因为插件两处都会用到（`scoped.webServer` 注册路由、`scoped.get('connection')` 判认证）。
    webServer: server,
    /** @param {Function} body 效果体。 @param {string} label 标签。 */
    effect(body, label) {
      effects.push(label ?? 'effect')
      const result = body()
      return typeof result === 'function' ? result : undefined
    },
    /**
     * 记录注入并把**同一个 ctx** 当作 scoped 上下文传给回调 —— 真实 cordis 也是这么做的
     * （scoped 子上下文能看到父上下文的全部服务），这样 `scoped.webServer` 与
     * `scoped.get('connection')` 都有东西可取。
     *
     * @param {string[]} services 服务名。
     * @param {Function} callback 回调。
     */
    inject(services, callback) {
      injections.push({ services: [...services], callback })
      return () => {}
    },
    /** @param {string} name 服务名。 */
    get(name) { return provided.get(name) },
    /** @param {string} _name 插件名。 */
    logger(_name) { return logger },
    /** @param {string} name 服务名。 @param {unknown} value 值。 */
    provide(name, value) { provided.set(name, value) },
    server,
    injections,
    effects,
  }
  return ctx
}

/** 载入构建后的插件产物。 */
async function loadPlugin() {
  return await import(pathToFileURL(join(root, 'lib/index.js')).href)
}

/** 载入测试专用产物（纯函数与内部构件）。 */
async function loadSelftest() {
  return await import(pathToFileURL(join(root, 'lib/selftest.js')).href)
}

describe('宿主产物', () => {
  test('契约导出齐全（name / inject / apply / Config）', async () => {
    const module = await loadPlugin()
    assert.equal(module.name, 'dsh-terminal-plugin')
    assert.deepEqual([...module.inject].sort(), ['subprocess', 'webServer'])
    assert.equal(typeof module.apply, 'function')
    assert.equal(typeof module.Config, 'function')
  })

  test('路由与索引注入都延迟到 webServer 就绪才注册', async () => {
    const module = await loadPlugin()
    const ctx = fakeContext()
    // subprocess 必须先在：apply 的同步部分会构造注册表（但不会 spawn）。
    ctx.provide('subprocess', { async spawnTerminal() { throw new Error('不该在测试里 spawn') } })
    module.apply(ctx, module.Config({}))
    assert.equal(ctx.server.routes.length, 0, 'apply 返回时不该有任何 HTTP 路由')
    assert.equal(ctx.server.upgrades.length, 0, 'apply 返回时不该有任何升级路由')
    assert.ok(ctx.injections.some(entry => entry.services.includes('webServer')), '必须用 ctx.inject 等 webServer')

    // 现在模拟「webServer 就绪」：触发那个回调（scoped 上下文就是同一个 ctx）。
    const pending = ctx.injections.find(entry => entry.services.includes('webServer'))
    pending.callback(ctx)
    assert.equal(ctx.server.routes.length, 1, '前缀路由应当注册')
    assert.equal(ctx.server.upgrades.length, 1, 'WS 升级路由应当注册')
    assert.equal(ctx.server.routes[0].path, '/dsh-terminal')
    assert.equal(ctx.server.routes[0].kind, 'prefix')
    assert.equal(ctx.server.upgrades[0].path, '/dsh-terminal/ws')
    assert.equal(ctx.server.taps.length, 1, '引导脚本应当挂上索引变换')
  })

  test('引导脚本带着挂载前缀与资源版本', async () => {
    const module = await loadPlugin()
    const ctx = fakeContext()
    ctx.provide('subprocess', { async spawnTerminal() { throw new Error('no') } })
    module.apply(ctx, module.Config({}))
    ctx.injections.find(entry => entry.services.includes('webServer')).callback(ctx)
    const html = ctx.server.taps[0]('<html><head></head><body></body></html>')
    assert.match(html, /__DSH_TERMINAL_PLUGIN__/)
    assert.match(html, /"mountPrefix":"\/dsh-terminal"/)
    assert.match(html, /"assetsRev":"[0-9a-f]{8,}"/)
    assert.ok(html.indexOf('__DSH_TERMINAL_PLUGIN__') < html.indexOf('</head>'), '脚本必须插在 </head> 之前')
  })

  test('mountPrefix 可配置，且规范化尾斜杠', async () => {
    const module = await loadPlugin()
    const ctx = fakeContext()
    ctx.provide('subprocess', { async spawnTerminal() { throw new Error('no') } })
    module.apply(ctx, module.Config({ mountPrefix: 'terminal-x/' }))
    ctx.injections.find(entry => entry.services.includes('webServer')).callback(ctx)
    assert.equal(ctx.server.routes[0].path, '/terminal-x')
    assert.equal(ctx.server.upgrades[0].path, '/terminal-x/ws')
  })

  test('装载资源清单：三个内置文件都在，且哈希版本稳定', async () => {
    const manifest = JSON.parse(readFileSync(join(root, 'lib/assets.json'), 'utf8'))
    assert.deepEqual(Object.keys(manifest.entries).sort(), ['addon-fit.mjs', 'xterm.css', 'xterm.mjs'])
    assert.match(manifest.rev, /^[0-9a-f]{16}$/)
    for (const name of Object.keys(manifest.entries)) {
      const body = readFileSync(join(root, 'lib', name))
      assert.ok(body.byteLength > 0, `${name} 不该为空`)
    }
  })
})

describe('配置', () => {
  test('dimension 夹紧：非法值退回默认、越界取边界', async () => {
    const { clampDimension } = await loadSelftest()
    assert.equal(clampDimension(undefined, 20, 1000, 80), 80)
    assert.equal(clampDimension(Number.NaN, 20, 1000, 80), 80)
    assert.equal(clampDimension(5, 20, 1000, 80), 20)
    assert.equal(clampDimension(99999, 20, 1000, 80), 1000)
    assert.equal(clampDimension(120.7, 20, 1000, 80), 120)
  })

  test('前缀规范化拒绝空值', async () => {
    const { normalizePrefix } = await loadSelftest()
    assert.equal(normalizePrefix('/dsh-terminal'), '/dsh-terminal')
    assert.equal(normalizePrefix('dsh-terminal/'), '/dsh-terminal')
    assert.throws(() => { normalizePrefix('///') })
  })
})

describe('shell 探测', () => {
  test('Windows 优先 pwsh，其次是 Windows PowerShell', async () => {
    const { resolveShell } = await loadSelftest()
    // 本机装有 pwsh 或 powershell，两者都应能被解析成绝对路径。
    const spec = resolveShell({
      platform: 'win32',
      fileExists: () => true,
      env: {
        SystemRoot: 'C:\\Windows',
        ProgramFiles: 'C:\\Program Files',
        LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local',
        Path: 'C:\\Windows\\System32',
      },
    })
    assert.match(spec.path, /pwsh\.exe$/i, '有 pwsh 候选时应当优先选它')
    assert.equal(spec.dialect, 'pwsh')
    assert.deepEqual(spec.args, ['-NoLogo'])
  })

  test('Windows 上 pwsh 缺席时退回 Windows PowerShell', async () => {
    const { resolveShell } = await loadSelftest()
    const spec = resolveShell({
      platform: 'win32',
      fileExists: path => path.endsWith('powershell.exe'),
      env: { SystemRoot: 'C:\\Windows', Path: '' },
    })
    assert.equal(spec.dialect, 'powershell')
    assert.match(spec.path, /WindowsPowerShell/u)
  })

  test('显式 shellPath 优先于任何探测', async () => {
    const { resolveShell } = await loadSelftest()
    const spec = resolveShell({ platform: 'linux', shellPath: '/opt/bin/bash', fileExists: () => false })
    assert.equal(spec.path, '/opt/bin/bash')
    assert.equal(spec.dialect, 'bash')
    assert.deepEqual(spec.args, ['--noprofile', '--norc', '-i'])
  })

  test('Unix 用 $SHELL，没有时退回 /bin/bash', async () => {
    const { resolveShell } = await loadSelftest()
    const withShell = resolveShell({ platform: 'linux', env: { SHELL: '/usr/bin/zsh' }, fileExists: () => true })
    assert.equal(withShell.path, '/usr/bin/zsh')
    const without = resolveShell({ platform: 'linux', env: {}, fileExists: () => true })
    assert.equal(without.path, '/bin/bash')
    assert.equal(without.dialect, 'bash')
  })

  test('探测不到任何 shell 时报错信息带候选路径', async () => {
    const { resolveShell } = await loadSelftest()
    assert.throws(
      () => { resolveShell({ platform: 'win32', fileExists: () => false, env: { SystemRoot: 'C:\\x', ProgramFiles: 'C:\\x', LOCALAPPDATA: 'C:\\x', Path: '' } }) },
      /shellPath/,
    )
  })

  test('PATH 查找按平台分隔符切开', async () => {
    const { findOnPath } = await loadSelftest()
    // 用系统上一定存在的可执行文件验证：node 自身所在目录必然在 PATH 里。
    const found = findOnPath(process.platform === 'win32' ? 'node.exe' : 'node', process.env, process.platform)
    assert.notEqual(found, null)
  })

  test('终端环境变量告诉 shell 它是真终端', async () => {
    const { terminalEnv } = await loadSelftest()
    const env = terminalEnv({ path: '/bin/bash', args: [], dialect: 'bash' })
    assert.equal(env.TERM, 'xterm-256color')
    assert.equal(env.COLORTERM, 'truecolor')
  })

  test('{cwd} 记号替换成进程工作目录', async () => {
    const { expandCwdToken } = await loadSelftest()
    assert.equal(expandCwdToken('{cwd}/sub', 'D:\\repo'), 'D:\\repo/sub')
  })
})

describe('工作目录解析', () => {
  test('配置 > 工作区 > 会话 > 进程目录', async () => {
    const { resolveWorkingDirectory } = await loadSelftest()
    const existing = process.cwd()
    assert.equal(resolveWorkingDirectory({ configured: existing, processCwd: 'C:\\nope', sessionCwd: existing }), existing)
    assert.equal(resolveWorkingDirectory({ processCwd: existing, workspacePath: existing }), existing)
    assert.equal(resolveWorkingDirectory({ processCwd: existing, sessionCwd: existing }), existing)
    // 全部候选都不存在时退回进程工作目录。
    assert.equal(resolveWorkingDirectory({ processCwd: 'C:\\nope\\definitely-missing' }), 'C:\\nope\\definitely-missing')
  })

  test('相对路径与不存在的目录都不被接受', async () => {
    const { usableDirectory } = await loadSelftest()
    assert.equal(usableDirectory('relative/dir'), undefined)
    assert.equal(usableDirectory('C:\\definitely\\missing\\path'), undefined)
    assert.equal(usableDirectory(process.cwd()), process.cwd())
  })
})

describe('会话所属工作区', () => {
  /**
   * 造一组工作区与会话，模拟「用户在 DC-new-org 工作区里看其中一条会话」。
   *
   * @param {string} workspaceDir 真实存在的目录（借 process.cwd()）。
   * @returns {{ workspaces: object[], sessions: (id: string) => object | undefined }} 测试数据。
   */
  function fixtures(workspaceDir) {
    return {
      workspaces: [
        { path: 'D:\\desktop\\repos\\dsh-terminal-plugin', sessionIds: ['session-plugin'] },
        { path: workspaceDir, sessionIds: ['session-dc-new-org'] },
      ],
      sessions: id => (id === 'session-dc-new-org' ? { header: { cwd: workspaceDir } } : undefined),
    }
  }

  test('按工作区账目命中：会话属于哪个工作区就落在哪', async () => {
    const { workspacePathForSession } = await loadSelftest()
    const { workspaces, sessions } = fixtures(process.cwd())
    assert.equal(workspacePathForSession(workspaces, sessions, 'session-dc-new-org'), process.cwd())
  })

  test('账目没建立时按会话 cwd 与工作区路径比对（Windows 大小写不敏感）', async () => {
    const { workspacePathForSession } = await loadSelftest()
    // 这两个路径都不存在，所以第 2 步的比对结论不会被第 3 步的兜底掩盖 —— 测的就是比对规则。
    const cwd = 'C:\\ws\\Alpha'
    const otherCase = 'C:\\ws\\alpha'
    const sessions = () => ({ header: { cwd } })
    assert.equal(
      workspacePathForSession([{ path: otherCase, sessionIds: [] }], sessions, 'session-x', 'win32'),
      otherCase,
      'win32 下大小写不同也算同一个工作区',
    )
    assert.equal(
      workspacePathForSession([{ path: otherCase, sessionIds: [] }], sessions, 'session-x', 'linux'),
      undefined,
      'linux 下大小写不同就是不同目录',
    )
  })

  test('会话 cwd 与工作区路径一致时返回工作区路径（真实目录也走得通）', async () => {
    const { workspacePathForSession } = await loadSelftest()
    const dir = process.cwd()
    const sessions = () => ({ header: { cwd: dir } })
    assert.equal(workspacePathForSession([{ path: dir, sessionIds: [] }], sessions, 'session-x'), dir)
  })

  test('会话与工作区都失联时退回第一个存在的作区目录', async () => {
    const { workspacePathForSession } = await loadSelftest()
    const workspaces = [
      { path: 'C:\\definitely\\missing', sessionIds: [] },
      { path: process.cwd(), sessionIds: [] },
    ]
    assert.equal(workspacePathForSession(workspaces, undefined, 'session-unknown'), process.cwd())
  })

  test('没有工作区服务时返回 undefined（由调用方退回进程目录）', async () => {
    const { workspacePathForSession } = await loadSelftest()
    assert.equal(workspacePathForSession(undefined, undefined, 'session-x'), undefined)
    assert.equal(workspacePathForSession([], undefined, undefined), undefined)
  })

  test('工作区目录都不存在时也返回 undefined，由调用方退回会话 cwd / 进程目录', async () => {
    const { workspacePathForSession } = await loadSelftest()
    const workspaces = [{ path: 'C:\\definitely\\missing\\workspace', sessionIds: [] }]
    assert.equal(workspacePathForSession(workspaces, () => undefined, 'session-x'), undefined)
  })
})
