# dsh-terminal-plugin

为 DeepSeek Harness（DSH）Web GUI 提供一个 VS Code 风格的底部终端面板。

- 按 `Ctrl+\`` 打开或收起面板
- 支持多终端标签和 `Ctrl+Shift+\`` 新建终端
- 使用真实 PTY：颜色、光标控制、备用屏以及 `vim`、`python`、`top` 等交互程序均可正常运行
- 终端面板只占中间对话区，不会挤压左右侧边栏
- 刷新页面后终端仍会保留，并回放近期输出

> 这是供页面使用者操作的终端，不是 DSH agent 使用的 `ctx.terminals` 持久终端。

## 环境要求

- Node.js 20 或更高版本
- 已安装带 Web profile 的 `@deepseek-ai/dsh`
- PowerShell 7（Windows 推荐；缺失时会回退到 Windows PowerShell）

`ws` 会随本插件依赖安装；构建时还需要从 DSH profile 链接 peer dependencies。

## 安装与构建

在仓库根目录执行：

```bash
npm run link-deps  # 一次性：链接 DSH profile 中的依赖
npm run vendor     # 一次性：下载并复制 xterm.js 资源
npm run build      # 构建宿主、客户端和静态资源
npm test           # 运行测试
```

用 `dsh plugin add` 安装时，包内的 `cordis.patch.yml` 会注册插件。若使用本地源码，可在 Web
profile 的 `cordis.patch.yml` 中加入下面这一项：

```yaml
- insert:
    - id: dsh-terminal-plugin
      name: "file:///绝对路径/dsh-terminal-plugin/lib/index.js"
```

修改或安装宿主端后，请重启 `dsh web`；只修改客户端界面时，刷新浏览器页面即可。

## 使用方式

1. 打开 DSH Web GUI，点击输入框工具栏中的终端按钮，或按 `Ctrl+\``。
2. 首次打开时会自动创建一个终端；点击面板工具栏中的 `+` 可新建标签。
3. 终端默认使用当前会话所属的工作区作为工作目录。若无法识别工作区，则回退到 DSH 进程的工作目录。
4. 关闭最后一个标签时，默认会立即创建一个新的终端，避免面板变为空状态；收起面板即可暂时隐藏它。

终端会话运行在 DSH 宿主进程中，因此浏览器刷新、短暂断网或重新打开面板都不会终止正在运行的命令。

## 配置

在插件配置中可设置以下常用项：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `mountPrefix` | `/dsh-terminal` | 插件 HTTP 与 WebSocket 路径前缀 |
| `shellPath` | 自动探测 | 交互式 shell 的绝对路径 |
| `shellArgs` | 自动选择 | shell 启动参数 |
| `cwd` | 当前工作区 | 新终端工作目录；支持 `{cwd}` 占位符 |
| `env` | `{}` | 附加环境变量 |
| `rows` / `cols` | `24` / `80` | 初始终端尺寸 |
| `scrollbackBytes` | `262144` | 断线重连时保留的输出字节数 |
| `idleCloseAfterMs` | `0` | 无人连接多久后关闭；`0` 表示不自动关闭 |
| `maxTerminals` | `20` | 同时存在的终端上限 |

完整配置定义见 [`src/config.ts`](src/config.ts)。

## 安全说明

终端等同于用户在本机打开的 shell，应只向可信用户开放。插件的 HTTP 与 WebSocket 请求会复用
DSH Web 的 Host/Origin 校验和 Cookie 认证；在缺少该能力的少数组合中，只接受回环地址请求。

请勿将插件端口直接暴露给不受信任的网络，也不要绕过 DSH 的认证配置。

## 已知限制

- 拖动面板高度不会调整已运行 PTY 的行列数；新建终端会采用当时的尺寸。
- 同一终端在多个浏览器连接中同时打开时，输入会共享，适合单人使用场景。
- 输出回放只保留最近 `scrollbackBytes` 字节，较早内容无法恢复。

## 开发说明

源码位于 `src/`，构建产物位于 `lib/`。提交前建议执行：

```bash
npm run build
npm test
```

许可证为 [MIT](LICENSE)。随插件分发的 xterm.js 及其适配器同样采用 MIT；详见
[`vendor/README.md`](vendor/README.md)。
