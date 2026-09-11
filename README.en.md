# dsh-terminal-plugin

[English](README.en.md) | [中文](README.md)

A VS Code-style bottom terminal panel for the DeepSeek Harness (DSH) Web GUI.

- Press `Ctrl+\`` to show or hide the panel.
- Run multiple terminal tabs; press `Ctrl+Shift+\`` to create a new one.
- Uses a real PTY, so colours, cursor control, the alternate screen, and interactive programs such as `vim`, `python`, and `top` work as expected.
- Occupies only the central conversation area and never squeezes either sidebar.
- URLs and file paths in the output open with `Ctrl`/`Cmd` + click.
- Terminal sessions survive page refreshes and replay recent output after reconnecting.

> This is an interactive terminal for the person using the web page. It is separate from DSH agent persistent terminals exposed as `ctx.terminals`.

## Requirements

- Node.js 20 or later
- `@deepseek-ai/dsh` with the Web profile, installed or runnable through `npx`
- PowerShell 7 on Windows (recommended; Windows PowerShell is used as a fallback)

`ws` is installed as a package dependency. Building also requires linking peer dependencies from the DSH profile.

## Install and build

Run the following from the repository root:

```bash
npm run link-deps  # once: link dependencies from the DSH profile
npm run vendor     # once: download and copy xterm.js assets
npm run build      # build the host, client, and static assets
npm test           # run the test suite
```

This repository contains only the plugin; it does not provide the `dsh` command. First confirm that the DSH CLI is available:

```bash
npx @deepseek-ai/dsh --help
```

Use the DSH CLI to add the package to the Web profile and mount the bundled `cordis.patch.yml`:

```bash
npx @deepseek-ai/dsh plugin --profile web add /path/to/dsh-terminal-plugin
npx @deepseek-ai/dsh plugin --profile web add git+https://github.com/zjuatri/dsh-terminal-plugin.git
```

If `@deepseek-ai/dsh` is installed globally, replace `npx @deepseek-ai/dsh` at the start of each command with `dsh`.

For a local checkout that needs to be mounted manually, add the following entry to the Web profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-terminal-plugin
      name: "file:///absolute/path/to/dsh-terminal-plugin/lib/index.js"
```

Restart `dsh web` after installing or changing the host-side plugin. A browser refresh is sufficient for client-only UI changes.

## Usage

1. Open the DSH Web GUI, then click the terminal button in the composer toolbar or press `Ctrl+\``.
2. The first open automatically creates a terminal. Use the `+` button in the panel toolbar to add tabs.
3. New terminals use the workspace associated with the current session as their working directory. If that cannot be determined, they fall back to the DSH process working directory.
4. By default, closing the final tab immediately creates a replacement so the visible panel is never empty. Hide the panel with `Ctrl+\`` when it is not needed.

Terminal sessions run in the DSH host process. Refreshing the browser, a brief network interruption, or hiding and reopening the panel does not stop running commands.

### Following links

Links in the output are underlined and show a pointer cursor. **Hold `Ctrl` (`Cmd` on macOS)
and click** to open one, matching the VS Code integrated terminal:

| Detected | Example | Opens as |
| --- | --- | --- |
| URL with a scheme | `http://localhost:3000`, `https://example.com/a?b=1` | a new tab |
| Bare `localhost` address | `localhost:5173/app` (how dev servers usually print it) | `http://` is added, then a new tab |
| Absolute file path | `D:\repo\src\index.ts:12:3`, `/home/u/app/main.js:7` | a `file://` address (the line and column are left for the editor) |

For safety only `http`, `https`, and `ftp` are opened; `javascript:`, `data:`, and `file:` are
never opened, because terminal output is untrusted content and must not become a code-execution
entry point. Relative paths such as `./a.ts` are not treated as links either, since there is no
base directory to resolve them against.

## Configuration

The following options are commonly useful:

| Option | Default | Description |
| --- | --- | --- |
| `mountPrefix` | `/dsh-terminal` | HTTP and WebSocket path prefix for the plugin |
| `shellPath` | auto-detected | Absolute path to the interactive shell |
| `shellArgs` | auto-selected | Shell start-up arguments |
| `cwd` | current workspace | Working directory for new terminals; supports the `{cwd}` placeholder |
| `env` | `{}` | Additional environment variables |
| `rows` / `cols` | `24` / `80` | Initial terminal dimensions |
| `scrollbackBytes` | `262144` | Output bytes retained for reconnect replay |
| `idleCloseAfterMs` | `0` | Time without attachments before closing; `0` disables automatic closing |
| `maxTerminals` | `20` | Maximum simultaneous terminal sessions |

See [`src/config.ts`](src/config.ts) for the complete configuration definition.

## Security

A terminal is equivalent to a shell opened by the user on the host machine, so only trusted users should have access. Its HTTP and WebSocket requests reuse DSH Web's Host/Origin checks and Cookie authentication. In the uncommon environments where that capability is unavailable, only loopback requests are accepted.

Do not expose the plugin endpoint to untrusted networks or bypass DSH authentication.

## Known limitations

- Resizing the panel does not resize an already-running PTY; a newly created terminal uses the current dimensions.
- Input is shared when the same terminal is open in multiple browser connections, so the intended use is single-user.
- Only the most recent `scrollbackBytes` of output is replayed; older output cannot be restored.
- A long URL that the terminal wraps is not joined across lines: each segment is matched on its own, so only the part that is a valid URL by itself can be clicked.

## Development

Source files are in `src/`; build artifacts are in `lib/`. Before committing, run:

```bash
npm run build
npm test
```

The project is licensed under [MIT](LICENSE). Bundled xterm.js and its add-on are also MIT licensed; see [`vendor/README.md`](vendor/README.md).
