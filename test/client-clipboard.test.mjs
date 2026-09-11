/**
 * 右键行为的测试：有选中就复制，没选中就粘贴。
 *
 * 不碰真剪贴板（那需要权限与用户手势），而是注入一个假的 clipboard，把鼠标右键用替身 DOM
 * 冒泡一次，断言「按了哪个分支、传了什么文本、有没有清选区」。真实终端里读剪贴板失败是静默的，
 * 这里也把「抛错不炸」钉住。
 */

import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, test } from './harness.mjs'
import { installDom, tick } from './stubs.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** 载入测试专用产物。 */
async function loadSelftest() {
  return await import(pathToFileURL(join(root, 'lib/selftest.js')).href)
}

/**
 * 造一个假终端。
 *
 * @param {{ selection?: string, clipboardText?: string, failRead?: boolean, failWrite?: boolean }} [options] 行为注入。
 * @returns {{ target: object, actions: string[], clipboard: object, state: object }} 测试对象。
 */
function makeTarget(options = {}) {
  const state = {
    selection: options.selection ?? '',
    cleared: 0,
    pasted: [],
  }
  const target = {
    /** 是否有选中。 */
    hasSelection: () => state.selection.length > 0,
    /** 取选中。 */
    getSelection: () => state.selection,
    /** 清选区（会记账）。 */
    clearSelection: () => { state.cleared += 1; state.selection = '' },
    /** 粘贴（会记账）。 */
    paste: (text) => { state.pasted.push(text) },
  }
  const written = []
  const clipboard = {
    /** 读剪贴板。 */
    async readText() {
      if (options.failRead === true) throw new Error('denied')
      return options.clipboardText ?? ''
    },
    /** 写剪贴板。 */
    async writeText(text) {
      if (options.failWrite === true) throw new Error('denied')
      written.push(text)
    },
  }
  return { target, actions: [], clipboard, state, written }
}

/** 造一个面板容器，并把终端放进它里面。 */
function makeContainer() {
  const dom = installDom()
  const container = dom.document.createElement('div')
  container.className = 'dsh-term-view'
  dom.document.body.appendChild(container)
  const inner = dom.document.createElement('div')
  inner.className = 'xterm-screen'
  container.appendChild(inner)
  return { dom, container, inner }
}

/** 造一个右键事件（`preventDefault` 会记账）。 */
function contextMenuEvent() {
  const event = {
    type: 'contextmenu',
    defaultPrevented: false,
    stopped: false,
    preventDefault() { this.defaultPrevented = true },
    stopPropagation() { this.stopped = true },
  }
  return event
}

describe('终端右键', () => {
  test('有选中 → 复制并清选区', async () => {
    const { attachContextMenu } = await loadSelftest()
    const { dom, container, inner } = makeContainer()
    try {
      const { target, actions, clipboard, state, written } = makeTarget({ selection: 'npm run dev' })
      const detach = attachContextMenu(target, container, { clipboard, onAction: action => actions.push(action) })
      const event = contextMenuEvent()
      dom.bubble(inner, 'contextmenu', event)
      await tick()
      assert.deepEqual(written, ['npm run dev'], '选区内容应当写进剪贴板')
      assert.deepEqual(actions, ['copied'])
      assert.equal(state.cleared, 1, '复制后应当清掉选区')
      assert.equal(event.defaultPrevented, true, '右键必须拦掉浏览器菜单')
      assert.equal(event.stopped, true)
      assert.deepEqual(state.pasted, [], '复制分支不该粘贴')
      detach()
    } finally {
      dom.cleanup()
    }
  })

  test('没有选中 → 读剪贴板并粘贴（交给 xterm 的 paste）', async () => {
    const { attachContextMenu } = await loadSelftest()
    const { dom, container, inner } = makeContainer()
    try {
      const { target, actions, clipboard, state, written } = makeTarget({ clipboardText: 'ls -la\n' })
      const detach = attachContextMenu(target, container, { clipboard, onAction: action => actions.push(action) })
      const event = contextMenuEvent()
      dom.bubble(inner, 'contextmenu', event)
      await tick()
      assert.deepEqual(state.pasted, ['ls -la\n'], '剪贴板内容应当原样交给 paste()')
      assert.deepEqual(actions, ['pasted'])
      assert.deepEqual(written, [], '粘贴分支不该写剪贴板')
      assert.equal(state.cleared, 0)
      assert.equal(event.defaultPrevented, true)
      detach()
    } finally {
      dom.cleanup()
    }
  })

  test('剪贴板为空时什么都不做（但依然拦掉浏览器菜单）', async () => {
    const { attachContextMenu } = await loadSelftest()
    const { dom, container, inner } = makeContainer()
    try {
      const { target, actions, clipboard, state } = makeTarget({ clipboardText: '' })
      const detach = attachContextMenu(target, container, { clipboard, onAction: action => actions.push(action) })
      const event = contextMenuEvent()
      dom.bubble(inner, 'contextmenu', event)
      await tick()
      assert.deepEqual(state.pasted, [])
      assert.deepEqual(actions, [])
      assert.equal(event.defaultPrevented, true)
      detach()
    } finally {
      dom.cleanup()
    }
  })

  test('读/写剪贴板被拒时不抛错、不改状态', async () => {
    const { attachContextMenu } = await loadSelftest()
    const { dom, container, inner } = makeContainer()
    try {
      // 写失败：保留选区，用户还能重试
      const failedWrite = makeTarget({ selection: 'keep me', failWrite: true })
      const detachWrite = attachContextMenu(failedWrite.target, container, { clipboard: failedWrite.clipboard })
      dom.bubble(inner, 'contextmenu', contextMenuEvent())
      await tick()
      assert.equal(failedWrite.state.cleared, 0, '写失败时不该清选区')
      detachWrite()

      // 读失败：不粘贴、不报错
      const failedRead = makeTarget({ failRead: true })
      const detachRead = attachContextMenu(failedRead.target, container, { clipboard: failedRead.clipboard })
      dom.bubble(inner, 'contextmenu', contextMenuEvent())
      await tick()
      assert.deepEqual(failedRead.state.pasted, [])
      detachRead()
    } finally {
      dom.cleanup()
    }
  })

  test('容器之外的右键不接管（浏览器菜单照旧）', async () => {
    const { attachContextMenu } = await loadSelftest()
    const { dom, container } = makeContainer()
    try {
      const { target, clipboard, state } = makeTarget({ clipboardText: 'x' })
      const detach = attachContextMenu(target, container, { clipboard })
      const outside = dom.document.createElement('button')
      dom.document.body.appendChild(outside)
      const event = contextMenuEvent()
      dom.bubble(outside, 'contextmenu', event)
      await tick()
      assert.equal(event.defaultPrevented, false, '面板外的右键不该被拦')
      assert.deepEqual(state.pasted, [])
      detach()
    } finally {
      dom.cleanup()
    }
  })

  test('disposer 之后不再接管', async () => {
    const { attachContextMenu } = await loadSelftest()
    const { dom, container, inner } = makeContainer()
    try {
      const { target, clipboard, state } = makeTarget({ clipboardText: 'x' })
      const detach = attachContextMenu(target, container, { clipboard })
      detach()
      const event = contextMenuEvent()
      dom.bubble(inner, 'contextmenu', event)
      await tick()
      assert.equal(event.defaultPrevented, false)
      assert.deepEqual(state.pasted, [])
    } finally {
      dom.cleanup()
    }
  })
})
