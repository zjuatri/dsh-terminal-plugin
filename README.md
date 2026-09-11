# dsh-terminal-plugin

在 DeepSeek Harness 的 Web GUI 里加一个 **VSCode 式底部终端**：按 **Ctrl+`** 弹出/收起，
可以同时开多个终端（标签页），每个都是**真的 PTY** —— 颜色、光标、清屏、备用屏、
`vim` / `python` / `top` 这类全屏交互程序都能跑。

## 装了什么

| 半边 | 产物 | 作用 |
| --- | --- | --- |
| 宿主 | `lib/index.js` | 用 `ctx.subprocess.spawnTerminal`（真 PTY）管理终端会话；在共享 Web 服务器上注册 HTTP 路由与 WebSocket 升级路由；把 xterm.js 产物作为静态资源提供 |
| 客户端 | `lib/client.js` | 在输入框工具行放一个终端按钮（唯一的入口，快捷键是 Ctrl+`），在 `shell.overlay` 里放**只占对话区**的终端面板；用 xterm.js 画终端画面 |
| 资源 | `lib/xterm.mjs`、`lib/xterm.css`、`lib/addon-fit.mjs` | 内置的 xterm.js（MIT），由宿主从 `<mountPrefix>/assets/*` 提供 |

### 为什么不用产品自带的终端

`@deepseek-ai/dsh-terminal` 的 `ctx.terminals` 是**给 agent 用**的持久终端：会话被 owner
围栏（只有创建它的那个 agent 能操作），人无法直接键入，输出也是 sanitize 过的文本而不是
交互画面。本插件要的是**给人用**的终端，所以只用它下面那一层 —— `ctx.subprocess.spawnTerminal`
（Windows 走 ConPTY，Linux 走真实 PTY，带前台进程组检查、信号投递与整会话静默回收）。

### 身份模型：人是所有者，不是 agent

这是有意的取舍：终端属于**打开页面的那个人**，不受 DSH 的 owner 围栏与工具沙箱约束，
等价于人自己开一个 PowerShell 窗口。谁登录了这个 GUI，谁就能在这个终端里做他自己能做的事
——因此认证必须跟着页面走，见下面「安全边界」。

## 布局：只在中间对话区这一块，两边侧边栏都不碰

实测的产品布局（`dsh-web-frontend/dist` + `dsh-client-ui-layout`）是：

```html
<div id="root" style="height:100%">
  <div class="…_frame" style="grid-template-columns: 280px 1640px 0px">   <!-- display:grid -->
    <div class="…_sidebarCol">   <!-- 左栏，全高 -->
    <div class="…_centerCol">    <!-- 对话区 -->
    <div class="…_rightbarCol">  <!-- 右侧栏（收起时宽 0） -->
    <div class="…_overlayLayer"> <!-- 浮层，面板挂在这里 -->
  </div>
</div>
```

于是面板是「**对话区下面的一条**」，左右两栏都不碰：

```css
/* 只压对话区这一列；左右两栏的内联样式一行都不写 */
.…_centerCol { height: calc(100% - var(--dsh-terminal-inset, 0px)) }
/* 面板本体是 fixed，位置与宽度都从对话区量出来 */
.dsh-term-root { left: var(--dsh-terminal-left, 280px); width: var(--dsh-terminal-width, 100%); right: auto; bottom: 0 }
```

- 高度写进 `--dsh-terminal-inset`；位置与宽度写进 `--dsh-terminal-left` / `--dsh-terminal-width`，
  值是 `src/client/frame-inset.ts` 的 `centerBox()` 直接量对话区那一列得到的（左栏收起、
  右栏展开/收起、拖分隔条都会让对话区变，面板因此自动对齐、绝不越界到侧边栏）。
- `#root` 不动、左右两栏都不动。走过的弯路都记在代码注释里：先改 `#root` 高度 → 左栏被
  一起压短且面板横跨整屏；再改成「压中间列 + 右栏、面板铺到视口右边缘」→ 右栏还是被占。
- 例外：右侧栏**全屏**时它 `position:fixed` 盖住整个框架，任何让位都只是残影，所以那一档
  不写内联样式（框架自己会给它 `data-rightbar-fullscreen`，代码据此判断）。

实测（在你正在用的 GUI 里量的）：视口 1920 宽，左栏 280 全高、右栏收起（宽 0），对话区
`x=280 / w=1640`，面板 `x=280 / w=1640 / h=341` —— **与对话区完全重合**；对话区顶到
`h=740`，面板顶边正好是 740，两边侧边栏仍是 `h=1080` 全高。

侵入面被刻意压到最小：对话区一条 `height` + 三个 CSS 变量；收起时还原内联高度。

面板挂在 `shell.overlay`（root 级的 frame-wide 浮层槽位）里：它是唯一能自建全局表面的
槽位，而且框架已经把「浮层本身 click-through、条目的直接子元素自动恢复 pointer-events」
处理好了，所以收起时不会有任何东西挡着页面。

**入口只有一个**：输入框工具行左侧那个终端按钮（加 Ctrl+`）。侧边栏里刻意不放任何东西 ——
终端只在对话区这一块，左栏底部那个入口按钮是特意去掉的（`sidebar.footer.action` 不注册）。

## 打开面板 = 有一个能用的终端

打开面板（Ctrl+`、那个按钮、或面板挂在页面上时）时，**如果宿主里一个终端都没有，就自动建一个**
（`store.ensureTerminal()`）。所以：

| 操作 | 结果 |
| --- | --- |
| 空状态下按 Ctrl+` | 建一个终端并展开 —— 不会按出一个空面板 |
| 有终端时按 Ctrl+` | 收起；再按一次复用已有终端，**不会**再建 |
| 点 **+** | 再开一个（不受这条规则影响） |
| 关掉多个中的一个 | 只删那一个 |
| 关掉**最后**一个 | 立刻补一个新终端，面板不空着（要空面板就按 Ctrl+` 收起） |
| 刷新页面 | 先与宿主对账；宿主里没有终端时才建 |
| 把 `autoCreateTerminals` 设为 false | 关掉最后一个 = 照 VSCode 的行为连面板一起收起 |

配置项 `autoCreateTerminals`（默认 true）可以关掉这条行为。

## 新终端落在哪个目录

**跟你正在看的工作区走**（VSCode 里集成终端的 cwd 是工作区文件夹，这里同理）：

| 优先级 | 来源 |
| --- | --- |
| 1 | 插件配置里写死的 `cwd`（支持 `{cwd}` 记号） |
| 2 | **当前会话所属工作区的路径** —— 客户端把「我正在看哪条会话」报到 `POST /terminals`，宿主在 `ctx.workspaceRegistry.list()` 里找到账下含这条会话的工作区（`sessionIds` 命中），用它的 canonical `path` |
| 3 | 会话头里的 `cwd`（`ctx.sessions.get(id).header.cwd`）—— 工作区账目还没建立时按路径比对 |
| 4 | 宿主进程的工作目录（都没有时） |

所以在 `DC-new-org` 工作区里按 Ctrl+`，终端就在 `D:\desktop\repos\DC-new-org` 里，
提示符直接是那个目录。

**为什么要绕一圈把 sessionId 报上去**：一个 `dsh web` 进程里同时会存在多个会话（每个工作区
一条），而 `ctx.sessions.list()` 的顺序没有语义 —— 宿主自己猜不出「用户在看哪个工作区」。
`conversation.input.left` 是**会话级**槽位，框架会把当前 `sessionId` 注入按钮，按钮再同步
给面板 store，新建终端时带上它。工作区账目（`sessionIds`）比会话 cwd 更权威：它做过 header
校验，而且工作区下可以有多条会话。

## 终端数据流

```
浏览器 xterm.js  ⇄  WebSocket  ⇄  宿主 PtySession  ⇄  node-pty / ConPTY  ⇄  shell
```

- **一条连接一个终端**：背压天然隔离，一个终端的洪水输出不会拖住别的终端。
- **回放不靠终端栅格模拟**：宿主只保留最近 `scrollbackBytes` 字节的原始输出，重连时整段
  重发，由 xterm 自己重新解析。这比在宿主里跑 `@xterm/headless` 简单一个数量级，也是
  xterm 自己的标准用法（刷新页面后重放 scrollback 是它的常规场景）。代价是被丢掉的中间
  输出不可恢复 —— 由 `truncated` 标记如实告诉用户。
- **PTY 活在宿主进程里**：刷新页面、网络抖动都不会杀掉终端，重连后终端看上去「一直在那儿」。

### 线路协议

一个 WebSocket（`<mountPrefix>/ws`），文本帧，每帧一个 JSON 对象；判别联合声明在
`src/protocol.ts`，宿主与浏览器**共用同一份**，不会两边各写一遍而慢慢漂移。

| 客户端 → 服务端 | 含义 |
| --- | --- |
| `attach { terminalId, cols, rows }` | 绑定到一个终端，宿主立刻回 `hello` + 回放内容 |
| `write { terminalId, data }` | 原样写 stdin（含控制字符） |
| `resize { terminalId, cols, rows }` | 上报新尺寸 |
| `detach { terminalId }` | 解绑但保留终端 |

| 服务端 → 客户端 | 含义 |
| --- | --- |
| `hello { terminal, buffer, truncated }` | attach 成功后的状态与回放 |
| `output { terminalId, data }` | UTF-8 文本增量 |
| `title { terminalId, title }` | 从输出里解析出的 OSC 0/2 标题 |
| `exit { terminalId, exitCode }` | 进程退出 |
| `error { code, message }` | `NO_TERMINAL` / `TOO_MANY_TERMINALS` / `SPAWN_FAILED` / `BAD_REQUEST` / `INTERNAL` |

HTTP 侧（都在 `<mountPrefix>` 下）：`POST /terminals` 创建（body 可带 `sessionId` 与 `cwd`）、
`GET /terminals` 列出、`DELETE /terminals/<id>` 关闭、`GET /assets/<file>` 静态资源。

## 安全边界

终端等价于「用户自己的 shell」，所以**认证必须跟着页面走**，不能只有一句「仅回环」：

- 每个请求（含升级握手）都先过 `ctx.connection.requestRejection` —— 那正是产品自己给
  `/api` 用的那套「Host/Origin 栅栏 + 浏览器 Cookie」。`ctx.connection` 缺席的极少数组合
  退回「只接受回环 Host」的降级判定，并在日志里说明。
- 因此本插件在 `0.0.0.0` 部署下**不会**变成一个裸的远程 shell。
- 路由一律挂在自己的前缀下（`config.mountPrefix`，默认 `/dsh-terminal`），不和产品路由抢位置。
- 客户端拿到的路径前缀来自宿主注入的引导脚本（`window.__DSH_TERMINAL_PLUGIN__`），所以前缀
  可配置而两端不会不同步。

## 界面图标

面板工具栏的两个按钮用设计给的 **48×48 线性 svg**（内联在 `src/client/toggle-button.tsx` 里，
不依赖任何图标包）：

| 位置 | 图标 | 路径 |
| --- | --- | --- |
| 新建终端 | 加号 | `M24.0605 10L24.0239 38` + `M10 24L38 24` |
| 收起面板 | 向下箭头 | `M36 18L24 30L12 18` |

只把设计稿里写死的 `stroke="#000000"` 换成 `currentColor`，好让图标跟随 DSH 的主题令牌
（亮/暗切换时不会变成死色）；`viewBox`、线宽、圆角端帽都原样保留。

## 构建

```bash
node scripts/link-deps.mjs   # 一次性：把工作区缺的依赖符号链接到 profile 的依赖树
npm run vendor               # 一次性：把 xterm.js 产物复制进 vendor/（需要网络）
npm run build                # 宿主 + 客户端 + 测试产物 + 静态资源清单
npm test                     # 65 个用例 / 5 个文件
```

**宿主半边是进程内加载的，改完必须重启 `dsh web` 才会生效**（客户端半边刷新页面即可）。

### 三个产物

| 产物 | 形态 | 构建期校验 |
| --- | --- | --- |
| `lib/index.js` | Node 直接 import 的 ESM | `node --check` + 真实 `import()`（要看到 `name`/`inject`/`apply`/`Config`） |
| `lib/client.js` | DSH 的 lazy-CJS 客户端插件 | 逐模块 + 整文件 `node --check` |
| `lib/selftest.js` | 同上，只为测试暴露内部纯函数 | 关键导出存在性 |
| `lib/assets.json` + 三个资源文件 | 静态资源清单与内容 | 清单里的文件都存在 |

`scripts/build.mjs` 是唯一入口，打包逻辑在 `scripts/bundler.mjs`（模块图与转写）+
`scripts/emit-host.mjs` / `scripts/emit-client.mjs`（两种包装）。类型剥除交给 Node 内置的
`stripTypeScriptTypes`，不引入构建期依赖。

**客户端产物不含 xterm**：那 345 KB 由宿主从 `<mountPrefix>/assets/xterm.mjs` 提供，
页面用一个 `<script type="module">` 把它挂到全局（见 `src/client/xterm-loader.ts`），
于是它走浏览器 HTTP 缓存，客户端 bundle 保持小体积。

### 手写打包器踩过的三个坑

这三个都在 `scripts/bundler.mjs` 里留下了注释，因为症状离原因都很远：

1. **`export { h, useState } from 'react'` 这类再导出必须折成模块绑定。** 模块之间靠命名空间
   对象取用，漏掉它就会拼出一个**空的命名空间**，运行期表现为
   `useSyncExternalStore is not a function`。
2. **语句边界不能按「出现过引号」判定。** `export {}` 没有引号，早先的实现会把它一路读到
   下一条语句，症状是命名空间莫名变空、或报「不支持的 import 形态」。
3. **归一化替换不能吞掉换行。** `splitImports` 靠「上一字符是换行」找语句起点，吞掉换行会
   让后面的解析整体走偏。

## 测试

`node --no-warnings test/run.mjs` 跑五个文件（零依赖，用 Node 自己的 `assert`）：

- `client-store.test.mjs` —— 面板状态与「自动建终端」的语义（不碰 DOM、不碰 React，只喂假
  fetch）：空面板按 Ctrl+` 会先建再展开、有终端时才是收起、关掉最后一个会立刻补一个、
  `ensureTerminal` 幂等、关掉 autoCreate 后收起面板、对账后不会重复创建、**新建终端会把
  当前会话报给宿主**（请求体里带着 `sessionId`）。
- `client-apply.test.mjs` —— 在 Node 里搭最小 lazy-CJS 宿主，**真的执行一遍 `apply`**：断言
  两处槽位注册（并断言侧边栏入口**没有**注册）、文案命名空间、按钮点击后的状态、**工具栏两个
  按钮用的是设计给的 48×48 svg 图标**（路径与 `viewBox` 原样保留、颜色走 `currentColor`，
  不是 `+`/`⌄` 文本）、面板展开时只压对话区（左右两栏都没有内联高度）、面板的 `left`/`width`
  与对话区**完全重合**、右栏展开时面板不越界、Ctrl+` 的拦截与收起还原，以及面板 CSS 里
  没有硬编码颜色。
- `host-bundle.test.mjs` —— 宿主接线：契约导出齐全、**路由与索引注入都延迟到 `webServer`
  就绪才注册**（这条钉住的是「`ctx.get('webServer')` 探一下」那个坑）、前缀可配置、资源清单
  可用，shell 探测 / 工作目录解析的优先级，以及**会话所属工作区的判定**（账目命中、路径比对、
  大小写在 win32 与 linux 下的差异、工作区目录都不存在时退回）。
- `pty-registry.test.mjs` —— 注入假 PTY：回放缓冲上限与 `truncated`、多订阅者扇出、OSC 标题、
  退出只通知一次、容量上限、`closeAll` 静默、`spawn` 参数透传。
- `wire-protocol.test.mjs` —— **真的起 HTTP/WebSocket 服务器**：创建/列出/关闭、409/404/400、
  401 拒绝、前缀外不归本插件、dispose 撤路由、`sessionId` 交给 `resolveCwd` 并成为 PTY 的 cwd、
  显式 `cwd` 优先、attach 回放、write→output、exit 帧、多订阅者、未 attach 即 write 被拒、
  升级握手被拒。

不测真 PTY：那需要 ConPTY 命名管道，在受限执行环境里会被拦（这也是本文档不把「起真终端」
写进自动化测试的原因）。真终端的验收见下。

## 安装

`cordis.patch.yml` 是给 `dsh plugin add` 用的补丁层。本机部署走的是
`$DSH_HOME/profiles/web/cordis.patch.yml` 里显式的一行：

```yaml
- insert:
    - id: dsh-terminal-plugin
      name: "file:///D:/desktop/repos/dsh-terminal-plugin/lib/index.js"
```

加完**重启 `dsh web`**（宿主半边在进程内加载），刷新页面，按 **Ctrl+`**。

## 手动验收清单

1. 空状态下按 Ctrl+` → 面板出现在**对话区下方**，且**自动建好一个终端**（提示符已经出来），
   **只占对话区那一块**：左右两侧的侧边栏一根像素都不占，面板的左右边缘与对话区完全对齐。
2. 再按 Ctrl+` → 收起；再按一次 → 直接复用那个终端（**不会**又建一个新的）。
3. 收起/展开左栏（或拖分隔条）、展开/收起右栏 → 面板跟着变位置变宽度，始终贴合对话区。
4. 侧边栏里**没有**终端入口（只在输入框工具行左侧有个终端图标）。
5. 切到别的**工作区**（例如 `DC-new-org`）再按 Ctrl+` → 新终端的提示符就在那个工作区的目录里
   （`D:\desktop\repos\DC-new-org`），而不是宿主进程或上一个工作区的目录。
6. 面板工具栏的「+」与「⌄」是线性 svg 图标，颜色跟随主题（切到暗色主题不会变成黑块）。
7. `echo hi`、`dir`、`python`、`vim` 各跑一次：颜色、光标、清屏、退出 vim 后画面还原。
8. 点 **+** 开第二个终端，来回切标签；`Ctrl+Shift+`` 也能新建。
9. 刷新页面 → 终端还在，且回放出了最近输出。
10. 关掉一个标签；关掉最后一个 → 立刻补一个新终端，面板不空着（按 Ctrl+` 收起面板）。
11. 任务管理器里对照关闭前后的 `pwsh` 进程数，确认没有孤儿进程。
12. 未带 Cookie 直接 `curl http://127.0.0.1:3080/dsh-terminal/terminals` → 401。

## 配置项

见 `src/config.ts`。常用：`mountPrefix`、`shellPath`（留空自动探测：Windows 先 `pwsh.exe`
再 `powershell.exe`，Unix 用 `$SHELL` 再 `/bin/bash`）、`shellArgs`、`cwd`（支持 `{cwd}`
记号；留空跟随当前会话的工作区）、`env`、`rows`/`cols`、`scrollbackBytes`、`maxTerminals`。

## 已知限制

- **拖分隔条不改 PTY 尺寸。** provider 的 seam（`SubprocessTerminalSpawnSpec.rows/cols`）没有
  暴露 resize 动词，真实实现（node-pty）有，但绕开 seam 去拿 provider 私有句柄会把
  「执行世界」的绑定（沙箱、Linux scope）一起绕掉。于是拖高之后 ConPTY 仍按旧宽度换行、
  全屏程序不会重排；新开的终端会按当时的尺寸。这是当前最明显的一处不足。
- **同一终端可能被开两条连接。** `shell.overlay` 与 `conversation.input.left` 是两个插槽、
  两个 React 子树，共用同一个 store 但各自按容器尺寸算 cols/rows。画面内容一致，尺寸以各自
  容器为准；服务端本来就支持多订阅者。
- **不自动关闭空闲终端。** 与 VSCode 一致，终端一直留着，由用户关。
- **会话不离线持久化。** PTY 活在宿主进程里，`dsh web` 退出就没了（页面刷新不受影响）。
- **CJK / emoji 宽度** 依赖 xterm 的宽度表与 ConPTY 的实现，极端字符可能错位。

## 明确不做

- 不做右侧/最大化停靠系统（只做底部面板，且只在对话区这一块）。
- 不把 agent 的 `bash`/`pwsh` 工具调用显示成终端标签（那是 `ctx.terminals` 的世界，
  与人的交互终端分开）。
- 不做 WebGL 渲染器、终端内链接点击、图片协议。
- 不修改产品仓库里任何 `@deepseek-ai/*` 包。
