/**
 * 测试收集器：`describe` 分组、`test` 注册、`run` 执行并汇总。
 *
 * 刻意保持极简：没有 watch、没有并发、没有 spy。测试文件自己带需要的最小替身
 * （DOM、fetch、PTY 句柄…），因为它们要守住的正是「在真实宿主里接线正确」这件事，
 * 而通用的 mock 库反而会把这份接线藏起来。
 *
 * @module dsh-terminal-plugin/test/harness
 */

/** 已注册的用例。 */
const cases = []

/** 当前 describe 前缀。 */
let suite = ''

/**
 * 注册一个测试。
 *
 * @param {string} name 测试名。
 * @param {() => void | Promise<void>} fn 测试体（抛错即失败）。
 * @returns {void}
 */
export function test(name, fn) {
  cases.push({ name: suite === '' ? name : `${suite} › ${name}`, fn })
}

/**
 * 注册一组测试（只影响显示名）。
 *
 * @param {string} name 组名。
 * @param {() => void} body 组体，内部调用 `test`。
 * @returns {void}
 */
export function describe(name, body) {
  const previous = suite
  suite = previous === '' ? name : `${previous} › ${name}`
  body()
  suite = previous
}

/**
 * 执行所有已注册的用例。
 *
 * @param {number} fileCount 测试文件数，只用于汇总显示。
 * @returns {Promise<number>} 进程退出码（0 全绿）。
 */
export async function run(fileCount) {
  let passed = 0
  /** @type {{ name: string, error: unknown }[]} */
  const failures = []
  for (const entry of cases) {
    try {
      await entry.fn()
      passed += 1
      process.stdout.write(`  ✓ ${entry.name}\n`)
    } catch (error) {
      failures.push({ name: entry.name, error })
      process.stdout.write(`  ✗ ${entry.name}\n`)
    }
  }
  process.stdout.write(`\n${String(passed)}/${String(cases.length)} 通过（${String(fileCount)} 个文件）\n`)
  for (const failure of failures) {
    const detail = failure.error instanceof Error ? failure.error.stack ?? failure.error.message : String(failure.error)
    process.stdout.write(`\n✗ ${failure.name}\n${detail}\n`)
  }
  return failures.length > 0 ? 1 : 0
}
