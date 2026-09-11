# vendor/

这些文件是第三方构建输入，**不要手工编辑**。由 `node scripts/vendor-xterm.mjs` 从
npm 取回并复制进来；`scripts/build.mjs` 只读本地文件，所以日常构建不需要网络。

| 文件 | 来源 | 许可证 |
| --- | --- | --- |
| xterm@6.0.0 | @xterm/xterm@6.0.0 | MIT |
| addon-fit@0.11.0 | @xterm/addon-fit@0.11.0 | MIT |

升级步骤：改上面的包版本号 → 重跑 `node scripts/vendor-xterm.mjs` → `npm run build`。

为什么是这三个文件：

- `xterm.mjs` —— 浏览器版终端模拟器（DOM 渲染器），宿主从
  `GET <mountPrefix>/assets/xterm.mjs` 提供给页面。它没有任何 import、也没有动态
  import，只有一个末尾的 `export { … as Terminal }`，所以既能被 `<script type="module">`
  直接加载，也能在必要时内联进客户端产物。
- `addon-fit.mjs` —— 按容器尺寸算 cols/rows；拖分隔条时必须靠它重算。
- `xterm.css` —— xterm 自己的排版与滚动条样式，必须随终端一起注入。

许可证：三者都是 MIT，原文见同目录的 `LICENSE.xterm` 与 `LICENSE.addon-fit`。
