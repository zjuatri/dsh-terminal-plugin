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

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 资源清单里的一个文件。 */
interface AssetEntry {
  /** 相对 `lib/` 的文件名。 */
  readonly file: string
  /** 内容类型。 */
  readonly type: string
}

/** 清单文件的结构。 */
interface AssetManifest {
  /** 内容版本。 */
  readonly rev: string
  /** 文件名 → 清单项。 */
  readonly entries: Record<string, AssetEntry>
}

/** 一个已经解析好的资源。 */
export interface Asset {
  /** 内容类型。 */
  readonly type: string
  /** 文件内容。 */
  readonly body: Buffer
}

/** 资源服务：按名字取内容、给缓存头。 */
export interface AssetService {
  /** 内容版本。 */
  readonly rev: string
  /**
   * 取一个资源。
   * @param name - 清单里的文件名（例如 `xterm.mjs`）。
   * @returns 资源，名字不在清单里时 null。
   */
  get(name: string): Asset | null
  /** 所有可用的文件名，用于诊断与测试。 */
  names(): string[]
}

/** `lib/` 目录的绝对路径（本模块编译后也住在 lib 里）。 */
function libDirectory(): string {
  return dirname(fileURLToPath(import.meta.url))
}

/**
 * 载入资源清单。
 *
 * @param libDir - 覆盖的 `lib` 目录，仅用于测试。
 * @returns 只读的资源服务。
 * @throws 清单缺失或损坏时抛出（构建脚本没跑过时应当立刻可见，而不是静默给空资源）。
 */
export function loadAssets(libDir: string = libDirectory()): AssetService {
  const manifestPath = join(libDir, 'assets.json')
  let manifest: AssetManifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetManifest
  } catch (error) {
    throw new Error(`dsh-terminal-plugin: 读不到资源清单 ${manifestPath}，请先运行 npm run build\n${String(error)}`)
  }
  const cache = new Map<string, Asset>()
  return {
    rev: manifest.rev,
    names: () => Object.keys(manifest.entries),
    get(name: string): Asset | null {
      const cached = cache.get(name)
      if (cached !== undefined) return cached
      const entry = manifest.entries[name]
      if (entry === undefined) return null
      const body = readFileSync(join(libDir, entry.file))
      const asset: Asset = { type: entry.type, body }
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
export function assetHeaders(asset: Asset, rev: string): Record<string, string> {
  return {
    'Content-Type': asset.type,
    'Content-Length': String(asset.body.byteLength),
    // 版本在 URL 里（引导行注入的 ?rev=），所以内容本身可以永久缓存。
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: `"${rev}-${asset.type}"`,
  }
}
