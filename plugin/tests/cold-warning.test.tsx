import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.UTC(2026, 10, 7, 12, 0)
const MINUTE = 60 * 1000

function lastRequest(minutesAgo: number, promptTokens: number) {
  const request = { at: NOW - minutesAgo * MINUTE, model: 'claude-opus-5-5', promptTokens }
  return { value: { value: { shape: 'last-request-1', value: request }, version: 1 } }
}

function harness(on: On, minutesAgo: number, promptTokens: number) {
  const toasts: string[] = []
  const entered: string[] = []
  mock.clock(on, { now: NOW })
  on('state.get', { key: 'lastRequest' }, () => lastRequest(minutesAgo, promptTokens))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('prompt.submit', (_, e) => {
    entered.push(e.text)
    return { text: e.text }
  })
  return { toasts, entered }
}

/** A summary whose prices are not the built-in snapshot's: Opus 5.5 at twice its rates. */
function historyWithPrices() {
  const rates = { input: 8, write5m: 10, write1h: 16, read: 0.4, output: 40 }
  const summary = { cacheLifetimeMs: 3_600_000, prices: [{ id: 'claude-opus-5-5', rates }] }
  const history = { status: 'ready', summary, isRefreshing: false, refreshError: null }
  return { value: { value: { shape: 'history-10', value: history }, version: 1 } }
}

const typed = { text: 'fix the bug', wait: false, origin: { kind: 'composer' } } as const

test('a prompt over a cold cache goes out unchanged, with a warning', async ($, on) => {
  const { toasts, entered } = harness(on, 120, 84_000)

  const result = await $.prompt.submit(typed)

  expect(entered).toEqual(['fix the bug'])
  expect(result).toEqual({ text: 'fix the bug' })
  expect(toasts).toEqual([
    'cost-lens: the cache had expired, so this message re-writes 84.0k tokens ≈ $0.67 instead of $0.02. ' +
      'Next time, /compact before a long break or /clear to start fresh.',
  ])
})

for (const [label, minutesAgo, promptTokens] of [
  ['a warm cache', 10, 84_000],
  ['a small context', 120, 39_000],
] as const) {
  test(`no warning for ${label}`, async ($, on) => {
    const { toasts, entered } = harness(on, minutesAgo, promptTokens)

    await $.prompt.submit(typed)

    expect(entered).toEqual(['fix the bug'])
    expect(toasts).toEqual([])
  })
}

test('slash commands and prompts that are not typed by the person get no warning', async ($, on) => {
  const { toasts } = harness(on, 120, 84_000)

  await $.prompt.submit({ ...typed, origin: { kind: 'plugin', name: 'other' } })

  expect(toasts).toEqual([])
})

test('the warning prices the cache as the last summary did, not at the snapshot rates', async ($, on) => {
  const { toasts } = harness(on, 120, 84_000)
  on('state.get', { key: 'history' }, () => historyWithPrices())

  await $.prompt.submit(typed)

  expect(toasts[0]).toMatch(/re-writes 84\.0k tokens ≈ \$1\.34 instead of \$0\.03\./)
})
