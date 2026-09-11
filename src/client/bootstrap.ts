/**
 * 引导信息与路径拼接。
 *
 * 宿主在 index.html 的 `</head>` 前注入一段引导脚本，把挂载前缀与资源版本交给页面
 * （见 `src/wire.ts` 的 `bootstrapTag()`）；本模块负责读它，并把前缀拼成完整的请求
 * 路径。前缀可配置，所以客户端里的任何路径都**不能**写死。
 *
 * @module dsh-terminal-plugin/src/client/bootstrap
 */

import { BOOTSTRAP_GLOBAL, type PanelBootstrap } from '../protocol.js'

/** 默认前缀：引导行还没跑到时（理论上不会发生）用的兜底。 */
const FALLBACK_PREFIX = '/dsh-terminal'

/** 读到的引导信息；重复调用返回同一个对象。 */
let cached: PanelBootstrap | null = null

/**
 * 读取宿主注入的引导信息。
 *
 * @returns 挂载前缀与资源版本。
 */
export function bootstrap(): PanelBootstrap {
  if (cached !== null) return cached
  const raw = (globalThis as Record<string, unknown>)[BOOTSTRAP_GLOBAL]
  if (typeof raw === 'object' && raw !== null) {
    const candidate = raw as Partial<PanelBootstrap>
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
export function pluginPath(suffix: string): string {
  return `${bootstrap().mountPrefix}${suffix}`
}

/**
 * 资源 URL（带版本查询串，便于 CDN / 浏览器缓存命中）。
 *
 * @param name - 资源文件名，例如 `xterm.mjs`。
 * @returns 带 `?rev=` 的绝对路径。
 */
export function assetUrl(name: string): string {
  const info = bootstrap()
  return `${info.mountPrefix}/assets/${name}?rev=${encodeURIComponent(info.assetsRev)}`
}

/**
 * WebSocket 地址。
 *
 * @param suffix - 前缀之后的部分，例如 `/ws`。
 * @returns `ws:` 或 `wss:` 开头的绝对地址（跟随页面协议，https 页面不会因为明文 ws 被拦）。
 */
export function socketUrl(suffix: string): string {
  const protocol = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${globalThis.location?.host ?? 'localhost'}${pluginPath(suffix)}`
}
